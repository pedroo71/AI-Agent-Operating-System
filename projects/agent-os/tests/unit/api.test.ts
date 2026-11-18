import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetStore, onChange, syncTracker } from '@/lib/claude/store';
import { GET as listSessions } from '@/app/api/sessions/route';
import { GET as getSession } from '@/app/api/sessions/[id]/route';
import { GET as getAgentEvents } from '@/app/api/sessions/[id]/agents/[agentId]/events/route';
import { GET as getProjects } from '@/app/api/projects/route';
import { GET as getMemory } from '@/app/api/memory/route';
import { parsePlanTasks, sessionProject } from '@/lib/claude/projects';

const SID = '11111111-aaaa-4bbb-8ccc-222222222222';
const A1 = 'abackend-dev-1111111111111111';
const FIX = path.resolve(__dirname, '../../fixtures/claude-home');
let tmp: string;
let home: string;
let team: string;

const req = (url: string) => new Request(`http://localhost:4100${url}`);
const j = async (r: Response) => ({ status: r.status, body: (await r.json()) as any });

beforeAll(() => {
  // cópia das fixtures + um PRODUCT_TEAM_DIR sintético
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-os-test-'));
  home = path.join(tmp, 'claude-home');
  fs.cpSync(FIX, home, { recursive: true });
  team = path.join(tmp, 'team');
  const docs = path.join(team, 'projects', 'demo', 'docs');
  fs.mkdirSync(path.join(docs, 'qa', 'bugs'), { recursive: true });
  fs.writeFileSync(path.join(docs, 'BRIEF.md'), '# Brief\nMarketing material: no\n');
  fs.writeFileSync(path.join(docs, 'qa', 'bugs', 'BUG-001.md'), '**Severity:** major\n**Status:** Open\n');
  fs.writeFileSync(path.join(docs, 'qa', 'bugs', 'BUG-002.md'), '**Severity:** minor\n**Status:** Verified\n');
  fs.mkdirSync(path.join(team, '.claude', 'agent-memory', 'backend-dev'), { recursive: true });
  fs.writeFileSync(path.join(team, '.claude', 'agent-memory', 'backend-dev', 'MEMORY.md'), '# lições\n');
  process.env.CLAUDE_HOME = home;
  process.env.PRODUCT_TEAM_DIR = team;
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => resetStore());

describe('GET /api/sessions', () => {
  it('lista a sessão das fixtures (fallback para todos os cwd)', async () => {
    const { status, body } = await j(await listSessions(req('/api/sessions')));
    expect(status).toBe(200);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).toMatchObject({ id: SID, cwd: 'C:\\fixtures\\demo', title: 'Site de reservas de padel', teamName: 'session-11111111', agentCount: 3 });
    expect(body.sessions[0].startedAt).toBe('2026-01-10T10:00:00.000Z');
  });
  it('limit inválido → 400; CLAUDE_HOME inexistente → 500', async () => {
    expect((await j(await listSessions(req('/api/sessions?limit=abc')))).status).toBe(400);
    const prev = process.env.CLAUDE_HOME;
    process.env.CLAUDE_HOME = path.join(tmp, 'nao-existe');
    const r = await j(await listSessions(req('/api/sessions')));
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe('CLAUDE_HOME_UNREADABLE');
    process.env.CLAUDE_HOME = prev;
  });
  it('cwd explícito sem sessões → lista vazia', async () => {
    const { body } = await j(await listSessions(req('/api/sessions?cwd=C%3A%5Cnada')));
    expect(body.sessions).toEqual([]);
  });
});

