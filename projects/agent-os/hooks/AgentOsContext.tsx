"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import * as api from "@/lib/client/api";
import type { Agent, AgentEvent, LiveStatus, Memory, Project, Session, Task } from "@/lib/client/types";
import { useLiveStream } from "./useLiveStream";

const MAX_EVENTS = 2000;

interface State {
  sessions: Session[];
  sessionId: string | null;
  manualPick: boolean;
  session: Session | null;
  agents: Agent[];
  /** Cronológico asc. As janelas invertem para mostrar os mais recentes no topo. */
  events: AgentEvent[];
  tasks: Task[];
  /** Projeto da sessão (slug em projects/), deduzido pelo servidor. */
  project: string | null;
  projects: Project[];
  memories: Memory[];
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "sessions"; sessions: Session[] }
  | { type: "pick"; id: string; manual: boolean }
  | { type: "detail"; session: Session; agents: Agent[]; events: AgentEvent[]; tasks: Task[]; project?: string }
  | { type: "event"; event: AgentEvent }
  | { type: "agent"; agent: Agent }
  | { type: "tasks"; tasks: Task[] }
  | { type: "session"; session: Session }
  | { type: "projects"; projects: Project[] }
  | { type: "memories"; memories: Memory[] }
  | { type: "loading"; loading: boolean }
  | { type: "error"; error: string | null };

const initial: State = {
  sessions: [],
  sessionId: null,
  manualPick: false,
  session: null,
  agents: [],
  events: [],
  tasks: [],
  project: null,
  projects: [],
  memories: [],
  loading: true,
  error: null,
};

function mergeEvents(base: AgentEvent[], incoming: AgentEvent[]): AgentEvent[] {
  const seen = new Set(base.map((e) => e.id));
  const add = incoming.filter((e) => !seen.has(e.id));
  if (add.length === 0) return base;
  const all = [...base, ...add].sort((a, b) => a.ts.localeCompare(b.ts));
  return all.length > MAX_EVENTS ? all.slice(all.length - MAX_EVENTS) : all;
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "sessions":
      return { ...s, sessions: a.sessions };
    case "pick":
      return a.id === s.sessionId
        ? { ...s, manualPick: s.manualPick || a.manual }
        : { ...s, sessionId: a.id, manualPick: a.manual, events: [], agents: [], tasks: [], project: null, session: null, loading: true };
    case "detail":
      return {
        ...s,
        session: a.session,
        agents: a.agents,
        events: mergeEvents([], a.events),
        tasks: a.tasks,
        project: a.project ?? null,
        loading: false,
        error: null,
      };
    case "event":
      return { ...s, events: mergeEvents(s.events, [a.event]) };
    case "agent": {
      const i = s.agents.findIndex((x) => x.id === a.agent.id);
      const agents = i === -1 ? [...s.agents, a.agent] : s.agents.map((x, j) => (j === i ? a.agent : x));
      return { ...s, agents };
    }
    case "tasks":
      return { ...s, tasks: a.tasks };
    case "session": {
      const exists = s.sessions.some((x) => x.id === a.session.id);
      const sessions = exists ? s.sessions.map((x) => (x.id === a.session.id ? a.session : x)) : [a.session, ...s.sessions];
      return { ...s, sessions, session: s.sessionId === a.session.id ? a.session : s.session };
    }
    case "projects":
      return { ...s, projects: a.projects };
    case "memories":
      return { ...s, memories: a.memories };
    case "loading":
      return { ...s, loading: a.loading };
    case "error":
      return { ...s, error: a.error, loading: false };
  }
}

interface Ctx extends State {
  live: LiveStatus;
  selectedAgentId: string | null;
  selectAgent: (id: string | null) => void;
  pickSession: (id: string) => void;
  reload: () => void;
}

const AgentOsContext = createContext<Ctx | null>(null);

export function AgentOsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const manualRef = useRef(false);
  manualRef.current = state.manualPick;

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // Sessões + projetos + memória (carga inicial e em cada reload).
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const [sessions, projects, memories] = await Promise.all([
          api.fetchSessions(ctrl.signal),
          api.fetchProjects(ctrl.signal).catch(() => [] as Project[]),
          api.fetchMemories(ctrl.signal).catch(() => [] as Memory[]),
        ]);
        dispatch({ type: "sessions", sessions });
        dispatch({ type: "projects", projects });
        dispatch({ type: "memories", memories });
        if (sessions.length === 0) dispatch({ type: "loading", loading: false });
        else if (!manualRef.current) dispatch({ type: "pick", id: sessions[0].id, manual: false });
      } catch (e) {
        if ((e as Error).name !== "AbortError") dispatch({ type: "error", error: (e as Error).message });
      }
    })();
    return () => ctrl.abort();
  }, [tick]);

  // Detalhe da sessão escolhida.
  useEffect(() => {
    if (!state.sessionId) return;
    const ctrl = new AbortController();
    api
      .fetchSession(state.sessionId, 300, ctrl.signal)
      .then((d) => dispatch({ type: "detail", ...d }))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") dispatch({ type: "error", error: (e as Error).message });
      });
    return () => ctrl.abort();
  }, [state.sessionId, tick]);

  const handlers = useMemo(
    () => ({
      onEvent: (event: AgentEvent) => dispatch({ type: "event", event }),
      onAgent: (agent: Agent) => dispatch({ type: "agent", agent }),
      onTasks: (tasks: Task[]) => dispatch({ type: "tasks", tasks }),
      onSession: (session: Session) => {
        dispatch({ type: "session", session });
        if (!manualRef.current && session.lastEventAt) dispatch({ type: "pick", id: session.id, manual: false });
      },
      onProjects: (projects: Project[]) => dispatch({ type: "projects", projects }),
      onResync: reload,
    }),
    [reload],
  );
  const live = useLiveStream(state.sessionId, handlers);

  const pickSession = useCallback((id: string) => {
    setSelectedAgentId(null);
    dispatch({ type: "pick", id, manual: true });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ...state, live, selectedAgentId, selectAgent: setSelectedAgentId, pickSession, reload }),
    [state, live, selectedAgentId, pickSession, reload],
  );
  return <AgentOsContext.Provider value={value}>{children}</AgentOsContext.Provider>;
}

export function useAgentOs(): Ctx {
  const ctx = useContext(AgentOsContext);
  if (!ctx) throw new Error("useAgentOs fora de AgentOsProvider");
  return ctx;
}
