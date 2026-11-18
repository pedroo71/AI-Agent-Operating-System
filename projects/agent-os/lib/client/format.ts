import type { Agent, AgentStatus } from "./types";

const ACTIVE_WINDOW_MS = 60_000;

/** Estado mostrado: recalculado no cliente para um agente ativo passar a inativo sem novo pedido. */
export function displayStatus(agent: Agent, now: number): AgentStatus {
  if (agent.status === "finished") return "finished";
  return now - new Date(agent.lastEventAt).getTime() < ACTIVE_WINDOW_MS ? "active" : "idle";
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "short" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "agora";
  if (s < 60) return `há ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("pt-PT");
}

export function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")} k`;
  return String(n);
}

/** Estado mostrado; antes de montar (now = 0) usa o estado do servidor. */
export function statusOf(agent: Agent, now: number): AgentStatus {
  return now ? displayStatus(agent, now) : agent.status;
}

/** "claude-sonnet-5-5" -> "Sonnet 5.5". */
export function formatModel(model?: string): string {
  if (!model) return "—";
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model);
  if (!m) return model;
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}

export function formatHM(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
