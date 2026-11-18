// Cliente da API (docs/API_CONTRACT.md). Com NEXT_PUBLIC_AGENT_OS_MOCKS=1 devolve mocks.
import type { Agent, AgentEvent, Memory, Project, Session, SessionDetail } from "./types";
import { MOCK_AGENTS, MOCK_DETAIL, MOCK_EVENTS, MOCK_MEMORIES, MOCK_PROJECTS, MOCK_SESSION } from "./mocks";

export const USE_MOCKS = process.env.NEXT_PUBLIC_AGENT_OS_MOCKS === "1";

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { cache: "no-store", signal });
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      /* corpo não é JSON */
    }
    throw new ApiError(code, message);
  }
  return (await res.json()) as T;
}

export async function fetchSessions(signal?: AbortSignal): Promise<Session[]> {
  if (USE_MOCKS) return [MOCK_SESSION];
  return (await get<{ sessions: Session[] }>("/api/sessions", signal)).sessions;
}

export async function fetchSession(id: string, events = 300, signal?: AbortSignal): Promise<SessionDetail> {
  if (USE_MOCKS) return MOCK_DETAIL;
  return get<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}?events=${events}`, signal);
}

export async function fetchAgentEvents(
  sessionId: string,
  agentId: string,
  signal?: AbortSignal,
): Promise<{ agent: Agent; events: AgentEvent[] }> {
  if (USE_MOCKS) {
    const agent = MOCK_AGENTS.find((a) => a.id === agentId) ?? MOCK_AGENTS[0];
    return { agent, events: MOCK_EVENTS.filter((e) => e.agentId === agent.id) };
  }
  return get(`/api/sessions/${encodeURIComponent(sessionId)}/agents/${encodeURIComponent(agentId)}/events?limit=200`, signal);
}

export async function fetchProjects(signal?: AbortSignal): Promise<Project[]> {
  if (USE_MOCKS) return MOCK_PROJECTS;
  return (await get<{ projects: Project[] }>("/api/projects", signal)).projects;
}

export async function fetchMemories(signal?: AbortSignal): Promise<Memory[]> {
  if (USE_MOCKS) return MOCK_MEMORIES;
  return (await get<{ memories: Memory[] }>("/api/memory", signal)).memories;
}
