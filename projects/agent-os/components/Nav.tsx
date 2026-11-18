"use client";

import type { ReactNode } from "react";
import { useUi, type View } from "@/hooks/UiContext";
import { IconFeed, IconFolder, IconMemory, IconTasks, IconTeam } from "./Icons";
import { SessionPicker } from "./SessionPicker";
import { STR } from "@/lib/client/strings";

const ICONS: Record<View, ReactNode> = {
  team: <IconTeam />,
  feed: <IconFeed />,
  tasks: <IconTasks />,
  projects: <IconFolder />,
  memory: <IconMemory />,
};

/** Rail vertical (desktop): Equipa, Tarefas, Projetos, Memória, Sessões. */
export function Rail() {
  const { view, setView } = useUi();
  const items: View[] = ["team", "tasks", "projects", "memory"];
  return (
    <nav aria-label={STR.nav.label} className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-line py-4">
      <div className="mb-4 size-8 rounded-lg bg-accent" aria-hidden="true" />
      {items.map((v) => (
        <button key={v} type="button" className="icon-btn" aria-label={STR.nav[v]} title={STR.nav[v]} aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
          {ICONS[v]}
        </button>
      ))}
      <div className="mt-auto">
        <SessionPicker placement="rail" />
      </div>
    </nav>
  );
}

/** Barra de separadores em baixo (< 768 px): Equipa, Feed, Tarefas, Projetos, Memória. */
export function TabBar() {
  const { view, setView } = useUi();
  const items: View[] = ["team", "feed", "tasks", "projects", "memory"];
  return (
    <nav aria-label={STR.nav.label} className="flex shrink-0 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]">
      {items.map((v) => (
        <button
          key={v}
          type="button"
          aria-label={STR.nav[v]}
          aria-current={view === v ? "page" : undefined}
          onClick={() => setView(v)}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${view === v ? "text-accent" : "text-mute"}`}
        >
          {ICONS[v]}
          <span aria-hidden="true">{STR.nav[v]}</span>
        </button>
      ))}
    </nav>
  );
}
