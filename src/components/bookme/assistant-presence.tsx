import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AssistantHeader,
  ChatBubble,
  Composer,
  ConfirmCard,
  QuickChips,
  ResultCard,
  ThinkingRow,
  UpcomingLessonCard,
} from "@/components/bookme/assistant-desk";
import { VoiceModePanel, type VoicePanelState } from "@/components/bookme/voice-mode-panel";
import { Button } from "@/components/ui/button";
import {
  getUpcomingLesson,
  mintVoiceSession,
  runAssistant,
  speakAssistant,
  voiceTurn,
  type AssistantPreview,
  type MyCoach,
  type UpcomingLesson,
} from "@/lib/bookme/api";
import type { AssistantAction } from "@/lib/bookme/assistant";
import { compactVoiceToolResult, parseToolText } from "@/lib/bookme/realtime";
import { isConfirmImportText } from "@/lib/bookme/recurring";
import { assistantTurnMutated, notifyLessonsChanged, useLessonsRefresh } from "@/lib/bookme/lessons-sync";
import { isMicPermissionError, micErrorMessage, voiceUnavailableMessage } from "@/lib/bookme/voice-errors";
import { usePurchasePolicy } from "@/lib/native/purchases";
import { GrokVoiceSession } from "@/lib/bookme/realtime-session";
import { spokenFromTurn } from "@/lib/bookme/voice";

type Phase = "idle" | "connecting" | "live" | "listening" | "thinking" | "speaking" | "confirm";

type ChatMsg = { id: string; role: "user" | "assistant"; text: string; at: number; card?: AssistantPreview | null };

const HOLD_GREETING = "Hold to talk. I can list openings, email a student, or swap two lesson times.";
const VOICE_UNSUPPORTED = "Voice isn't supported in this browser — try typing.";

function focusComposer() {
  const tryFocus = () => {
    const el = document.getElementById("assistant-input");
    if (!(el instanceof HTMLInputElement) || el.disabled) return false;
    el.focus();
    return true;
  };
  if (tryFocus()) return;
  window.setTimeout(() => {
    if (!tryFocus()) window.requestAnimationFrame(() => void tryFocus());
  }, 0);
}

function notifyVoiceError(message: string) {
  toast.error(message, { id: "assistant-voice-error" });
}

