// Tipos do contrato (docs/DESIGN.md § Modelo de dados, docs/API_CONTRACT.md).

export type AgentStatus = "active" | "idle" | "finished";
export type EventKind = "prompt" | "text" | "tool_call" | "tool_result" | "message" | "system";

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
  /** Só em `message`: nomes dos agentes (API_CONTRACT.md § v2). */
  from?: string;
  to?: string;
}

export interface Task {
  id: string;
  subject: string;
  status: "pending" | "in_progress" | "completed";
  owner?: string;
  blockedBy: string[];
}

export interface Deliverable {
  name: string;
  path: string;
  present: boolean;
}

export interface BugRef {
  id: string;
  severity: string;
  open: boolean;
}

export interface Project {
  slug: string;
  deliverables: Deliverable[];
  bugs: BugRef[];
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

export interface SessionDetail {
  session: Session;
  agents: Agent[];
  events: AgentEvent[];
  tasks: Task[];
  /** Slug do projeto da sessão, quando o servidor o deduz. */
  project?: string;
}

export type LiveStatus = "connecting" | "live" | "disconnected";