describe('GET /api/sessions/:id', () => {
  it('devolve sessão, agentes, eventos e tarefas', async () => {
    const { status, body } = await j(await getSession(req(`/api/sessions/${SID}`), { params: Promise.resolve({ id: SID }) }));
    expect(status).toBe(200);
    expect(body.session.agentCount).toBe(3);
    const byId = Object.fromEntries(body.agents.map((a: any) => [a.id, a]));
    expect(byId.main).toMatchObject({ name: 'team-lead', agentType: 'team-lead', model: 'claude-opus-5-5', toolCalls: 5, status: 'idle' });
    expect(byId[A1]).toMatchObject({ name: 'backend-dev', agentType: 'backend-dev', parentToolUseId: 'tu-3', toolCalls: 2, currentAction: 'Edit: C:\\fixtures\\demo\\app\\api\\route.ts' });
    expect(byId['aExplore-2222222222222222'].status).toBe('finished');
    expect(body.tasks.map((t: any) => [t.id, t.status])).toEqual([['1', 'completed'], ['2', 'in_progress'], ['3', 'pending']]);
    expect(body.tasks[1].blockedBy).toEqual(['1']);
    const kinds = new Set(body.events.map((e: any) => e.kind));
    expect(kinds).toEqual(new Set(['prompt', 'text', 'tool_call', 'tool_result', 'message']));
    const ts = body.events.map((e: any) => e.ts);
    expect([...ts].sort()).toEqual(ts); // cronológico
    expect(body.events.find((e: any) => e.isError)).toMatchObject({ kind: 'tool_result', tool: 'Bash' });
    expect(JSON.stringify(body)).not.toContain('thinking');
    const pairs = body.events.filter((e: any) => e.kind === 'message').map((e: any) => `${e.from}>${e.to}`);
    expect(pairs).toEqual(['team-lead>backend-dev', 'backend-dev>team-lead', 'team-lead>backend-dev']);
  });
  it('events limita aos mais recentes; inválido → 400; desconhecido → 404', async () => {
    const r = await j(await getSession(req(`/api/sessions/${SID}?events=3`), { params: Promise.resolve({ id: SID }) }));
    expect(r.body.events).toHaveLength(3);
    expect((await j(await getSession(req(`/api/sessions/${SID}?events=0`), { params: Promise.resolve({ id: SID }) }))).status).toBe(400);
    const nf = await j(await getSession(req('/api/sessions/nope'), { params: Promise.resolve({ id: 'nope' }) }));
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('SESSION_NOT_FOUND');
    const trav = await j(await getSession(req('/x'), { params: Promise.resolve({ id: '..%2F..' }) }));
    expect(trav.status).toBe(404);
  });
});

describe('GET /api/sessions/:id/agents/:agentId/events', () => {
  const call = (agentId: string, qs = '') => getAgentEvents(req(`/api/sessions/${SID}/agents/${agentId}/events${qs}`), { params: Promise.resolve({ id: SID, agentId }) });
  it('eventos de um subagente (linha inválida ignorada)', async () => {
    const { status, body } = await j(await call('aExplore-2222222222222222'));
    expect(status).toBe(200);
    expect(body.agent.id).toBe('aExplore-2222222222222222');
    expect(body.events.map((e: any) => e.kind)).toEqual(['prompt', 'tool_call', 'tool_result', 'text']);
    expect(body.events.every((e: any) => e.agentId === 'aExplore-2222222222222222')).toBe(true);
  });
  it('before e limit', async () => {
    const r = await j(await call(A1, '?before=2026-01-10T10:00:23.000Z&limit=2'));
    expect(r.body.events.map((e: any) => e.ts)).toEqual(['2026-01-10T10:00:21.000Z', '2026-01-10T10:00:22.000Z']);
    expect((await j(await call(A1, '?before=ontem'))).status).toBe(400);
  });
  it('agente "main" e 404s', async () => {
    expect((await j(await call('main'))).body.agent.id).toBe('main');
    const r = await j(await call('naoexiste'));
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('AGENT_NOT_FOUND');
    const s = await j(await getAgentEvents(req('/x'), { params: Promise.resolve({ id: 'nope', agentId: 'main' }) }));
    expect(s.body.error.code).toBe('SESSION_NOT_FOUND');
  });
});

