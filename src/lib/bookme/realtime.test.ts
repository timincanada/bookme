import assert from "node:assert/strict";
import {
  BOOKME_VOICE_TOOL,
  REALTIME_WS_URL,
  VOICE_ID,
  VOICE_SAMPLE_RATE,
  base64ToPcm16,
  compactVoiceToolResult,
  eventKind,
  extractClientSecret,
  floatToPcm16,
  parseToolText,
  pcm16ToBase64,
  pcm16ToFloat,
  resampleFloat,
  voiceInstructions,
  voiceSessionUpdate,
  websocketProtocols,
} from "./realtime.ts";

assert.equal(VOICE_SAMPLE_RATE, 24_000);
assert.equal(VOICE_ID, "eve");
assert.equal(REALTIME_WS_URL.includes("grok-voice-latest"), true);

assert.deepEqual(websocketProtocols("tok_abc"), ["xai-client-secret.tok_abc"]);
assert.deepEqual(websocketProtocols("xai-client-secret.tok_abc"), ["xai-client-secret.tok_abc"]);
assert.deepEqual(websocketProtocols("  "), []);

assert.equal(extractClientSecret(null), null);
assert.equal(extractClientSecret({ value: "sec_1" })?.token, "sec_1");
assert.equal(extractClientSecret({ client_secret: { value: "sec_2", expires_at: 99 } })?.token, "sec_2");
assert.equal(extractClientSecret({ client_secret: { value: "sec_2", expires_at: 99 } })?.expiresAt, 99);
assert.equal(extractClientSecret({ client_secret: "sec_3" })?.token, "sec_3");
assert.equal(extractClientSecret({ value: { nested: true } }), null);

assert.equal(parseToolText('{"text":"openings this week"}'), "openings this week");
assert.equal(parseToolText('{"request":"email Maya"}'), "email Maya");
assert.equal(parseToolText("just talk"), "just talk");
assert.equal(parseToolText(""), "");

assert.deepEqual(compactVoiceToolResult({ ok: false, error: "Nope" }), {
  ok: false,
  status: "error",
  error: "Nope",
});
assert.equal(compactVoiceToolResult({ ok: true, needsConfirm: true, summary: "Email Maya?" }).status, "awaiting_confirm");
assert.equal(
  compactVoiceToolResult({
    ok: true,
    message: "huge",
    preview: { groups: [{ label: "Mon", lines: ["10:00", "11:00"] }] },
  }).status,
  "openings",
);
assert.equal(compactVoiceToolResult({ ok: true, message: "Sent." }).status, "done");

assert.equal(eventKind("ping"), "ping");
assert.equal(eventKind("input_audio_buffer.speech_started"), "speech_started");
assert.equal(eventKind("response.output_audio.delta"), "audio");
assert.equal(eventKind("response.audio.delta"), "audio");
assert.equal(eventKind("response.output_audio_transcript.delta"), "out_delta");
assert.equal(eventKind("conversation.item.input_audio_transcription.completed"), "in_done");
assert.equal(eventKind("response.function_call_arguments.done"), "tool");
assert.equal(eventKind("response.done"), "response_done");
assert.equal(eventKind("error"), "error");

const inst = voiceInstructions("Alex Rivera");
assert.equal(inst.includes("Alex Rivera"), true);
assert.equal(inst.includes("bookme_action"), true);
assert.equal(inst.includes("awaiting_confirm"), true);
assert.equal(inst.includes("You are Assistant,"), true);

const named = voiceInstructions("Alex Rivera", "Maya");
assert.equal(named.includes("You are Maya,"), true);
assert.equal(named.includes("Alex Rivera"), true);

const update = voiceSessionUpdate("Alex Rivera");
assert.equal(update.type, "session.update");
assert.equal(update.session.voice, "eve");
assert.equal(update.session.turn_detection.type, "server_vad");
assert.equal(update.session.turn_detection.interrupt_response, true);
assert.equal(update.session.audio.input.format.rate, 24_000);
assert.equal(update.session.tools[0].name, BOOKME_VOICE_TOOL.name);
assert.equal(update.session.instructions.includes("XAI_API_KEY"), false);

const sine = new Float32Array(8).map((_, i) => (i < 4 ? 0.5 : -0.5));
const pcm = floatToPcm16(sine);
assert.equal(pcm.length, 8);
assert.equal(pcm[0]! > 0, true);
assert.equal(pcm[7]! < 0, true);
const back = pcm16ToFloat(pcm);
assert.equal(Math.abs(back[0]! - 0.5) < 0.01, true);

const round = base64ToPcm16(pcm16ToBase64(pcm));
assert.equal(round.length, pcm.length);
assert.equal(round[0], pcm[0]);
assert.equal(round[7], pcm[7]);

const up = resampleFloat(new Float32Array([0, 1]), 24_000, 48_000);
assert.equal(up.length, 4);
assert.equal(up[0], 0);
assert.equal(Math.abs(up[up.length - 1]! - 1) < 0.01, true);
const same = resampleFloat(sine, 24_000, 24_000);
assert.equal(same, sine);

console.log("realtime.test.ts ok");
