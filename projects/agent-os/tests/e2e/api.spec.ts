import { expect, test } from '@playwright/test';
import { BASE, SESSION_ID } from './helpers/server';

const A_BACK = 'abackend-dev-1111111111111111';
const KINDS = ['prompt', 'text', 'tool_call', 'tool_result', 'message', 'system'];
const STATUS = ['active', 'idle', 'finished'];
const TSTATUS = ['pending', 'in_progress', 'completed'];

function checkSession(s: any) {
  for (const k of ['id', 'cwd', 'title', 'startedAt', 'lastEventAt']) expect(typeof s[k], `session.${k}`).toBe('string');
  expect(typeof s.agentCount).toBe('number');
}
function checkAgent(a: any) {
  expect(typeof a.id).toBe('string');
  expect(typeof a.name).toBe('string');
  expect(typeof a.agentType).toBe('string');
  expect(STATUS).toContain(a.status);
  expect(typeof a.lastEventAt).toBe('string');
  expect(typeof a.toolCalls).toBe('number');
}
function checkEvent(e: any) {
  for (const k of ['id', 'sessionId', 'agentId', 'ts', 'summary']) expect(typeof e[k], `event.${k}`).toBe('string');
  expect(KINDS).toContain(e.kind);
}

test.describe('API contrato (fixtures)', () => {
  test('API-01 sessions', async ({ request }) => {
    const r = await request.get('/api/sessions');
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('application/json');
    const { sessions } = await r.json();
    expect(sessions.length).toBeGreaterThan(0);
    sessions.forEach(checkSession);
    const ts = sessions.map((s: any) => s.lastEventAt);
    expect([...ts].sort().reverse()).toEqual(ts);
  });

  test('API-02 limit', async ({ request }) => {
    const { sessions } = await (await request.get('/api/sessions?limit=1')).json();
    expect(sessions.length).toBeLessThanOrEqual(1);
  });

  test('API-04 session detail', async ({ request }) => {
    const r = await request.get(`/api/sessions/${SESSION_ID}`);
    expect(r.status()).toBe(200);
    const b = await r.json();
    checkSession(b.session);
    expect(b.agents.length).toBe(b.session.agentCount);
    b.agents.forEach(checkAgent);
    expect(b.agents.some((a: any) => a.id === 'main')).toBe(true);
    b.events.forEach(checkEvent);
    for (const t of b.tasks) {
      expect(TSTATUS).toContain(t.status);
      expect(Array.isArray(t.blockedBy)).toBe(true);
    }
    expect(b.tasks.length).toBeGreaterThan(0);
  });

  test('API-25 message from/to', async ({ request }) => {
    const b = await (await request.get(`/api/sessions/${SESSION_ID}?events=2000`)).json();
    const names = new Set(b.agents.map((a: any) => a.name));
    const msgs = b.events.filter((e: any) => e.kind === 'message');
    expect(msgs.length).toBeGreaterThan(0);
    for (const m of msgs) {
      expect(typeof m.from).toBe('string');
      expect(typeof m.to).toBe('string');
      expect(m.from).not.toBe('');
      expect(m.to).not.toBe('');
      expect(m.from).not.toBe(m.to);
    }
    expect(msgs.some((m: any) => names.has(m.from) && names.has(m.to))).toBe(true);
    for (const e of b.events.filter((e: any) => e.kind !== 'message')) {
      expect(e.from).toBeUndefined();
      expect(e.to).toBeUndefined();
    }
  });

  test('API-04b lastEventAt coerente entre lista e detalhe', async ({ request }) => {
    const list = (await (await request.get('/api/sessions')).json()).sessions.find((s: any) => s.id === SESSION_ID);
    const det = (await (await request.get(`/api/sessions/${SESSION_ID}`)).json()).session;
    expect(list.lastEventAt).toBe(det.lastEventAt);
  });

  test('API-05 events limit', async ({ request }) => {
    const b5 = await (await request.get(`/api/sessions/${SESSION_ID}?events=5`)).json();
    expect(b5.events.length).toBe(5);
    const bAll = await (await request.get(`/api/sessions/${SESSION_ID}?events=99999`)).json();
    expect(bAll.events.length).toBeLessThanOrEqual(2000);
  });

  test('API-06 session 404', async ({ request }) => {
    const r = await request.get('/api/sessions/inexistente');
    expect(r.status()).toBe(404);
    const b = await r.json();
    expect(b.error.code).toBe('SESSION_NOT_FOUND');
    expect(typeof b.error.message).toBe('string');
  });

  test('API-07/08 agent events, before, limit', async ({ request }) => {
    const r = await request.get(`/api/sessions/${SESSION_ID}/agents/${A_BACK}/events`);
    expect(r.status()).toBe(200);
    const b = await r.json();
    checkAgent(b.agent);
    expect(b.agent.id).toBe(A_BACK);
    expect(b.events.length).toBeGreaterThan(2);
    b.events.forEach(checkEvent);
    b.events.forEach((e: any) => expect(e.agentId).toBe(A_BACK));
    const ts = b.events.map((e: any) => e.ts);
    expect([...ts].sort()).toEqual(ts);

    const lim = await (await request.get(`/api/sessions/${SESSION_ID}/agents/${A_BACK}/events?limit=2`)).json();
    expect(lim.events.length).toBe(2);

    const before = ts[2];
    const bf = await (await request.get(`/api/sessions/${SESSION_ID}/agents/${A_BACK}/events?before=${encodeURIComponent(before)}`)).json();
    expect(bf.events.length).toBeGreaterThan(0);
    bf.events.forEach((e: any) => expect(e.ts < before).toBe(true));
  });

  test('API-07b agente main', async ({ request }) => {
    const r = await request.get(`/api/sessions/${SESSION_ID}/agents/main/events`);
    expect(r.status()).toBe(200);
    expect((await r.json()).events.length).toBeGreaterThan(0);
  });

  test('API-09 agent/session 404', async ({ request }) => {
    const a = await request.get(`/api/sessions/${SESSION_ID}/agents/zzz/events`);
    expect(a.status()).toBe(404);
    expect((await a.json()).error.code).toBe('AGENT_NOT_FOUND');
    const s = await request.get(`/api/sessions/nope/agents/main/events`);
    expect(s.status()).toBe(404);
    expect((await s.json()).error.code).toBe('SESSION_NOT_FOUND');
  });

  test('API-10 projects', async ({ request }) => {
    const r = await request.get('/api/projects');
    expect(r.status()).toBe(200);
    const { projects } = await r.json();
    expect(Array.isArray(projects)).toBe(true);
    for (const p of projects) {
      expect(typeof p.slug).toBe('string');
      for (const d of p.deliverables) {
        expect(typeof d.name).toBe('string');
        expect(typeof d.path).toBe('string');
        expect(typeof d.present).toBe('boolean');
      }
      for (const b of p.bugs) {
        expect(typeof b.id).toBe('string');
        expect(['blocker', 'major', 'minor']).toContain(b.severity);
        expect(typeof b.open).toBe('boolean');
      }
    }
  });

  test('API-11 memory', async ({ request }) => {
    const r = await request.get('/api/memory');
    expect(r.status()).toBe(200);
    const { memories } = await r.json();
    expect(Array.isArray(memories)).toBe(true);
    for (const m of memories) {
      expect(typeof m.agent).toBe('string');
      expect(typeof m.content).toBe('string');
      expect(typeof m.updatedAt).toBe('string');
    }
  });

  test('API-12 regras de summary', async ({ request }) => {
    const main = await (await request.get(`/api/sessions/${SESSION_ID}?events=2000`)).json();
    const calls = main.events.filter((e: any) => e.kind === 'tool_call');
    const by = (t: string) => calls.filter((e: any) => e.tool === t);
    for (const e of by('Read')) expect(e.summary).toMatch(/[\\/]/);
    for (const e of by('Bash')) expect(e.summary.length).toBeLessThanOrEqual(120);
    for (const e of by('SendMessage')) expect(e.summary).toMatch(/^→ [^:]+: /);
    for (const e of by('Agent')) expect(e.summary).toMatch(/^[^:]+: /);
    for (const e of by('Glob')) expect(e.summary).toBe('**/*.ts');
    expect(by('Bash')[0]?.summary).toBe('Instalar dependências');
  });

  test('API-13/14 sem thinking, texto truncado', async ({ request }) => {
    const b = await (await request.get(`/api/sessions/${SESSION_ID}?events=2000`)).json();
    const raw = JSON.stringify(b);
    expect(raw).not.toContain('"thinking"');
    expect(raw).not.toContain('signature');
    for (const e of b.events) expect(e.summary.length).toBeLessThanOrEqual(520);
  });

  test('ROB-04/05 não-GET e traversal', async ({ request }) => {
    for (const m of ['post', 'delete', 'put'] as const) {
      const r = await request[m]('/api/sessions');
      expect([404, 405]).toContain(r.status());
    }
    for (const id of ['..%2f..%2fsettings', '..%5c..%5csettings', '%2e%2e', 'a%00b']) {
      const r = await request.get(`/api/sessions/${id}`);
      expect([400, 404], `id=${id} status=${r.status()}`).toContain(r.status());
    }
    const r = await request.get(`/api/sessions/${SESSION_ID}/agents/..%2f..%2fx/events`);
    expect([400, 404]).toContain(r.status());
  });

  test('API-17 stream 404', async ({ request }) => {
    const r = await request.get('/api/stream?session=nope');
    expect(r.status()).toBe(404);
    expect((await r.json()).error.code).toBe('SESSION_NOT_FOUND');
    const r2 = await request.get('/api/stream');
    expect(r2.status()).toBe(404);
  });

  test('API-18 stream content-type e ligação', async () => {
    const ctl = new AbortController();
    const r = await fetch(`${BASE}/api/stream?session=${SESSION_ID}`, { signal: ctl.signal });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/event-stream');
    ctl.abort();
  });
});
