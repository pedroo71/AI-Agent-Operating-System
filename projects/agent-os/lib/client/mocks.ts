// Mocks tipados, iguais ao contrato. Ativados com NEXT_PUBLIC_AGENT_OS_MOCKS=1.
import type { Agent, AgentEvent, Memory, Project, Session, SessionDetail, Task } from "./types";

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

export const MOCK_SESSION: Session = {
  id: "mock-session",
  cwd: "C:\\Users\\demo\\product-team",
  title: "Agent OS (exemplo)",
  startedAt: iso(3_600_000),
  lastEventAt: iso(4000),
  teamName: "agent-os",
  agentCount: 4,
};

export const MOCK_AGENTS: Agent[] = [
  { id: "main", name: "tech-lead", agentType: "tech-lead", model: "claude-opus-5-5", status: "active", lastEventAt: iso(4000), currentAction: "SendMessage: → frontend-dev", toolCalls: 42, tokens: 182_000 },
  { id: "a1", name: "frontend-dev", agentType: "frontend-dev", model: "claude-sonnet-5-5", status: "active", lastEventAt: iso(9000), currentAction: "Write: components/Window.tsx", toolCalls: 17, tokens: 64_300 },
  { id: "a2", name: "backend-dev", agentType: "backend-dev", model: "claude-sonnet-5-5", status: "idle", lastEventAt: iso(240_000), currentAction: "Bash: npm run test", toolCalls: 29, tokens: 71_900 },
  { id: "a3", name: "qa-engineer", agentType: "qa-engineer", status: "finished", lastEventAt: iso(1_200_000), toolCalls: 8, tokens: 12_000 },
];

const KINDS: Pick<AgentEvent, "kind" | "tool" | "summary" | "isError">[] = [
  { kind: "tool_call", tool: "Read", summary: "docs/DESIGN.md" },
  { kind: "tool_result", summary: "ok" },
  { kind: "tool_call", tool: "Write", summary: "components/Window.tsx" },
  { kind: "text", summary: "A janela já arrasta e foca ao clicar." },
  { kind: "tool_call", tool: "Bash", summary: "npm run build" },
  { kind: "tool_result", summary: "Falhou: erro de tipos em Taskbar.tsx", isError: true },
  { kind: "message", tool: "SendMessage", summary: "→ backend-dev: preciso do campo tokens em Agent" },
];

export function mockEvent(i: number, agentId?: string): AgentEvent {
  const a = MOCK_AGENTS[agentId ? MOCK_AGENTS.findIndex((x) => x.id === agentId) : i % 3] ?? MOCK_AGENTS[0];
  const k = KINDS[i % KINDS.length];
  return { id: `mock-ev-${i}-${Math.random().toString(36).slice(2, 6)}`, sessionId: MOCK_SESSION.id, agentId: a.id, ts: new Date().toISOString(), ...k };
}

export const MOCK_EVENTS: AgentEvent[] = Array.from({ length: 24 }, (_, i) => ({
  ...mockEvent(i),
  id: `mock-ev-seed-${i}`,
  ts: iso((24 - i) * 20_000),
}));

export const MOCK_TASKS: Task[] = [
  { id: "1", subject: "Shell desktop e gestor de janelas", status: "completed", owner: "frontend-dev", blockedBy: [] },
  { id: "2", subject: "Ligar hook useLiveStream ao /api/stream", status: "in_progress", owner: "frontend-dev", blockedBy: ["4"] },
  { id: "3", subject: "Plano de testes", status: "completed", owner: "qa-engineer", blockedBy: [] },
  { id: "4", subject: "Endpoint SSE com watcher incremental", status: "in_progress", owner: "backend-dev", blockedBy: [] },
  { id: "5", subject: "Auditoria de SEO", status: "pending", blockedBy: ["2"] },
];

export const MOCK_PROJECTS: Project[] = [
  {
    slug: "agent-os",
    deliverables: [
      { name: "Aplicação a correr", path: "README.md", present: false },
      { name: "Relatório de testes", path: "docs/qa/TEST_REPORT.md", present: false },
      { name: "Especificação de SEO", path: "docs/seo/SEO_SPEC.md", present: true },
      { name: "Documentação técnica", path: "docs/TECHNICAL.md", present: false },
      { name: "Documentação funcional", path: "docs/FUNCTIONAL.md", present: false },
    ],
    bugs: [
      { id: "BUG-001", severity: "alta", open: true },
      { id: "BUG-002", severity: "baixa", open: false },
    ],
    planTasks: [{ agent: "backend-dev", text: "Parser + API REST a devolver dados reais." }],
  },
];

export const MOCK_MEMORIES: Memory[] = [
  { agent: "frontend-dev", content: "# frontend-dev — lições\n\n- Ao receber um contrato, escrever mocks tipados primeiro.", updatedAt: iso(86_400_000) },
  { agent: "backend-dev", content: "# backend-dev — lições\n\n- Ler só os bytes novos de cada ficheiro.", updatedAt: iso(172_800_000) },
];

export const MOCK_DETAIL: SessionDetail = {
  session: MOCK_SESSION,
  agents: MOCK_AGENTS,
  events: MOCK_EVENTS,
  tasks: MOCK_TASKS,
};
