import { DEFAULT_ASSISTANT_NAME, normalizeAssistantName } from "./assistant-name.ts";

export const VOICE_SAMPLE_RATE = 24_000;
export const VOICE_ID = "eve";
export const VOICE_MODEL = "grok-voice-latest";
export const REALTIME_WS_URL = "wss://api.x.ai/v1/realtime?model=" + VOICE_MODEL;
export const TOKEN_TTL_SECONDS = 300;

export const BOOKME_VOICE_TOOL = {
  type: "function" as const,
  name: "bookme_action",
  description:
    "Look up openings or the upcoming schedule, email a student, move a lesson, cancel a lesson, swap two students' times, or block hours. Call this whenever the coach asks about schedule, students, availability, email, cancelling, hours, or a time swap.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "The coach's request in plain words, as they would type it. Examples: openings this week, what's on my schedule, cancel Jordan on Tuesday, email Maya about Tuesday, swap Emma and Jordan, block Thursday afternoon.",
      },
    },
    required: ["text"],
  },
};

export function voiceInstructions(coachName: string, assistantName?: string) {
  const name = String(coachName || "the coach").trim() || "the coach";
  const asst = normalizeAssistantName(assistantName || DEFAULT_ASSISTANT_NAME);
  return [
    "You are " + asst + ", the BookMe scheduling assistant for " + name + ".",
    "On screen you appear as " + asst + ". Student emails are from " + name + ", never from you. Sign drafts as " + name + ".",
    "You are on a live voice call. Keep replies short — one or two spoken sentences.",
    "You can list openings, list the upcoming schedule, email a student, move a lesson, cancel a lesson, propose a time swap, or block hours.",
    "When the coach asks about schedule, students, hours, email, openings, cancelling, or swapping two lesson times, call bookme_action with their request as text.",
    "Never invent openings, student names, or lesson times — always call the tool.",
    "Never say you cannot. If they want a lesson cancelled, call the tool. Confirm on the screen before anything is sent or changed.",
    'Never claim you sent an email or changed hours unless the tool result status is "done".',
    'If status is "awaiting_confirm", tell them to confirm on the screen. Do not say it is done.',
    "If they speak Chinese, reply in Chinese. Otherwise English.",
    "If what you hear sounds like background TV, radio, or other people not talking to you, ignore it and stay silent.",
    "Do not mention tools, APIs, models, or that you are an AI.",
  ].join(" ");
}

export function voiceSessionUpdate(coachName: string, assistantName?: string) {
  return {
    type: "session.update" as const,
    session: {
      voice: VOICE_ID,
      instructions: voiceInstructions(coachName, assistantName),
      turn_detection: {
        type: "server_vad" as const,
        // Raised from 0.5 / 400ms so TV, radio, and nearby conversation don't start a turn.
        // prefix_padding_ms stays 300 so the onset of a real word is kept.
        // xAI documents no server noise_reduction field — do not send one.
        // The live mic also uses echo cancellation, noise suppression, and auto gain.
        threshold: 0.7,
        prefix_padding_ms: 300,
        silence_duration_ms: 700,
        create_response: true,
        interrupt_response: true,
      },
      audio: {
        input: {
          format: { type: "audio/pcm", rate: VOICE_SAMPLE_RATE },
          transcription: { model: "grok-transcribe" },
        },
        output: { format: { type: "audio/pcm", rate: VOICE_SAMPLE_RATE } },
      },
      tools: [BOOKME_VOICE_TOOL],
    },
  };
}

export function extractClientSecret(body: unknown): { token: string; expiresAt?: number } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const nested =
    o.client_secret && typeof o.client_secret === "object"
      ? (o.client_secret as Record<string, unknown>)
      : null;
  const raw = o.value ?? nested?.value ?? (typeof o.client_secret === "string" ? o.client_secret : "");
  const token = String(raw || "").trim();
  if (!token || token === "[object Object]") return null;
  const expiresAt = Number(o.expires_at ?? nested?.expires_at ?? 0);
  return { token, expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : undefined };
}

export function websocketProtocols(token: string): string[] {
  const raw = String(token || "").trim();
  if (!raw) return [];
  if (raw.startsWith("xai-client-secret.")) return [raw];
  return ["xai-client-secret." + raw];
}

export function parseToolText(args: string): string {
  const raw = String(args || "").trim();
  if (!raw) return "";
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const text = o.text ?? o.request ?? o.query ?? o.message;
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch {
    /* plain text */
  }
  return raw;
}

export function compactVoiceToolResult(res: {
  ok: boolean;
  error?: string;
  needsConfirm?: boolean;
  summary?: string;
  message?: string;
  preview?: { groups?: { label: string; lines: string[] }[] } | null;
}) {
  if (!res.ok) return { ok: false as const, status: "error" as const, error: res.error || "Something went wrong." };
  if (res.needsConfirm) {
    return { ok: true as const, status: "awaiting_confirm" as const, summary: res.summary || "Confirm on the screen." };
  }
  const groups = res.preview?.groups;
  if (groups?.length) {
    return {
      ok: true as const,
      status: "openings" as const,
      days: groups.map((g) => ({ label: g.label, slots: g.lines.slice(0, 8) })),
    };
  }
  return { ok: true as const, status: "done" as const, message: res.message || res.summary || "Done." };
}

export function eventKind(type: string) {
  const t = String(type || "");
  if (t === "ping") return "ping";
  if (t === "input_audio_buffer.speech_started" || t === "speech_started") return "speech_started";
  if (t === "input_audio_buffer.speech_stopped" || t === "speech_stopped") return "speech_stopped";
  if (t === "response.output_audio.delta" || t === "response.audio.delta" || t === "output_audio.delta") return "audio";
  if (
    t === "response.output_audio_transcript.delta" ||
    t === "response.audio_transcript.delta" ||
    t === "response.output_text.delta" ||
    t === "response.text.delta"
  )
    return "out_delta";
  if (t === "response.output_audio_transcript.done" || t === "response.audio_transcript.done" || t === "response.output_text.done")
    return "out_done";
  if (
    t === "conversation.item.input_audio_transcription.updated" ||
    t === "input_audio_transcription.updated"
  )
    return "in_update";
  if (t === "conversation.item.input_audio_transcription.delta" || t === "input_audio_transcription.delta") return "in_delta";
  if (
    t === "conversation.item.input_audio_transcription.completed" ||
    t === "conversation.item.input_audio_transcription.done"
  )
    return "in_done";
  if (t === "response.function_call_arguments.done") return "tool";
  if (t === "response.created") return "response_created";
  if (t === "response.done") return "response_done";
  if (t === "error") return "error";
  return "other";
}

export function resampleFloat(input: Float32Array, fromRate: number, toRate: number) {
  if (!fromRate || !toRate || fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  const last = input.length - 1;
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.min(last, Math.floor(src));
    const i1 = Math.min(last, i0 + 1);
    const t = src - i0;
    out[i] = input[i0]! * (1 - t) + input[i1]! * t;
  }
  return out;
}

export function floatToPcm16(input: Float32Array) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] || 0));
    out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return out;
}

export function pcm16ToFloat(input: Int16Array) {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = (input[i] || 0) / 32768;
  return out;
}

function bytesToB64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64ToBytes(b64: string) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function pcm16ToBase64(pcm: Int16Array) {
  return bytesToB64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}

export function base64ToPcm16(b64: string) {
  const bytes = b64ToBytes(b64);
  const copy = new Uint8Array(bytes.byteLength + (bytes.byteLength % 2));
  copy.set(bytes);
  return new Int16Array(copy.buffer, 0, Math.floor(copy.byteLength / 2));
}
