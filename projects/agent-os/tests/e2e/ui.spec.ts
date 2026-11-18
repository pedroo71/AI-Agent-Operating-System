import { expect, test } from '@playwright/test';
import { boot, nav, node, tab } from './helpers/ui';

const load = async (request: any) => {
  const api = await (await request.get('/api/sessions')).json();
  const det = await (await request.get(`/api/sessions/${api.sessions[0].id}?events=2000`)).json();
  return { id: api.sessions[0].id as string, det };
};
const uniqNames = (det: any) => [...new Set<string>(det.agents.map((a: any) => a.name))];

test.describe('UI desktop v2', () => {
  test('UI-01/02/20/22 carrega, rail, header, metadados', async ({ page }) => {
    const errors = await boot(page);
    for (const n of ['Equipa', 'Tarefas', 'Projetos', 'Memória']) {
      const b = nav(page, n);
      await expect(b).toBeVisible();
      const bb = (await b.boundingBox())!;
      expect.soft(Math.min(bb.width, bb.height), `alvo rail ${n}`).toBeGreaterThanOrEqual(44);
    }
    await expect(nav(page, 'Equipa')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Escolher sessão' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Painel de detalhe' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Linha do tempo da sessão' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');
    expect((await page.title()).length).toBeGreaterThan(5);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel~="icon"]').first()).toHaveAttribute('href', /.+/);
    expect(errors.filter((e) => !/font/i.test(e))).toEqual([]);
  });

  test('UI-22b relógio no header', async ({ page }) => {
    await boot(page);
    await expect(page.locator('header time').first()).toHaveText(/\d{2}:\d{2}/);
  });

  test('UI-23 só há a vista Grafo (sem alternador)', async ({ page }) => {
    await boot(page);
    await expect(page.locator('section[data-view="graph"]')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Vista da equipa' })).toHaveCount(0);
    await expect(page.locator('section[data-view="orbit"]')).toHaveCount(0);
  });

  test('UI-24/25 nós e arestas correspondem à API', async ({ page, request }) => {
    await boot(page, { mode: 'graph' });
    const { det } = await load(request);
    const expected = uniqNames(det);
    await expect(page.locator('section[data-view="graph"] button[data-agent]')).toHaveCount(expected.length);
    for (const n of expected) await expect(node(page, n).first()).toBeVisible();
    await expect(node(page, 'Explore').first()).toHaveAttribute('data-status', 'finished');
    const pairs = new Set<string>(det.events.filter((e: any) => e.kind === 'message').map((e: any) => [e.from, e.to].map((x: string) => x.toLowerCase()).sort().join('|')));
    expect(pairs.size).toBeGreaterThan(0);
    const edges = await page.locator('section[data-view="graph"] [data-edge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-edge')!.split('|').sort().join('|')));
    expect(new Set(edges)).toEqual(pairs);
  });

  test('UI-26/27/28 seleção de nó -> Inspetor', async ({ page }) => {
    await boot(page, { mode: 'graph' });
    const aside = page.getByRole('complementary', { name: 'Painel de detalhe' });
    await expect(tab(page, 'Inspetor')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('button[data-agent][aria-pressed="true"]')).toHaveCount(1);
    for (const m of ['Grafo']) {
      await node(page, 'backend-dev').click();
      await expect(node(page, 'backend-dev')).toHaveAttribute('aria-pressed', 'true');
      await expect(aside).toContainText('backend-dev');
      for (const t of ['Ferramentas', 'Falhas de ferramenta', 'Modelo', 'Tokens']) await expect(aside).toContainText(t);
      const rows = aside.locator('[data-testid="inspector-timeline"] li');
      await expect(rows.first()).toBeVisible();
      const times = await rows.locator('time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime')!));
      expect(times.length).toBeGreaterThan(2);
      expect([...times].sort()).toEqual(times);
      await node(page, 'Explore').click();
      await expect(aside).toContainText('Explore');
    }
  });

  test('UI-29 Feed: ordem e filtro por agente', async ({ page }) => {
    await boot(page);
    await tab(page, 'Feed').click();
    const feed = page.locator('[data-testid="feed"]');
    const rows = feed.locator('li.event-row');
    await expect(rows.first()).toBeVisible();
    const times = await rows.locator('time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime')!));
    expect([...times].sort().reverse()).toEqual(times);
    const total = await rows.count();
    await feed.getByLabel('Filtrar por agente').selectOption({ label: 'Explore' });
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(total);
    await expect(rows.filter({ hasNotText: 'Explore' })).toHaveCount(0);
  });

  test('UI-30 linha do tempo da sessão: pistas, blocos, clique', async ({ page, request }) => {
    await boot(page);
    const { det } = await load(request);
    const tl = page.getByRole('region', { name: 'Linha do tempo da sessão' });
    for (const n of uniqNames(det)) await expect(tl.locator(`[data-lane="${n}"]`)).toHaveCount(1);
    await node(page, 'team-lead').click(); // garante que a seleção muda ao clicar no bloco
    const block = tl.locator('button[data-block="backend-dev"]').first();
    await expect(block).toBeVisible();
    await expect(block).toHaveAttribute('aria-label', /backend-dev, \d{2}:\d{2}/);
    await block.click();
    await expect(node(page, 'backend-dev')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('complementary', { name: 'Painel de detalhe' })).toContainText('backend-dev');
    await expect(page.locator('[data-testid="inspector-timeline"] li[data-focus="true"]')).toHaveCount(1);
  });

  test('UI-31/32 arrastar nó persiste; zoom', async ({ page, request }) => {
    await boot(page, { mode: 'graph' });
    const { id } = await load(request);
    const n = node(page, 'backend-dev');
    const b0 = (await n.boundingBox())!;
    await page.mouse.move(b0.x + b0.width / 2, b0.y + 8);
    await page.mouse.down();
    await page.mouse.move(b0.x + b0.width / 2 + 80, b0.y + 8 + 60, { steps: 8 });
    await page.mouse.up();
    const b1 = (await n.boundingBox())!;
    expect(Math.abs(b1.x - b0.x - 80)).toBeLessThan(15);
    expect(Math.abs(b1.y - b0.y - 60)).toBeLessThan(15);
    expect(await page.evaluate((k) => localStorage.getItem(k), `agent-os:graph:${id}`), 'posições guardadas').toBeTruthy();
    await page.reload();
    await expect(node(page, 'backend-dev')).toBeVisible();
    const b2 = (await node(page, 'backend-dev').boundingBox())!;
    expect(Math.abs(b2.x - b1.x)).toBeLessThan(6);
    expect(Math.abs(b2.y - b1.y)).toBeLessThan(6);
    const w0 = (await node(page, 'team-lead').boundingBox())!.width;
    await page.getByRole('button', { name: 'Aumentar zoom' }).click();
    await expect(async () => expect((await node(page, 'team-lead').boundingBox())!.width).toBeGreaterThan(w0 + 1)).toPass({ timeout: 3000 });
    await page.getByRole('button', { name: 'Repor vista e posições' }).click();
    await expect(async () => expect(Math.abs((await node(page, 'team-lead').boundingBox())!.width - w0)).toBeLessThan(2)).toPass({ timeout: 3000 });
  });

  test('UI-33 seletor de sessões', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Escolher sessão' }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const items = menu.getByRole('menuitemradio');
    expect(await items.count()).toBeGreaterThan(0);
    await expect(items.first()).toHaveAttribute('aria-checked', 'true');
    await expect(items.first()).toContainText('Site de reservas de padel');
    await items.first().click();
    await expect(menu).toHaveCount(0);
  });

  test('UI-21/34 Tarefas, Projetos, Memória', async ({ page, request }) => {
    await boot(page);
    await nav(page, 'Tarefas').click();
    const t = page.locator('[data-testid="tasks"]');
    await expect(t).toBeVisible();
    for (const s of ['Planear o projeto', 'Implementar a API', 'Testar a API', 'Concluída', 'Em curso', 'Pendente']) await expect(t).toContainText(s);
    await expect(page.getByRole('complementary', { name: 'Painel de detalhe' })).toBeVisible();

    await nav(page, 'Projetos').click();
    const p = page.locator('[data-testid="projects"]');
    await expect(p).toBeVisible();
    const { projects } = await (await request.get('/api/projects')).json();
    await expect(p).toContainText(projects[0].slug);
    await expect(p).toContainText('Contrato da API');

    await nav(page, 'Memória').click();
    const m = page.locator('[data-testid="memory"]');
    await expect(m).toBeVisible();
    const { memories } = await (await request.get('/api/memory')).json();
    if (memories.length) await expect(m).toContainText(memories[0].agent);
    await expect(m.locator('textarea, input[type="text"]')).toHaveCount(0);

    await nav(page, 'Equipa').click();
    await expect(page.locator('section[data-view]')).toBeVisible();
  });

  test('UI-15 texto pt-PT', async ({ page }) => {
    await boot(page);
    for (const n of ['Tarefas', 'Projetos', 'Memória', 'Equipa']) await nav(page, n).click();
    await tab(page, 'Feed').click();
    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const bad of ['arquivo', 'tela ', 'usuário', 'salvar', 'carregando', 'configurações', 'você']) expect(text, `contém "${bad}"`).not.toContain(bad);
  });

  test('UI-16 prefers-reduced-motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', baseURL: `http://localhost:${process.env.QA_PORT ?? 4120}` });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('button[data-agent]').first()).toBeVisible({ timeout: 20_000 });
    for (const m of ['Grafo']) {
      const anims = await page.evaluate(() => document.getAnimations().filter((a) => (a as CSSAnimation).animationName && (a.effect?.getTiming().iterations ?? 1) === Infinity).length);
      expect(anims, `animações infinitas em ${m}`).toBe(0);
    }
    await ctx.close();
  });
});
