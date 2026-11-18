import type { AgentEvent, AgentMeta, Task, TaskStatus, TeamConfig } from './types';

const MAX_TEXT = 500;

export function truncate(s: string, max = MAX_TEXT): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Resumo de uma chamada de ferramenta (regras em API_CONTRACT.md § Regras). */
export function summarizeToolCall(name: string, input: unknown): string {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return truncate(str(i.file_path) ?? str(i.notebook_path) ?? str(i.path) ?? name);
    case 'Bash':
      return truncate(oneLine(str(i.description) ?? str(i.command) ?? name), 120);
    case 'Grep':
    case 'Glob':
      return truncate(str(i.pattern) ?? name);
    case 'Agent':
    case 'Task': {
      const t = str(i.subagent_type);
      const d = str(i.description);
      return truncate(t && d ? `${t}: ${d}` : (t ?? d ?? name));
    }
    case 'SendMessage': {
      const to = str(i.to) ?? '?';
      const m = i.message;
      let body: string;
      if (typeof m === 'string') body = str(i.summary) ?? m;
      else if (m && typeof m === 'object') body = str((m as Record<string, unknown>).type) ?? str(i.summary) ?? '';
      else body = str(i.summary) ?? '';
      return truncate(`→ ${to}: ${oneLine(body).slice(0, 120)}`);
    }
    default:
      return truncate(name);
  }
}

/** Estado do parser por ficheiro (ligação tool_use → tool_result). */
export interface ParseState {
  toolNames: Map<string, string>;
  pending: Set<string>;
}
export const newParseState = (): ParseState => ({ toolNames: new Map(), pending: new Set() });

export interface LineResult {
  events: AgentEvent[];
  ts?: string;
  cwd?: string;
  title?: string;
  model?: string;
  usage?: { msgId: string; tokens: number };
  toolCalls: number;
}

const TEAMMATE_RE = /<teammate-message\b([^>]*)>([\s\S]*?)<\/teammate-message>/g;
const REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

const unescapeHtml = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function attr(attrs: string, key: string): string | undefined {
  const m = new RegExp(`${key}="([^"]*)"`).exec(attrs);
  return m ? unescapeHtml(m[1]) : undefined;
}

function blockText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === 'object' && (b as { type?: string }).type === 'text' ? String((b as { text?: unknown }).text ?? '') : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

/**
 * Converte uma linha (já em JSON) de uma transcrição em eventos.
 * Tipos desconhecidos devolvem resultado vazio; o conteúdo de `thinking` nunca é devolvido.
 */
export function parseLine(
  obj: unknown,
  state: ParseState,
  ctx: { sessionId: string; agentId: string; fallbackId: string; agentName?: string },
): LineResult {
  const out: LineResult = { events: [], toolCalls: 0 };
  if (!obj || typeof obj !== 'object') return out;
  const o = obj as Record<string, any>;
  const ts = typeof o.timestamp === 'string' && !Number.isNaN(Date.parse(o.timestamp)) ? o.timestamp : undefined;
  if (ts) out.ts = ts;
  if (typeof o.cwd === 'string') out.cwd = o.cwd;

  if (o.type === 'ai-title') {
    const t = str(o.aiTitle) ?? str(o.title);
    if (t) out.title = t;
    return out;
  }
  const self = ctx.agentName ?? ctx.agentId;
  const baseId = typeof o.uuid === 'string' ? o.uuid : ctx.fallbackId;
  const mk = (idx: number | string, kind: AgentEvent['kind'], summary: string, extra: Partial<AgentEvent> = {}): AgentEvent => ({
    id: `${baseId}:${idx}`,
    sessionId: ctx.sessionId,
    agentId: ctx.agentId,
    ts: ts!,
    kind,
    summary,
    ...extra,
  });

  if (o.type === 'system') {
    if (ts && typeof o.content === 'string' && o.content.trim()) out.events.push(mk(0, 'system', truncate(o.content.trim())));
    return out;
  }
  if ((o.type !== 'user' && o.type !== 'assistant') || !o.message || typeof o.message !== 'object') return out;
  const msg = o.message as Record<string, any>;

  if (o.type === 'assistant') {
    if (typeof msg.model === 'string') out.model = msg.model;
    const u = msg.usage;
    if (u && typeof msg.id === 'string') {
      const n = (x: unknown) => (typeof x === 'number' ? x : 0);
      out.usage = { msgId: msg.id, tokens: n(u.input_tokens) + n(u.output_tokens) + n(u.cache_creation_input_tokens) };
    }
  }
  if (!ts) return out;

  const blocks: any[] = typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : Array.isArray(msg.content) ? msg.content : [];
  let idx = 0;
  for (const b of blocks) {
    const i = idx++;
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && typeof b.text === 'string') {
      if (o.type === 'assistant') {
        const t = b.text.trim();
        if (t) out.events.push(mk(i, 'text', truncate(t)));
        continue;
      }
      // user: mensagens de colegas, prompts reais; ignora system-reminder
      let rest = b.text.replace(REMINDER_RE, '');
      let n = 0;
      rest = rest.replace(TEAMMATE_RE, (_m: string, attrs: string, body: string) => {
        const from = attr(attrs, 'teammate_id') ?? '?';
        const sum = attr(attrs, 'summary') ?? oneLine(body).slice(0, 120);
        out.events.push(mk(`${i}.${n++}`, 'message', truncate(`← ${from}: ${sum}`), { from, to: self }));
        return '';
      });
      rest = rest.trim();
      if (rest && !o.isMeta) out.events.push(mk(i, 'prompt', truncate(rest)));
    } else if (b.type === 'tool_use' && typeof b.name === 'string') {
      out.toolCalls++;
      if (typeof b.id === 'string') {
        state.toolNames.set(b.id, b.name);
        state.pending.add(b.id);
      }
      const summary = summarizeToolCall(b.name, b.input);
      if (b.name === 'SendMessage') {
        out.events.push(mk(i, 'message', summary, { tool: b.name, from: self, to: str(b.input?.to) ?? '?' }));
      } else {
        out.events.push(mk(i, 'tool_call', summary, { tool: b.name }));
      }
    } else if (b.type === 'tool_result') {
      const id = typeof b.tool_use_id === 'string' ? b.tool_use_id : undefined;
      const tool = id ? state.toolNames.get(id) : undefined;
      if (id) state.pending.delete(id);
      const text = oneLine(blockText(b.content));
      const ev = mk(i, 'tool_result', truncate(text || (b.is_error ? 'erro' : 'ok')), tool ? { tool } : {});
      if (b.is_error === true) ev.isError = true;
      out.events.push(ev);
    }
    // thinking e restantes tipos: ignorados
  }
  return out;
}