function voiceReason(res: object): string | undefined {
  if (!("reason" in res)) return undefined;
  const reason = (res as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}

export function AssistantPresence({ coach }: { coach: MyCoach }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typed, setTyped] = useState("");
  const [upgrade, setUpgrade] = useState(false);
  const purchases = usePurchasePolicy();
  const [dismissed, setDismissed] = useState(false);
  const [preview, setPreview] = useState<AssistantPreview | null>(null);
  const [action, setAction] = useState<AssistantAction | undefined>();
  const [holdFallback, setHoldFallback] = useState(false);
  const [voiceOff, setVoiceOff] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [upcoming, setUpcoming] = useState<UpcomingLesson | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [toolBusy, setToolBusy] = useState(false);
  const [userCaption, setUserCaption] = useState("");
  const [asstCaption, setAsstCaption] = useState("");

  const phaseRef = useRef<Phase>("idle");
  const liveRef = useRef(true);
  const recGen = useRef(0);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sendingRef = useRef(false);
  const sessionRef = useRef<GrokVoiceSession | null>(null);
  const startingRef = useRef(false);
  const voiceOffRef = useRef(false);
  const liveGen = useRef(0);
  const msgN = useRef(1);
  const userLiveId = useRef<string | null>(null);
  const asstLiveId = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const pendingCardRef = useRef<AssistantPreview | null>(null);
  const toolBusyRef = useRef(false);

  phaseRef.current = phase;
  const locked = coach.capabilities.length === 0 && !dismissed;
  const listening = phase === "listening";
  const callActive = inCall || phase === "connecting" || phase === "live";

  function reloadUpcoming() {
    void getUpcomingLesson().then((res) => {
      if (!liveRef.current) return;
      if (res.ok) setUpcoming(res.lesson);
    });
  }

  useLessonsRefresh(reloadUpcoming);

  useEffect(() => {
    reloadUpcoming();
  }, []);

  useEffect(() => {
    return () => {
      liveRef.current = false;
      recGen.current += 1;
      stopPlayback();
      stopRecorder(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      sessionRef.current?.hangup();
      sessionRef.current = null;
    };
  }, []);

  function scrollChatToEnd() {
    const el = listRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      if (listRef.current && stickRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }

  useLayoutEffect(() => {
    if (phase === "confirm" || phase === "thinking") stickRef.current = true;
    scrollChatToEnd();
    const t = window.setTimeout(scrollChatToEnd, 80);
    return () => window.clearTimeout(t);
  }, [messages, phase, preview, upcoming]);

  function nextId() {
    msgN.current += 1;
    return `m${msgN.current}`;
  }

  function push(role: ChatMsg["role"], text: string, card?: AssistantPreview | null) {
    const id = nextId();
    setMessages((rows) => [...rows, { id, role, text, at: Date.now(), card: card ?? null }]);
    return id;
  }

  function upsert(ref: { current: string | null }, role: ChatMsg["role"], text: string, card?: AssistantPreview | null) {
    if (!text && !card) return;
    if (ref.current) {
      const id = ref.current;
      setMessages((rows) => rows.map((m) => (m.id === id ? { ...m, text: text || m.text, card: card ?? m.card } : m)));
      return;
    }
    ref.current = push(role, text, card);
  }

  function stopPlayback() {
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.pause();
      a.removeAttribute("src");
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function stopRecorder(keepStream: boolean) {
    vadRef.current?.();
    vadRef.current = null;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    if (!keepStream) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function clearVoiceChrome() {
    toolBusyRef.current = false;
    setToolBusy(false);
    setAwaitingReply(false);
    setUserCaption("");
    setAsstCaption("");
  }

  function dropToHold(message: string) {
    liveGen.current += 1;
    sessionRef.current?.hangup();
    sessionRef.current = null;
    startingRef.current = false;
    setHoldFallback(true);
    setInCall(false);
    clearVoiceChrome();
    notifyVoiceError(message);
    setPhase("idle");
  }

  function markVoiceOff() {
    const message = voiceUnavailableMessage("not_configured");
    voiceOffRef.current = true;
    setVoiceOff(true);
    setHoldFallback(false);
    liveGen.current += 1;
    recGen.current += 1;
    sessionRef.current?.hangup();
    sessionRef.current = null;
    startingRef.current = false;
    stopPlayback();
    stopRecorder(false);
    setPreview(null);
    setAction(undefined);
    setInCall(false);
    clearVoiceChrome();
    notifyVoiceError(message);
    setPhase("idle");
    focusComposer();
  }

  function hangupLive() {
    liveGen.current += 1;
    sessionRef.current?.hangup();
    sessionRef.current = null;
    startingRef.current = false;
    setPreview(null);
    setAction(undefined);
    setInCall(false);
    clearVoiceChrome();
    setPhase("idle");
    userLiveId.current = null;
    asstLiveId.current = null;
  }

  async function handleVoiceTool(callId: string, name: string, args: string) {
    const session = sessionRef.current;
    if (!session) return;
    const text = name === "bookme_action" ? parseToolText(args) : "";
    if (!text) {
      session.sendFunctionOutput(callId, JSON.stringify({ ok: false, status: "error", error: "I need a request." }));
      return;
    }
    upsert(userLiveId, "user", text);
    toolBusyRef.current = true;
    setToolBusy(true);
    setAwaitingReply(true);
    setPhase("thinking");
    try {
      const res = await runAssistant({ data: { text } });
      if (!res.ok && "upgrade" in res && res.upgrade) setUpgrade(true);
      if (assistantTurnMutated(res)) notifyLessonsChanged("voice-tool");
      if (res.ok && res.needsConfirm && res.action) {
        setPreview(res.preview || null);
        setAction(res.action);
        asstLiveId.current = null;
        upsert(asstLiveId, "assistant", res.summary || "I have a change ready. Confirm below.");
        setPhase("confirm");
        session.pauseCapture();
        session.sendFunctionOutput(callId, JSON.stringify(compactVoiceToolResult(res)));
        return;
      }
      if (res.ok && res.preview && !res.needsConfirm) {
        asstLiveId.current = null;
        upsert(asstLiveId, "assistant", spokenFromTurn(res), res.preview);
        setPreview(null);
      } else if (!res.ok) setPreview(null);
      session.sendFunctionOutput(callId, JSON.stringify(compactVoiceToolResult(res)));
    } catch {
      session.sendFunctionOutput(
        callId,
        JSON.stringify({ ok: false, status: "error", error: "Something went wrong." }),
      );
    } finally {
      toolBusyRef.current = false;
      setToolBusy(false);
    }
  }

  async function startLive() {
    if (locked || startingRef.current || sessionRef.current) return;
    if (voiceOff || voiceOffRef.current) {
      notifyVoiceError(voiceUnavailableMessage("not_configured"));
      focusComposer();
      return;
    }
    if (phase === "thinking" || phase === "confirm") return;
    startingRef.current = true;
    liveGen.current += 1;
    const myGen = liveGen.current;
    stopPlayback();
    stopRecorder(false);
    setPreview(null);
    setAction(undefined);
    userLiveId.current = null;
    asstLiveId.current = null;
    clearVoiceChrome();
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      notifyVoiceError(VOICE_UNSUPPORTED);
      setPhase("idle");
      startingRef.current = false;
      focusComposer();
      return;
    }
    setPhase("connecting");
    const timeout = window.setTimeout(() => {
      if (myGen === liveGen.current && phaseRef.current === "connecting") {
        dropToHold("Live talk isn't available right now. Hold to talk instead.");
      }
    }, 12_000);
    try {
      const session = new GrokVoiceSession();
      sessionRef.current = session;
      setInCall(true);
      await session.prepare();
      if (myGen !== liveGen.current || !liveRef.current) {
        session.hangup();
        return;
      }
      const minted = await mintVoiceSession();
      if (myGen !== liveGen.current || !liveRef.current) {
        session.hangup();
        return;
      }
      if (!minted.ok) {
        if ("upgrade" in minted && minted.upgrade) setUpgrade(true);
        if ("reason" in minted && minted.reason === "not_configured") {
          markVoiceOff();
          return;
        }
        const message =
          "reason" in minted && minted.reason === "upstream"
            ? voiceUnavailableMessage("upstream")
            : ("error" in minted && minted.error) || HOLD_GREETING;
        dropToHold(message);
        return;
      }
      await session.connect({
        token: minted.token,
        url: minted.url,
        coachName: minted.coachName || coach.name,
        assistantName: minted.assistantName || coach.assistantName,
        handlers: {
          onReady: () => {
            if (sessionRef.current !== session) return;
            setPhase("live");
            asstLiveId.current = null;
            upsert(asstLiveId, "assistant", "I'm here. Just talk.");
            asstLiveId.current = null;
          },
          onSpeaking: (on) => {
            if (sessionRef.current !== session) return;
            if (phaseRef.current === "confirm") return;
            if (on || !toolBusyRef.current) setAwaitingReply(false);
            setPhase(on ? "speaking" : "live");
          },
          onListening: (on) => {
            if (sessionRef.current !== session) return;
            if (phaseRef.current === "confirm") return;
            if (on) {
              userLiveId.current = null;
              asstLiveId.current = null;
              setAwaitingReply(false);
              setUserCaption("");
              setAsstCaption("");
            } else if (phaseRef.current !== "speaking") {
              // Panel-only. Phase stays "live" so the mic, composer, and thread keep their current behavior.
              setAwaitingReply(true);
            }
            setPhase(on ? "listening" : phaseRef.current === "speaking" ? "speaking" : "live");
          },
          onCaption: (text) => {
            if (sessionRef.current !== session) return;
            if (text) {
              setAwaitingReply(false);
              setAsstCaption(text);
              upsert(asstLiveId, "assistant", text);
            }
          },
          onHeard: (text) => {
            if (sessionRef.current !== session) return;
            if (text) {
              setUserCaption(text);
              upsert(userLiveId, "user", text);
            }
          },
          onTool: (callId, name, args) => {
            if (sessionRef.current !== session) return;
            void handleVoiceTool(callId, name, args);
          },
          onError: (message) => {
            if (sessionRef.current !== session) return;
            dropToHold(message || "Live talk dropped. Hold to talk instead.");
          },
          onClose: () => {
            if (sessionRef.current !== session) return;
            sessionRef.current = null;
            startingRef.current = false;
            setInCall(false);
            clearVoiceChrome();
            if (phaseRef.current !== "idle") {
              setPhase("idle");
            }
          },
        },
      });
      if (myGen !== liveGen.current) {
        session.hangup();
        if (sessionRef.current === session) sessionRef.current = null;
        setInCall(false);
        return;
      }
    } catch (err) {
      if (myGen !== liveGen.current || !liveRef.current) return;
      const message = micErrorMessage(err);
      if (isMicPermissionError(err)) {
        liveGen.current += 1;
        sessionRef.current?.hangup();
        sessionRef.current = null;
        setInCall(false);
        clearVoiceChrome();
        notifyVoiceError(message);
        setPhase("idle");
        focusComposer();
        return;
      }
      dropToHold(message);
    } finally {
      window.clearTimeout(timeout);
      startingRef.current = false;
    }
  }

  function playBrowserSpeech(text: string, after: () => void) {
    if (!("speechSynthesis" in window)) {
      after();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.lang = /[\u4e00-\u9fff]/.test(text) ? "zh-CN" : "en-CA";
    u.onend = after;
    u.onerror = after;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  function playAudio(audio: string | undefined, mime: string | undefined, fallback: boolean, text: string, after: () => void) {
    stopPlayback();
    if (audio) {
      const url = `data:${mime || "audio/mpeg"};base64,${audio}`;
      const el = new Audio(url);
      audioRef.current = el;
      el.onended = after;
      el.onerror = () => playBrowserSpeech(text, after);
      void el.play().catch(() => playBrowserSpeech(text, after));
      return;
    }
    if (fallback) playBrowserSpeech(text, after);
    else after();
  }

  async function speakTurn(
    res: {
      ok: boolean;
      message?: string;
      summary?: string;
      error?: string;
      needsConfirm?: boolean;
      preview?: AssistantPreview | null;
      action?: AssistantAction;
      upgrade?: boolean;
      audio?: string;
      mime?: string;
      fallbackAudio?: boolean;
    },
    preloaded?: boolean,
  ) {
    if (!res.ok && "upgrade" in res && res.upgrade) setUpgrade(true);
    if (assistantTurnMutated(res)) notifyLessonsChanged("assistant");
    const text = spokenFromTurn(res);
    asstLiveId.current = null;
    const card = pendingCardRef.current || (res.ok && res.preview && !res.needsConfirm ? res.preview : null);
    pendingCardRef.current = null;
    upsert(asstLiveId, "assistant", text, card);
    asstLiveId.current = null;
    if (!res.ok) {
      setPreview(null);
      setAction(undefined);
      const backIdle = () => setPhase(sessionRef.current ? "live" : "idle");
      if (preloaded && (res.audio || res.fallbackAudio)) {
        setPhase("speaking");
        playAudio(res.audio, res.mime, !!res.fallbackAudio, text, backIdle);
      } else {
        setPhase(sessionRef.current ? "live" : "idle");
      }
      return;
    }
    if (res.needsConfirm && res.action) {
      setPreview(res.preview || null);
      setAction(res.action);
    } else {
      setPreview(null);
      setAction(undefined);
    }
    setPhase("speaking");
    const next = () => {
      if (res.ok && res.needsConfirm && res.action) {
        setPhase("confirm");
        return;
      }
      if (sessionRef.current) {
        setPhase("live");
        return;
      }
      setPhase("idle");
    };
    if (preloaded) {
      playAudio(res.audio, res.mime, !!res.fallbackAudio, text, next);
      return;
    }
    try {
      const speech = await speakAssistant({ data: { text } });
      playAudio(
        speech && "audio" in speech ? speech.audio : undefined,
        speech && "mime" in speech ? speech.mime : undefined,
        !!(speech && "fallback" in speech && speech.fallback),
        text,
        next,
      );
    } catch {
      playBrowserSpeech(text, next);
    }
  }

  async function sendText(payload: { text?: string; confirm?: boolean; action?: AssistantAction }) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    stopPlayback();
    stopRecorder(true);
    if (payload.text) {
      userLiveId.current = null;
      upsert(userLiveId, "user", payload.text);
      userLiveId.current = null;
    }
    setPhase("thinking");
    try {
      const session = sessionRef.current;
      if (session && payload.text && !payload.confirm) {
        session.injectUserText(payload.text);
        setPhase("live");
        return;
      }
      const res = await runAssistant({ data: payload });
      await speakTurn(res);
    } finally {
      sendingRef.current = false;
    }
  }

  async function sendRecording(blob: Blob, mime: string) {
    if (sendingRef.current) return;
    if (blob.size < 1200) {
      const message = "I didn't catch that. Tap to talk again.";
      notifyVoiceError(message);
      setPhase("idle");
      return;
    }
    sendingRef.current = true;
    setPhase("thinking");
    try {
      const audio = await blobToBase64(blob);
      const res = await voiceTurn({ data: { audio, mime } });
      const reason = voiceReason(res);
      const transcript = "transcript" in res && typeof res.transcript === "string" ? res.transcript : "";
      if (transcript) {
        userLiveId.current = null;
        upsert(userLiveId, "user", transcript);
        userLiveId.current = null;
      }
      if (!res.ok && !transcript) {
        if (reason === "not_configured") {
          markVoiceOff();
          return;
        }
        const message = reason ? voiceUnavailableMessage(reason) : ("error" in res && res.error) || voiceUnavailableMessage();
        notifyVoiceError(message);
        if (reason) {
          setPhase("idle");
          return;
        }
      }
      await speakTurn(res, true);
    } finally {
      sendingRef.current = false;
    }
  }

  async function beginListen() {
    if (voiceOff || voiceOffRef.current) {
      notifyVoiceError(voiceUnavailableMessage("not_configured"));
      focusComposer();
      return;
    }
    if (locked || sessionRef.current) return;
    recGen.current += 1;
    const myGen = recGen.current;
    stopPlayback();
    setPreview(null);
    setAction(undefined);
    userLiveId.current = null;
    asstLiveId.current = null;
    const Speech = webSpeech();
    const mime = pickRecorderMime();
    if (mime && navigator.mediaDevices?.getUserMedia) {
      try {
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        }
        if (myGen !== recGen.current) return;
        const rec = new MediaRecorder(streamRef.current, { mimeType: mime });
        chunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          if (myGen !== recGen.current) return;
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime });
          void sendRecording(blob, rec.mimeType || mime);
        };
        recRef.current = rec;
        rec.start();
        setPhase("listening");
        vadRef.current = attachVad(streamRef.current, () => finishListen());
        return;
      } catch (err) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (!Speech) {
          const message = micErrorMessage(err);
          notifyVoiceError(message);
          setPhase("idle");
          return;
        }
      }
    }
    if (Speech) {
      const rec = new Speech();
      rec.lang = "en-CA";
      rec.interimResults = false;
      rec.onresult = (e) => {
        const said = e.results[0][0].transcript;
        recGen.current += 1;
        setPhase("idle");
        void sendText({ text: said });
      };
      rec.onerror = () => {
        if (myGen === recGen.current) setPhase("idle");
      };
      rec.onend = () => {
        if (phaseRef.current === "listening" && myGen === recGen.current) setPhase("idle");
      };
      recRef.current = rec;
      setPhase("listening");
      rec.start();
      return;
    }
    const message =
      typeof navigator.mediaDevices?.getUserMedia === "function"
        ? "Microphone is blocked here. Type instead."
        : VOICE_UNSUPPORTED;
    notifyVoiceError(message);
    setPhase("idle");
  }

  function finishListen() {
    if (phaseRef.current !== "listening") return;
    const rec = recRef.current;
    vadRef.current?.();
    vadRef.current = null;
    recRef.current = null;
    if (rec && "stop" in rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  function onTalkTap() {
    if (locked || phase === "thinking") return;
    if (voiceOff || voiceOffRef.current) {
      notifyVoiceError(voiceUnavailableMessage("not_configured"));
      focusComposer();
      return;
    }
    if (callActive) {
      hangupLive();
      return;
    }
    if (holdFallback) {
      if (phase === "listening") finishListen();
      else {
        if (phase === "speaking" || phase === "confirm") stopPlayback();
        void beginListen();
      }
      return;
    }
    void startLive();
  }

  async function confirmAction() {
    if (!action) return;
    const next = action;
    const snapshot = preview;
    setAction(undefined);
    setPreview(null);
    const session = sessionRef.current;
    if (session) {
      setPhase("thinking");
      try {
        const res = await runAssistant({ data: { confirm: true, action: next } });
        const spoken = spokenFromTurn(res);
        if (res.ok && res.needsConfirm && res.action) {
          // The calendar changed since the preview: show the updated card again.
          asstLiveId.current = null;
          upsert(asstLiveId, "assistant", spoken, null);
          asstLiveId.current = null;
          setPreview(res.preview || null);
          setAction(res.action);
          setPhase("confirm");
          return;
        }
        if (assistantTurnMutated(res)) notifyLessonsChanged("confirm");
        const card =
          next.type === "cancel_lesson" && snapshot
            ? { ...snapshot, confirmLabel: undefined, heading: "Lesson Cancelled" }
            : res.ok && res.preview && !res.needsConfirm
              ? res.preview
              : null;
        asstLiveId.current = null;
        upsert(asstLiveId, "assistant", spoken, card);
        asstLiveId.current = null;
        session.injectUserText("The coach confirmed. " + spoken);
        session.resumeCapture();
        setPhase("live");
      } catch {
        session.resumeCapture();
        setPhase("live");
        push("assistant", "Something went wrong.");
      }
      return;
    }
    if (next.type === "cancel_lesson" && snapshot) {
      pendingCardRef.current = { ...snapshot, confirmLabel: undefined, heading: "Lesson Cancelled" };
    }
    await sendText({ confirm: true, action: next });
  }

  function skipAction() {
    setAction(undefined);
    setPreview(null);
    const session = sessionRef.current;
    if (session) {
      session.injectUserText("The coach skipped. Do not apply that change.");
      session.resumeCapture();
      push("assistant", "Okay, nothing changed.");
      setPhase("live");
      return;
    }
    push("assistant", "Okay, nothing changed.");
    setPhase("idle");
  }

  const headerStatus =
    phase === "connecting"
      ? "Connecting…"
      : phase === "listening"
        ? "Listening"
        : phase === "thinking"
          ? "One moment"
          : phase === "speaking"
            ? "Speaking"
            : phase === "confirm"
              ? "Waiting for you"
              : phase === "live"
                ? "Live · always here to help"
                : "Always here to help";

  const voicePanelOpen = (inCall || phase === "connecting") && phase !== "confirm" && phase !== "idle";
  const voicePanelState: VoicePanelState =
    phase === "connecting"
      ? "connecting"
      : phase === "speaking"
        ? "speaking"
        : phase === "listening"
          ? "listening"
          : phase === "thinking" || toolBusy || awaitingReply
            ? "thinking"
            : "listening";

  const talkLabel = callActive
    ? phase === "connecting"
      ? "Connecting…"
      : "Tap to end"
    : holdFallback && listening
      ? "Tap to send"
      : "Tap to talk";

  function ask(text: string) {
    if (phase === "thinking" || phase === "connecting" || locked) return;
    void sendText({ text });
  }

  return (
    <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col bg-cream">
      <AssistantHeader coachName={coach.name} assistantName={coach.assistantName} status={headerStatus} live={callActive || listening} />

      <div
        ref={listRef}
        className="assistant-thread min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
        }}
      >
        <div className="flex flex-col gap-3">
          {upcoming ? <UpcomingLessonCard lesson={upcoming} timeZone={coach.timezone} /> : null}

          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              {m.text ? <ChatBubble role={m.role} text={m.text} at={m.at} timeZone={coach.timezone} /> : null}
              {m.card ? (
                <div className={m.role === "user" ? "self-end" : "pl-10"}>
                  <ResultCard preview={m.card} />
                </div>
              ) : null}
            </div>
          ))}

          {phase === "thinking" ? <ThinkingRow /> : null}

          {phase === "confirm" && preview && action ? (
            <div className="pl-10">
              <ConfirmCard preview={preview} onConfirm={() => void confirmAction()} onSkip={skipAction} />
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {upgrade ? (
        <div className="mx-3 mb-2 rounded-2xl bg-sage-3 p-4">
          <p className="font-semibold">Assistant is on Coach</p>
          <p className="mt-1 text-sm text-muted">List openings, email a student, swap two times. Your plan is Light.</p>
          {purchases.showPurchases ? (
            <Link to="/app/billing" className="mt-2 inline-block text-sm font-semibold text-forest">
              Upgrade to Coach
            </Link>
          ) : null}
        </div>
      ) : null}

      <QuickChips
        onReschedule={() => ask(upcoming ? "reschedule " + upcoming.clientName : "reschedule the next lesson")}
        onOpenings={() => ask("openings this week")}
        onSchedule={() => ask("show me the upcoming schedule")}
      />
      <Composer
        value={typed}
        onChange={setTyped}
        onSend={() => {
          const value = typed.trim();
          if (!value || phase === "thinking" || phase === "connecting") return;
          setTyped("");
          // Typing "确认导入" / "confirm import" confirms the import card on screen.
          if (phase === "confirm" && action?.type === "draft_import" && isConfirmImportText(value)) {
            push("user", value);
            void confirmAction();
            return;
          }
          void sendText({ text: value });
        }}
        onMic={onTalkTap}
        talkLabel={talkLabel}
        live={listening || callActive}
        disabled={phase === "thinking" || locked}
      />

      {voicePanelOpen ? (
        <VoiceModePanel
          state={voicePanelState}
          userCaption={userCaption}
          assistantCaption={asstCaption}
          onEnd={hangupLive}
          getLevels={() => sessionRef.current?.getLevels() ?? { input: 0, output: 0 }}
        />
      ) : null}

      {locked ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-cream/80 px-6">
          <div className="max-w-sm rounded-2xl bg-card p-6 text-center ring-1 ring-line">
            <p className="font-display text-2xl">Assistant is on Coach</p>
            <p className="mt-2 text-sm text-muted">List openings, email a student, or swap two lesson times — included on Coach and Busy.</p>
            {purchases.showPurchases ? (
              <Button asChild className="mt-4" size="field">
                <Link to="/app/billing">Upgrade to Coach</Link>
              </Button>
            ) : null}
            <button type="button" className="mt-3 text-sm text-muted" onClick={() => setDismissed(true)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  return types.find((t) => t && MediaRecorder.isTypeSupported(t)) || "";
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function webSpeech() {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

function attachVad(stream: MediaStream, onSilence: () => void) {
  const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    const t = window.setTimeout(onSilence, 8000);
    return () => window.clearTimeout(t);
  }
  const ctx = new AC();
  void ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let heard = false;
  let lastVoice = performance.now();
  const start = performance.now();
  let raf = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) {
      const n = (v - 128) / 128;
      sum += n * n;
    }
    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();
    if (rms > 0.035) {
      heard = true;
      lastVoice = now;
    }
    if (now - start > 12_000) {
      onSilence();
      return;
    }
    if (!heard && now - start > 7000) {
      onSilence();
      return;
    }
    if (heard && now - lastVoice > 1100 && now - start > 900) {
      onSilence();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    void ctx.close();
  };
}
