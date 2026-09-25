import {
  REALTIME_WS_URL,
  VOICE_SAMPLE_RATE,
  base64ToPcm16,
  eventKind,
  pcm16ToBase64,
  pcm16ToFloat,
  resampleFloat,
  floatToPcm16,
  voiceSessionUpdate,
  websocketProtocols,
} from "./realtime";

export type VoiceHandlers = {
  onSpeaking: (on: boolean) => void;
  onListening: (on: boolean) => void;
  onCaption: (text: string) => void;
  onHeard: (text: string) => void;
  onTool: (callId: string, name: string, args: string) => void;
  onError: (message: string) => void;
  onReady: () => void;
  onClose: () => void;
};

function openAudioContext(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error("Audio is not available in this browser.");
  // Device default rate. iOS Safari breaks MediaStreamSource if we force 24 kHz.
  // Capture resamples to 24 kHz; playback buffers are 24 kHz and the device rate resamples them.
  return new AC();
}

class PcmPlayer {
  private ctx: AudioContext;
  private dest: AudioNode;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];
  onIdle: (() => void) | null = null;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
  }

  get isPlaying() {
    return this.sources.length > 0;
  }

  enqueue(pcm: Int16Array) {
    if (!pcm.length) return;
    const float = pcm16ToFloat(pcm);
    const buf = this.ctx.createBuffer(1, float.length, VOICE_SAMPLE_RATE);
    buf.getChannelData(0).set(float);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.dest);
    const start = Math.max(this.ctx.currentTime, this.nextTime);
    src.start(start);
    this.nextTime = start + buf.duration;
    this.sources.push(src);
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src);
      if (!this.sources.length) this.onIdle?.();
    };
  }

  interrupt() {
    for (const src of this.sources) {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.nextTime = this.ctx.currentTime;
    this.onIdle?.();
  }
}

const METER_FFT = 512;

function configureMeter(node: AnalyserNode) {
  node.fftSize = METER_FFT;
  node.smoothingTimeConstant = 0.45;
}

/** 0..1. Time-domain RMS, with a small floor so room tone does not twitch the ring. */
function readMeter(node: AnalyserNode | null, buf: Uint8Array<ArrayBuffer>): number {
  if (!node) return 0;
  node.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const s = (buf[i]! - 128) / 128;
    sum += s * s;
  }
  const rms = Math.sqrt(sum / buf.length);
  return Math.max(0, Math.min(1, (rms - 0.012) / 0.15));
}

function startMicCapture(
  stream: MediaStream,
  ctx: AudioContext,
  onPcm: (b64: string) => void,
): { stop: () => void; pause: () => void; resume: () => void; analyser: AnalyserNode } {
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  // Silent side-chain tap. The samples sent upstream still come only from the processor.
  const analyser = ctx.createAnalyser();
  configureMeter(analyser);
  const meterMute = ctx.createGain();
  meterMute.gain.value = 0;
  let paused = false;
  const fromRate = ctx.sampleRate || VOICE_SAMPLE_RATE;
  proc.onaudioprocess = (e) => {
    if (paused) return;
    const input = e.inputBuffer.getChannelData(0);
    const resampled = resampleFloat(input, fromRate, VOICE_SAMPLE_RATE);
    onPcm(pcm16ToBase64(floatToPcm16(resampled)));
  };
  src.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);
  src.connect(analyser);
  analyser.connect(meterMute);
  meterMute.connect(ctx.destination);
  return {
    analyser,
    stop() {
      paused = true;
      try {
        proc.disconnect();
        src.disconnect();
        mute.disconnect();
        analyser.disconnect();
        meterMute.disconnect();
      } catch {
        /* already closed */
      }
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
  };
}

export class GrokVoiceSession {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private player: PcmPlayer | null = null;
  private capture: { stop: () => void; pause: () => void; resume: () => void } | null = null;
  private stream: MediaStream | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inMeter = new Uint8Array(new ArrayBuffer(METER_FFT));
  private outMeter = new Uint8Array(new ArrayBuffer(METER_FFT));
  private handlers: VoiceHandlers | null = null;
  private closed = false;
  private outText = "";
  private inText = "";
  private awaitingIdle = false;
  private paused = false;
  private onAudioState = () => {
    const ctx = this.ctx;
    if (!ctx || this.closed) return;
    // iOS suspends or interrupts the context on a phone call or screen lock.
    if (ctx.state === "interrupted" || ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
  };

  get connected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN && !this.closed;
  }

