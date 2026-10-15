/// <reference lib="dom" />
/**
 * Capturas del README (`npm run capturas`, con `npm run dev` corriendo en otra terminal).
 * Recorre la demostración desde cero, como en el video: primer paso → plan terminado → «todavía no» →
 * ahorro medido, más la foto oscura, el perfil asistido sin IA, el escritorio y el informe para aliados.
 * Deja la demostración reiniciada al terminar.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { syntheticBmp } from '../e2e/tests/support.js';

const BASE = process.env.CAPTURAS_URL ?? 'http://localhost:5180';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'img');

async function post(route: string, body: unknown = {}): Promise<void> {
  const res = await fetch(`${BASE}/api${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${route} respondió ${res.status}`);
}

async function phone(browser: Browser, user: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?verComo=${user}`);
  return { context, page };
}

async function desktop(
  browser: Browser,
  user: string,
  height = 900,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 1440, height },
    deviceScaleFactor: 1,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?verComo=${user}`);
  return { context, page };
}

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  // Sin el cursor de texto ni animaciones de foco en la imagen.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  ✓ ${name}.png`);
}

/** Lleva el elemento arriba de la pantalla, debajo de la barra superior y de los botones de la sección. */
async function scrollTo(page: Page, text: string, offset = 130): Promise<void> {
  await page
    .getByText(text, { exact: true })
    .first()
    .evaluate((el, top) => {
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - top);
    }, offset);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await post('/demo/reset');
  const browser = await chromium.launch();
  try {
    console.log('Celular · Inés');
    const { context, page } = await phone(browser, 'ines');

    await page.getByText('Mantenimiento de burletes y descongelamiento de refrigeradoras').first().waitFor();
    await shot(page, 'celular-primer-paso');
    await scrollTo(page, '¿Por qué esto?');
    await shot(page, 'celular-por-que-esto');

    await page.getByRole('button', { name: 'Empezar este paso' }).click();
    await page.waitForURL('**/plan');
    await page.getByRole('button', { name: 'Terminé' }).click();
    await page.getByLabel('¿Qué día terminaste?').fill('2026-07-08');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByText(/factura que cierra alrededor del 31 de agosto/).waitFor();
    await scrollTo(page, '¿Qué me falta?', 140);
    await shot(page, 'celular-plan-terminado');

    await post('/demo/simulate-time', { through: 'ago' });
    await page.goto(`${BASE}/ahorro`);
    await page.getByText('Todavía no podemos saberlo').first().waitFor();
    await shot(page, 'celular-ahorro-todavia-no');

    await post('/demo/simulate-time', { through: 'sep' });
    await page.goto(`${BASE}/ahorro`);
    await page.getByText('Sí: usas 6 % menos luz por día').first().waitFor();
    // El aviso de resultado nuevo vive en «Avisos»; en esta pantalla se ve solo el recálculo.
    await shot(page, 'celular-ahorro-medido');

    await page.getByText('Cómo lo medimos', { exact: true }).click();
    await scrollTo(page, 'Cómo lo medimos');
    await shot(page, 'celular-como-lo-medimos');

    await page.goto(`${BASE}/factura`);
    await page.getByLabel('Foto de la factura').setInputFiles({
      name: 'factura-oscura.bmp',
      mimeType: 'image/bmp',
      // Un recibo sacado con poca luz: renglones apenas visibles sobre un fondo casi negro.
      buffer: syntheticBmp(1200, 1600, (x, y) =>
        y > 180 && y < 1420 && x > 120 && x < 1080 && y % 64 < 10 && (x + Math.floor(y / 64) * 37) % 260 < 200
          ? 44
          : 20,
      ),
    });
    await page
      .getByText('La foto se ve oscura o movida. Tómala con buena luz y que se lean los kWh.')
      .waitFor();
    await shot(page, 'celular-factura-foto');
    await context.close();

    console.log('Celular · Rosa (negocio nuevo, sin IA)');
    const rosa = await phone(browser, 'nuevo');
    await rosa.page.goto(`${BASE}/perfil`);
    await rosa.page
      .getByLabel('Cuéntanos cómo es tu negocio')
      .fill(
        'Panadería de barrio en Cusco. Tenemos horno eléctrico y una congeladora. Puedo poner 800 soles y 3 horas por semana.',
      );
    await rosa.page.getByRole('button', { name: 'Sugerir mis datos' }).click();
    await rosa.page.getByRole('button', { name: 'Entendido, enviar' }).click();
    await rosa.page.getByText('Sugerido por palabras clave').waitFor();
    await scrollTo(rosa.page, 'Revisa lo que entendimos');
    await shot(rosa.page, 'celular-perfil-asistido');
    await rosa.context.close();

    console.log('Escritorio');
    const ines = await desktop(browser, 'ines');
    await ines.page.goto(`${BASE}/ahorro`);
    await ines.page.getByText('Sí: usas 6 % menos luz por día').first().waitFor();
    await shot(ines.page, 'escritorio-ahorro');
    await ines.page.goto(`${BASE}/`);
    await ines.page.getByText(/Ya lo elegiste/).waitFor();
    await ines.page.goto(`${BASE}/demo`);
    await ines.page.getByText('Simular el paso del tiempo').waitFor();
    await shot(ines.page, 'escritorio-demostracion');
    await ines.context.close();

    // Alto suficiente para el informe entero: la barra lateral ocupa toda la pantalla, como al usarla.
    const aliado = await desktop(browser, 'aliado', 1720);
    await aliado.page.goto(`${BASE}/aliados?periodo=2026-T3`);
    await aliado.page.getByText('Negocios por resultado').waitFor();
    await shot(aliado.page, 'escritorio-informe-aliados');
    await aliado.context.close();
  } finally {
    await browser.close();
    await post('/demo/reset').catch(() => undefined);
  }
  console.log(`Listo: ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