export function parseAgentMeta(raw: unknown): AgentMeta {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    agentType: str(o.agentType),
    name: str(o.name),
    description: str(o.description),
    toolUseId: str(o.toolUseId),
    model: str(o.pickedEffortModel) ?? str(o.model),
    finished: o.finished === true,
  };
}

export function parseTeam(raw: unknown): TeamConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, any>;
  if (typeof o.name !== 'string') return null;
  const members = Array.isArray(o.members) ? o.members : [];
  return {
    name: o.name,
    leadSessionId: str(o.leadSessionId),
    members: members
      .filter((m: any) => m && typeof m.name === 'string')
      .map((m: any) => ({ agentId: str(m.agentId), name: m.name, agentType: str(m.agentType) })),
  };
}

const TASK_STATUS: Record<string, TaskStatus> = {
  pending: 'pending',
  todo: 'pending',
  in_progress: 'in_progress',
  inprogress: 'in_progress',
  active: 'in_progress',
  completed: 'completed',
  done: 'completed',
};

/** Tolerante: aceita `blockedBy`/`blocked_by`/`dependsOn`, ids numéricos ou texto. */
export function parseTask(raw: unknown, fallbackId: string): Task | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, any>;
  const subject = str(o.subject) ?? str(o.title) ?? str(o.content);
  if (!subject) return null;
  const rawStatus = String(o.status ?? 'pending').toLowerCase();
  const blocked = o.blockedBy ?? o.blocked_by ?? o.dependsOn ?? [];
  const task: Task = {
    id: o.id !== undefined && o.id !== null && o.id !== '' ? String(o.id) : fallbackId,
    subject: truncate(subject),
    status: TASK_STATUS[rawStatus] ?? 'pending',
    blockedBy: Array.isArray(blocked) ? blocked.map(String) : [],
  };
  const owner = str(o.owner);
  if (owner) task.owner = owner;
  return task;
}

export function parseBug(fileName: string, content: string): { id: string; severity: string; open: boolean } {
  const id = fileName.replace(/\.md$/i, '');
  // Field labels in English or pt-PT (QA writes "Severidade"/"Estado").
  const field = (name: string) => {
    const m = new RegExp(`^[\\s>*_#-]*(?:${name})[\\s*_]*:[\\s*_]*([^\\n]*)`, 'im').exec(content);
    return m ? m[1].replace(/[*_`]/g, '').trim().toLowerCase() : '';
  };
  const sev = field('severity|severidade|gravidade');
  const severity = /blocker/.test(sev) ? 'blocker' : /major/.test(sev) ? 'major' : /minor/.test(sev) ? 'minor' : sev || 'minor';
  const status = field('status|estado');
  const open = !/(verified|verificad|closed|fechad|resolved|wontfix|won't fix)/.test(status);
  return { id, severity, open };
}
