import fs from 'node:fs';
import path from 'node:path';
import { encodeCwd, isSafeId, projectsRoot, tasksRoot, teamsRoot } from './paths';
import { newParseState, parseAgentMeta, parseLine, parseTask, parseTeam, truncate, type ParseState } from './parse';
import type { Agent, AgentEvent, AgentMeta, Session, Task, TeamConfig } from './types';

/**
 * Armazém em memória, singleton (globalThis: sobrevive ao HMR e a bundles duplicados do Next).
 * Cada ficheiro .jsonl tem um Tracker que guarda o offset de bytes já lido: só se lêem bytes novos.
 */

const MAX_EVENTS_PER_FILE = 20000;
export const ACTIVE_WINDOW_MS = 60_000;

export interface Tracker {
  path: string;
  sessionId: string;
  agentId: string;
  agentName?: string;
  offset: number;
  lineNo: number;
  events: AgentEvent[];
  state: ParseState;
  toolCalls: number;
  usage: Map<string, number>;
  lastTs?: string;
  model?: string;
  title?: string;
  cwd?: string;
  startedAt?: string;
  firstPrompt?: string;
  lastAction?: string;
}

export interface ChangeBatch {
  sessionId: string;
  agentId: string;
  events: AgentEvent[];
}

interface StoreShape {
  trackers: Map<string, Tracker>;
  known: Set<string>;
  refs: Map<string, SessionRef>;
  listeners: Set<(b: ChangeBatch) => void>;
  metaCache: Map<string, { mtimeMs: number; meta: AgentMeta }>;
  teamCache: Map<string, { mtimeMs: number; team: TeamConfig | null }>;
  summaryCache: Map<string, { key: string; session: Session }>;
}

const KEY = Symbol.for('agent-os.store.v2');
function store(): StoreShape {
  const g = globalThis as any;
  if (!g[KEY]) {
    g[KEY] = {
      trackers: new Map(),
      known: new Set(),
      refs: new Map(),
      listeners: new Set(),
      metaCache: new Map(),
      teamCache: new Map(),
      summaryCache: new Map(),
    } satisfies StoreShape;
  }
  return g[KEY];
}

export function onChange(fn: (b: ChangeBatch) => void): () => void {
  store().listeners.add(fn);
  return () => store().listeners.delete(fn);
}

/** Apaga todo o estado (usado nos testes, quando CLAUDE_HOME muda). */
export function resetStore(): void {
  const s = store();
  s.trackers.clear();
  s.known.clear();
  s.refs.clear();
  s.metaCache.clear();
  s.teamCache.clear();
  s.summaryCache.clear();
}

// ---------------------------------------------------------------------------
// Leitura incremental

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function applyLine(t: Tracker, obj: unknown, fresh: AgentEvent[]): void {
  const r = parseLine(obj, t.state, { sessionId: t.sessionId, agentId: t.agentId, agentName: t.agentName, fallbackId: `${path.basename(t.path)}#${t.lineNo}` });
  if (r.ts) {
    if (!t.startedAt || r.ts < t.startedAt) t.startedAt = r.ts;
    if (!t.lastTs || r.ts > t.lastTs) t.lastTs = r.ts;
  }
  if (r.cwd && !t.cwd) t.cwd = r.cwd;
  if (r.title) t.title = r.title;
  if (r.model) t.model = r.model;
  if (r.usage) t.usage.set(r.usage.msgId, r.usage.tokens);
  t.toolCalls += r.toolCalls;
  for (const e of r.events) {
    fresh.push(e);
    if (e.kind === 'prompt' && !t.firstPrompt) t.firstPrompt = e.summary;
    if (e.kind === 'tool_call') t.lastAction = truncate(`${e.tool}: ${e.summary}`, 160);
    else if (e.kind === 'message' && e.tool) t.lastAction = truncate(`${e.tool} ${e.summary}`, 160);
    else if (e.kind === 'text') t.lastAction = truncate(e.summary.replace(/\s+/g, ' '), 160);
  }
}

/**
 * Lê os bytes novos de um ficheiro. Só consome linhas completas (terminadas em \n); uma última
 * linha sem \n só é aceite se já for JSON válido. Devolve os eventos novos.
 */
