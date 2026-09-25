import assert from "node:assert/strict";
import { isMicPermissionError, micErrorMessage, voiceUnavailableMessage } from "./voice-errors.ts";

const BLOCKED = "Microphone blocked — allow it in Settings › Safari › Microphone, then try again.";
const MISSING = "No microphone found. Try typing instead.";
const BUSY = "Microphone is busy in another app. Close it and try again.";
const GENERIC = "Voice unavailable — try typing.";

for (const name of ["NotAllowedError", "SecurityError", "PermissionDeniedError"]) {
  assert.equal(micErrorMessage({ name }), BLOCKED);
  assert.equal(isMicPermissionError({ name }), true);
}

for (const name of ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"]) {
  assert.equal(micErrorMessage({ name }), MISSING);
  assert.equal(isMicPermissionError({ name }), false);
}

for (const name of ["NotReadableError", "TrackStartError", "AbortError"]) {
  assert.equal(micErrorMessage({ name }), BUSY);
  assert.equal(isMicPermissionError({ name }), false);
}

const denied = new Error("permission");
denied.name = "NotAllowedError";
assert.equal(micErrorMessage(denied), BLOCKED);
assert.equal(isMicPermissionError(denied), true);

assert.equal(micErrorMessage({ name: "TypeError" }), GENERIC);
assert.equal(micErrorMessage(new Error("nope")), GENERIC);
assert.equal(micErrorMessage(null), GENERIC);
assert.equal(micErrorMessage(undefined), GENERIC);
assert.equal(micErrorMessage("NotAllowedError"), GENERIC);
assert.equal(micErrorMessage({ name: 12 }), GENERIC);
assert.equal(isMicPermissionError(null), false);
assert.equal(isMicPermissionError(new Error("nope")), false);

assert.equal(voiceUnavailableMessage("not_configured"), "Voice is unavailable right now — please type instead.");
assert.equal(voiceUnavailableMessage("upstream"), "Voice service didn't respond. Try again or type.");
assert.equal(voiceUnavailableMessage(), GENERIC);
assert.equal(voiceUnavailableMessage(""), GENERIC);
assert.equal(voiceUnavailableMessage("other"), GENERIC);

console.log("voice-errors.test.ts ok");
