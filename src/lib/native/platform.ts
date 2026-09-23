/**
 * Native (Capacitor) detection. The iOS/Android apps load the live site in a
 * WebView; the native bridge is injected there, so these checks run in the browser.
 */
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

export type NativePlatform = "ios" | "android" | "web";

export function nativePlatform(): NativePlatform {
  if (typeof window === "undefined") return "web";
  try {
    if (!Capacitor.isNativePlatform()) return "web";
    const p = Capacitor.getPlatform();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    return "web";
  }
}

export function isNativeApp() {
  return nativePlatform() !== "web";
}

/** Marketing pages are not shown inside the apps. */
export const NATIVE_HIDDEN_PATHS = new Set(["/", "/pricing", "/for-coaches", "/how-it-works", "/find", "/preview"]);

export function useNativePlatform() {
  const [state, setState] = useState<{ ready: boolean; platform: NativePlatform }>({ ready: false, platform: "web" });
  useEffect(() => setState({ ready: true, platform: nativePlatform() }), []);
  return state;
}