export function syncTracker(t: Tracker, notify: boolean): AgentEvent[] {
  let fd: number | undefined;
  const fresh: AgentEvent[] = [];
  try {
    const st = fs.statSync(t.path);
    if (st.size < t.offset) resetTracker(t); // ficheiro truncado/substituído
    if (st.size === t.offset) return fresh;
    fd = fs.openSync(t.path, 'r');
    const len = st.size - t.offset;
    const buf = Buffer.alloc(len);
    const n = fs.readSync(fd, buf, 0, len, t.offset);
    const data = buf.subarray(0, n);
    const lastNl = data.lastIndexOf(0x0a);
    let consumed = lastNl + 1;
    const complete = data.subarray(0, consumed).toString('utf8');
    for (const line of complete.split('\n')) {
      t.lineNo++;
      if (!line.trim()) continue;
      try {
        applyLine(t, JSON.parse(line), fresh);
      } catch {
        /* linha inválida: ignorada */
      }
    }
    if (consumed < n) {
      const tail = data.subarray(consumed).toString('utf8');
      try {
        const obj = JSON.parse(tail);
        t.lineNo++;
        applyLine(t, obj, fresh);
        consumed = n;
      } catch {
        /* linha parcial: espera pelo resto */
      }
    }
    t.offset += consumed;
  } catch {
    /* ficheiro desapareceu ou ilegível */
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  if (fresh.length) {
    t.events.push(...fresh);
    if (t.events.length > MAX_EVENTS_PER_FILE) t.events.splice(0, t.events.length - MAX_EVENTS_PER_FILE);
    if (notify) {
      const batch = { sessionId: t.sessionId, agentId: t.agentId, events: fresh };
      for (const fn of store().listeners) {
        try {
          fn(batch);
        } catch {
          /* um ouvinte com erro não pára os outros */
        }
      }
    }
  }
  return fresh;
}

function resetTracker(t: Tracker): void {
  t.offset = 0;
  t.lineNo = 0;
  t.events = [];
  t.state = newParseState();
  t.toolCalls = 0;
  t.usage = new Map();
  t.lastTs = t.startedAt = t.model = t.title = t.firstPrompt = t.lastAction = undefined;
}

function getTracker(file: string, sessionId: string, agentId: string): { t: Tracker; created: boolean } {
  const s = store();
  let t = s.trackers.get(file);
  if (t) return { t, created: false };
  t = { path: file, sessionId, agentId, offset: 0, lineNo: 0, events: [], state: newParseState(), toolCalls: 0, usage: new Map() };
  s.trackers.set(file, t);
  return { t, created: true };
}

// ---------------------------------------------------------------------------
// Localizar sessões

export interface SessionRef {
  id: string;
  dir: string;
  mainPath: string;
  subDir: string;
}

function refFor(dir: string, id: string): SessionRef {
  return { id, dir, mainPath: path.join(dir, `${id}.jsonl`), subDir: path.join(dir, id, 'subagents') };
}

export function locateSession(id: string): SessionRef | null {
  if (!isSafeId(id)) return null;
  const s = store();
  const cached = s.refs.get(id);
  if (cached && fs.existsSync(cached.mainPath)) return cached;
  s.refs.delete(id);
  let dirs: string[];
  try {
    dirs = fs.readdirSync(projectsRoot());
  } catch {
    return null;
  }
  for (const d of dirs) {
    const dir = path.join(projectsRoot(), d);
    if (fs.existsSync(path.join(dir, `${id}.jsonl`))) {
      const ref = refFor(dir, id);
      s.refs.set(id, ref);
      return ref;
    }
  }
  return null;
}

export function claudeHomeReadable(): boolean {
  try {
    return fs.statSync(projectsRoot()).isDirectory();
  } catch {
    return false;
  }
}

/** Pastas de projeto (em `projects/`) correspondentes a um cwd; `null` = todas. */
export function projectDirsFor(cwd: string | null): string[] {
  let all: string[];
  try {
    all = fs.readdirSync(projectsRoot());
  } catch {
    return [];
  }
  const full = (d: string) => path.join(projectsRoot(), d);
  if (cwd === null) return all.map(full);
  const enc = encodeCwd(cwd).toLowerCase();
  return all.filter((d) => d.toLowerCase() === enc).map(full);
}

export function listSessionFiles(dirs: string[]): { id: string; dir: string; mtimeMs: number }[] {
  const out: { id: string; dir: string; mtimeMs: number }[] = [];
  for (const dir of dirs) {
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const n of names) {
      const m = /^(.+)\.jsonl$/.exec(n);
      if (!m || !isSafeId(m[1])) continue;
      try {
        out.push({ id: m[1], dir, mtimeMs: fs.statSync(path.join(dir, n)).mtimeMs });
      } catch {
        /* ignora */
      }
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// ---------------------------------------------------------------------------
// Equipas, metas, tarefas

export function findTeam(sessionId: string): TeamConfig | null {
  const s = store();
  let names: string[];
  try {
    names = fs.readdirSync(teamsRoot());
  } catch {
    return null;
  }
  for (const n of names) {
    const file = path.join(teamsRoot(), n, 'config.json');
    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(file).mtimeMs;
    } catch {
      continue;
    }
    let c = s.teamCache.get(file);
    if (!c || c.mtimeMs !== mtimeMs) {
      c = { mtimeMs, team: parseTeam(readJson(file)) };
      s.teamCache.set(file, c);
    }
    if (c.team && c.team.leadSessionId === sessionId) return c.team;
  }
  return null;
}

function readMeta(file: string): AgentMeta {
  const s = store();
  try {
    const mtimeMs = fs.statSync(file).mtimeMs;
    const c = s.metaCache.get(file);
    if (c && c.mtimeMs === mtimeMs) return c.meta;
    const meta = parseAgentMeta(readJson(file));
    s.metaCache.set(file, { mtimeMs, meta });
    return meta;
  } catch {
    return {};
  }
}

export function readTasks(sessionId: string, team: TeamConfig | null): Task[] {
  const dir = path.join(tasksRoot(), team?.name ?? sessionId);
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  const tasks: Task[] = [];
  for (const n of names) {
    const t = parseTask(readJson(path.join(dir, n)), n.replace(/\.json$/, ''));
    if (t) tasks.push(t);
  }
  return tasks.sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.id.localeCompare(b.id);
  });
}

