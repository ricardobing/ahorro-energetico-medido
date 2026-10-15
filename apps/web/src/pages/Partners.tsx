import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateLong } from '@ppam/domain';
import { IconPartners } from '../components/Icons';
import { Banner, PageHead, SkeletonCards } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { Hidden, PartnerReport } from '../lib/types';

const HIDDEN_NOTE = 'menos de 5 negocios';
const PERIODS = ['2026-T1', '2026-T2', '2026-T3', '2026-T4'];
const METHOD: Record<string, string> = {
  RECENT_PERIODS: 'Periodos cercanos (sin corrección por temporada)',
  YEAR_OVER_YEAR: 'Mismos meses del año anterior',
};

const COMPLEMENT_NOTE = 'oculto para que no se deduzca';
const NBSP = String.fromCharCode(0xa0);

/**
 * Una celda del informe: el número o, si se ocultó, el motivo. «menos de 5 negocios» cuando vienen de
 * pocos negocios; «oculto para que no se deduzca» cuando tiene 5 o más pero permitiría deducir otra restando.
 */
function Cell(props: { value: Hidden | null | undefined; suffix?: string }) {
  if (typeof props.value === 'number')
    return (
      <span className="stat-value num">
        {props.value}
        {props.suffix ?? ''}
      </span>
    );
  return (
    <span className="stat-value hidden-cell">{props.value === 'oculto' ? COMPLEMENT_NOTE : HIDDEN_NOTE}</span>
  );
}

const usd = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const kwh = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });

