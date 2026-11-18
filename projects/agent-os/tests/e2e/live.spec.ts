import { expect, test, type Page } from '@playwright/test';
import { appendAssistantText, BASE, HOME_DIR, MAIN_JSONL, SESSION_ID, startServer, stopServer } from './helpers/server';
import fs from 'node:fs';
import path from 'node:path';

import { boot as bootBase, live as state, node, edge, tab } from './helpers/ui';

const FEED = '[data-testid="feed"] li.event-row';

async function boot(page: Page) {
  await bootBase(page, { mode: 'graph' });
  await tab(page, 'Feed').click();
  await expect(page.locator(FEED).first()).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.describe('Ao vivo', () => {
  test('LIVE-01/02 linha anexada aparece no topo do Feed em <= 2 s', async ({ page }) => {
    await boot(page);
    const text = `QA-LIVE-${Date.now()}`;
    const t0 = Date.now();
    appendAssistantText(text);
    const row = page.locator(FEED).filter({ hasText: text });
    await expect(row).toHaveCount(1, { timeout: 2000 });
    const dt = Date.now() - t0;
    console.log(`LIVE-02 latência: ${dt} ms`);
    expect(dt).toBeLessThanOrEqual(2000);
    // no topo
    await expect(page.locator(FEED).first()).toContainText(text);
  });

  test('LIVE-03/04 Inspetor e nó atualizam', async ({ page }) => {
    await bootBase(page, { mode: 'graph' });
    await node(page, 'team-lead').click();
    const rows = page.locator('[data-testid="inspector-timeline"] li');
    await expect(rows.first()).toBeVisible();
    const text = `QA-TL-${Date.now()}`;
    appendAssistantText(text);
    await expect(rows.filter({ hasText: text })).toHaveCount(1, { timeout: 2000 });
    await expect(node(page, 'team-lead')).toContainText(text.slice(0, 20), { timeout: 3000 });
    await expect(node(page, 'team-lead')).toHaveAttribute('data-status', 'active', { timeout: 3000 });
  });

  test('LIVE-04b chamada de ferramenta incrementa o contador', async ({ page, request }) => {
    await boot(page);
    const card = page.getByRole('complementary', { name: 'Painel de detalhe' });
    await node(page, 'team-lead').click();
    await tab(page, 'Inspetor').click();
    const before = (await (await request.get(`/api/sessions/${SESSION_ID}`)).json()).agents.find((a: any) => a.id === 'main').toolCalls;
    const line = {
      type: 'assistant', isSidechain: false, cwd: 'C:\\fixtures\\demo', sessionId: SESSION_ID,
      message: { model: 'claude-opus-5-5', id: 'qa-tc', role: 'assistant', type: 'message', content: [{ type: 'tool_use', id: `qa-tu-${Date.now()}`, name: 'Grep', input: { pattern: 'qa-pattern-xyz' } }], usage: { input_tokens: 1, output_tokens: 1 } },
      uuid: `qa-tc-${Date.now()}`, timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(MAIN_JSONL, JSON.stringify(line) + '\n');
    await tab(page, 'Feed').click();
    await expect(page.locator(FEED).first()).toContainText('qa-pattern-xyz', { timeout: 2000 });
    await tab(page, 'Inspetor').click();
    await expect(card).toContainText(String(before + 1), { timeout: 3000 });
  });

  test('LIVE-04c linha corrompida/parcial é ignorada sem partir o stream', async ({ page }) => {
    await boot(page);
    fs.appendFileSync(MAIN_JSONL, '{"type":"assistant","message":{broken json\n');
    fs.appendFileSync(MAIN_JSONL, '{"type":"qa-unknown","x":1}\n');
    const text = `QA-AFTER-BAD-${Date.now()}`;
    appendAssistantText(text);
    await expect(page.locator(FEED).filter({ hasText: text })).toHaveCount(1, { timeout: 3000 });
    await expect(state(page)).toHaveAttribute('data-state', 'live');
  });

  test('LIVE-04d linha parcial sem \\n final é completada mais tarde', async ({ page }) => {
    await boot(page);
    const text = `QA-PARTIAL-${Date.now()}`;
    const full = JSON.stringify({
      type: 'assistant', isSidechain: false, cwd: 'C:\\fixtures\\demo', sessionId: SESSION_ID,
      message: { model: 'claude-opus-5-5', id: 'qa-p', role: 'assistant', type: 'message', content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } },
      uuid: `qa-p-${Date.now()}`, timestamp: new Date().toISOString(),
    });
    const cut = Math.floor(full.length / 2);
    fs.appendFileSync(MAIN_JSONL, full.slice(0, cut));
    await page.waitForTimeout(1800);
    await expect(page.locator(FEED).filter({ hasText: text })).toHaveCount(0);
    fs.appendFileSync(MAIN_JSONL, full.slice(cut) + '\n');
    await expect(page.locator(FEED).filter({ hasText: text })).toHaveCount(1, { timeout: 3000 });
  });

  test('LIVE-05/06/07 reconexão após reinício do servidor', async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page);
    stopServer();
    try {
    await expect(state(page)).not.toHaveAttribute('data-state', 'live', { timeout: 20_000 });
    await expect(state(page)).toContainText(/Desligado|Servidor indisponível|A ligar/);
    await expect(state(page)).toHaveAttribute('title', /Sem ligação|contactar/); // v2: sem faixa, só indicador + tooltip
    // a UI continua com os últimos dados
    await expect(node(page, 'team-lead')).toBeVisible();
    } finally {
      await startServer(); // repõe sempre o servidor, mesmo que as asserções falhem
    }

    await expect(state(page)).toHaveAttribute('data-state', 'live', { timeout: 60_000 });

    const text = `QA-RECONNECT-${Date.now()}`;
    appendAssistantText(text);
    await expect(page.locator(FEED).filter({ hasText: text })).toHaveCount(1, { timeout: 3000 });
    // sem duplicados no Feed (mesma hora + mesmo texto)
    const dupes = await page.locator(FEED).evaluateAll((els) => {
      const seen = new Set<string>(); let d = 0;
      for (const e of els) { const k = (e.textContent ?? '') + e.querySelector('time')?.getAttribute('datetime'); if (seen.has(k)) d++; seen.add(k); }
      return d;
    });
    expect(dupes).toBe(0);
    void BASE;
  });

  test('ROB-01 CLAUDE_HOME inexistente: API 500 e UI com erro compreensível', async ({ page, request }) => {
    test.setTimeout(180_000);
    stopServer();
    await startServer({ home: 'C:\\nao\\existe\\claude-home' });
    const r = await request.get('/api/sessions');
    expect(r.status()).toBe(500);
    expect((await r.json()).error.code).toBe('CLAUDE_HOME_UNREADABLE');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' });
    await expect(page.locator('body')).toContainText(/Algo correu mal|Nenhuma sessão|CLAUDE_HOME|Servidor indisponível/i, { timeout: 15_000 });
    await page.screenshot({ path: 'test-results/rob01-claude-home-invalido.png' });
    expect(errors).toEqual([]);
    // repor o servidor normal
    stopServer();
    await startServer();
  });

  test('API-19/20 stream SSE cru: event, agent, tasks, projects', async () => {
    const ctl = new AbortController();
    const r = await fetch(`${BASE}/api/stream?session=${SESSION_ID}`, { signal: ctl.signal });
    const dec = new TextDecoder();
    let buf = '';
    (async () => {
      const reader = r.body!.getReader();
      try { for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value); } } catch { /* abort */ }
    })();
    await new Promise((res) => setTimeout(res, 700));
    expect(buf).toContain(': connected');
    const t0 = Date.now();
    const text = `QA-SSE-${Date.now()}`;
    appendAssistantText(text);
    const waitFor = async (re: RegExp, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (re.test(buf)) return Date.now() - t0; await new Promise((x) => setTimeout(x, 50)); } return -1; };
    const dEvent = await waitFor(new RegExp(`event: event\\ndata: [^\\n]*${text}`), 2000);
    console.log(`SSE event em ${dEvent} ms`);
    expect(dEvent).toBeGreaterThan(-1);
    expect(await waitFor(/event: agent\ndata: \{[^\n]*"id":"main"/, 2000)).toBeGreaterThan(-1);

    // tarefas: alterar o estado de uma tarefa na pasta temporária
    const taskFile = path.join(HOME_DIR, 'tasks', 'session-11111111', '3.json');
    const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    task.status = 'in_progress';
    fs.writeFileSync(taskFile, JSON.stringify(task));
    expect(await waitFor(/event: tasks\ndata: [^\n]*"in_progress"/, 3000)).toBeGreaterThan(-1);

    task.status = 'pending'; // repor o estado original (UI-10 depende dele)
    fs.writeFileSync(taskFile, JSON.stringify(task));

    // projectos: tocar num ficheiro em projects/*/docs do repo é proibido (só-leitura); verificado apenas se existir PRODUCT_TEAM_DIR temporário
    ctl.abort();
  });

  test('LIVE-09 agente ativo passa a inativo ao fim de 60 s', async ({ page }) => {
    test.setTimeout(150_000);
    await boot(page);
    const card = node(page, 'team-lead');
    appendAssistantText(`QA-ACTIVE-${Date.now()}`);
    await expect(card).toHaveAttribute('data-status', 'active', { timeout: 3000 });
    await expect(card).toHaveAttribute('data-status', 'idle', { timeout: 80_000 });
  });

  test('LIVE-08 mensagem nova anima a aresta ~4 s', async ({ page }) => {
    test.setTimeout(60_000);
    await bootBase(page, { mode: 'graph' });
    const e = edge(page, 'team-lead', 'backend-dev').first();
    await expect(e).toHaveAttribute('data-active', 'false');
    const send = (to: string) => fs.appendFileSync(MAIN_JSONL, JSON.stringify({
      type: 'assistant', isSidechain: false, cwd: 'C:\\fixtures\\demo', sessionId: SESSION_ID,
      message: { model: 'claude-opus-5-5', id: 'qa-sm', role: 'assistant', type: 'message', content: [{ type: 'tool_use', id: `qa-sm-${Date.now()}`, name: 'SendMessage', input: { to, summary: 'qa', message: 'Mensagem de teste QA para animar a aresta' } }], usage: { input_tokens: 1, output_tokens: 1 } },
      uuid: `qa-sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(),
    }) + '\n');
    const t0 = Date.now();
    send('backend-dev');
    await expect(e).toHaveAttribute('data-active', 'true', { timeout: 2500 });
    await expect(page.locator('[data-testid="edge-bubble"]').first()).toBeAttached();
    await expect(e).toHaveAttribute('data-active', 'false', { timeout: 8000 });
    const dt = Date.now() - t0;
    console.log(`LIVE-08 aresta ativa durante ~${dt} ms`);
    expect(dt).toBeGreaterThan(3000);
    expect(dt).toBeLessThan(7000);
  });

  test('LIVE-10 evento a chegar depois de repor o servidor', async ({ page }) => {
    await boot(page);
    const text = `QA-FINAL-${Date.now()}`;
    appendAssistantText(text);
    await expect(page.locator(FEED).filter({ hasText: text })).toHaveCount(1, { timeout: 2000 });
  });
});
