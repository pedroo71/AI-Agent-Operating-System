import { expect, test, request as pwRequest } from '@playwright/test';

// API-22: contra o ~/.claude REAL, em modo só-leitura (apenas GET).
// Usa o servidor de desenvolvimento em REAL_URL (por omissão http://localhost:4100, iniciado com `npm run dev`).
const REAL = process.env.REAL_URL ?? 'http://localhost:4100';

const KINDS = ['prompt', 'text', 'tool_call', 'tool_result', 'message', 'system'];

test.describe('API contra ~/.claude real (só leitura)', () => {
  // Opt-in: depende das sessões reais desta máquina (falharia num clone novo). REAL_HOME=1 para correr.
  test.skip(!process.env.REAL_HOME, 'opt-in: REAL_HOME=1 com `npm run dev` a correr');
  test('API-22 todos os GET respondem e cumprem o contrato', async () => {
    const api = await pwRequest.newContext({ baseURL: REAL });
    const t0 = Date.now();
    const rs = await api.get('/api/sessions?cwd=all&limit=50');
    expect(rs.status()).toBe(200);
    const { sessions } = await rs.json();
    console.log(`sessões reais: ${sessions.length} (${Date.now() - t0} ms)`);
    expect(sessions.length).toBeGreaterThan(0);
    const ts = sessions.map((s: any) => s.lastEventAt);
    expect([...ts].sort().reverse()).toEqual(ts);

    // por omissão (cwd = product-team) a sessão mais recente deve existir
    const def = await (await api.get('/api/sessions')).json();
    expect(def.sessions.length).toBeGreaterThan(0);
    for (const s of def.sessions) expect(s.cwd.toLowerCase()).toContain('product-team');

    let checked = 0;
    for (const s of sessions.slice(0, 8)) {
      const t = Date.now();
      const r = await api.get(`/api/sessions/${s.id}?events=2000`);
      const dt = Date.now() - t;
      expect(r.status(), `sessão ${s.id}`).toBe(200);
      expect(dt, `tempo ${s.id}`).toBeLessThan(3000);
      const b = await r.json();
      const raw = JSON.stringify(b);
      expect(raw, 'thinking não pode vazar').not.toContain('"thinking"');
      expect(b.agents[0].id).toBe('main');
      expect(b.agents.length).toBe(b.session.agentCount);
      // verificações em JS simples (expect por evento é lento e fecha a ligação keep-alive de 5 s do servidor)
      const ids = new Set<string>();
      const bad: string[] = [];
      let last = '';
      for (const e of b.events) {
        if (!KINDS.includes(e.kind)) bad.push(`kind ${e.kind}`);
        if (e.summary.length > 520) bad.push(`summary longo ${e.id}`);
        if (ids.has(e.id)) bad.push(`duplicado ${e.id}`);
        ids.add(e.id);
        if (e.ts < last) bad.push(`ordem ${e.id}`);
        last = e.ts;
        if (e.kind === 'tool_call' && e.tool === 'Bash' && e.summary.length > 120) bad.push(`bash > 120 ${e.id}`);
      }
      expect(bad, `sessão ${s.id}`).toEqual([]);
      for (const a of b.agents) {
        expect(['active', 'idle', 'finished']).toContain(a.status);
        const re = await api.get(`/api/sessions/${s.id}/agents/${encodeURIComponent(a.id)}/events?limit=50`);
        expect(re.status(), `agente ${a.id}`).toBe(200);
      }
      checked++;
    }
    console.log(`sessões verificadas: ${checked}`);

    for (const p of ['/api/projects', '/api/memory']) {
      const r = await api.get(p);
      expect(r.status()).toBe(200);
    }
    const mem = (await (await api.get('/api/memory')).json()).memories;
    expect(mem.map((m: any) => m.agent)).toContain('qa-engineer');
    const proj = (await (await api.get('/api/projects')).json()).projects;
    expect(proj.map((p: any) => p.slug)).toContain('agent-os');
    await api.dispose();
  });

  test('INVALID_QUERY nos parâmetros numéricos e de data', async () => {
    const api = await pwRequest.newContext({ baseURL: REAL });
    const { sessions } = await (await api.get('/api/sessions')).json();
    const id = sessions[0].id;
    for (const q of ['limit=abc', 'limit=0', 'limit=-1']) {
      const r = await api.get(`/api/sessions?${q}`);
      expect(r.status(), q).toBe(400);
      expect((await r.json()).error.code).toBe('INVALID_QUERY');
    }
    for (const q of ['events=abc', 'events=0', 'events=-5']) {
      const r = await api.get(`/api/sessions/${id}?${q}`);
      expect(r.status(), q).toBe(400);
      expect((await r.json()).error.code).toBe('INVALID_QUERY');
    }
    const r = await api.get(`/api/sessions/${id}/agents/main/events?before=nao-e-data`);
    expect(r.status()).toBe(400);
    await api.dispose();
  });
});
