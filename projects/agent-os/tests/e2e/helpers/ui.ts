import { expect, type Page } from '@playwright/test';

export const live = (page: Page) => page.locator('.live');
export const node = (page: Page, name: string) => page.locator(`button[data-agent="${name}"]`);
export const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Navegação' }).getByRole('button', { name, exact: true });
export const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
export const edge = (page: Page, a: string, b: string) => page.locator(`[data-edge="${a}|${b}"], [data-edge="${b}|${a}"]`);

// `mode` ficou da v2 (alternador Grafo/Órbita, removido); só existe o grafo e o valor é ignorado.
export async function boot(page: Page, _opts: { mode?: 'graph' } = {}) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto('/');
  await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' }); // overlay do Next em dev (BUG-001)
  await expect(live(page)).toHaveAttribute('data-state', 'live', { timeout: 20_000 });
  return errors;
}
