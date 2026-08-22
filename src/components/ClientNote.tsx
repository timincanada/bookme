"use client";
import { useState } from "react";

export function ClientNote({ clientId, note }: { clientId: string; note: string }) {
  const [value, setValue] = useState(note);
  const [saved, setSaved] = useState("");
  async function save() {
    const res = await fetch("/api/clients/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, note: value }),
    });
    setSaved(res.ok ? "Saved" : "Could not save");
  }
  return (
    <div className="mt-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-line px-3 py-2 text-sm"
        placeholder="One note about this client"
      />
      <button onClick={save} className="mt-2 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white">
        Save note
      </button>
      {saved && <span className="ml-3 text-sm text-muted">{saved}</span>}
    </div>
  );
}