export function PartnersPage(props: { staff: boolean }): ReactNode {
  const [params, setParams] = useSearchParams();
  const period = params.get('periodo') ?? '2026-T3';
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['partners', period],
    queryFn: () => api<PartnerReport>(`/partners/report?period=${encodeURIComponent(period)}`),
  });
  const close = useMutation({
    mutationFn: () => api(`/partners/report/${period}/close`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['partners'] }),
  });

  const r = query.data;
  return (
    <>
      <PageHead
        icon={IconPartners}
        title={`Informe de ahorro medido · ${period}`}
        sub={
          r
            ? `Del ${formatDateLong(r.from, 'es-PE')} al ${formatDateLong(r.to, 'es-PE')} · ${
                r.status === 'closed'
                  ? `cerrado el ${formatDateLong(r.closedAt!.slice(0, 10), 'es-PE')}`
                  : 'abierto: puede cambiar'
              }`
            : 'Datos agregados para quienes financian el programa'
        }
      />
      <div className="actions" style={{ marginTop: 0, marginBottom: 16 }}>
        <label className="field-label" htmlFor="periodo" style={{ alignSelf: 'center' }}>
          Periodo
        </label>
        <select
          id="periodo"
          className="select"
          style={{ width: 'auto' }}
          value={period}
          onChange={(e) => setParams({ periodo: e.target.value })}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {props.staff && r?.status === 'open' ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => close.mutate()}
            disabled={close.isPending}
          >
            Cerrar el periodo
          </button>
        ) : null}
      </div>
      {close.isError ? <Banner tone="error">{errorMessage(close.error)}</Banner> : null}

      {query.isPending ? <SkeletonCards count={2} label="Armando el informe…" /> : null}
      {query.isError ? <Banner tone="error">{errorMessage(query.error)}</Banner> : null}
      {r ? (
        <>
          <Banner>
            <p>
              Solo mostramos números que vienen de <strong>5 negocios o más</strong>. Lo que viene de menos
              aparece como «{HIDDEN_NOTE}», y también se oculta lo que permitiría deducirlo restando. Ningún
              dato identifica a un negocio.
            </p>
          </Banner>

          <h2 className="section-title">Negocios por resultado</h2>
          <div className="stat-grid">
            {(
              [
                ['measured', 'Con ahorro medido'],
                ['notYet', 'Todavía no se puede saber'],
                ['noSavings', 'Sin ahorro visible'],
                ['noData', 'Sin facturas para comparar'],
              ] as const
            ).map(([key, label]) => (
              <div className="card stat" key={key}>
                <span className="stat-label">{label}</span>
                <Cell value={r.byStatus[key]} />
              </div>
            ))}
          </div>

          <h2 className="section-title">Ahorro medido con facturas</h2>
          <div className="two-col">
            <div className="card stat">
              <span className="stat-label">kWh ahorrados por mes</span>
              {r.measured.kwhPerMonth !== null ? (
                <span className="stat-value num">{kwh.format(r.measured.kwhPerMonth)}</span>
              ) : (
                <Cell value={null} />
              )}
              <span className="field-hint">
                {r.measured.co2KgPerMonth !== null
                  ? `≈ ${kwh.format(r.measured.co2KgPerMonth)} kg de CO₂e por mes`
                  : ''}
              </span>
            </div>
            <div className="card stat">
              <span className="stat-label">Equivalente en USD por mes</span>
              {r.usd !== null ? (
                <span className="stat-value num">{usd.format(r.usd)}</span>
              ) : (
                <Cell value={null} />
              )}
              <span className="field-hint">{r.usdNote}</span>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: 10 }}>
            <section className="card" aria-labelledby="evidencia">
              <h3 id="evidencia" className="stat-label">
                Nivel de evidencia
              </h3>
              <table className="table">
                <tbody>
                  <tr>
                    <td>Con comprobante (foto clara de cada factura)</td>
                    <td className="right">
                      <Cell value={r.measured.evidence.withReceipt ?? 'oculto'} />
                    </td>
                  </tr>
                  <tr>
                    <td>Con números cargados a mano</td>
                    <td className="right">
                      <Cell value={r.measured.evidence.declared ?? 'oculto'} />
                    </td>
                  </tr>
                </tbody>
              </table>
              {r.measured.evidence.hiddenNote ? (
                <p className="field-hint" style={{ marginTop: 8 }}>
                  Una de las dos filas viene de menos de 5 negocios; la otra también se oculta para que no se
                  pueda deducir restando del total.
                </p>
              ) : null}
            </section>
            <section className="card" aria-labelledby="metodo">
              <h3 id="metodo" className="stat-label">
                Método de comparación
              </h3>
              <table className="table">
                <tbody>
                  {Object.entries(r.measured.method).map(([m, v]) => (
                    <tr key={m}>
                      <td>{METHOD[m] ?? m}</td>
                      <td className="right">
                        <Cell value={v} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <h2 className="section-title">Por ecoinnovación</h2>
          <section className="card">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Ecoinnovación</th>
                  <th scope="col" className="right">
                    Negocios medidos
                  </th>
                  <th scope="col" className="right">
                    Cambio del consumo por día (mediana)
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.byEco.map((row) => (
                  <tr key={row.ecoId}>
                    <td>{row.title}</td>
                    <td className="right">
                      <Cell value={row.businesses} />
                    </td>
                    <td className="right">
                      {row.medianChangePct !== null ? (
                        <span className="num">{`${row.medianChangePct}${NBSP}%`.replace('-', '−')}</span>
                      ) : (
                        <span className="field-hint">sin número</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="field-hint" style={{ marginTop: 8 }}>
              Negocios que midieron dos ecoinnovaciones a la vez (combinación):{' '}
              <strong>{typeof r.combos === 'number' ? r.combos : HIDDEN_NOTE}</strong>. No entran en la
              mediana de ninguna.
            </p>
          </section>

          <h2 className="section-title">Montos por moneda</h2>
          <section className="card">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Moneda</th>
                  <th scope="col" className="right">
                    Negocios
                  </th>
                  <th scope="col" className="right">
                    Ahorro por mes
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.amounts.map((a) => (
                  <tr key={a.currency}>
                    <td>
                      {a.currency === 'PEN'
                        ? 'Soles (Perú)'
                        : a.currency === 'BOB'
                          ? 'Bolivianos (Bolivia)'
                          : a.currency}
                    </td>
                    <td className="right">
                      <Cell value={a.businesses} />
                    </td>
                    <td className="right">
                      {a.amountText ?? <Cell value={a.hiddenReason ?? 'menos de 5'} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <h2 className="section-title">Impacto declarado</h2>
          <section className="card peach">
            <p className="chips" style={{ marginTop: 0 }}>
              <span className="chip">{r.declared.label}</span>
            </p>
            <p className="support">
              Formularios de impacto percibido del periodo:{' '}
              <strong>{typeof r.declared.forms === 'number' ? r.declared.forms : HIDDEN_NOTE}</strong>
              {r.declared.medianScale !== null ? ` · mediana ${r.declared.medianScale} de 5` : ''}.
            </p>
            <p className="field-hint">{r.declared.scaleNote}</p>
          </section>

          {r.adjustments.length ? (
            <>
              <h2 className="section-title">Ajustes de periodos cerrados</h2>
              {r.adjustments.map((a) => (
                <Banner key={a.period}>
                  <p>
                    <strong>{a.period}</strong>: {a.note}
                  </p>
                </Banner>
              ))}
            </>
          ) : null}

          {r.notes.map((n) => (
            <p className="field-hint" key={n} style={{ marginTop: 8 }}>
              {n}
            </p>
          ))}
        </>
      ) : null}
    </>
  );
}
