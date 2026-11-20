import Link from "next/link";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let loadError: string | null = null;
  try {
    projects = await listProjects();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load projects";
  }

  return (
    <div className="space-y-12">
      <section className="animate-rise max-w-3xl space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--neon)]">
          Shadow versioning
        </p>
        <h1
          className="text-4xl leading-tight text-[var(--ink)] sm:text-5xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          One project id. A readable history. No Git homework.
        </h1>
        <p className="text-lg leading-relaxed text-[var(--muted)]">
          Bind Confluence, SharePoint, Git, and testing under an{" "}
          <code className="text-[var(--neon)]">appcode-*</code> manifest. Browse
          snapshots in plain language. Stage-gate owns promotion decisions;
          this module only keeps the ledger.
        </p>
      </section>

      <section className="animate-rise space-y-4" style={{ animationDelay: "80ms" }}>
        <div className="flex items-end justify-between gap-4">
          <h2
            className="text-2xl text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Projects
          </h2>
          <Link
            href="/docs/sync-model"
            className="text-sm text-[var(--muted)] hover:text-[var(--neon)]"
          >
            How stage ownership works →
          </Link>
        </div>

        {loadError ? (
          <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            {loadError}
          </p>
        ) : null}

        {!loadError && projects.length === 0 ? (
          <p className="text-[var(--muted)]">
            No projects yet. Create one below — seed data loads on first API
            touch if the store is empty.
          </p>
        ) : null}

        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {projects.map((p) => (
            <li key={p.appcode}>
              <Link
                href={`/projects/${p.appcode}`}
                className="flex flex-col gap-1 py-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-baseline sm:justify-between"
              >
                <div>
                  <div
                    className="text-xl text-[var(--ink)]"
                    style={{ fontFamily: "var(--font-display), serif" }}
                  >
                    {p.name}
                  </div>
                  <div className="text-sm text-[var(--neon)]">{p.appcode}</div>
                </div>
                <p className="max-w-xl text-sm text-[var(--muted)]">
                  {p.description || "No description"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="animate-rise max-w-2xl space-y-4"
        style={{ animationDelay: "140ms" }}
      >
        <h2
          className="text-2xl text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Open a project
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Appcodes look like <code>appcode-demo-0</code>. Default stub bindings
          are attached automatically.
        </p>
        <CreateProjectForm />
      </section>
    </div>
  );
}
