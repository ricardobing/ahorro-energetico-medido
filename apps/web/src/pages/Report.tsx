import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDateLong } from '@ppam/domain';
import { IconPrint, IconReport } from '../components/Icons';
import { Banner, PageHead, SkeletonCards } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { SavingsReport } from '../lib/types';

const date = (d: string | null | undefined) => (d ? formatDateLong(d, 'es-PE') : '—');

/** Reporte de la usuaria, imprimible: los mismos textos que «Tu ahorro», con fechas, método y evidencia. */
export function ReportPage(): ReactNode {
  const query = useQuery({
    queryKey: ['savings-report'],
    queryFn: () => api<SavingsReport>('/savings/report'),
  });
  if (query.isPending) return <SkeletonCards count={2} label="Armando tu reporte…" />;
  if (query.isError) return <Banner tone="error">{errorMessage(query.error)}</Banner>;
  const r = query.data;
  return (
    <article className="report">
      <PageHead
        icon={IconReport}
        title={r.title}
        sub={`${r.business.name}${r.business.city ? ` · ${r.business.city}` : ''}`}
      />
      <section className="card">
        {r.changeText ? <p className="answer">{r.changeText}</p> : null}
        {r.moneyText ? <p className="answer md">{r.moneyText}</p> : null}
        <p className="support">{r.summary}</p>
        {r.tariffNote ? <p className="support">{r.tariffNote}</p> : null}
      </section>
      {r.period ? (
        <section className="card">
          <table className="table">
            <tbody>
              <tr>
                <th scope="row">Primer paso</th>
                <td>{r.planTitle}</td>
              </tr>
              <tr>
                <th scope="row">Terminado el</th>
                <td>{date(r.implementedAt)}</td>
              </tr>
              <tr>
                <th scope="row">Antes del cambio</th>
                <td>
                  {date(r.period.baselineFrom)} al {date(r.period.baselineTo)}
                </td>
              </tr>
              <tr>
                <th scope="row">Después del cambio</th>
                <td>
                  {r.period.afterFrom
                    ? `${date(r.period.afterFrom)} al ${date(r.period.afterTo)}`
                    : 'Todavía sin facturas'}
                </td>
              </tr>
              <tr>
                <th scope="row">Cómo se comparó</th>
                <td>{r.method ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">Evidencia</th>
                <td>{r.evidence ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">Calculado</th>
                <td>
                  {r.computedAt ? date(r.computedAt.slice(0, 10)) : '—'}
                  {r.version ? ` · versión ${r.version}` : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}
      {r.nextStep ? <p className="method">{r.nextStep}</p> : null}
      <div className="actions no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <IconPrint /> Imprimir o guardar en PDF
        </button>
      </div>
      <p className="field-hint">
        Prototipo para el reto técnico de Agora · datos del caso y sintéticos rotulados.
      </p>
    </article>
  );
}
