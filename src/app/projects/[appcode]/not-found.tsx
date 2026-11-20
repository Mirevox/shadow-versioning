import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1
        className="text-3xl text-[var(--ink)]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Project not found
      </h1>
      <p className="text-[var(--muted)]">
        That appcode is not in the local store. Create it from the home page or
        open the seeded demo.
      </p>
      <Link href="/" className="text-[var(--neon)] hover:underline">
        Back to projects
      </Link>
    </div>
  );
}
