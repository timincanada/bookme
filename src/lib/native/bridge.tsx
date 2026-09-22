/**
 * Native glue, mounted once in the root route. No-op on the web.
 * - deep links (universal/app links) → router navigation
 * - marketing pages → /welcome
 * - push: register after sign-in, open the tapped notification's path
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { registerCoachDevice, registerStudentDevice } from "@/lib/bookme/devices-api";
import { NATIVE_HIDDEN_PATHS, nativePlatform } from "./platform";

const APP_HOSTS = new Set(["bookme.training", "www.bookme.training"]);

function pathFromUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!APP_HOSTS.has(u.hostname)) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export function NativeBridge() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const registered = useRef<{ coach: boolean; student: boolean }>({ coach: false, student: false });
  const token = useRef<{ value: string; platform: "ios" | "android" } | null>(null);

  // Deep links, splash, push listeners
  useEffect(() => {
    const platform = nativePlatform();
    if (platform === "web") return;
    const cleanups: Array<() => void> = [];
    void (async () => {
      const { App } = await import("@capacitor/app");
      const link = await App.addListener("appUrlOpen", ({ url }) => {
        const path = pathFromUrl(url);
        if (path) window.location.assign(path);
      });
      cleanups.push(() => void link.remove());
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.minimizeApp();
      });
      cleanups.push(() => void back.remove());

      const { SplashScreen } = await import("@capacitor/splash-screen");
      void SplashScreen.hide();
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);

      const { PushNotifications } = await import("@capacitor/push-notifications");
      const reg = await PushNotifications.addListener("registration", (t) => {
        token.current = { value: t.value, platform };
        registered.current = { coach: false, student: false };
        window.dispatchEvent(new Event("bookme:push-token"));
      });
      const tap = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const path = String(action.notification.data?.path || "");
        if (path.startsWith("/")) window.location.assign(path);
      });
      cleanups.push(() => void reg.remove(), () => void tap.remove());
    })();
    return () => cleanups.forEach((fn) => fn());
  }, []);

  // Marketing pages are web-only.
  useEffect(() => {
    if (nativePlatform() === "web") return;
    if (NATIVE_HIDDEN_PATHS.has(pathname)) void navigate({ to: "/welcome", replace: true });
  }, [pathname, navigate]);

  // Ask for push permission once the person is inside the coach app or the portal.
  useEffect(() => {
    if (nativePlatform() === "web") return;
    const role = pathname.startsWith("/app") ? "coach" : pathname.startsWith("/manage") ? "student" : null;
    if (!role) return;
    let cancelled = false;
    const send = () => {
      const t = token.current;
      if (!t || registered.current[role] || cancelled) return;
      const fn = role === "coach" ? registerCoachDevice : registerStudentDevice;
      void fn({ data: { token: t.value, platform: t.platform } })
        .then((r) => {
          if (r.ok) registered.current[role] = true;
        })
        .catch(() => undefined);
    };
    window.addEventListener("bookme:push-token", send);
    void (async () => {
      if (token.current) return send();
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.checkPermissions();
      const status = perm.receive === "prompt" ? (await PushNotifications.requestPermissions()).receive : perm.receive;
      if (status === "granted" && !cancelled) await PushNotifications.register();
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      window.removeEventListener("bookme:push-token", send);
    };
  }, [pathname]);

  return null;
}
