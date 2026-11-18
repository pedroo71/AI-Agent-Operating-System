"use client";

import { useMemo, useState } from "react";
import { useAgentOs } from "@/hooks/AgentOsContext";
import { useTeam } from "@/hooks/TeamContext";
import { EmptyState } from "./EmptyState";
import { EventRow } from "./EventRow";
import { Gate } from "./Gate";
import { STR } from "@/lib/client/strings";

const MAX_RENDER = 300;

/** Feed: todos os eventos da sessão, mais recentes no topo, filtráveis por agente. */
export function FeedPanel() {
  const { events, agents } = useAgentOs();
  const { nodes, nodeOf } = useTeam();
  const [nodeKey, setNodeKey] = useState("");
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const shown = useMemo(() => {
    const out = [];
    for (let i = events.length - 1; i >= 0 && out.length < MAX_RENDER; i--) {
      const e = events[i];
      if (nodeKey && nodeOf(e.agentId)?.key !== nodeKey) continue;
      out.push(e);
    }
    return out;
  }, [events, nodeKey, nodeOf]);

  return (
    <Gate>
      <div className="flex h-full min-h-0 flex-col" data-testid="feed">
        <div className="shrink-0 border-b border-line px-4 py-2.5">
          <label className="block">
            <span className="sr-only">{STR.filterAgent}</span>
            <select className="field w-full" value={nodeKey} onChange={(e) => setNodeKey(e.target.value)}>
              <option value="">{STR.allAgents}</option>
              {nodes.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            {...(events.length === 0 ? STR.empty.feed : STR.empty.feedFiltered)}
            action={
              events.length > 0 ? (
                <button type="button" className="btn" onClick={() => setNodeKey("")}>
                  {STR.clearFilters}
                </button>
              ) : undefined
            }
          />
        ) : (
          <ol className="feed-list min-h-0 flex-1 overflow-y-auto" aria-live="off" aria-label={STR.panel.feed}>
            {shown.map((e) => {
              const a = byId.get(e.agentId);
              return <EventRow key={e.id} event={e} agentName={a?.name} agentType={a?.agentType} />;
            })}
          </ol>
        )}
      </div>
    </Gate>
  );
}
