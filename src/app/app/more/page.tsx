"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { publicAppUrl } from "@/lib/app-url";

export default function MorePage() {
  const [me, setMe] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/coach/me").then(async (r) => {
      if (r.status === 401) {
        window.location.href = "/app/login";
        return;
      }
      setMe(await r.json());
    });
  }, []);

  const link = me ? `${publicAppUrl()}/${me.slug}` : "";

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">More</h1>
      <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
        <li>
          <Link href="/app/assistant" className="block p-4 font-semibold">Assistant</Link>
        </li>
        <li>
          <Link href="/app/more/hours" className="block p-4 font-semibold">Weekly hours</Link>
        </li>
        <li>
          <Link href="/app/more/locations" className="block p-4 font-semibold">Locations</Link>
        </li>
        <li>
          <Link href="/app/billing" className="block p-4 font-semibold">Subscription & billing</Link>
        </li>
        <li>
          <Link href="/app/setup" className="block p-4 font-semibold">Open for business</Link>
        </li>
      </ul>
      {me && (
        <div className="mt-5 card text-sm">
          <div className="text-muted">Booking link</div>
          <div className="mt-1 break-all font-semibold">{link}</div>
          {me.canCopyLink ? (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
              className="mt-3 w-full rounded-2xl bg-brand py-2 font-semibold text-white"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          ) : (
            <p className="mt-2 text-muted">Finish setup and start a trial to copy this link.</p>
          )}
        </div>
      )}
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/app/login";
        }}
        className="mt-6 w-full rounded-2xl border border-line py-3 font-semibold"
      >
        Sign out
      </button>
      <TabBar active="more" />
    </main>
  );
}
