import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDateLong, formatMonthName } from '@ppam/domain';
import { IconChevronDown, IconReport, IconSavings } from '../components/Icons';
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
 * Consumo por día de cada factura como puntos, sobre una escala ajustada a los datos (no desde cero: una
 * baja del 6 % tiene que verse). La franja es lo que el consumo varía normalmente alrededor de «antes».
 * SVG propio, sin librería; los valores exactos van en la lista de abajo.
 */
function DailyChart(props: { chart: Extract<Savings, { planId: string }>['chart'] }) {
  const points = props.chart.points.slice(-12);
  if (points.length === 0) return null;
  const base = props.chart.baselineKwhPerDay;
  const band = props.chart.bandPct;
  const lo = base && band ? base * (1 - band / 100) : null;
  const hi = base && band ? base * (1 + band / 100) : null;
  const values = [...points.map((p) => p.kwhPerDay), ...(lo && hi ? [lo, hi] : [])];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = Math.max((max - min) * 0.25, 1);
  const top = max + margin;
  const bottom = Math.max(0, min - margin);
  const w = 340;
  const h = 170;
  const pad = { l: 34, r: 6, t: 8, b: 24 };
  const step = (w - pad.l - pad.r) / points.length;
  const x = (i: number) => pad.l + step * (i + 0.5);
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - (v - bottom) / (top - bottom));
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="daily-chart"
      role="img"
      aria-label="Consumo por día de cada factura"
    >
      {lo && hi ? (
        <rect x={pad.l} width={w - pad.l - pad.r} y={y(hi)} height={y(lo) - y(hi)} className="chart-band" />
      ) : null}
      {base ? <line x1={pad.l} x2={w - pad.r} y1={y(base)} y2={y(base)} className="chart-base" /> : null}
      {[top, bottom].map((v) => (
        <text key={v} x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label num">
          {Math.round(v)}
        </text>
      ))}
      {points.map((p, i) => (
        <g key={p.billId}>
          <circle
            cx={x(i)}
            cy={y(p.kwhPerDay)}
            r={p.role === 'after' ? 6 : 5}
            className={`chart-dot ${p.role}`}
          />
          <text x={x(i)} y={h - 6} textAnchor="middle" className="chart-label">
            {formatMonthName(p.billingEndDate, 'es-PE').slice(0, 3)}
          </text>
        </g>
      ))}
    </svg>
  );
}

const monthTitle = (p: ChartPoint) => {
  const start = p.billingStartDate;
  const end = p.billingEndDate;
  const calendar = start.endsWith('-01') && start.slice(0, 7) === end.slice(0, 7);
  if (!calendar)
    return `${formatDateLong(start, 'es-PE').replace(/ de \d{4}$/, '')} al ${formatDateLong(end, 'es-PE')}`;
  const month = formatMonthName(end, 'es-PE');
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} de ${end.slice(0, 4)}`;
};

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
          <i className="sw excluded" /> No cuenta
        </span>
        <span>
          <i className="sw other" /> No se usa
        </span>
        <span>
          <i className="sw band" /> Lo que varía normalmente
        </span>
      </div>
      <ul className="list-plain card-rows">
        {[...s.chart.points].reverse().map((p) => (
          <li className="bill-row" key={p.billId}>
            <span>
              <strong>{monthTitle(p)}</strong>
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
        <PageHead icon={IconSavings} title="Tu ahorro" />
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
        icon={IconSavings}
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
        <Link className="btn btn-primary btn-block" to="/reporte">
          <IconReport /> Ver mi reporte
        </Link>
      </div>
      <HowWeMeasure savings={s} />
    </>
  );
}
