"use client";

import { useEffect, useRef, useState } from "react";
import { USE_MOCKS } from "@/lib/client/api";
import { MOCK_AGENTS, mockEvent } from "@/lib/client/mocks";
import type { Agent, AgentEvent, LiveStatus, Project, Session, Task } from "@/lib/client/types";

export interface StreamHandlers {
  onEvent: (e: AgentEvent) => void;
  onAgent: (a: Agent) => void;
  onTasks: (t: Task[]) => void;
  onSession: (s: Session) => void;
  onProjects: (p: Project[]) => void;
  /** Chamado após reconectar, para voltar a ler o estado completo (eventos perdidos). */
  onResync: () => void;
}

const MIN_DELAY = 1000;
const MAX_DELAY = 10_000;

/**
 * Liga a /api/stream?session=:id, expõe o estado da ligação e reconecta com
 * recuo exponencial (1 s → 10 s). Sem sessão não liga.
 */
export function useLiveStream(sessionId: string | null, handlers: StreamHandlers): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!sessionId) {
      setStatus("connecting");
      return;
    }
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = MIN_DELAY;
    let disposed = false;
    let hadConnection = false;

    // Modo mock: gera um evento novo de poucos em poucos segundos.
    if (USE_MOCKS) {
      setStatus("live");
      let i = 100;
      const iv = setInterval(() => {
        const ev = mockEvent(i++);
        ref.current.onEvent(ev);
        const a = MOCK_AGENTS.find((x) => x.id === ev.agentId);
        if (a) ref.current.onAgent({ ...a, status: "active", lastEventAt: ev.ts, currentAction: ev.summary });
      }, 3500);
      return () => clearInterval(iv);
    }

    const parse = <T,>(raw: MessageEvent, fn: (v: T) => void) => {
      try {
        fn(JSON.parse(raw.data) as T);
      } catch {
        /* mensagem inválida: ignora */
      }
    };

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      es = new EventSource(`/api/stream?session=${encodeURIComponent(sessionId)}`);
      es.onopen = () => {
        delay = MIN_DELAY;
        setStatus("live");
        if (hadConnection) ref.current.onResync();
        hadConnection = true;
      };
      es.addEventListener("event", (m) => parse<AgentEvent>(m as MessageEvent, (v) => ref.current.onEvent(v)));
      es.addEventListener("agent", (m) => parse<Agent>(m as MessageEvent, (v) => ref.current.onAgent(v)));
      es.addEventListener("tasks", (m) => parse<{ tasks: Task[] }>(m as MessageEvent, (v) => ref.current.onTasks(v.tasks)));
      es.addEventListener("session", (m) => parse<Session>(m as MessageEvent, (v) => ref.current.onSession(v)));
      es.addEventListener("projects", (m) =>
        parse<{ projects: Project[] }>(m as MessageEvent, (v) => ref.current.onProjects(v.projects)),
      );
      es.onerror = () => {
        // Fechamos sempre e reconectamos nós, para controlar o recuo e o estado.
        es?.close();
        es = null;
        if (disposed) return;
        setStatus("disconnected");
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, MAX_DELAY);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [sessionId]);

  return status;
}