describe('GET /api/projects e /api/memory', () => {
  it('projetos: entregáveis e bugs', async () => {
    const { body } = await j(await getProjects());
    const p = body.projects.find((x: any) => x.slug === 'demo');
    expect(p.deliverables.find((d: any) => d.path === 'docs/BRIEF.md').present).toBe(true);
    expect(p.deliverables.find((d: any) => d.path === 'docs/PLAN.md').present).toBe(false);
    expect(p.deliverables.some((d: any) => d.name === 'Marketing')).toBe(false);
    expect(p.bugs).toEqual([{ id: 'BUG-001', severity: 'major', open: true }, { id: 'BUG-002', severity: 'minor', open: false }]);
    expect(p.planTasks).toEqual([]);
  });
  it('projeto da sessão: o mais referido nas ferramentas, só slugs conhecidos', () => {
    const tc = (summary: string) => ({ kind: 'tool_call', summary });
    const known = ['agent-os', 'outro-projeto'];
    expect(sessionProject([tc('C:\\x\\projects\\outro-projeto\\docs\\PLAN.md'), tc('projects/agent-os/a.ts'), tc('cd projects/agent-os && npm test')], known)).toBe('agent-os');
    expect(sessionProject([{ kind: 'text', summary: 'projects/agent-os' }, tc('projects/outro/x'), tc('README.md')], known)).toBeUndefined();
  });
  it('tarefas do PLAN.md por agente', () => {
    const md = [
      '# Plano', '## Stack', '1. não conta',
      '## Tarefas', '### backend-dev', '1. **API** `GET /x`. Done: curl', '   continuação ignorada', '2. Fixtures',
      '### frontend-dev', '- Shell [ver](DESIGN.md)', '## Dependências', '### qa', '1. fora da secção',
    ].join('\n');
    expect(parsePlanTasks(md)).toEqual([
      { agent: 'backend-dev', text: 'API GET /x. Done: curl' },
      { agent: 'backend-dev', text: 'Fixtures' },
      { agent: 'frontend-dev', text: 'Shell ver' },
    ]);
  });
  it('memória dos agentes', async () => {
    const { body } = await j(await getMemory());
    expect(body.memories).toHaveLength(1);
    expect(body.memories[0]).toMatchObject({ agent: 'backend-dev', content: '# lições\n' });
    expect(Number.isNaN(Date.parse(body.memories[0].updatedAt))).toBe(false);
  });
});

describe('leitura incremental', () => {
  it('só lê bytes novos, espera por linhas parciais e notifica ouvintes', async () => {
    const batches: any[] = [];
    const off = onChange((b) => batches.push(b));
    const call = () => getSession(req(`/api/sessions/${SID}`), { params: Promise.resolve({ id: SID }) });
    const first = await j(await call());
    const total = first.body.events.length;
    const file = path.join(home, 'projects', 'C--fixtures-demo', `${SID}.jsonl`);
    const line = JSON.stringify({ type: 'assistant', uuid: 'new-1', timestamp: '2026-01-10T11:00:00.000Z', sessionId: SID, message: { id: 'mx', model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'text', text: 'novo evento' }] } });
    // metade da linha: não deve produzir evento
    fs.appendFileSync(file, line.slice(0, 40));
    expect((await j(await call())).body.events).toHaveLength(total);
    expect(batches).toHaveLength(0);
    // resto da linha + \n
    fs.appendFileSync(file, line.slice(40) + '\n');
    const after = await j(await call());
    expect(after.body.events).toHaveLength(total + 1);
    expect(after.body.events.at(-1)).toMatchObject({ id: 'new-1:0', summary: 'novo evento' });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ sessionId: SID, agentId: 'main' });
    // sem novas escritas: nada de novo
    await call();
    expect(batches).toHaveLength(1);
    off();
  });
  it('syncTracker aceita última linha completa sem \\n', async () => {
    const { loadSession, locateSession } = await import('@/lib/claude/store');
    const l = loadSession(locateSession(SID)!);
    const main = l.trackers[0];
    const before = main.events.length;
    fs.appendFileSync(main.path, JSON.stringify({ type: 'user', uuid: 'nl', timestamp: '2026-01-10T12:00:00.000Z', message: { role: 'user', content: 'sem newline' } }));
    expect(syncTracker(main, false)).toHaveLength(1);
    expect(main.events).toHaveLength(before + 1);
  });
});
