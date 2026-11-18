"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAgentOs } from "@/hooks/AgentOsContext";
import { useTeam } from "@/hooks/TeamContext";
import { useUi } from "@/hooks/UiContext";
import { EmptyState } from "./EmptyState";
import { EventRow } from "./EventRow";
import * as api from "@/lib/client/api";
import { toneFor } from "@/lib/client/agentColors";
import { compactTokens, formatModel, statusOf } from "@/lib/client/format";
import { STR } from "@/lib/client/strings";
import type { AgentEvent } from "@/lib/client/types";

/** Inspetor: resumo do agente selecionado e a sua linha temporal cronológica (mais recente no fim). */
export function Inspector() {
  const { sessionId, events } = useAgentOs();
  const { selectedNode: node, now } = useTeam();
  const { focus } = useUi();
  const [history, setHistory] = useState<AgentEvent[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  const idsKey = node ? node.ids.join(",") : "";

  // Histórico de cada instância do agente (a API devolve só o recente; o stream completa o resto).
  useEffect(() => {
    setHistory([]);
    setOnlyErrors(false);
    stick.current = true;
    if (!node || !sessionId) return;
    const ctrl = new AbortController();
    Promise.all(node.ids.map((id) => api.fetchAgentEvents(sessionId, id, ctrl.signal).then((r) => r.events).catch(() => [] as AgentEvent[])))
      .then((all) => {
        if (ctrl.signal.aborted) return;
        setHistory(all.flat());
        setLoadedKey(idsKey);
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, sessionId]);

  const list = useMemo(() => {
    if (!node) return [];
    const ids = new Set(node.ids);
    const map = new Map<string, AgentEvent>();
    for (const e of history) map.set(e.id, e);
    for (const e of events) if (ids.has(e.agentId)) map.set(e.id, e);
    return [...map.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  }, [history, events, node]);

  const errorList = useMemo(() => list.filter((e) => e.isError), [list]);
  const errors = errorList.length;
  const shown = onlyErrors ? errorList : list;

  // Segue o fim enquanto o utilizador lá estiver.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [list.length, idsKey]);

  // Salto vindo da linha do tempo da sessão: centra o evento mais próximo desse momento.
  useEffect(() => {
    if (!focus || list.length === 0) return;
    let best = list[0];
    let bestD = Infinity;
    for (const e of list) {
      const d = Math.abs(new Date(e.ts).getTime() - focus.ts);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    stick.current = false;
    setFlash(best.id);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(best.id)}"]`);
    el?.scrollIntoView({ block: "center" });
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, loadedKey, list.length > 0]);

  if (!node) return <EmptyState {...STR.empty.inspector} />;

  const tone = toneFor(node.name, node.rep.agentType);
  const status = statusOf(node.rep, now);

  return (
    <div className="flex h-full min-h-0 flex-col" data-agent={node.name}>
      <div className="shrink-0 space-y-3.5 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="size-3.5 shrink-0 rounded-full" style={{ background: tone.color }} aria-hidden="true" />
          <h3 className="truncate text-xl font-bold">{node.name}</h3>
          <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: tone.soft, color: tone.color }}>
            {STR.status[status]}
          </span>
        </div>
        {node.rep.description && <p className="truncate text-xs text-mute">{node.rep.description}</p>}
        <dl className="grid grid-cols-4 gap-2 md:grid-cols-2">
          <Stat label={STR.inspector.tools} value={String(node.toolCalls)} />
          <button
            type="button"
            onClick={() => setOnlyErrors((v) => !v)}
            disabled={errors === 0}
            aria-pressed={onlyErrors}
            title={STR.inspector.errorsHint}
            data-testid="inspector-errors"
            className={`min-w-0 rounded-[10px] bg-surface p-2.5 text-left enabled:hover:bg-line disabled:cursor-default ${onlyErrors ? "ring-1 ring-accent" : ""}`}
          >
            <span className="block truncate text-[11px] text-mute">{STR.inspector.errors}</span>
            <span className={`mt-0.5 block truncate text-base font-semibold md:text-lg ${errors ? "text-err" : ""}`}>{errors}</span>
          </button>
          <Stat label={STR.inspector.model} value={formatModel(node.rep.model)} small />
          <Stat label={STR.inspector.tokens} value={node.tokens != null ? compactTokens(node.tokens) : "—"} />
        </dl>
        {onlyErrors && (
          <div className="flex items-center justify-between gap-2 text-xs text-mute" role="status">
            <span>{STR.inspector.errorsOnly} ({errors})</span>
            <button type="button" onClick={() => setOnlyErrors(false)} className="min-h-[44px] px-2 text-accent hover:underline">
              {STR.inspector.showAll}
            </button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState {...STR.empty.inspectorNone} />
      ) : (
        <ol
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="feed-list min-h-0 flex-1 overflow-y-auto border-t border-line"
          aria-label={`${STR.inspector.activity} ${node.name}`}
          data-testid="inspector-timeline"
        >
          {shown.map((e, i) => (
            <EventRow key={e.id} event={e} agentName={node.name} agentType={node.rep.agentType} showAgent={false} latest={i === shown.length - 1} focused={flash === e.id} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ label, value, tone, small }: { label: string; value: string; tone?: string; small?: boolean }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-surface p-2.5">
      <dt className="truncate text-[11px] text-mute">{label}</dt>
      <dd className={`mt-0.5 truncate font-semibold ${small ? "text-xs md:text-sm" : "text-base md:text-lg"} ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}
