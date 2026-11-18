// Tipos do modelo de dados (ver docs/DESIGN.md § Modelo de dados e docs/API_CONTRACT.md).

export type AgentStatus = 'active' | 'idle' | 'finished';
export type EventKind = 'prompt' | 'text' | 'tool_call' | 'tool_result' | 'message' | 'system';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Session {
  id: string;
  cwd: string;
  title: string;
  startedAt: string;
  lastEventAt: string;
  teamName?: string;
  agentCount: number;
}

export interface Agent {
  id: string;
  name: string;
  agentType: string;
  model?: string;
  description?: string;
  parentToolUseId?: string;
  status: AgentStatus;
  lastEventAt: string;
  currentAction?: string;
  toolCalls: number;
  tokens?: number;
}

export interface AgentEvent {
  id: string;
  sessionId: string;
  agentId: string;
  ts: string;
  kind: EventKind;
  tool?: string;
  summary: string;
  isError?: boolean;
  /** Só em `message`: nome do remetente e do destinatário. */
  from?: string;
  to?: string;
}

export interface Task {
  id: string;
  subject: string;
  status: TaskStatus;
  owner?: string;
  blockedBy: string[];
}

export interface Project {
  slug: string;
  deliverables: { name: string; path: string; present: boolean }[];
  bugs: { id: string; severity: string; open: boolean }[];
  /** Tarefas por agente lidas de `docs/PLAN.md` § Tarefas (sem estado ao vivo). */
  planTasks: PlanTask[];
}

export interface PlanTask {
  agent: string;
  text: string;
}

export interface Memory {
  agent: string;
  content: string;
  updatedAt: string;
}

export interface AgentMeta {
  agentType?: string;
  name?: string;
  description?: string;
  toolUseId?: string;
  model?: string;
  finished?: boolean;
}

export interface TeamConfig {
  name: string;
  leadSessionId?: string;
  members: { agentId?: string; name: string; agentType?: string }[];
}
