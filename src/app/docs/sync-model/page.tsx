import Link from "next/link";
import { DEFAULT_OWNERSHIP, ownershipBlurb } from "@/lib/sync-model";

export default function SyncModelPage() {
  return (
    <article className="prose-invert mx-auto max-w-3xl space-y-8">
      <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--neon)]">
        ← Home
      </Link>
      <h1
        className="text-4xl text-[var(--ink)]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Stage-owned sync model
      </h1>
      <p className="text-lg leading-relaxed text-[var(--muted)]">
        Shadow versioning is a ledger. It does not become a second source of
        truth. Each stage-gate stage names one owning system. Connectors only
        read (or stub-read) that owner and append a human-readable snapshot.
      </p>

      <section className="space-y-4">
        <h2
          className="text-2xl text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Default ownership
        </h2>
        <ul className="space-y-4">
          {DEFAULT_OWNERSHIP.map((row) => (
            <li
              key={row.stage}
              className="border-t border-[var(--line)] pt-4 text-[var(--muted)]"
            >
              <div className="text-[var(--neon)]">
                {row.stage} → <strong className="text-[var(--ink)]">{row.owner}</strong>
              </div>
              <p className="mt-1">{row.rationale}</p>
              <p className="mt-1 text-sm opacity-80">{ownershipBlurb(row)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 text-[var(--muted)]">
        <h2
          className="text-2xl text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          What v1 will not do
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Dual-write edits back into Confluence, SharePoint, or Git.</li>
          <li>Replace stage-gate as the promotion authority.</li>
          <li>Teach Git verbs as the primary human interface.</li>
          <li>Pretend stub connectors are live integrations.</li>
        </ul>
      </section>

      <section className="space-y-3 text-[var(--muted)]">
        <h2
          className="text-2xl text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Stage-gate hook
        </h2>
        <p>
          When a workflow advances, stage-gate (or a harness) POSTs to{" "}
          <code className="text-[var(--neon)]">
            /api/projects/&#123;appcode&#125;/stage-events
          </code>
          . We store the decision on the timeline and leave ownership untouched.
        </p>
      </section>
    </article>
  );
}
