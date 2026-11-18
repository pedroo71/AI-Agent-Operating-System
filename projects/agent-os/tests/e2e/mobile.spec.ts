import { expect, test, type Page } from '@playwright/test';
import { boot, node } from './helpers/ui';

const bar = (page: Page) => page.getByRole('navigation', { name: 'Navegação' });
const tabBtn = (page: Page, n: string) => bar(page).getByRole('button', { name: n, exact: true });

test.describe('Móvel 375x812 v2', () => {
  test('MOB-01/02/05 sem scroll horizontal, tab bar em baixo, grafo, sem linha do tempo', async ({ page }) => {
    await boot(page);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    const b = (await bar(page).boundingBox())!;
    expect(b.y).toBeGreaterThan(600);
    expect(b.y + b.height).toBeGreaterThan(808);
    await expect(page.locator('section[data-view="graph"]')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Linha do tempo da sessão' })).toBeHidden();
    const o = (await page.locator('section[data-view="graph"]').boundingBox())!;
    expect(o.x).toBeGreaterThanOrEqual(-1);
    expect(o.x + o.width).toBeLessThanOrEqual(376);
    await page.screenshot({ path: 'test-results/mobile-home.png' });
  });

  test('MOB-03 5 separadores visíveis, alvos >= 40 px, conteúdo', async ({ page }) => {
    await boot(page);
    for (const n of ['Equipa', 'Feed', 'Tarefas', 'Projetos', 'Memória']) {
      const b = tabBtn(page, n);
      await expect(b, n).toBeVisible();
      const bb = (await b.boundingBox())!;
      expect.soft(bb.x, `${n} dentro do ecrã`).toBeGreaterThanOrEqual(0);
      expect.soft(bb.x + bb.width, `${n} dentro do ecrã`).toBeLessThanOrEqual(376);
      expect.soft(bb.height, `altura ${n}`).toBeGreaterThanOrEqual(40);
      await b.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `scroll horizontal em ${n}`).toBe(true);
    }
    await tabBtn(page, 'Tarefas').click();
    await expect(page.locator('[data-testid="tasks"]')).toBeVisible();
    await tabBtn(page, 'Projetos').click();
    await expect(page.locator('[data-testid="projects"]')).toBeVisible();
    await tabBtn(page, 'Memória').click();
    await expect(page.locator('[data-testid="memory"]')).toBeVisible();
  });

  test('MOB-04 tocar num nó abre a folha do Inspetor', async ({ page }) => {
    await boot(page);
    await node(page, 'backend-dev').tap();
    const sheet = page.getByRole('dialog', { name: 'Inspetor' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('backend-dev');
    const b = (await sheet.boundingBox())!;
    expect(b.width).toBeLessThanOrEqual(376);
    expect(await sheet.evaluate((e) => e.scrollWidth > e.clientWidth + 1)).toBe(false);
    await page.screenshot({ path: 'test-results/mobile-inspector.png' });
    await sheet.getByRole('button', { name: 'Fechar inspetor' }).click();
    await expect(sheet).toHaveCount(0);
    await node(page, 'Explore').tap();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  });

  test('MOB-06 Feed legível; seletor de sessão cabe', async ({ page }) => {
    await boot(page);
    await tabBtn(page, 'Feed').click();
    const feed = page.locator('[data-testid="feed"]');
    await expect(feed.locator('li.event-row').first()).toBeVisible();
    expect(await feed.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(false);
    await page.screenshot({ path: 'test-results/mobile-feed.png' });
    await tabBtn(page, 'Equipa').click();
    const sel = page.getByRole('button', { name: 'Escolher sessão' });
    if (await sel.isVisible()) {
      await sel.click();
      const b = (await page.getByRole('menu').boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(376);
    }
  });
});