// ---------------------------------------------------------------------------
// Sessão completa

export interface LoadedSession {
  ref: SessionRef;
  session: Session;
  agents: Agent[];
  trackers: Tracker[];
  tasks: Task[];
  team: TeamConfig | null;
}

function listAgentFiles(ref: SessionRef): { id: string; file: string; metaFile: string }[] {
  let names: string[];
  try {
    names = fs.readdirSync(ref.subDir);
  } catch {
    return [];
  }
  const out: { id: string; file: string; metaFile: string }[] = [];
  for (const n of names) {
    const m = /^agent-(.+)\.jsonl$/.exec(n);
    if (!m || !isSafeId(m[1])) continue;
    out.push({ id: m[1], file: path.join(ref.subDir, n), metaFile: path.join(ref.subDir, `agent-${m[1]}.meta.json`) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

const iso = (ms: number) => new Date(ms).toISOString();

export function loadSession(ref: SessionRef): LoadedSession {
  const s = store();
  const late = s.known.has(ref.id); // ficheiros que surgem depois de a sessão ser conhecida notificam desde o 1.º evento
  const trackers: Tracker[] = [];
  const team = findTeam(ref.id);
  const lead = team?.members.find((m) => m.agentType === 'team-lead') ?? team?.members[0];
  const main = getTracker(ref.mainPath, ref.id, 'main');
  main.t.agentName = lead?.name ?? 'main';
  syncTracker(main.t, late || !main.created);
  trackers.push(main.t);
  const subs = listAgentFiles(ref);
  for (const f of subs) {
    const g = getTracker(f.file, ref.id, f.id);
    const m = readMeta(f.metaFile);
    g.t.agentName = m.name ?? m.agentType ?? f.id;
    syncTracker(g.t, late || !g.created);
    trackers.push(g.t);
  }
  s.known.add(ref.id);

  const now = Date.now();
  const agents: Agent[] = [];
  const mk = (t: Tracker, base: Pick<Agent, 'id' | 'name' | 'agentType'> & Partial<Agent>, meta?: AgentMeta, mtimeMs?: number): Agent => {
    const last = t.lastTs ?? (mtimeMs ? iso(mtimeMs) : iso(0));
    const tokens = [...t.usage.values()].reduce((a, b) => a + b, 0);
    const a: Agent = {
      ...base,
      status: meta?.finished ? 'finished' : now - Date.parse(last) < ACTIVE_WINDOW_MS ? 'active' : 'idle',
      lastEventAt: last,
      toolCalls: t.toolCalls,
    };
    const model = t.model ?? meta?.model;
    if (model) a.model = model;
    if (t.lastAction) a.currentAction = t.lastAction;
    if (tokens > 0) a.tokens = tokens;
    return a;
  };
  agents.push(mk(main.t, { id: 'main', name: lead?.name ?? 'main', agentType: lead?.agentType ?? 'main' }));
  subs.forEach((f, i) => {
    const t = trackers[i + 1];
    const meta = readMeta(f.metaFile);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(f.file).mtimeMs;
    } catch {
      /* ignora */
    }
    const base: Agent = {
      id: f.id,
      name: meta.name ?? meta.agentType ?? f.id,
      agentType: meta.agentType ?? 'subagent',
      status: 'idle',
      lastEventAt: '',
      toolCalls: 0,
    };
    if (meta.description) base.description = meta.description;
    if (meta.toolUseId) base.parentToolUseId = meta.toolUseId;
    agents.push(mk(t, base, meta, mtimeMs));
  });

  let mainMtime = 0;
  try {
    mainMtime = fs.statSync(ref.mainPath).mtimeMs;
  } catch {
    /* ignora */
  }
  const lastEventAt = agents.reduce((m, a) => (a.lastEventAt > m ? a.lastEventAt : m), main.t.lastTs ?? iso(mainMtime));
  const session: Session = {
    id: ref.id,
    cwd: main.t.cwd ?? ref.dir,
    title: main.t.title ?? (main.t.firstPrompt ? truncate(main.t.firstPrompt, 80) : `Sessão ${ref.id.slice(0, 8)}`),
    startedAt: main.t.startedAt ?? iso(mainMtime),
    lastEventAt,
    agentCount: agents.length,
  };
  if (team) session.teamName = team.name;
  return { ref, session, agents, trackers, tasks: readTasks(ref.id, team), team };
}

/** Eventos de todos os agentes, ordenados por tempo (estável). */
export function mergedEvents(trackers: Tracker[]): AgentEvent[] {
  const all = trackers.flatMap((t) => t.events);
  return all
    .map((e, i) => [e, i] as const)
    .sort((a, b) => (a[0].ts < b[0].ts ? -1 : a[0].ts > b[0].ts ? 1 : a[1] - b[1]))
    .map(([e]) => e);
}

// ---------------------------------------------------------------------------
// Resumo leve para listas (sem guardar eventos)

/** Último timestamp de um .jsonl, lendo só o fim do ficheiro (0 se não houver). */
function tailTimestamp(file: string): number {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 16384);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = /"timestamp":"([^"]+)"/.exec(lines[i]);
      const ms = m ? Date.parse(m[1]) : NaN;
      if (!Number.isNaN(ms)) return ms;
    }
    return 0;
  } finally {
    fs.closeSync(fd);
  }
}

