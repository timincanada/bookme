import { unregisterDevice } from "@/lib/bookme/devices-api";
import { nativePlatform } from "./platform";

/** On sign-out: stop pushes to this phone for the previous person. */
export async function forgetDevice() {
  if (nativePlatform() === "web") return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 3000);
      void PushNotifications.addListener("registration", (t) => {
        clearTimeout(timer);
        resolve(t.value);
      });
      void PushNotifications.register().catch(() => resolve(null));
    });
    if (token) await unregisterDevice({ data: { token } });
  } catch {
    // best effort
  }
}
