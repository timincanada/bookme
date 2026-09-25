import assert from "node:assert/strict";
import {
  isMicPermissionError,
  micBlockedMessage,
  micErrorMessage,
  voiceUnavailableMessage,
} from "./voice-errors.ts";

const BLOCKED =
  "Microphone blocked — allow microphone access in your browser settings, then try again.";
const MISSING = "No microphone found. Try typing instead.";
const BUSY = "Microphone is busy in another app. Close it and try again.";
const GENERIC = "Voice unavailable — try typing.";

const IOS_CHROME =
  "Microphone blocked — allow it in Settings › Chrome › Microphone, then try again.";
const IOS_FIREFOX =
  "Microphone blocked — allow it in Settings › Firefox › Microphone, then try again.";
const IOS_EDGE = "Microphone blocked — allow it in Settings › Edge › Microphone, then try again.";
const IOS_SAFARI =
  "Microphone blocked — allow it in Settings › Safari › Microphone (or aA › Website Settings), then try again.";
const ANDROID_CHROME =
  "Microphone blocked — tap the lock icon in the address bar › Permissions › Microphone › Allow, then try again.";
const DESKTOP_CHROMIUM =
  "Microphone blocked — click the site icon left of the address › Microphone › Allow, then try again.";
const DESKTOP_SAFARI =
  "Microphone blocked — open Safari › Settings for bookme.training › Microphone › Allow, then try again.";

const UA_IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1";
const UA_IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_IPHONE_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15";
const UA_IPHONE_EDGE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0.2592.68 Version/17.0 Mobile/15E148 Safari/604.1";
const UA_ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36";
const UA_DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.127 Safari/537.36";
const UA_DESKTOP_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.127 Safari/537.36 Edg/126.0.2592.87";
const UA_DESKTOP_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const UA_UNKNOWN = "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";

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

assert.equal(
  voiceUnavailableMessage("not_configured"),
  "Voice is unavailable right now — please type instead.",
);
assert.equal(
  voiceUnavailableMessage("upstream"),
  "Voice service didn't respond. Try again or type.",
);
assert.equal(voiceUnavailableMessage(), GENERIC);
assert.equal(voiceUnavailableMessage(""), GENERIC);
assert.equal(voiceUnavailableMessage("other"), GENERIC);

for (const [ua, expected] of [
  [UA_IPHONE_CHROME, IOS_CHROME],
  [UA_IPHONE_SAFARI, IOS_SAFARI],
  [UA_IPHONE_FIREFOX, IOS_FIREFOX],
  [UA_IPHONE_EDGE, IOS_EDGE],
  [UA_ANDROID_CHROME, ANDROID_CHROME],
  [UA_DESKTOP_CHROME, DESKTOP_CHROMIUM],
  [UA_DESKTOP_EDGE, DESKTOP_CHROMIUM],
  [UA_DESKTOP_SAFARI, DESKTOP_SAFARI],
  [UA_UNKNOWN, BLOCKED],
] as const) {
  assert.equal(micBlockedMessage(ua), expected);
  assert.equal(micErrorMessage({ name: "NotAllowedError" }, ua), expected);
}

assert.equal(
  micBlockedMessage(UA_DESKTOP_SAFARI, { platform: "MacIntel", maxTouchPoints: 5 }),
  IOS_SAFARI,
);
assert.equal(micErrorMessage({ name: "NotFoundError" }, UA_IPHONE_CHROME), MISSING);

console.log("voice-errors.test.ts ok");
