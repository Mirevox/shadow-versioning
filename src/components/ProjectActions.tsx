"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ProjectActions({ appcode }: { appcode: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const disabled = busy || pending;

  async function runSync() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/projects/${appcode}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setNote(
        `Added ${data.added ?? 0} of ${data.fetched ?? 0} stub snapshot(s). ${data.note ?? ""}`.trim(),
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function recordAdvance() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/projects/${appcode}/stage-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "release",
          outcome: "advanced",
          detail:
            "Conceptual stage-gate hook: promotion recorded on the shadow timeline without dual-writing upstream systems.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Stage event failed");
      setNote(data.duplicate ? "Duplicate stage event skipped." : "Stage-gate event appended.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stage event failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={runSync}
          disabled={disabled}
          aria-busy={busy}
          className="rounded-md bg-[var(--neon)] px-4 py-2 text-sm font-semibold text-[#041016] transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Working…" : "Add sample ledger events"}
        </button>
        <button
          type="button"
          onClick={recordAdvance}
          disabled={disabled}
          className="rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--neon)] hover:text-[var(--neon)] disabled:opacity-60"
        >
          Record stage-gate advance
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}{" "}
          <button type="button" className="underline" onClick={runSync}>
            Retry
          </button>
        </p>
      ) : null}
      {note ? <p className="text-sm text-[var(--ok)]">{note}</p> : null}
    </div>
  );
}
