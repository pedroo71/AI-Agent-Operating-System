// Agrupa agentes por nome (um nó por agente "lógico") e deriva arestas das mensagens.
import type { Agent, AgentEvent } from "./types";

export const CORE_ALIASES = ["team-lead", "tech-lead", "main"];

export interface TeamNode {
  /** Nome em minúsculas: chave estável do nó. */
  key: string;
  name: string;
  /** Instância representativa (a mais recente e viva). */
  rep: Agent;
  /** Ids de todas as instâncias com este nome (agentes respawnados). */
  ids: string[];
  isCore: boolean;
  toolCalls: number;
  tokens?: number;
}

export interface TeamEdge {
  a: string;
  b: string;
  from: string;
  to: string;
  text: string;
  /** Momento em que o cliente viu a mensagem (ou o seu ts, no carregamento inicial). */
  arrivedAt: number;
  lastTs: number;
}

export const cleanName = (n: string) => n.toLowerCase().split("@")[0].trim();

export function buildTeam(agents: Agent[]): TeamNode[] {
  const groups = new Map<string, Agent[]>();
  for (const a of agents) {
    const k = cleanName(a.name);
    const g = groups.get(k);
    if (g) g.push(a);
    else groups.set(k, [a]);
  }
  const nodes: TeamNode[] = [];
  for (const [key, list] of groups) {
    const byRecent = [...list].sort((x, y) => y.lastEventAt.localeCompare(x.lastEventAt));
    const rep = byRecent.find((a) => a.status !== "finished") ?? byRecent[0];
    const tokens = list.reduce((s, a) => s + (a.tokens ?? 0), 0);
    nodes.push({
      key,
      name: rep.name,
      rep,
      ids: list.map((a) => a.id),
      isCore: list.some((a) => a.id === "main"),
      toolCalls: list.reduce((s, a) => s + a.toolCalls, 0),
      tokens: list.some((a) => a.tokens != null) ? tokens : undefined,
    });
  }
  // Núcleo primeiro; os restantes por nome para as posições não saltarem.
  nodes.sort((x, y) => Number(y.isCore) - Number(x.isCore) || x.key.localeCompare(y.key));
  return nodes;
}

export function resolveKey(raw: string | undefined, nodes: TeamNode[]): string | null {
  if (!raw) return null;
  const k = cleanName(raw);
  if (nodes.some((n) => n.key === k)) return k;
  if (CORE_ALIASES.includes(k)) return nodes.find((n) => n.isCore)?.key ?? null;
  return null;
}

/** Extremos de uma mensagem: `from`/`to` do contrato; sem eles, interpreta o `summary` ("→ nome:" / "← nome:"). */
export function messageEnds(e: AgentEvent, ownerName: string | undefined): { from?: string; to?: string } {
  if (e.from || e.to) return { from: e.from, to: e.to };
  const m = /^([→←])\s*([^:]+):/.exec(e.summary);
  if (!m) return {};
  return m[1] === "→" ? { from: ownerName, to: m[2].trim() } : { from: m[2].trim(), to: ownerName };
}

/** Texto curto para a bolha: sem o prefixo "→ nome:"; mensagens JSON mostram o tipo. */
export function bubbleText(summary: string, max = 48): string {
  let t = summary.replace(/^[→←]\s*[^:]+:\s*/, "").trim();
  const type = /^\{\s*"type"\s*:\s*"([^"]+)"/.exec(t);
  if (type) t = type[1].replace(/_/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function shortLabel(name: string): string {
  return cleanName(name).split("-")[0].replace(/end$/, "").toUpperCase().slice(0, 7);
}

export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export const EDGE_ACTIVE_MS = 4000;
