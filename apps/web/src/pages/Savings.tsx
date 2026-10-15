import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDateLong, formatMonthName } from '@ppam/domain';
import { IconChevronDown, IconReport } from '../components/Icons';
import { SavingsAnswers } from '../components/SavingsAnswers';
import { Banner, PageHead, SkeletonCards } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { keys, useNotifications, useSavings } from '../lib/queries';
import type { ChartPoint, Savings } from '../lib/types';

const ROLE_TAG: Record<ChartPoint['role'], { text: string; className: string }> = {
  baseline: { text: 'Antes', className: 'tag before' },
  after: { text: 'Después', className: 'tag after' },
  excluded: { text: 'No cuenta', className: 'tag peach' },
  other: { text: 'No se usa', className: 'tag' },
};

const EXCLUDED_TEXT: Record<string, string> = {
  CONTAINS_IMPLEMENTATION_DATE: 'incluye el día del cambio',
  PERIOD_TOO_SHORT: 'periodo de menos de 20 días',
  PERIOD_TOO_LONG: 'periodo de más de 40 días',
  HIGH_SEASON: 'campaña de fin de año',
  NOT_ELECTRICITY: 'no es de luz',
};

const fmt = (v: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(v);

/**
 * Gráfico simple de kWh por día de cada factura, con la franja de lo que varía normalmente alrededor de
 * «antes». SVG propio, sin librería; el texto de cada factura va en la lista de abajo.
 */
function DailyChart(props: { chart: Extract<Savings, { planId: string }>['chart'] }) {
  const points = props.chart.points.slice(-12);
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.kwhPerDay)) * 1.15;
  const w = 640;
  const h = 200;
  const pad = { l: 8, r: 8, t: 12, b: 28 };
  const bw = (w - pad.l - pad.r) / points.length;
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  const base = props.chart.baselineKwhPerDay;
  const band = props.chart.bandPct;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="daily-chart"
      role="img"
      aria-label="Consumo por día de cada factura"
    >
      {base && band ? (
        <rect
          x={pad.l}
          width={w - pad.l - pad.r}
          y={y(base * (1 + band / 100))}
          height={y(base * (1 - band / 100)) - y(base * (1 + band / 100))}
          className="chart-band"
        />
      ) : null}
      {points.map((p, i) => (
        <g key={p.billId}>
          <rect
            x={pad.l + i * bw + bw * 0.18}
            width={bw * 0.64}
            y={y(p.kwhPerDay)}
            height={h - pad.b - y(p.kwhPerDay)}
            rx={3}
            className={`chart-bar ${p.role}`}
          />
          <text x={pad.l + i * bw + bw / 2} y={h - 10} textAnchor="middle" className="chart-label">
            {formatMonthName(p.billingEndDate, 'es-PE').slice(0, 3)}
          </text>
        </g>
      ))}
      {base ? <line x1={pad.l} x2={w - pad.r} y1={y(base)} y2={y(base)} className="chart-base" /> : null}
    </svg>
  );
}

function HowWeMeasure(props: { savings: Extract<Savings, { planId: string }> }) {
  const s = props.savings;
  return (
    <details className="disclosure card">
      <summary>
        Cómo lo medimos
        <IconChevronDown />
      </summary>
      <p className="support">
        Comparamos cuánta luz usas <strong>por día</strong>, no el total del mes: los meses no tienen los
        mismos días. La franja celeste es lo que tu consumo varía normalmente de un mes a otro: un cambio
        dentro de esa franja todavía no se puede separar de lo normal.
      </p>
      <DailyChart chart={s.chart} />
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="sw before" /> Antes
        </span>
        <span>
          <i className="sw after" /> Después
        </span>
        <span>
          <i className="sw band" /> Lo que varía normalmente
        </span>
      </div>
      <ul className="list-plain card-rows">
        {[...s.chart.points].reverse().map((p) => (
          <li className="bill-row" key={p.billId}>
            <span>
              <strong>
                {formatDateLong(p.billingStartDate, 'es-PE').replace(/ de \d{4}$/, '')} al{' '}
                {formatDateLong(p.billingEndDate, 'es-PE')}
              </strong>
              <br />
              <span className="field-hint num">
                {fmt(p.kwhPerDay)} kWh por día
                {p.excludedReason ? ` · ${EXCLUDED_TEXT[p.excludedReason] ?? 'no cuenta'}` : ''}
              </span>
            </span>
            <span className={ROLE_TAG[p.role].className}>{ROLE_TAG[p.role].text}</span>
          </li>
        ))}
      </ul>
      <p className="field-hint">
        Versión {s.version} del cálculo · método {s.methodVersion} · calculado con tus facturas vigentes.
      </p>
    </details>
  );
}

export function SavingsPage(): ReactNode {
  const query = useSavings();
  const notifications = useNotifications();
  const client = useQueryClient();
  const recalculated = notifications.data?.items.find((n) => n.type === 'savings_recalculated' && !n.readAt);
  const dismiss = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.notifications }),
  });

  if (query.isPending) return <SkeletonCards label="Calculando tu ahorro…" />;
  if (query.isError) return <Banner tone="error">{errorMessage(query.error)}</Banner>;
  const s = query.data;

  if (!s.planId || !s.display)
    return (
      <>
        <PageHead title="Tu ahorro" />
        <Banner>
          <p>
            Todavía no terminaste tu primer paso. Cuando lo termines, comparamos tus facturas de antes y de
            después.
          </p>
          <div>
            <Link to="/" className="btn btn-secondary">
              Ver mi primer paso
            </Link>
          </div>
        </Banner>
      </>
    );

  return (
    <>
      <PageHead
        title="Tu ahorro"
        sub={`${s.planTitle}${s.implementedAt ? ` · hecho el ${formatDateLong(s.implementedAt, 'es-PE').replace(/ de \d{4}$/, '')}` : ''}`}
      />
      {recalculated ? (
        <Banner onClose={() => dismiss.mutate(recalculated.id)}>
          <p>{recalculated.body}</p>
        </Banner>
      ) : null}
      <SavingsAnswers
        display={s.display}
        detail={{
          baselineKwhPerDay: s.baseline?.kwhPerDay ?? null,
          afterKwhPerDay: s.after?.kwhPerDay ?? null,
          changePct: s.changePct,
        }}
      />
      <div className="actions no-print">
        <Link className="btn btn-primary btn-block" to="/mas/reporte">
          <IconReport /> Ver mi reporte
        </Link>
      </div>
      <HowWeMeasure savings={s} />
    </>
  );
}
