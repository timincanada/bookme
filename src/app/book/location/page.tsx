"use client";
import { Brand } from "@/components/Brand";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Loc = { id: string; name: string; address: string; kind: string };

export default function LocationPage() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("coach") || "tim-zhang";
  const start = params.get("start") || "";
  const [locations, setLocations] = useState<Loc[]>([]);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    fetch(`/api/slots?coach=${slug}&date=${start.slice(0, 10)}`)
      .then((r) => r.json())
      .then((d) => {
        const list: Loc[] = d.locations || [];
        setLocations(list);
        if (list.length === 1) {
          router.replace(`/book/pay?coach=${slug}&start=${encodeURIComponent(start)}&location=${list[0].id}`);
        }
      });
  }, [slug, start, router]);

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Choose location</h1>
      <p className="text-muted">This coach teaches at more than one place.</p>
      <ul className="mt-5 space-y-2">
        {locations.map((l) => (
          <li key={l.id}>
            <button
              onClick={() => setPicked(l.id)}
              className={`w-full rounded-xl border p-4 text-left ${picked === l.id ? "border-brand bg-brand-soft" : "border-line"}`}
            >
              <div className="font-semibold">{l.name}</div>
              <div className="text-sm text-muted">{l.address || l.kind}</div>
            </button>
          </li>
        ))}
      </ul>
      <button
        disabled={!picked}
        onClick={() => router.push(`/book/pay?coach=${slug}&start=${encodeURIComponent(start)}&location=${picked}`)}
        className="mt-8 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
      >
        Continue
      </button>
    </main>
  );
}
