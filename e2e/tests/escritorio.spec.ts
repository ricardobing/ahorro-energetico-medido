import { expect, test } from '@playwright/test';
import { resetDemo, viewAs } from './support.js';

test.beforeEach(async ({ page, request }) => {
  await resetDemo(request);
  await viewAs(page, 'ines');
});

test.describe('Navegación según el ancho', () => {
  test('Computadora', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ahorro');
    const navs = page.getByRole('navigation');
    await expect(navs).toHaveCount(1);
    const sidebar = page.locator('aside');
    const box = await sidebar.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: 248, height: 800 });
    for (const group of ['Mi negocio', 'Facturas', 'Reportes'])
      await expect(page.getByText(group, { exact: true })).toBeVisible();
    for (const id of ['nav-primer-paso', 'nav-plan', 'nav-factura', 'nav-ahorro', 'nav-mas'])
      await expect(page.getByTestId(id)).toHaveCount(1);
    await expect(page.getByTestId('nav-ahorro')).toHaveAttribute('aria-current', 'page');
  });
});
