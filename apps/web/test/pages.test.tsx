import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (key: string) => store.get(key),
  set: async (key: string, value: unknown) => void store.set(key, value),
  del: async (key: string) => void store.delete(key),
}));

const { BillUploadPage } = await import('../src/pages/BillUpload');
const { FirstStepPage } = await import('../src/pages/FirstStep');
const { PlanPage } = await import('../src/pages/Plan');
const { SavingsPage } = await import('../src/pages/Savings');
const { BillsPage } = await import('../src/pages/Bills');
const { NotificationsPage } = await import('../src/pages/Notifications');
const { ReportPage } = await import('../src/pages/Report');
const { ProfilePage } = await import('../src/pages/Profile');
const { PartnersPage } = await import('../src/pages/Partners');

type Handler = (
  init: RequestInit | undefined,
) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;
let routes: Record<string, Handler> = {};
const calls: { url: string; init?: RequestInit }[] = [];

const ME = {
  user: { id: 'usr_ines', role: 'owner', displayName: 'Inés Huamán' },
  business: { name: 'Panadería Santa Inés', country: 'PE', city: 'Arequipa' },
  today: '2026-07-10',
  demoMode: true,
};

beforeEach(() => {
  store.clear();
  calls.length = 0;
  routes = {
    'GET /me': () => ({ status: 200, body: ME }),
    'GET /notifications': () => ({ status: 200, body: { items: [], unread: 0 } }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input).replace(/^\/api/, '');
      calls.push({ url, init });
      const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`;
      const handler = routes[key];
      if (!handler) throw new TypeError(`sin ruta simulada: ${key}`);
      const { status, body } = await handler(init);
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderPage(page: ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const err = (status: number, code: string, message: string, details?: unknown) => ({
  status,
  body: { error: { code, message, details }, requestId: 'r1' },
});

describe('manejo de errores de la API', () => {
  it('un 503 muestra el mensaje del servidor y conserva el formulario', async () => {
    routes['POST /user-bill'] = () =>
      err(
        503,
        'SERVICE_UNAVAILABLE',
        'No pudimos guardar ni leer tus datos ahora. Intenta de nuevo en un rato.',
      );
    const user = userEvent.setup();
    renderPage(<BillUploadPage />, '/factura');
    await user.type(screen.getByLabelText('Consumo del periodo (kWh)'), '1790');
    await user.type(screen.getByLabelText(/Precio por kWh/), '0.84');
    await user.click(screen.getByRole('button', { name: 'Guardar factura' }));
    expect(
      await screen.findByText('No pudimos guardar ni leer tus datos ahora. Intenta de nuevo en un rato.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Consumo del periodo (kWh)')).toHaveValue('1790');
  });

  it('sin conexión guarda el borrador en el teléfono', async () => {
    routes['POST /user-bill'] = () => {
      throw new TypeError('Failed to fetch');
    };
    const user = userEvent.setup();
    renderPage(<BillUploadPage />, '/factura');
    await user.type(screen.getByLabelText('Consumo del periodo (kWh)'), '1790');
    await user.click(screen.getByRole('button', { name: 'Guardar factura' }));
    expect(
      await screen.findByText(
        'No hay conexión. Guardamos tu factura en el teléfono y la enviamos cuando vuelva.',
      ),
    ).toBeInTheDocument();
    expect(store.size).toBe(1);
  });

  it('un error de un campo se muestra junto al campo', async () => {
    routes['POST /user-bill'] = () =>
      err(400, 'VALIDATION_ERROR', 'La fecha de inicio tiene que ser anterior a la de cierre.', {
        errors: [{ field: 'billingStartDate', code: 'START_AFTER_END' }],
      });
    const user = userEvent.setup();
    renderPage(<BillUploadPage />, '/factura');
    await user.click(screen.getByRole('button', { name: 'Guardar factura' }));
    expect(
      await screen.findByText('La fecha de inicio tiene que ser anterior a la de cierre.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Inicio del periodo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('pide confirmar un valor atípico y lo reenvía confirmado', async () => {
    let attempts = 0;
    routes['POST /user-bill'] = (init) => {
      attempts++;
      const body = JSON.parse(String(init?.body)) as { confirmAtypical?: boolean };
      return body.confirmAtypical
        ? { status: 201, body: { id: 'b1', evidence: 'no_photo' } }
        : err(422, 'BILL_NEEDS_CONFIRMATION', 'Es mucho más que tu consumo habitual. ¿Está bien el número?');
    };
    routes['GET /first-step'] = () => ({ status: 200, body: {} });
    const user = userEvent.setup();
    renderPage(<BillUploadPage />, '/factura');
    await user.type(screen.getByLabelText('Consumo del periodo (kWh)'), '17900');
    await user.click(screen.getByRole('button', { name: 'Guardar factura' }));
    await user.click(await screen.findByRole('button', { name: 'Sí, está bien' }));
    expect(await screen.findByText(/Factura guardada/)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});

const FIRST_STEP = {
  recommendation: {
    id: 'rec_1',
    ecoId: 'eco_118',
    createdAt: '2026-07-10T12:00:00Z',
    rulesetVersion: '1.0.0',
    eco: {
      ecoId: 'eco_118',
      title: 'Mantenimiento de burletes y descongelamiento de refrigeradoras',
      category: 'ENERGY',
      complexity: 'BAJA',
      investment: 'BAJA',
      time: 'BAJA',
      impact: 'Reduce el consumo de refrigeración',
      returnInvestment: 'Inmediato',
      steps: ['Revisar burletes', 'Programar descongelamiento', 'Registrar consumo'],
      dataSource: 'caso',
    },
  },
  explanation: {
    reasons: [
      'Cabe en tu presupuesto y en tus horas: inversión baja y se hace en pocos días.',
      'Apunta a tus refrigeradoras, que gastan buena parte de tu luz.',
      '7 de cada 9 panaderías que la eligieron la terminaron.',
    ],
    unknown:
      'Todavía no sabemos cuánto te va a ahorrar a ti. Lo vamos a medir con tus próximas facturas de luz.',
  },
  alternatives: [
    {
      ecoId: 'eco_204',
      title: 'Hornear por tandas',
      investment: 'BAJA',
      time: 'MEDIA',
      complexity: 'MEDIA',
      budgetFit: 'FULL',
      mayExceedBudget: false,
    },
  ],
  why: {
    peerCounts: { chose: 9, completed: 7, measured: 4 },
    factors: { pComplete: 0.607, effectPct: 3.43, detectable: true, budgetFit: 'FULL', timeFit: 'FULL' },
    dataUsed: {
      budgetCents: 120000,
      hoursPerWeek: 4,
      diagnosticLevel: 'Crecimiento',
      equipment: ['electric_oven', 'refrigeration'],
      ovenType: 'electric',
      billsCount: 6,
      peerStatsVersion: 'case_table-1',
    },
    rulesetVersion: '1.0.0',
  },
  stalledPlan: { id: 'plan_552', title: 'Aislamiento térmico del horno', daysWithoutChange: 89 },
  decision: null,
};

describe('«Tu primer paso»', () => {
  it('muestra la recomendación con sus tres motivos y ofrece pausar el plan estancado', async () => {
    let decision: unknown;
    routes['GET /first-step'] = () => ({ status: 200, body: FIRST_STEP });
    routes['POST /first-step/decision'] = (init) => {
      decision = JSON.parse(String(init?.body));
      return { status: 201, body: {} };
    };
    const user = userEvent.setup();
    renderPage(<FirstStepPage />);
    expect(
      await screen.findByText('Mantenimiento de burletes y descongelamiento de refrigeradoras'),
    ).toBeInTheDocument();
    for (const reason of FIRST_STEP.explanation.reasons) expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.getByText(FIRST_STEP.explanation.unknown)).toBeInTheDocument();
    expect(screen.getByText(/no avanza hace 89 días/)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Pausar «Aislamiento térmico del horno» al empezar' }),
    ).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Empezar este paso' }));
    await waitFor(() => expect(decision).toEqual({ action: 'accept', pausePlanId: 'plan_552' }));
  });

  it('«Prefiero otra» deja elegir una alternativa sin justificar', async () => {
    let decision: unknown;
    routes['GET /first-step'] = () => ({ status: 200, body: { ...FIRST_STEP, stalledPlan: null } });
    routes['POST /first-step/decision'] = (init) => {
      decision = JSON.parse(String(init?.body));
      return { status: 201, body: {} };
    };
    const user = userEvent.setup();
    renderPage(<FirstStepPage />);
    await user.click(await screen.findByRole('button', { name: 'Prefiero otra' }));
    await user.click(screen.getByRole('radio', { name: /Hornear por tandas/ }));
    await user.click(screen.getByRole('button', { name: 'Elegir esta' }));
    await waitFor(() => expect(decision).toEqual({ action: 'choose', ecoId: 'eco_204' }));
  });
});

const PLAN = {
  id: 'plan_1',
  ecoCardOrigin: 'eco_118',
  title: 'Mantenimiento de burletes y descongelamiento de refrigeradoras',
  status: 'in_progress',
  statusUpdatedAt: '2026-07-10',
  createdAt: '2026-07-10',
  steps: [{ _id: 'step_1', title: 'Revisar burletes', status: 'not_started', subSteps: [] }],
  implementedAt: null,
  stalled: false,
  daysWithoutChange: 0,
  events: [],
  measurementHint: null,
  dataSource: null,
};

describe('«Tu plan»', () => {
  beforeEach(() => {
    routes['GET /user-eco-card'] = () => ({ status: 200, body: { items: [PLAN] } });
    routes['GET /first-step'] = () => ({
      status: 200,
      body: { ...FIRST_STEP, decision: { planId: 'plan_1' } },
    });
  });

  it('sin cupo de ideas lo dice y los pasos siguen', async () => {
    routes['POST /user-eco-card/plan_1/steps/step_1/ideas'] = () =>
      err(402, 'AI_QUOTA_EXCEEDED', 'Se terminó el cupo gratis de ideas de este mes. Tus pasos siguen aquí.');
    const user = userEvent.setup();
    renderPage(<PlanPage />, '/plan');
    await user.click(await screen.findByRole('button', { name: /Ideas para este paso/ }));
    expect(
      await screen.findByText('Se terminó el cupo gratis de ideas de este mes. Tus pasos siguen aquí.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Revisar burletes' })).toBeInTheDocument();
  });

  it('si el servicio de ideas tarda o se cae, lo dice sin bloquear', async () => {
    routes['POST /user-eco-card/plan_1/steps/step_1/ideas'] = () =>
      err(503, 'AI_UNAVAILABLE', 'Ahora no pudimos sugerir ideas extra. Tus pasos siguen aquí.');
    const user = userEvent.setup();
    renderPage(<PlanPage />, '/plan');
    await user.click(await screen.findByRole('button', { name: /Ideas para este paso/ }));
    expect(
      await screen.findByText('Ahora no pudimos sugerir ideas extra. Tus pasos siguen aquí.'),
    ).toBeInTheDocument();
  });

  it('«Terminé» pide la fecha y muestra con qué factura se va a ver el resultado', async () => {
    let body: unknown;
    routes['PATCH /user-eco-card/plan_1'] = (init) => {
      body = JSON.parse(String(init?.body));
      const message =
        'Tu factura de julio no cuenta porque incluye el día del cambio. El resultado se va a ver con la factura que cierra alrededor del 31 de agosto.';
      routes['GET /user-eco-card'] = () => ({
        status: 200,
        body: {
          items: [
            {
              ...PLAN,
              status: 'completed',
              implementedAt: '2026-07-08',
              measurementHint: { excludedMonth: '2026-07', firstMeasurableBillEta: '2026-08-31', message },
            },
          ],
        },
      });
      return { status: 200, body: {} };
    };
    routes['GET /savings'] = () => ({ status: 200, body: {} });
    routes['GET /user-bill'] = () => ({ status: 200, body: { items: [] } });
    routes['GET /profile'] = () => ({ status: 200, body: {} });
    const user = userEvent.setup();
    renderPage(<PlanPage />, '/plan');
    await user.click(await screen.findByRole('button', { name: 'Terminé' }));
    const date = screen.getByLabelText('¿Qué día terminaste?');
    await user.clear(date);
    await user.type(date, '2026-07-08');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/factura que cierra alrededor del 31 de agosto/)).toBeInTheDocument();
    expect(body).toEqual({ status: 'completed', implementedAt: '2026-07-08' });
  });
});

const DISPLAY_BASE = {
  methodLine: 'Comparado con tus 3 meses antes del cambio. Todavía no podemos corregir por temporada.',
  tariffNote:
    'Tu tarifa subió 8 % desde enero: por eso tu factura puede subir aunque uses menos luz. Eso no depende de ti.',
  tariffHeadline: 'La tarifa subió 8 % desde enero',
};
const savings = (display: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  planId: 'plan_1',
  ecoId: 'eco_118',
  planTitle: 'Mantenimiento de burletes y descongelamiento de refrigeradoras',
  implementedAt: '2026-07-08',
  version: 3,
  methodVersion: '1.0.0',
  inputsHash: 'x',
  computedAt: '2026-10-05T12:00:00Z',
  status: display.status,
  reasons: [],
  baseline: { kwhPerDay: 58.9, days: 91, billIds: ['b4', 'b5', 'b6'] },
  after: { kwhPerDay: 55.25, days: 61, billIds: ['b8', 'b9'] },
  changePct: -6.21,
  chart: {
    baselineKwhPerDay: 58.9,
    bandPct: 4.69,
    points: [
      {
        billId: 'b6',
        billingStartDate: '2026-06-01',
        billingEndDate: '2026-06-30',
        kwhPerDay: 57.3,
        role: 'baseline',
        excludedReason: null,
      },
      {
        billId: 'b7',
        billingStartDate: '2026-07-01',
        billingEndDate: '2026-07-31',
        kwhPerDay: 57.7,
        role: 'excluded',
        excludedReason: 'CONTAINS_IMPLEMENTATION_DATE',
      },
      {
        billId: 'b8',
        billingStartDate: '2026-08-01',
        billingEndDate: '2026-08-31',
        kwhPerDay: 57.1,
        role: 'after',
        excludedReason: null,
      },
    ],
  },
  display: { ...DISPLAY_BASE, ...display },
  ...extra,
});

describe('«Tu ahorro»: los tres estados', () => {
  it('medido: las tres preguntas, el rango y «Cómo lo medimos» con cada factura', async () => {
    routes['GET /savings'] = () => ({
      status: 200,
      body: savings({
        status: 'MEASURED',
        summary:
          'Desde que cambiaste los burletes usas 6 % menos de luz por día. A la tarifa de hoy son unos S/ 90 menos por mes (entre S/ 20 y S/ 160).',
        headline: 'Sí: usas 6 % menos luz por día',
        money: {
          text: 'Unos S/ 90 menos por mes',
          rangeText: 'Entre S/ 20 y S/ 160',
          mostLikelyText: 'Lo más probable: S/ 90',
        },
        nextStep: null,
      }),
    });
    renderPage(<SavingsPage />, '/ahorro');
    expect(await screen.findByText('Sí: usas 6 % menos luz por día')).toBeInTheDocument();
    expect(screen.getByText('La tarifa subió 8 % desde enero')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Entre S/ 20 y S/ 160, lo más probable S/ 90' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/incluye el día del cambio/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver mi reporte/ })).toHaveAttribute('href', '/reporte');
  });

  it('no vemos ahorro: lo dice con el siguiente paso, sin soles', async () => {
    routes['GET /savings'] = () => ({
      status: 200,
      body: savings({
        status: 'NO_SAVINGS_DETECTED',
        summary:
          'Por ahora no vemos ahorro: tu consumo por día sigue dentro de lo que varía normalmente en tu negocio.',
        headline: 'Por ahora no vemos ahorro',
        money: null,
        nextStep:
          'Revisa con tu equipo si el cambio se sigue haciendo todos los días. Seguimos comparando con cada factura nueva.',
      }),
    });
    renderPage(<SavingsPage />, '/ahorro');
    expect(await screen.findByText('Por ahora no vemos ahorro')).toBeInTheDocument();
    expect(
      screen.getByText('Tu consumo por día sigue dentro de lo que varía normalmente en tu negocio.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Unos S\//)).not.toBeInTheDocument();
  });

  it('sin plan terminado lleva al primer paso, y el aviso de recálculo se cierra a mano', async () => {
    routes['GET /savings'] = () => ({
      status: 200,
      body: { planId: null, status: 'INSUFFICIENT_DATA', reasons: ['NO_IMPLEMENTATION_DATE'], display: null },
    });
    renderPage(<SavingsPage />, '/ahorro');
    expect(await screen.findByRole('link', { name: 'Ver mi primer paso' })).toHaveAttribute('href', '/');
  });

  it('muestra el aviso «Recalculamos tu ahorro…» arriba', async () => {
    let read = false;
    routes['GET /notifications'] = () => ({
      status: 200,
      body: {
        unread: 1,
        items: [
          {
            id: 'n1',
            type: 'savings_recalculated',
            title: 'Recalculamos tu ahorro',
            body: 'Recalculamos tu ahorro porque corregiste tu factura de septiembre: antes unos S/ 90, ahora unos S/ 75.',
            link: '/ahorro',
            createdAt: '2026-10-05T12:00:00Z',
            readAt: read ? 'x' : null,
          },
        ],
      },
    });
    routes['POST /notifications/n1/read'] = () => {
      read = true;
      return { status: 204 };
    };
    routes['GET /savings'] = () => ({
      status: 200,
      body: savings({
        status: 'MEASURED',
        summary: '…',
        headline: 'Sí: usas 5 % menos luz por día',
        money: {
          text: 'Unos S/ 75 menos por mes',
          rangeText: 'Entre S/ 10 y S/ 140',
          mostLikelyText: 'Lo más probable: S/ 75',
        },
        nextStep: null,
      }),
    });
    const user = userEvent.setup();
    renderPage(<SavingsPage />, '/ahorro');
    expect(await screen.findByText(/antes unos S\/ 90, ahora unos S\/ 75/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    await waitFor(() => expect(read).toBe(true));
  });
});

describe('«Mis facturas», «Avisos» y «Tu reporte»', () => {
  it('lista las facturas y pide confirmar antes de borrar', async () => {
    let deleted = false;
    routes['GET /user-bill'] = () => ({
      status: 200,
      body: {
        items: [
          {
            id: 'b1',
            serviceType: 'electricity',
            kwhConsumed: 1720,
            costPerKwh: 0.84,
            billingStartDate: '2026-06-01',
            billingEndDate: '2026-06-30',
            days: 30,
            totalCost: 1444.8,
            totalCostText: 'S/ 1,444.80',
            currency: 'PEN',
            evidence: 'photo_ok',
            source: 'user',
            version: 1,
            dataSource: 'caso',
          },
        ],
      },
    });
    routes['DELETE /user-bill/b1'] = () => {
      deleted = true;
      return { status: 204 };
    };
    const user = userEvent.setup();
    renderPage(<BillsPage />, '/facturas');
    expect(await screen.findByText(/1720 kWh/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(screen.getByText(/Vamos a recalcular tu ahorro sin ella/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('muestra los avisos y los marca como leídos', async () => {
    const read: string[] = [];
    routes['GET /notifications'] = () => ({
      status: 200,
      body: {
        unread: 1,
        items: [
          {
            id: 'n1',
            type: 'bill_reminder',
            title: 'Sube tu factura de agosto',
            body: 'Tu factura de luz de agosto ya debería haber llegado.',
            link: '/factura',
            createdAt: '2026-09-05T12:00:00Z',
            readAt: null,
          },
        ],
      },
    });
    routes['POST /notifications/n1/read'] = () => {
      read.push('n1');
      return { status: 204 };
    };
    renderPage(<NotificationsPage />, '/avisos');
    expect(await screen.findByText('Sube tu factura de agosto')).toBeInTheDocument();
    await waitFor(() => expect(read).toEqual(['n1']));
  });

  it('el reporte trae fechas, método y evidencia, y se puede imprimir', async () => {
    routes['GET /savings/report'] = () => ({
      status: 200,
      body: {
        business: { name: 'Panadería Santa Inés', city: 'Arequipa', country: 'PE' },
        planTitle: 'Mantenimiento de burletes',
        implementedAt: '2026-07-08',
        status: 'MEASURED',
        title: 'Tu ahorro medido',
        summary: 'Desde que cambiaste los burletes usas 6 % menos de luz por día.',
        changeText: '6 % menos de luz por día',
        moneyText: 'Unos S/ 90 menos por mes (entre S/ 20 y S/ 160)',
        method: 'periodos cercanos, sin corrección por temporada',
        evidence: 'con comprobante',
        period: {
          baselineFrom: '2026-04-01',
          baselineTo: '2026-06-30',
          afterFrom: '2026-08-01',
          afterTo: '2026-09-30',
        },
        computedAt: '2026-10-05T12:00:00Z',
        version: 3,
      },
    });
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const user = userEvent.setup();
    renderPage(<ReportPage />, '/reporte');
    expect(await screen.findByRole('heading', { name: 'Tu ahorro medido' })).toBeInTheDocument();
    expect(screen.getByText('periodos cercanos, sin corrección por temporada')).toBeInTheDocument();
    expect(screen.getByText('con comprobante')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(print).toHaveBeenCalled();
  });
});

describe('«Perfil del negocio» con el perfil asistido', () => {
  const PROFILE = {
    name: 'Panadería El Trigal',
    ownerName: 'Rosa Quispe',
    country: 'PE',
    city: 'Cusco',
    currency: 'PEN',
    ciiu: null,
    employeesText: 'tres personas',
    description: '',
    equipment: null,
    ovenType: 'unknown',
    budgetQuarterCents: null,
    hoursPerWeek: null,
    diagnosticLevel: 'Inicial',
    dataSource: 'sintetico',
  };
  beforeEach(() => {
    routes['GET /profile'] = () => ({ status: 200, body: PROFILE });
    routes['GET /consumption-history'] = () => ({ status: 200, body: { months: [] } });
  });

  for (const source of ['keywords', 'ai'] as const) {
    it(`muestra el aviso de privacidad la primera vez y marca el origen (${source})`, async () => {
      let patched: Record<string, unknown> | null = null;
      routes['POST /profile/assist'] = (init) => {
        const body = JSON.parse(String(init?.body)) as { noticeAccepted?: boolean };
        if (!body.noticeAccepted)
          return err(
            409,
            'AI_NOTICE_REQUIRED',
            'Tu descripción se envía a un servicio de IA solo para sugerir estos datos. No escribas nombres ni teléfonos.',
          );
        return {
          status: 200,
          body: {
            suggestions: {
              ciiu: { code: '1071', label: 'Elaboración de productos de panadería' },
              equipment: ['electric_oven', 'refrigeration'],
              ovenType: 'electric',
              budget: null,
              hoursPerWeek: 3,
              source,
            },
          },
        };
      };
      routes['PATCH /profile'] = (init) => {
        patched = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return { status: 200, body: PROFILE };
      };
      routes['GET /first-step'] = () => ({ status: 200, body: {} });
      routes['GET /user-eco-card'] = () => ({ status: 200, body: { items: [] } });
      routes['GET /savings'] = () => ({ status: 200, body: {} });
      routes['GET /user-bill'] = () => ({ status: 200, body: { items: [] } });
      const user = userEvent.setup();
      renderPage(<ProfilePage />, '/perfil');
      await user.type(
        await screen.findByLabelText('Cuéntanos cómo es tu negocio'),
        'Panadería de barrio con horno eléctrico.',
      );
      await user.click(screen.getByRole('button', { name: 'Sugerir mis datos' }));
      expect(
        await screen.findByText(
          'Tu descripción se envía a un servicio de IA solo para sugerir estos datos. No escribas nombres ni teléfonos.',
        ),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Entendido, enviar' }));
      expect(await screen.findByText('Elaboración de productos de panadería')).toBeInTheDocument();
      expect(
        screen.getByText(
          source === 'ai' ? 'Sugerido por IA (revisado contra tu texto)' : 'Sugerido por palabras clave',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('No lo escribiste')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Confirmar mis datos' }));
      await waitFor(() =>
        expect(patched).toMatchObject({
          ciiu: '1071',
          equipment: ['electric_oven', 'refrigeration'],
          ovenType: 'electric',
          budgetQuarterCents: null,
          hoursPerWeek: 3,
        }),
      );
    });
  }
});

describe('informe para aliados', () => {
  it('oculta las celdas de menos de 5 negocios y separa lo declarado', async () => {
    routes['GET /partners/report'] = () => ({
      status: 200,
      body: {
        period: '2026-T3',
        from: '2026-07-01',
        to: '2026-09-30',
        status: 'open',
        closedAt: null,
        sectors: [{ ciiu: '1071', label: 'Elaboración de productos de panadería' }],
        countries: ['BO', 'PE'],
        byStatus: { measured: 12, notYet: 'menos de 5', noSavings: 0, noData: 'menos de 5' },
        byEco: [
          { ecoId: 'eco_033', title: 'Iluminación LED', businesses: 5, medianChangePct: -4 },
          {
            ecoId: 'eco_118',
            title: 'Mantenimiento de burletes',
            businesses: 'menos de 5',
            medianChangePct: null,
          },
        ],
        combos: 0,
        measured: {
          businesses: 12,
          kwhPerMonth: 1243,
          co2KgPerMonth: 300,
          evidence: { withReceipt: null, declared: null, hiddenNote: 'menos de 5 negocios' },
          method: { RECENT_PERIODS: 12 },
        },
        declared: {
          label: 'declarado por las usuarias, no medido',
          forms: 5,
          medianScale: 4,
          scaleNote: 'Escala de 1 a 5.',
        },
        amounts: [
          { currency: 'BOB', businesses: 'menos de 5', amountPerMonthCents: null, amountText: null },
          { currency: 'PEN', businesses: 9, amountPerMonthCents: null, amountText: null },
        ],
        usd: 320.5,
        usdNote:
          'Equivalente en USD por mes con el tipo de cambio del 30 de septiembre de 2026 (sintético en esta demostración).',
        adjustments: [],
        notes: [],
      },
    });
    renderPage(<PartnersPage staff={false} />, '/aliados?periodo=2026-T3');
    expect(await screen.findByRole('heading', { name: /Informe de ahorro medido/ })).toBeInTheDocument();
    expect((await screen.findAllByText('menos de 5 negocios')).length).toBeGreaterThan(2);
    expect(screen.getByText('declarado por las usuarias, no medido')).toBeInTheDocument();
    const row = screen.getByText('Iluminación LED').closest('tr')!;
    expect(within(row).getByText('−4 %')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar el periodo' })).not.toBeInTheDocument();
  });
});
