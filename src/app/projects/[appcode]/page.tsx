import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectActions } from "@/components/ProjectActions";
import { Timeline } from "@/components/Timeline";
import { getProject, getTimeline } from "@/lib/store";
import { ownershipBlurb } from "@/lib/sync-model";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ appcode: string }>;
}) {
  const { appcode } = await params;
  const project = await getProject(appcode);
  if (!project) notFound();

  const timeline = (await getTimeline(appcode)) ?? [];
  const { manifest } = project;

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--neon)]">
          ← All projects
        </Link>
        <h1
          className="text-4xl text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {manifest.name}
        </h1>
        <p className="font-mono text-sm text-[var(--neon)]">{manifest.appcode}</p>
        <p className="max-w-3xl text-[var(--muted)]">{manifest.description}</p>
        <p className="text-sm text-[var(--purple-soft)]">Owner: {manifest.owner}</p>
      </div>

      <ProjectActions appcode={appcode} />

      <section className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <h2
            className="text-2xl text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Snapshot timeline
          </h2>
          <Timeline events={timeline} />
        </div>

        <aside className="space-y-8">
          <div className="space-y-3">
            <h3
              className="text-lg text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Bindings
            </h3>
            <ul className="space-y-3 text-sm">
              {manifest.bindings.map((b) => (
                <li key={b.source} className="border-t border-[var(--line)] pt-3">
                  <div className="text-[var(--purple-soft)]">
                    {b.source} · {b.mode}
                  </div>
                                    <div className="break-all text-[var(--muted)]">{b.target}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3
              className="text-lg text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Stage ownership
            </h3>
            <ul className="space-y-3 text-sm text-[var(--muted)]">
              {manifest.ownership.map((row) => (
                <li key={row.stage} className="border-t border-[var(--line)] pt-3">
                  <div className="text-[var(--neon)]">
                    {row.stage} → {row.owner}
                  </div>
                  <p className="mt-1">{ownershipBlurb(row)}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
