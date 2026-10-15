import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDateLong } from '@ppam/domain';
import { Banner, Field, PageHead, SkeletonCards, SourceTag } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { refreshBusinessData, useBills } from '../lib/queries';
import type { Bill } from '../lib/types';

const EVIDENCE: Record<Bill['evidence'], string> = {
  photo_ok: 'Con foto',
  photo_retake: 'Foto poco clara',
  no_photo: 'Sin foto',
};

const period = (b: Bill) =>
  `${formatDateLong(b.billingStartDate, 'es-PE').replace(/ de \d{4}$/, '')} al ${formatDateLong(b.billingEndDate, 'es-PE')}`;

function BillItem(props: { bill: Bill }) {
  const { bill } = props;
  const client = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [kwh, setKwh] = useState(String(bill.kwhConsumed ?? ''));
  const [tariff, setTariff] = useState(String(bill.costPerKwh ?? ''));
  const edit = useMutation({
    mutationFn: () =>
      api(`/user-bill/${bill.id}`, {
        method: 'PATCH',
        json: { kwhConsumed: Number(kwh.replace(',', '.')), costPerKwh: Number(tariff.replace(',', '.')) },
      }),
    onSuccess: async () => {
      setMode('view');
      await refreshBusinessData(client);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/user-bill/${bill.id}`, { method: 'DELETE' }),
    onSuccess: () => refreshBusinessData(client),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    edit.mutate();
  };

  return (
    <li className="step">
      <div className="bill-row">
        <span>
          <strong>{period(bill)}</strong>
          <br />
          <span className="field-hint num">
            {bill.serviceType === 'electricity'
              ? `${bill.kwhConsumed} kWh · ${bill.totalCostText}`
              : `${bill.volumeM3} m³ de agua · ${bill.totalCostText}`}
          </span>
        </span>
        <span className={bill.evidence === 'photo_ok' ? 'tag before' : 'tag peach'}>
          {EVIDENCE[bill.evidence]}
        </span>
      </div>
      <SourceTag source={bill.dataSource} />
      {mode === 'view' && bill.serviceType === 'electricity' ? (
        <div className="actions" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-quiet" onClick={() => setMode('edit')}>
            Corregir
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setMode('delete')}>
            Borrar
          </button>
        </div>
      ) : null}
      {mode === 'edit' ? (
        <form onSubmit={onSubmit} noValidate>
          <div className="grid-2">
            <Field
              label="Consumo del periodo (kWh)"
              inputMode="decimal"
              value={kwh}
              onChange={(e) => setKwh(e.target.value)}
            />
            <Field
              label="Precio por kWh"
              inputMode="decimal"
              value={tariff}
              onChange={(e) => setTariff(e.target.value)}
            />
          </div>
          {edit.isError ? (
            <div style={{ marginTop: 12 }}>
              <Banner tone="error">{errorMessage(edit.error)}</Banner>
            </div>
          ) : null}
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={edit.isPending}>
              Guardar corrección
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode('view')}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      {mode === 'delete' ? (
        <Banner tone="error">
          <p>¿Borrar esta factura? Vamos a recalcular tu ahorro sin ella. Queda guardada en el historial.</p>
          <div className="actions" style={{ marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Sí, borrar
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode('view')}>
              Cancelar
            </button>
          </div>
          {remove.isError ? <p className="field-error">{errorMessage(remove.error)}</p> : null}
        </Banner>
      ) : null}
    </li>
  );
}

export function BillsPage(): ReactNode {
  const bills = useBills();
  if (bills.isPending) return <SkeletonCards count={2} label="Cargando tus facturas…" />;
  if (bills.isError) return <Banner tone="error">{errorMessage(bills.error)}</Banner>;
  return (
    <>
      <PageHead title="Mis facturas" sub={`${bills.data.length} facturas cargadas`} />
      <div className="actions" style={{ marginTop: 0, marginBottom: 14 }}>
        <Link to="/factura" className="btn btn-primary">
          Subir factura
        </Link>
      </div>
      <section className="card">
        <ul className="list-plain card-rows" style={{ marginTop: 0 }}>
          {bills.data.map((b) => (
            <BillItem key={`${b.id}-${b.version}`} bill={b} />
          ))}
        </ul>
      </section>
    </>
  );
}
