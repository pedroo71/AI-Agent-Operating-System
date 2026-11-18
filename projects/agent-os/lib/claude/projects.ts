import fs from 'node:fs';
import path from 'node:path';
import { productTeamDir } from './paths';
import { parseBug } from './parse';
import type { Memory, PlanTask, Project } from './types';

/** Entregáveis do CLAUDE.md (caminhos relativos a `projects/<slug>/`). */
const DELIVERABLES: { name: string; path: string }[] = [
  { name: 'Brief', path: 'docs/BRIEF.md' },
  { name: 'Plano', path: 'docs/PLAN.md' },
  { name: 'Design', path: 'docs/DESIGN.md' },
  { name: 'Contrato da API', path: 'docs/API_CONTRACT.md' },
  { name: 'Plano de testes', path: 'docs/qa/TEST_PLAN.md' },
  { name: 'Relatório de testes', path: 'docs/qa/TEST_REPORT.md' },
  { name: 'Especificação SEO', path: 'docs/seo/SEO_SPEC.md' },
  { name: 'Auditoria SEO', path: 'docs/seo/SEO_AUDIT.md' },
  { name: 'Documentação técnica', path: 'docs/TECHNICAL.md' },
  { name: 'Documentação funcional', path: 'docs/FUNCTIONAL.md' },
  { name: 'README', path: 'README.md' },
];

const nonEmpty = (p: string) => {
  try {
    const st = fs.statSync(p);
    return st.isDirectory() ? fs.readdirSync(p).length > 0 : st.size > 0;
  } catch {
    return false;
  }
};

export function readProjects(): Project[] {
  const root = path.join(productTeamDir(), 'projects');
  let slugs: string[];
  try {
    slugs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
  return slugs.map((slug) => {
    const dir = path.join(root, slug);
    const list = [...DELIVERABLES];
    try {
      if (/marketing material:\s*(yes|sim)/i.test(fs.readFileSync(path.join(dir, 'docs/BRIEF.md'), 'utf8'))) {
        list.push({ name: 'Marketing', path: 'docs/marketing' });
      }
    } catch {
      /* sem brief */
    }
    const bugsDir = path.join(dir, 'docs/qa/bugs');
    let bugs: Project['bugs'] = [];
    try {
      bugs = fs
        .readdirSync(bugsDir)
        .filter((n) => /^BUG-.*\.md$/i.test(n))
        .sort()
        .map((n) => parseBug(n, fs.readFileSync(path.join(bugsDir, n), 'utf8')));
    } catch {
      /* sem bugs */
    }
    let planTasks: PlanTask[] = [];
    try {
      planTasks = parsePlanTasks(fs.readFileSync(path.join(dir, 'docs/PLAN.md'), 'utf8'));
    } catch {
      /* sem plano */
    }
    return { slug, deliverables: list.map((d) => ({ ...d, present: nonEmpty(path.join(dir, d.path)) })), bugs, planTasks };
  });
}

/**
 * Projeto de uma sessão: o `projects/<slug>/` mais referido nas chamadas de ferramentas dos seus
 * agentes (caminhos de Read/Write/Edit, comandos Bash, padrões). Só conta slugs que existem em
 * `known`. Sem referências → undefined (gig, conversa solta).
 */
export function sessionProject(events: { kind: string; summary?: string }[], known: string[]): string | undefined {
  const ok = new Set(known.map((k) => k.toLowerCase()));
  const count = new Map<string, number>();
  const re = /projects[\\/]+([a-z0-9][\w.-]*)/gi;
  for (const e of events) {
    if (e.kind !== 'tool_call' || !e.summary) continue;
    for (const m of e.summary.matchAll(re)) {
      const slug = m[1].toLowerCase();
      if (ok.has(slug)) count.set(slug, (count.get(slug) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  let n = 0;
  for (const [slug, c] of count) if (c > n) [best, n] = [slug, c];
  return best ? known.find((k) => k.toLowerCase() === best) : undefined;
}

/**
 * Tarefas de `PLAN.md`: dentro de `## Tarefas` (ou `## Tasks`), cada `### <agente>` seguido de uma
 * lista numerada ou com marcadores. Só a primeira linha de cada item, sem markdown, até 200 chars.
 */
export function parsePlanTasks(md: string): PlanTask[] {
  const out: PlanTask[] = [];
  let inTasks = false;
  let agent: string | null = null;
  for (const line of md.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2 && !line.startsWith('###')) {
      inTasks = /^(tarefas|tasks)\b/i.test(h2[1]);
      agent = null;
      continue;
    }
    if (!inTasks) continue;
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      agent = h3[1].replace(/[`*_]/g, '').trim();
      continue;
    }
    const item = /^\s{0,3}(?:\d+[.)]|[-*])\s+(.+)$/.exec(line);
    if (agent && item) {
      let text = item[1].replace(/\*\*|__|`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
      if (text.length > 200) text = text.slice(0, 199) + '…';
      if (text) out.push({ agent, text });
    }
  }
  return out;
}

export function readMemories(): Memory[] {
  const root = path.join(productTeamDir(), '.claude', 'agent-memory');
  let agents: string[];
  try {
    agents = fs.readdirSync(root).sort();
  } catch {
    return [];
  }
  const out: Memory[] = [];
  for (const agent of agents) {
    const file = path.join(root, agent, 'MEMORY.md');
    try {
      const st = fs.statSync(file);
      out.push({ agent, content: fs.readFileSync(file, 'utf8'), updatedAt: st.mtime.toISOString() });
    } catch {
      /* sem memória */
    }
  }
  return out;
}

/** Assinatura barata (caminho+mtime+tamanho) dos docs de cada projeto para detetar alterações. */
export function projectsSignature(): string {
  const root = path.join(productTeamDir(), 'projects');
  const parts: string[] = [];
  const walk = (dir: string, depth: number) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < 5) walk(p, depth + 1);
      } else {
        try {
          const st = fs.statSync(p);
          parts.push(`${p}:${st.mtimeMs}:${st.size}`);
        } catch {
          /* ignora */
        }
      }
    }
  };
  let slugs: string[] = [];
  try {
    slugs = fs.readdirSync(root);
  } catch {
    return '';
  }
  for (const s of slugs) {
    walk(path.join(root, s, 'docs'), 0);
    try {
      parts.push(`${s}/README.md:${fs.statSync(path.join(root, s, 'README.md')).mtimeMs}`);
    } catch {
      /* sem README */
    }
  }
  return parts.join('|');
}
