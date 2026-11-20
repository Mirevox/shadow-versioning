import type { SnapshotEvent } from "@/lib/types";

const SOURCE_COLOR: Record<string, string> = {
  confluence: "#a78bfa",
  sharepoint: "#60a5fa",
  git: "#5dffa8",
  testing: "#fbbf24",
  "stage-gate": "#3df2ff",
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function Timeline({
  events,
  emptyHint,
}: {
  events: SnapshotEvent[];
  emptyHint?: string;
}) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--line)] px-5 py-10 text-center text-[var(--muted)]">
        {emptyHint ?? "No snapshots yet. Run a stub sync to pull sample events."}
      </div>
    );
  }

  const ordered = [...events].sort(
    (a, b) =>
      Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
      (b.sequenceNumber ?? 0) - (a.sequenceNumber ?? 0),
  );

  return (
    <ol className="relative space-y-0 border-l border-[var(--line)] pl-6">
      <span className="timeline-rail absolute -left-px top-0 h-full w-px bg-gradient-to-b from-[var(--neon)] via-[var(--purple-soft)] to-transparent" />
      {ordered.map((event, index) => (
        <li
          key={event.id}
          className="animate-rise relative pb-8 last:pb-0"
          style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
          <span
            className="absolute -left-[1.9rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-[var(--bg)]"
            style={{ background: SOURCE_COLOR[event.source] ?? "#fff" }}
          />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3
              className="text-lg text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {event.title}
            </h3>
            <time className="text-xs text-[var(--muted)]">
              recorded {formatWhen(event.recordedAt)}
            </time>
            {event.sequenceNumber ? (
              <span className="text-xs text-[var(--muted)]">#{event.sequenceNumber}</span>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
            {event.detail}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="text-[var(--purple-soft)]">{event.source}</span>
            {event.stage ? (
              <span className="text-[var(--neon)]">stage: {event.stage}</span>
            ) : null}
            {event.provenance === "stub" || event.network === false ? (
              <span className="rounded px-1.5 py-0.5 bg-[var(--neon-dim)] text-[var(--neon)]">
                stub · no network
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
