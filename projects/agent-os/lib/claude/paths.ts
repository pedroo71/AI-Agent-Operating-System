import os from 'node:os';
import path from 'node:path';

/** Pasta do Claude Code (`CLAUDE_HOME`, por omissão `~/.claude`). Lida a cada chamada. */
export function claudeHome(): string {
  const env = process.env.CLAUDE_HOME;
  return env && env.trim() ? path.resolve(env) : path.join(os.homedir(), '.claude');
}

/** Raiz do repositório product-team (`PRODUCT_TEAM_DIR`, por omissão dois níveis acima de `projects/agent-os`). */
export function productTeamDir(): string {
  const env = process.env.PRODUCT_TEAM_DIR;
  return env && env.trim() ? path.resolve(env) : path.resolve(process.cwd(), '..', '..');
}

/** Codifica um cwd como o Claude Code o faz nos nomes de pastas em `projects/`. */
export function encodeCwd(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

export const projectsRoot = () => path.join(claudeHome(), 'projects');
export const teamsRoot = () => path.join(claudeHome(), 'teams');
export const tasksRoot = () => path.join(claudeHome(), 'tasks');

/** IDs de sessão/agente chegam por URL: só caracteres seguros (evita path traversal). */
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
export const isSafeId = (s: string) => SAFE_ID.test(s);
