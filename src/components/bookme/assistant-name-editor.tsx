import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveCoachAssistantName } from "@/lib/bookme/api";
import { ASSISTANT_NAME_MAX, normalizeAssistantName } from "@/lib/bookme/assistant-name";
import { cn } from "@/lib/utils";

export function AssistantNameHeading({
  name,
  onSaved,
}: {
  name: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  async function save() {
    const next = normalizeAssistantName(draft);
    setDraft(next);
    setEditing(false);
    if (next === name) return;
    setBusy(true);
    const res = await saveCoachAssistantName({ data: { name: next } });
    setBusy(false);
    if (res.ok) onSaved();
    else setDraft(name);
  }

  if (editing) {
    return (
      <input
        className="field h-11 max-w-[14rem] font-display text-2xl font-medium"
        value={draft}
        maxLength={ASSISTANT_NAME_MAX}
        autoFocus
        aria-label="Assistant name"
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="group flex max-w-[16rem] items-center gap-2 text-left"
      onClick={() => setEditing(true)}
      aria-label={"Rename " + name}
    >
      <h1 className={cn("font-display text-2xl font-medium", busy && "opacity-60")}>{name}</h1>
      <Pencil className="size-3.5 text-muted opacity-70 group-hover:text-forest" strokeWidth={1.75} />
    </button>
  );
}

export function AssistantNameForm({
  name,
  onSaved,
}: {
  name: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  async function save() {
    const next = normalizeAssistantName(draft);
    setDraft(next);
    setBusy(true);
    const res = await saveCoachAssistantName({ data: { name: next } });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved.");
      onSaved();
    } else setMsg(res.error);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Name</span>
        <input
          className="field"
          value={draft}
          maxLength={ASSISTANT_NAME_MAX}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
        />
      </label>
      <p className="mt-2 text-sm text-muted">Up to {ASSISTANT_NAME_MAX} characters. Shown on the assistant screen and used when it talks.</p>
      <Button className="mt-4" size="field" type="submit" disabled={busy}>
        Save
      </Button>
      {msg ? <p className="mt-3 text-sm text-ink-soft">{msg}</p> : null}
    </form>
  );
}
