import type { Project } from "@/lib/client/types";
import { STR } from "@/lib/client/strings";

export function DeliverableChecklist({ project }: { project: Project }) {
  const done = project.deliverables.filter((d) => d.present).length;
  const total = project.deliverables.length;
  const openBugs = project.bugs.filter((b) => b.open);

  return (
    <article className="rounded-lg border border-[var(--color-line)] bg-black/15 p-3.5" aria-label={project.slug}>
      <header className="flex items-baseline gap-3">
        <h3 className="mono text-sm font-semibold text-[var(--color-ink)]">{project.slug}</h3>
        <span className="mono ml-auto text-[11px] text-[var(--color-mute)]">
          {done}/{total}
        </span>
      </header>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/8"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={STR.deliverables}
      >
        <div className="h-full rounded-full bg-[var(--color-ok)] transition-[width] duration-500" style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
      </div>

      <ul className="mt-3 space-y-1.5">
        {project.deliverables.map((d) => (
          <li key={d.path + d.name} className="flex items-start gap-2 text-xs" data-present={d.present}>
            <span
              aria-hidden="true"
              className={`mt-px inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                d.present ? "border-[var(--color-ok)] bg-[var(--color-ok)]/15 text-[var(--color-ok)]" : "border-[var(--color-line-strong)] text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={d.present ? "text-[var(--color-ink)]" : "text-[var(--color-mute)]"}>
              {d.name}
              <span className="mono ml-2 text-[11px] text-[var(--color-mute)]">{d.path}</span>
            </span>
            <span className="sr-only">{d.present ? STR.present : STR.missing}</span>
          </li>
        ))}
      </ul>

      <footer className="mt-3 border-t border-[var(--color-line)] pt-2.5 text-xs">
        {openBugs.length === 0 ? (
          <p className="text-[var(--color-mute)]">{STR.noBugs}</p>
        ) : (
          <>
            <p className="text-[var(--color-ink-soft)]">
              {openBugs.length} {STR.bugsOpen}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {openBugs.map((b) => (
                <li key={b.id} className="mono rounded border border-[var(--color-err)]/40 bg-[var(--color-err)]/10 px-1.5 py-0.5 text-[11px] text-[var(--color-err)]">
                  {b.id} · {b.severity}
                </li>
              ))}
            </ul>
          </>
        )}
      </footer>
    </article>
  );
}
