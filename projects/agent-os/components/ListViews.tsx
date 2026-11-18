"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAgentOs } from "@/hooks/AgentOsContext";
import { DeliverableChecklist } from "./DeliverableChecklist";
import { EmptyState } from "./EmptyState";
import { Gate } from "./Gate";
import { TaskRow } from "./TaskRow";
import { toneFor } from "@/lib/client/agentColors";
import { formatDateTime } from "@/lib/client/format";
import { STR } from "@/lib/client/strings";
import type { Task } from "@/lib/client/types";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 md:px-8">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </div>
  );
}

const GROUPS: Task["status"][] = ["in_progress", "pending", "completed"];

/** Sem lista partilhada do Claude Code: mostra as tarefas por agente do PLAN.md do projeto desta sessão. */
function PlanTasks() {
  const { projects, project: slug } = useAgentOs();
  const project = slug ? projects.find((p) => p.slug === slug && p.planTasks.length > 0) : undefined;
  if (!project) return <EmptyState {...STR.empty.tasks} />;
  const agents = [...new Set(project.planTasks.map((t) => t.agent))];
  return (
    <div className="space-y-5" data-testid="plan-tasks" data-project={project.slug}>
      <p className="text-xs text-mute">{STR.planTasks.hint.replace("{slug}", project.slug)}</p>
      {agents.map((a) => {
        const items = project.planTasks.filter((t) => t.agent === a);
        return (
          <section key={a} aria-label={a}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{ color: toneFor(a).color }}>
              {a}
              <span className="mono rounded-full bg-white/10 px-1.5 text-[11px] font-normal text-mute">{items.length}</span>
            </h3>
            <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
              {items.map((t, i) => (
                <li key={i} className="flex gap-3 px-4 py-2.5 text-sm leading-snug text-[var(--color-ink)]">
                  <span className="mono shrink-0 text-[11px] text-[var(--color-mute)]">{i + 1}</span>
                  <span className="min-w-0">{t.text}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export function TasksView() {
  const { tasks } = useAgentOs();
  return (
    <Gate>
      <Page title={STR.nav.tasks}>
        {tasks.length === 0 ? (
          <PlanTasks />
        ) : (
          <div className="space-y-5" data-testid="tasks">
            {GROUPS.map((g) => {
              const items = tasks.filter((t) => t.status === g);
              if (items.length === 0) return null;
              return (
                <section key={g} aria-label={STR.taskStatus[g]}>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-soft">
                    {STR.taskStatus[g]}
                    <span className="mono rounded-full bg-white/10 px-1.5 text-[11px] font-normal text-mute">{items.length}</span>
                  </h3>
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                    {items.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Page>
    </Gate>
  );
}

export function ProjectsView() {
  const { projects } = useAgentOs();
  return (
    <Gate needsSession={false}>
      <Page title={STR.nav.projects}>
        {projects.length === 0 ? (
          <EmptyState {...STR.empty.projects} />
        ) : (
          <div className="space-y-3" data-testid="projects">
            {projects.map((p) => (
              <DeliverableChecklist key={p.slug} project={p} />
            ))}
          </div>
        )}
      </Page>
    </Gate>
  );
}

export function MemoryView() {
  const { memories } = useAgentOs();
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (memories.length && !memories.some((m) => m.agent === sel)) setSel(memories[0].agent);
  }, [memories, sel]);

  const current = memories.find((m) => m.agent === sel);

  return (
    <Gate needsSession={false}>
      <Page title={STR.nav.memory}>
        {memories.length === 0 || !current ? (
          <EmptyState {...STR.empty.memory} />
        ) : (
          <div data-testid="memory">
            <div role="tablist" aria-label={STR.nav.memory} className="mb-3 flex gap-1 overflow-x-auto">
              {memories.map((m) => {
                const tone = toneFor(m.agent);
                const on = m.agent === sel;
                return (
                  <button key={m.agent} role="tab" type="button" aria-selected={on} onClick={() => setSel(m.agent)} className="tab" style={{ "--tone": tone.color, "--tone-soft": tone.soft } as React.CSSProperties}>
                    {m.agent}
                  </button>
                );
              })}
            </div>
            <div role="tabpanel" className="rounded-xl border border-line bg-surface p-4">
              <p className="mb-3 text-[11px] text-mute">
                {STR.updated} {formatDateTime(current.updatedAt)}
              </p>
              <pre className="mono whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-soft">{current.content}</pre>
            </div>
          </div>
        )}
      </Page>
    </Gate>
  );
}
