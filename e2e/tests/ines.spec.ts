import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { resetDemo, sharpNoise, simulateTime, syntheticBmp, viewAs } from './support.js';

const ROUTES = ['/', '/plan', '/ahorro', '/perfil', '/factura', '/facturas', '/reporte', '/avisos'];

test.beforeEach(async ({ page, request }) => {
  await resetDemo(request);
  await viewAs(page, 'ines');
});

test.describe('Uso en celular', () => {
  test('Pantalla chica', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const route of ROUTES) {
      await page.goto(route);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `desplazamiento horizontal en ${route}`).toBeLessThanOrEqual(360);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [role="button"]')]
          .filter((el) => el.offsetParent !== null && !el.closest('.sr-only'))
          .map((el) => ({
            label: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName,
            box: el.getBoundingClientRect(),
          }))
          .filter(({ box }) => box.width < 44 || box.height < 44)
          .map(({ label }) => label),
      );
      expect(small, `controles de menos de 44 px en ${route}`).toEqual([]);
    }
  });
});

test.describe('Navegación según el ancho', () => {
  test('Celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ahorro');
    const nav = page.getByRole('navigation');
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    expect(Math.round(box!.y + box!.height)).toBe(844);
    const paddingBottom = await page
      .locator('main')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(paddingBottom).toBeGreaterThanOrEqual(56);
  });
});

test.describe('Accesibilidad', () => {
  test('Control automático', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.help}`);
      expect(serious, `violaciones en ${route}`).toEqual([]);
    }
  });
});

test.describe('Datos móviles limitados', () => {
  test('Foto grande', async ({ page }) => {
    await page.goto('/factura');
    const bigPhoto = syntheticBmp(1400, 1000, sharpNoise); // ~4 MB
    expect(bigPhoto.length).toBeGreaterThan(4_000_000);
    const uploadRequest = page.waitForRequest(
      (r) => r.url().includes('/api/uploads') && r.method() === 'POST',
    );
    await page
      .getByLabel('Foto de la factura')
      .setInputFiles({ name: 'factura.bmp', mimeType: 'image/bmp', buffer: bigPhoto });
    await page.getByRole('button', { name: 'Usar esta foto' }).click();
    const req = await uploadRequest;
    expect(req.postDataBuffer()?.length ?? Infinity).toBeLessThanOrEqual(250 * 1024 + 2048);
  });
});

test.describe('Borradores sin conexión', () => {
  test('Corte de conexión', async ({ page, context }) => {
    await page.goto('/factura');
    await page.getByLabel('Consumo del periodo (kWh)').fill('1790');
    await page.getByLabel('Precio por kWh (S/)').fill('0.84');
    await page.getByLabel('Inicio del periodo').fill('2025-12-01');
    await page.getByLabel('Cierre del periodo').fill('2025-12-31');
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Guardar factura' }).click();
    await expect(
      page.getByText('No hay conexión. Guardamos tu factura en el teléfono y la enviamos cuando vuelva.'),
    ).toBeVisible();
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByLabel('Consumo del periodo (kWh)')).toHaveValue('1790');
  });
});

test.describe('recorridos de Inés', () => {
  test('primer paso → aceptar → completar → simular el tiempo → ahorro medido', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Tu primer paso/ })).toBeVisible();
    await expect(
      page.getByText('Mantenimiento de burletes y descongelamiento de refrigeradoras'),
    ).toBeVisible();
    await expect(page.getByText('7 de cada 9 panaderías que la eligieron la terminaron.')).toBeVisible();
    await page.getByRole('button', { name: 'Empezar este paso' }).click();

    await page.getByTestId('nav-plan').click();
    await page.getByRole('button', { name: 'Terminé' }).click();
    await page.getByLabel('¿Qué día terminaste?').fill('2026-07-08');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(/factura que cierra alrededor del 31 de agosto/)).toBeVisible();

    await simulateTime(request);
    await page.getByTestId('nav-ahorro').click();
    await expect(page.getByRole('heading', { name: '¿Bajó tu consumo?' })).toBeVisible();
    await expect(page.getByText('Sí: usas 6 % menos luz por día')).toBeVisible();
    await expect(page.getByText('Unos S/ 90 menos por mes')).toBeVisible();
    // El porcentaje lleva espacio duro (como en el dominio): `\s` lo acepta.
    await expect(page.getByText(/La tarifa subió 8\s%/)).toBeVisible();
  });

  test('perfil asistido sin IA y foto oscura guardada igual', async ({ page }) => {
    await viewAs(page, 'nuevo');
    await page.goto('/perfil');
    await page
      .getByLabel('Cuéntanos cómo es tu negocio')
      .fill(
        'Panadería de barrio, hacemos pan y tortas todos los días. Tenemos horno eléctrico y una congeladora.',
      );
    await page.getByRole('button', { name: 'Sugerir mis datos' }).click();
    await page.getByRole('button', { name: 'Entendido, enviar' }).click();
    await expect(page.getByText('Elaboración de productos de panadería')).toBeVisible();
    await expect(page.getByText('Sugerido por palabras clave')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar mis datos' }).click();

    await page.goto('/factura');
    await page.getByLabel('Foto de la factura').setInputFiles({
      name: 'oscura.bmp',
      mimeType: 'image/bmp',
      buffer: syntheticBmp(1200, 1600, () => 15),
    });
    await expect(
      page.getByText('La foto se ve oscura o movida. Tómala con buena luz y que se lean los kWh.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Guardar igual' }).click();
    await page.getByLabel('Consumo del periodo (kWh)').fill('1650');
    await page.getByLabel('Precio por kWh (S/)').fill('0.84');
    await page.getByLabel('Inicio del periodo').fill('2026-06-01');
    await page.getByLabel('Cierre del periodo').fill('2026-06-30');
    await page.getByRole('button', { name: 'Guardar factura' }).click();
    await expect(
      page.getByText('Factura guardada. Cuando puedas, súbela de nuevo con una foto más clara.'),
    ).toBeVisible();
  });
});

test.describe('Navegación en tres secciones', () => {
  test('en el celular, tres botones abajo y las páginas de la sección arriba', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ahorro');
    for (const id of ['nav-grupo-negocio', 'nav-grupo-facturas', 'nav-grupo-reportes'])
      await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId('nav-plan')).toBeVisible();
    await expect(page.getByTestId('nav-factura')).toBeHidden();
    await page.getByTestId('nav-grupo-facturas').click();
    await expect(page).toHaveURL(/\/factura$/);
    await expect(page.getByTestId('nav-facturas')).toBeVisible();
    await expect(page.getByTestId('nav-plan')).toBeHidden();
  });
});
