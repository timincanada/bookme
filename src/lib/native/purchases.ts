/**
 * Store rules for coach subscriptions (bought on the web only):
 * - Native apps (iOS and Android): no purchase, upgrade, pricing or cancel
 *   controls, and no pointers to buying elsewhere. Apple's guideline 3.1.3 and
 *   Google Play's Payments policy both cover subscriptions sold in an app.
 * - Exception: on the US App Store storefront one link may open the account
 *   page in the system browser.
 * Student lesson payments (Stripe, in-person lessons) are not affected.
 */
import { registerPlugin } from "@capacitor/core";
import { useEffect, useState } from "react";
import { nativePlatform } from "./platform";

type StorefrontPlugin = { getCountry(): Promise<{ countryCode: string | null }> };
const Storefront = registerPlugin<StorefrontPlugin>("Storefront");

export type PurchasePolicy = {
  /** false until the platform check has run (avoid flashing purchase UI). */
  ready: boolean;
  /** Show plan purchase / upgrade / cancel controls and upgrade prompts. */
  showPurchases: boolean;
  /** iOS US storefront only: allowed to link out to the web account page. */
  showExternalAccountLink: boolean;
};

let cachedCountry: Promise<string | null> | null = null;

export function storefrontCountry() {
  cachedCountry ??= Storefront.getCountry()
    .then((r) => (r?.countryCode ? String(r.countryCode).toUpperCase() : null))
    .catch(() => null);
  return cachedCountry;
}

export function usePurchasePolicy(): PurchasePolicy {
  const [policy, setPolicy] = useState<PurchasePolicy>({ ready: false, showPurchases: false, showExternalAccountLink: false });
  useEffect(() => {
    const platform = nativePlatform();
    if (platform === "web") {
      setPolicy({ ready: true, showPurchases: true, showExternalAccountLink: false });
      return;
    }
    // Native: never show purchase controls.
    setPolicy({ ready: true, showPurchases: false, showExternalAccountLink: false });
    if (platform !== "ios") return;
    let alive = true;
    void storefrontCountry().then((country) => {
      if (alive) setPolicy({ ready: true, showPurchases: false, showExternalAccountLink: country === "USA" });
    });
    return () => {
      alive = false;
    };
  }, []);
  return policy;
}

/** Opens a URL in the system browser (Safari / default browser). */
export async function openInSystemBrowser(url: string) {
  const { AppLauncher } = await import("@capacitor/app-launcher");
  await AppLauncher.openUrl({ url });
}

export async function shareLink(input: { title: string; url: string }) {
  if (nativePlatform() === "web") return false;
  const { Share } = await import("@capacitor/share");
  await Share.share({ title: input.title, url: input.url, dialogTitle: input.title });
  return true;
}
