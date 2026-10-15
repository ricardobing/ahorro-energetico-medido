import { expect, test } from '@playwright/test';
import { resetDemo, viewAs } from './support.js';

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test.describe('informe para aliados', () => {
  test('el aliado ve el informe con celdas ocultas y no puede abrir datos de un negocio', async ({
    page,
    request,
  }) => {
    await viewAs(page, 'aliado');
    await page.goto('/aliados?periodo=2026-T3');
    await expect(page.getByRole('heading', { name: /Informe de ahorro medido/ })).toBeVisible();
    await expect(page.getByText('menos de 5 negocios').first()).toBeVisible();
    await expect(page.getByText('declarado por las usuarias, no medido')).toBeVisible();
    await expect(page.getByText(/Panadería|Inés|Arequipa/)).toHaveCount(0);

    const forbidden = await request.get('/api/user-bill', { headers: { 'X-Demo-User': 'aliado' } });
    expect(forbidden.status()).toBe(403);
  });
});