export function summarizeSession(dir: string, id: string): Session | null {
  const ref = refFor(dir, id);
  const s = store();
  let st: fs.Stats;
  try {
    st = fs.statSync(ref.mainPath);
  } catch {
    return null;
  }
  let subs: { id: string; file: string }[] = [];
  let subMtime = 0;
  subs = listAgentFiles(ref);
  let subLast = 0;
  for (const f of subs) {
    try {
      subMtime = Math.max(subMtime, fs.statSync(f.file).mtimeMs);
      subLast = Math.max(subLast, tailTimestamp(f.file));
    } catch {
      /* ignora */
    }
  }
  const team = findTeam(id);
  const key = `${st.size}:${st.mtimeMs}:${subs.length}:${subMtime}:${team?.name ?? ''}`;
  const cached = s.summaryCache.get(ref.mainPath);
  if (cached && cached.key === key) return cached.session;

  let text = '';
  try {
    text = fs.readFileSync(ref.mainPath, 'utf8');
  } catch {
    return null;
  }
  const lines = text.split('\n');
  const state = newParseState();
  let cwd: string | undefined;
  let startedAt: string | undefined;
  let firstPrompt: string | undefined;
  let title: string | undefined;
  let lastTs: string | undefined;
  const feed = (line: string, n: number, full: boolean) => {
    if (!line.trim()) return;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      return;
    }
    const r = parseLine(obj, state, { sessionId: id, agentId: 'main', fallbackId: `s#${n}` });
    if (r.cwd && !cwd) cwd = r.cwd;
    if (r.ts) {
      if (!startedAt || r.ts < startedAt) startedAt = r.ts;
      if (!lastTs || r.ts > lastTs) lastTs = r.ts;
    }
    if (r.title) title = r.title;
    if (!firstPrompt && full) firstPrompt = r.events.find((e) => e.kind === 'prompt')?.summary;
  };
  const head = Math.min(lines.length, 80);
  for (let i = 0; i < head; i++) feed(lines[i], i, true);
  for (let i = head; i < lines.length; i++) if (lines[i].includes('"ai-title"')) feed(lines[i], i, false);
  for (let i = lines.length - 1, k = 0; i >= head && k < 8; i--, k++) feed(lines[i], i, false);

  const last = Math.max(Date.parse(lastTs ?? '') || 0, subLast) || st.mtimeMs;
  const session: Session = {
    id,
    cwd: cwd ?? dir,
    title: title ?? (firstPrompt ? truncate(firstPrompt, 80) : `Sessão ${id.slice(0, 8)}`),
    startedAt: startedAt ?? iso(st.birthtimeMs || st.mtimeMs),
    lastEventAt: iso(last),
    agentCount: 1 + subs.length,
  };
  if (team) session.teamName = team.name;
  s.summaryCache.set(ref.mainPath, { key, session });
  return session;
}
