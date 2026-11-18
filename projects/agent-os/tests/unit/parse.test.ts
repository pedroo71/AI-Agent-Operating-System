import { describe, expect, it } from 'vitest';
import { newParseState, parseAgentMeta, parseBug, parseLine, parseTask, parseTeam, summarizeToolCall, truncate } from '@/lib/claude/parse';
import { encodeCwd } from '@/lib/claude/paths';

const ctx = { sessionId: 's1', agentId: 'main', fallbackId: 'f#1' };
const ts = '2026-01-10T10:00:00.000Z';
const asst = (content: unknown[], extra: object = {}) => ({ type: 'assistant', uuid: 'u1', timestamp: ts, message: { id: 'm1', model: 'claude-x', role: 'assistant', content, ...extra } });

describe('summarizeToolCall', () => {
  it('Read/Write/Edit → caminho', () => {
    expect(summarizeToolCall('Read', { file_path: 'a/b.ts' })).toBe('a/b.ts');
    expect(summarizeToolCall('Write', { file_path: 'c.md', content: 'x' })).toBe('c.md');
    expect(summarizeToolCall('Edit', { file_path: 'd.ts' })).toBe('d.ts');
  });
  it('Bash → description ou comando truncado a 120', () => {
    expect(summarizeToolCall('Bash', { command: 'ls', description: 'Listar' })).toBe('Listar');
    const long = 'x'.repeat(300);
    const s = summarizeToolCall('Bash', { command: long });
    expect(s.length).toBe(120);
    expect(s.endsWith('…')).toBe(true);
  });
  it('Grep/Glob → padrão; Agent → tipo: descrição', () => {
    expect(summarizeToolCall('Grep', { pattern: 'foo' })).toBe('foo');
    expect(summarizeToolCall('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts');
    expect(summarizeToolCall('Agent', { subagent_type: 'qa', description: 'Testar' })).toBe('qa: Testar');
  });
  it('SendMessage → destinatário: início da mensagem; mensagem estruturada usa o tipo', () => {
    expect(summarizeToolCall('SendMessage', { to: 'frontend-dev', message: 'olá' })).toBe('→ frontend-dev: olá');
    expect(summarizeToolCall('SendMessage', { to: 'x', message: { type: 'shutdown_request' } })).toBe('→ x: shutdown_request');
  });
  it('outros → nome; input inválido não rebenta', () => {
    expect(summarizeToolCall('WebFetch', { url: 'u' })).toBe('WebFetch');
    expect(summarizeToolCall('Read', null)).toBe('Read');
  });
});

describe('parseLine', () => {
  it('prompt do utilizador (string)', () => {
    const r = parseLine({ type: 'user', uuid: 'u', timestamp: ts, cwd: 'C:\\x', message: { role: 'user', content: 'olá' } }, newParseState(), ctx);
    expect(r.cwd).toBe('C:\\x');
    expect(r.events).toEqual([{ id: 'u:0', sessionId: 's1', agentId: 'main', ts, kind: 'prompt', summary: 'olá' }]);
  });
  it('nunca devolve thinking', () => {
    const r = parseLine(asst([{ type: 'thinking', thinking: 'segredo', signature: 's' }, { type: 'text', text: 'ok' }]), newParseState(), ctx);
    expect(r.events).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain('segredo');
  });
  it('tool_use → tool_call; tool_result herda a ferramenta e o erro', () => {
    const st = newParseState();
    const a = parseLine(asst([{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }]), st, ctx);
    expect(a.toolCalls).toBe(1);
    expect(a.events[0]).toMatchObject({ kind: 'tool_call', tool: 'Bash', summary: 'npm test' });
    expect(st.pending.has('t1')).toBe(true);
    const r = parseLine({ type: 'user', uuid: 'u2', timestamp: ts, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'boom' }], is_error: true }] } }, st, ctx);
    expect(r.events[0]).toMatchObject({ kind: 'tool_result', tool: 'Bash', summary: 'boom', isError: true });
    expect(st.pending.has('t1')).toBe(false);
  });
  it('SendMessage vira evento "message"', () => {
    const r = parseLine(asst([{ type: 'tool_use', id: 't', name: 'SendMessage', input: { to: 'qa-engineer', message: 'API pronta' } }]), newParseState(), ctx);
    expect(r.events[0]).toMatchObject({ kind: 'message', tool: 'SendMessage', summary: '→ qa-engineer: API pronta' });
  });
  it('message tem from/to: enviada (agente → input.to) e recebida (teammate_id → agente)', () => {
    const sent = parseLine(asst([{ type: 'tool_use', id: 't', name: 'SendMessage', input: { to: 'qa-engineer', message: 'x' } }]), newParseState(), { ...ctx, agentName: 'backend-dev' });
    expect(sent.events[0]).toMatchObject({ kind: 'message', from: 'backend-dev', to: 'qa-engineer' });
    const text = '<teammate-message teammate_id="team-lead" summary="Tarefa">faz</teammate-message>';
    const recv = parseLine({ type: 'user', uuid: 'u', timestamp: ts, message: { role: 'user', content: text } }, newParseState(), { ...ctx, agentName: 'backend-dev' });
    expect(recv.events[0]).toMatchObject({ kind: 'message', from: 'team-lead', to: 'backend-dev' });
    const noName = parseLine({ type: 'user', uuid: 'u', timestamp: ts, message: { role: 'user', content: text } }, newParseState(), ctx);
    expect(noName.events[0].to).toBe('main');
  });
  it('teammate-message → message; system-reminder e isMeta ignorados', () => {
    const text = '<system-reminder>x</system-reminder><teammate-message teammate_id="team-lead" summary="Tarefa">faz isto</teammate-message>';
    const r = parseLine({ type: 'user', uuid: 'u', timestamp: ts, message: { role: 'user', content: text } }, newParseState(), ctx);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ kind: 'message', summary: '← team-lead: Tarefa' });
    const meta = parseLine({ type: 'user', uuid: 'u', timestamp: ts, isMeta: true, message: { role: 'user', content: '<system-reminder>x</system-reminder>' } }, newParseState(), ctx);
    expect(meta.events).toHaveLength(0);
  });
  it('texto truncado a 500', () => {
    const r = parseLine(asst([{ type: 'text', text: 'a'.repeat(900) }]), newParseState(), ctx);
    expect(r.events[0].summary).toHaveLength(500);
  });
  it('ai-title usa o campo aiTitle', () => {
    expect(parseLine({ type: 'ai-title', aiTitle: 'Título', sessionId: 's' }, newParseState(), ctx).title).toBe('Título');
  });
  it('uso de tokens e modelo', () => {
    const r = parseLine(asst([{ type: 'text', text: 'x' }], { usage: { input_tokens: 2, output_tokens: 10, cache_creation_input_tokens: 5, cache_read_input_tokens: 999 } }), newParseState(), ctx);
    expect(r.model).toBe('claude-x');
    expect(r.usage).toEqual({ msgId: 'm1', tokens: 17 });
  });
  it('tipos desconhecidos, lixo e linhas sem timestamp são ignorados', () => {
    const st = newParseState();
    for (const bad of [null, 42, 'x', {}, { type: 'mode', mode: 'normal' }, { type: 'attachment', attachment: {} }, { type: 'user' }, { type: 'user', message: 'x' }]) {
      expect(parseLine(bad, st, ctx).events).toEqual([]);
    }
    expect(parseLine({ type: 'user', message: { role: 'user', content: 'sem ts' } }, st, ctx).events).toEqual([]);
  });
});

