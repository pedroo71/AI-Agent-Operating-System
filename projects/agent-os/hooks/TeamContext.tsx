"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAgentOs } from "./AgentOsContext";
import { useNow } from "./useNow";
import { bubbleText, buildTeam, edgeKey, messageEnds, resolveKey, type TeamEdge, type TeamNode } from "@/lib/client/team";

interface TeamCtx {
  nodes: TeamNode[];
  edges: TeamEdge[];
  now: number;
  /** Nó a que pertence um id de agente. */
  nodeOf: (agentId: string | null | undefined) => TeamNode | undefined;
  selectedNode: TeamNode | undefined;
}

const Ctx = createContext<TeamCtx | null>(null);

interface Seen {
  sid: string | null;
  arrival: Map<string, number>;
  init: boolean;
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const { agents, events, sessionId, selectedAgentId, selectAgent } = useAgentOs();
  const now = useNow(1000);
  const nodes = useMemo(() => buildTeam(agents), [agents]);
  const seen = useRef<Seen>({ sid: null, arrival: new Map(), init: false });

  const edges = useMemo(() => {
    const st = seen.current;
    if (st.sid !== sessionId) {
      st.sid = sessionId;
      st.arrival = new Map();
      st.init = false;
    }
    const nameById = new Map(agents.map((a) => [a.id, a.name]));
    const out = new Map<string, TeamEdge>();
    for (const e of events) {
      if (e.kind !== "message") continue;
      const ts = new Date(e.ts).getTime();
      let arr = st.arrival.get(e.id);
      if (arr === undefined) {
        // Depois do carregamento inicial, "chegou agora"; no inicial, vale o ts do evento.
        arr = st.init ? Math.max(Date.now(), ts) : ts;
        st.arrival.set(e.id, arr);
      }
      const ends = messageEnds(e, nameById.get(e.agentId));
      const from = resolveKey(ends.from, nodes);
      const to = resolveKey(ends.to, nodes);
      if (!from || !to || from === to) continue;
      const key = edgeKey(from, to);
      const prev = out.get(key);
      if (!prev || arr >= prev.arrivedAt) {
        out.set(key, { a: key.split("|")[0], b: key.split("|")[1], from, to, text: bubbleText(e.summary), arrivedAt: arr, lastTs: ts });
      }
    }
    if (events.length > 0 && nodes.length > 0) st.init = true;
    return [...out.values()];
  }, [events, agents, nodes, sessionId]);

  const nodeByAgent = useMemo(() => {
    const m = new Map<string, TeamNode>();
    for (const n of nodes) for (const id of n.ids) m.set(id, n);
    return m;
  }, [nodes]);
  const nodeOf = useMemo(() => (id: string | null | undefined) => (id ? nodeByAgent.get(id) : undefined), [nodeByAgent]);
  const selectedNode = nodeOf(selectedAgentId);

  // Seleção por omissão: o agente ativo mais recente.
  useEffect(() => {
    if (selectedNode || agents.length === 0) return;
    const live = nodes.filter((n) => n.rep.status !== "finished");
    const pool = live.length ? live : nodes;
    const best = [...pool].sort((x, y) => y.rep.lastEventAt.localeCompare(x.rep.lastEventAt))[0];
    if (best) selectAgent(best.rep.id);
  }, [selectedNode, agents.length, nodes, selectAgent]);

  const value = useMemo(() => ({ nodes, edges, now, nodeOf, selectedNode }), [nodes, edges, now, nodeOf, selectedNode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeam(): TeamCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTeam fora de TeamProvider");
  return c;
}
