"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const appcode = String(form.get("appcode") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appcode, name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      startTransition(() => router.push(`/projects/${appcode}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="text-[var(--muted)]">Appcode</span>
          <input
            name="appcode"
            required
            placeholder="appcode-myproj-0"
            pattern="appcode-[a-z0-9]+(?:-[a-z0-9]+)*-\d+"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--neon)]"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-[var(--muted)]">Name</span>
          <input
            name="name"
            required
            placeholder="My project"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--neon)]"
          />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[var(--muted)]">Description</span>
        <textarea
          name="description"
          rows={2}
          placeholder="What this appcode binds together"
          className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--neon)]"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--purple)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        Create project
      </button>
    </form>
  );
}