describe('meta, equipa, tarefas, bugs', () => {
  it('parseAgentMeta', () => {
    expect(parseAgentMeta({ agentType: 'qa', name: 'qa-engineer', toolUseId: 't', pickedEffortModel: 'm', finished: true, description: 'd' })).toEqual({
      agentType: 'qa', name: 'qa-engineer', toolUseId: 't', model: 'm', finished: true, description: 'd',
    });
    expect(parseAgentMeta(null)).toEqual({});
  });
  it('parseTeam', () => {
    const t = parseTeam({ name: 'session-1', leadSessionId: 'L', members: [{ name: 'a', agentType: 'x' }, { nope: 1 }] });
    expect(t).toEqual({ name: 'session-1', leadSessionId: 'L', members: [{ agentId: undefined, name: 'a', agentType: 'x' }] });
    expect(parseTeam({})).toBeNull();
  });
  it('parseTask tolerante', () => {
    expect(parseTask({ id: 2, subject: 'S', status: 'in_progress', owner: 'o', blockedBy: [1] }, 'f')).toEqual({ id: '2', subject: 'S', status: 'in_progress', owner: 'o', blockedBy: ['1'] });
    expect(parseTask({ subject: 'S', status: '???' }, 'f')).toEqual({ id: 'f', subject: 'S', status: 'pending', blockedBy: [] });
    expect(parseTask({ status: 'pending' }, 'f')).toBeNull();
  });
  it('parseBug: severidade e estado', () => {
    expect(parseBug('BUG-001.md', '# x\n**Severity:** Major\n**Status:** Open')).toEqual({ id: 'BUG-001', severity: 'major', open: true });
    expect(parseBug('BUG-002.md', 'Severity: blocker\nStatus: Verified')).toEqual({ id: 'BUG-002', severity: 'blocker', open: false });
    expect(parseBug('BUG-003.md', '- Severity: minor\n- Status: Closed')).toMatchObject({ open: false });
  });
  it('parseBug: campos em pt-PT (formato real do QA)', () => {
    expect(parseBug('BUG-004.md', '- **Severidade:** major\n- **Estado:** Verified')).toEqual({ id: 'BUG-004', severity: 'major', open: false });
    expect(parseBug('BUG-005.md', '- **Severidade:** blocker\n- **Estado:** Aberto')).toEqual({ id: 'BUG-005', severity: 'blocker', open: true });
  });
});

describe('utilitários', () => {
  it('truncate', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcdef', 5)).toBe('abcd…');
  });
  it('encodeCwd', () => {
    expect(encodeCwd('C:\\Users\\demo\\product-team')).toBe('C--Users-demo-product-team');
  });
});