  async prepare() {
    const ctx = openAudioContext();
    this.ctx = ctx;
    ctx.addEventListener("statechange", this.onAudioState);
    // resume() and getUserMedia() run in the tap turn, before the first await.
    void ctx.resume();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (err) {
      await this.closeContext(ctx);
      throw err;
    }
    if (this.closed) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      throw new Error("Session closed");
    }
    await ctx.resume();
  }

  private async closeContext(ctx: AudioContext) {
    ctx.removeEventListener("statechange", this.onAudioState);
    if (this.ctx === ctx) this.ctx = null;
    try {
      await ctx.close();
    } catch {
      /* already closed */
    }
  }

  async connect(opts: { token: string; url?: string; coachName: string; assistantName?: string; handlers: VoiceHandlers }) {
    if (this.closed) throw new Error("Session closed");
    if (!this.ctx || !this.stream) await this.prepare();
    this.handlers = opts.handlers;
    const ctx = this.ctx!;
    // Unity gain so playback level is unchanged; the analyser only feeds the voice ring.
    const outputGain = ctx.createGain();
    outputGain.gain.value = 1;
    const outputAnalyser = ctx.createAnalyser();
    configureMeter(outputAnalyser);
    outputGain.connect(outputAnalyser);
    outputAnalyser.connect(ctx.destination);
    this.outputAnalyser = outputAnalyser;
    this.player = new PcmPlayer(ctx, outputGain);
    this.player.onIdle = () => {
      if (this.awaitingIdle) {
        this.awaitingIdle = false;
        this.handlers?.onSpeaking(false);
      }
    };

    const url = opts.url || REALTIME_WS_URL;
    const protocols = websocketProtocols(opts.token);
    this.ws = new WebSocket(url, protocols);
    this.ws.addEventListener("open", () => {
      this.send(voiceSessionUpdate(opts.coachName, opts.assistantName));
      this.handlers?.onReady();
    });
    this.ws.addEventListener("message", (ev) => {
      void this.onMessage(ev.data);
    });
    this.ws.addEventListener("error", () => {
      if (!this.closed) this.handlers?.onError("The live line dropped.");
    });
    this.ws.addEventListener("close", () => {
      if (!this.closed) {
        this.closed = true;
        this.cleanupMedia();
        this.handlers?.onClose();
      }
    });
    const capture = startMicCapture(this.stream!, this.ctx!, (b64) => this.append(b64));
    this.inputAnalyser = capture.analyser;
    this.capture = capture;
  }

  getLevels(): { input: number; output: number } {
    return {
      input: readMeter(this.inputAnalyser, this.inMeter),
      output: readMeter(this.outputAnalyser, this.outMeter),
    };
  }

  async start(opts: { token: string; url?: string; coachName: string; assistantName?: string; handlers: VoiceHandlers }) {
    await this.prepare();
    await this.connect(opts);
  }

  pauseCapture() {
    this.paused = true;
    this.capture?.pause();
  }

  resumeCapture() {
    this.paused = false;
    this.capture?.resume();
  }

  sendFunctionOutput(callId: string, output: string) {
    this.send({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output },
    });
    this.send({ type: "response.create" });
  }

  injectUserText(text: string) {
    const value = String(text || "").trim();
    if (!value) return;
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: value }],
      },
    });
    this.send({ type: "response.create" });
  }

  hangup() {
    if (this.closed) return;
    this.closed = true;
    this.cleanupMedia();
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
    this.ws = null;
  }

  private append(b64: string) {
    if (this.paused || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.send({ type: "input_audio_buffer.append", audio: b64 });
  }

  private send(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      /* closed mid-send */
    }
  }

  private async onMessage(data: unknown) {
    if (this.closed) return;
    if (typeof data !== "string") {
      const buf =
        data instanceof Blob
          ? await data.arrayBuffer()
          : data instanceof ArrayBuffer
            ? data
            : null;
      if (buf) {
        this.awaitingIdle = true;
        this.handlers?.onSpeaking(true);
        this.player?.enqueue(new Int16Array(buf));
      }
      return;
    }
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = String(ev.type || "");
    const kind = eventKind(type);
    if (kind === "ping") {
      this.send({ type: "pong", event_id: ev.event_id });
      return;
    }
    if (kind === "speech_started") {
      this.awaitingIdle = false;
      this.player?.interrupt();
      this.send({ type: "response.cancel" });
      this.handlers?.onSpeaking(false);
      this.handlers?.onListening(true);
      return;
    }
    if (kind === "speech_stopped") {
      this.handlers?.onListening(false);
      return;
    }
    if (kind === "audio") {
      const chunk = String(ev.delta || ev.audio || "");
      if (chunk) {
        this.awaitingIdle = true;
        this.handlers?.onSpeaking(true);
        this.player?.enqueue(base64ToPcm16(chunk));
      }
      return;
    }
    if (kind === "out_delta") {
      this.outText += String(ev.delta || ev.text || "");
      if (this.outText) this.handlers?.onCaption(this.outText);
      return;
    }
    if (kind === "out_done") {
      const done = String(ev.transcript || ev.text || this.outText);
      if (done) this.handlers?.onCaption(done);
      return;
    }
    if (kind === "in_update") {
      // grok-transcribe sends the cumulative transcript so far (replace, not append).
      const transcript = typeof ev.transcript === "string" ? ev.transcript : "";
      this.inText = transcript;
      if (transcript) this.handlers?.onHeard(transcript);
      return;
    }
    if (kind === "in_delta") {
      this.inText += String(ev.delta || ev.transcript || "");
      if (this.inText) this.handlers?.onHeard(this.inText);
      return;
    }
    if (kind === "in_done") {
      const heard = String(ev.transcript || ev.text || this.inText);
      if (heard) this.handlers?.onHeard(heard);
      this.inText = "";
      return;
    }
    if (kind === "tool") {
      const callId = String(ev.call_id || ev.id || "");
      const name = String(ev.name || "bookme_action");
      const args = String(ev.arguments || "");
      this.handlers?.onTool(callId, name, args);
      return;
    }
    if (kind === "response_created") {
      this.outText = "";
      return;
    }
    if (kind === "response_done") {
      if (!this.player?.isPlaying) {
        this.awaitingIdle = false;
        this.handlers?.onSpeaking(false);
      } else {
        this.awaitingIdle = true;
      }
      return;
    }
    if (kind === "error") {
      const msg = String((ev.error as { message?: string } | undefined)?.message || ev.message || "");
      if (msg && !/cancel/i.test(msg)) this.handlers?.onError(msg);
    }
  }

  private cleanupMedia() {
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.player?.interrupt();
    this.player = null;
    this.capture?.stop();
    this.capture = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      ctx.removeEventListener("statechange", this.onAudioState);
      void ctx.close().catch(() => {});
    }
  }
}
