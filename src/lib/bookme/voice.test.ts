import assert from "node:assert/strict";
import {
  audioFilename,
  capSpokenText,
  speakableText,
  spokenFromTurn,
  ttsLanguage,
} from "./voice.ts";

assert.equal(speakableText("Mon 10:00 · Court  /  Tue: none"), "Mon 10:00, Court. Tue: none");
assert.equal(capSpokenText("Short."), "Short.");

const long = "Hello. " + "openings " .repeat(80) + "The end is here.";
const capped = capSpokenText(long, 80);
assert.equal(capped.length <= 80, true);
assert.equal(capped.startsWith("Hello."), true);

assert.equal(ttsLanguage("Hello there"), "en");
assert.equal(ttsLanguage("你好，帮我改一下时间"), "zh");
assert.equal(audioFilename("audio/mp4"), "clip.m4a");
assert.equal(audioFilename("audio/webm;codecs=opus"), "clip.webm");

assert.equal(
  spokenFromTurn({ ok: true, needsConfirm: true, summary: "Email Alex?" }),
  "Email Alex?",
);
assert.equal(spokenFromTurn({ ok: true, message: "Moved." }), "Moved.");
assert.equal(spokenFromTurn({ ok: false, error: "Sign in required" }), "Sign in required");
assert.equal(
  spokenFromTurn({
    ok: true,
    message: "huge dump",
    preview: {
      groups: [
        { label: "Mon, Sep 14", lines: ["10:00 a.m.", "11:00 a.m.", "12:00 p.m.", "1:00 p.m."] },
        { label: "Tue, Sep 15", lines: ["10:00 a.m."] },
      ],
    },
  }),
  "Mon, Sep 14: 10:00 a.m., 11:00 a.m., 12:00 p.m.. Plus 1 more day.",
);

console.log("voice.test.ts ok");
