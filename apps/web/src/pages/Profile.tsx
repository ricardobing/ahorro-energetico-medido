import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CIIU_OPTIONS, EQUIPMENT_OPTIONS, OVEN_OPTIONS } from '@ppam/domain';
import { IconBusiness, IconCalendar, IconListCheck, IconProfile } from '../components/Icons';
import { Banner, Checkbox, Field, PageHead, SectionTitle, SkeletonCards } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { keys, refreshBusinessData, useProfile } from '../lib/queries';
import type { Profile, Suggestions } from '../lib/types';

const equipmentLabel = (v: string) => EQUIPMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;
const ovenLabel = (v: string | null) => OVEN_OPTIONS.find((o) => o.value === v)?.label ?? 'No sé';

interface Draft {
  ciiu: string | null;
  equipment: string[];
  ovenType: string;
  budget: string;
  hours: string;
}

function draftFrom(profile: Profile, s: Suggestions | null): Draft {
  return {
    ciiu: s?.ciiu?.code ?? profile.ciiu?.code ?? null,
    equipment: s && s.equipment.length ? s.equipment : (profile.equipment ?? []),
    ovenType: s?.ovenType ?? profile.ovenType ?? 'unknown',
    budget: s?.budget
      ? String(s.budget.amount)
      : profile.budgetQuarterCents !== null
        ? String(profile.budgetQuarterCents / 100)
        : '',
    hours:
      s?.hoursPerWeek !== null && s?.hoursPerWeek !== undefined
        ? String(s.hoursPerWeek)
        : profile.hoursPerWeek !== null
          ? String(profile.hoursPerWeek)
          : '',
  };
}

/** Una fila de «Revisa lo que entendimos»: el valor a la vista y, al tocar «Cambiar», el control. */
function ReviewRow(props: {
  label: string;
  value: ReactNode;
  origin: string | null;
  children: (close: () => void) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="step">
      <div className="bill-row" style={{ padding: 0 }}>
        <span>
          <span className="field-hint">{props.label}</span>
          <br />
          <strong>{props.value}</strong>
          {props.origin ? <span className="field-hint"> · {props.origin}</span> : null}
        </span>
        {!editing ? (
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
            Cambiar
          </button>
        ) : null}
      </div>
      {editing ? props.children(() => setEditing(false)) : null}
    </div>
  );
}

function HistoryForm() {
  const history = useQuery({
    queryKey: ['history'],
    queryFn: () => api<{ months: { month: string; kwh: number }[] }>('/consumption-history'),
  });
  if (!history.data) return null;
  return <HistoryRows initial={history.data.months.map((m) => ({ month: m.month, kwh: String(m.kwh) }))} />;
}

function HistoryRows(props: { initial: { month: string; kwh: string }[] }) {
  const client = useQueryClient();
  const [rows, setRows] = useState(props.initial);
  const save = useMutation({
    mutationFn: () =>
      api('/consumption-history', {
        method: 'PUT',
        json: {
          serviceType: 'electricity',
          months: rows
            .filter((r) => r.month && r.kwh)
            .map((r) => ({ month: r.month, kwh: Number(r.kwh.replace(',', '.')) })),
        },
      }),
    onSuccess: () => refreshBusinessData(client),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="historial">
      <SectionTitle id="historial" icon={IconCalendar}>
        Historial del recibo (opcional)
      </SectionTitle>
      <p className="support">
        Tu recibo trae un gráfico con el consumo de meses anteriores. Si lo cargas, podemos comparar con los
        mismos meses del año pasado. Son datos aproximados y no se guardan como facturas.
      </p>
      {rows.map((r, i) => (
        <div className="grid-2" key={i}>
          <Field
            label={`Mes ${i + 1}`}
            type="month"
            value={r.month}
            onChange={(e) =>
              setRows((all) => all.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)))
            }
          />
          <Field
            label={`kWh del mes ${i + 1}`}
            inputMode="decimal"
            value={r.kwh}
            onChange={(e) =>
              setRows((all) => all.map((x, j) => (j === i ? { ...x, kwh: e.target.value } : x)))
            }
          />
        </div>
      ))}
      <div className="actions">
        {rows.length < 12 ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRows((all) => [...all, { month: '', kwh: '' }])}
          >
            Agregar un mes
          </button>
        ) : null}
        {rows.length ? (
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            Guardar historial
          </button>
        ) : null}
      </div>
      {save.isSuccess ? (
        <p className="support" role="status">
          Historial guardado. Tu ahorro se recalculó.
        </p>
      ) : null}
      {save.isError ? <p className="field-error">{errorMessage(save.error)}</p> : null}
    </form>
  );
}

export function ProfilePage(): ReactNode {
  const profile = useProfile();
  const client = useQueryClient();
  const descriptionId = useId();
  const [description, setDescription] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ s: Suggestions; notice?: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  const assist = useMutation({
    mutationFn: (noticeAccepted: boolean) =>
      api<{ suggestions: Suggestions; notice?: string }>('/profile/assist', {
        method: 'POST',
        json: {
          description: description ?? profile.data?.description ?? '',
          ...(noticeAccepted ? { noticeAccepted } : {}),
        },
      }),
    onSuccess: (res) => {
      setNotice(null);
      setSuggestions({ s: res.suggestions, notice: res.notice });
      setDraft(draftFrom(profile.data!, res.suggestions));
      setSaved(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'AI_NOTICE_REQUIRED') setNotice(error.message);
    },
  });

  const confirm = useMutation({
    mutationFn: (d: Draft) =>
      api('/profile', {
        method: 'PATCH',
        json: {
          ciiu: d.ciiu,
          equipment: d.equipment,
          ovenType: d.ovenType,
          budgetQuarterCents: d.budget.trim() ? Math.round(Number(d.budget.replace(',', '.')) * 100) : null,
          hoursPerWeek: d.hours.trim() ? Number(d.hours.replace(',', '.')) : null,
          ...(description !== null ? { description } : {}),
        },
      }),
    onSuccess: async () => {
      setSuggestions(null);
      setDraft(null);
      setSaved(true);
      await refreshBusinessData(client);
      await client.invalidateQueries({ queryKey: keys.profile });
    },
  });

  if (profile.isPending) return <SkeletonCards count={2} label="Cargando tu perfil…" />;
  if (profile.isError) return <Banner tone="error">{errorMessage(profile.error)}</Banner>;
  const p = profile.data;
  const text = description ?? p.description ?? '';
  const currency = p.currency === 'BOB' ? 'Bs' : 'S/';
  const origin = (suggested: boolean) => (suggestions ? (suggested ? 'sugerido' : 'tu dato actual') : null);

  return (
    <>
      <PageHead icon={IconProfile} title="Perfil del negocio" sub={p.name} />
      {saved ? (
        <Banner>
          <p>Guardamos tus datos. Tu primer paso se recalculó con ellos.</p>
          <div>
            <Link to="/" className="btn btn-quiet">
              Ver mi primer paso
            </Link>
          </div>
        </Banner>
      ) : null}

      <section className="card" aria-labelledby={`${descriptionId}-titulo`}>
        <SectionTitle id={`${descriptionId}-titulo`} icon={IconBusiness}>
          Tu negocio en tus palabras
        </SectionTitle>
        <div className="field">
          <label className="field-label" htmlFor={descriptionId}>
            Cuéntanos cómo es tu negocio
          </label>
          <span className="field-hint" id={`${descriptionId}-ayuda`}>
            Qué hacen, qué equipos usan y, si quieres, cuánto puedes invertir y cuántas horas por semana. No
            escribas nombres ni teléfonos.
          </span>
          <textarea
            id={descriptionId}
            className="textarea"
            aria-describedby={`${descriptionId}-ayuda`}
            value={text}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {notice ? (
          <div style={{ marginTop: 14 }}>
            <Banner>
              <p>{notice}</p>
              <div className="actions" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => assist.mutate(true)}
                  disabled={assist.isPending}
                >
                  Entendido, enviar
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setNotice(null)}>
                  Mejor lo completo a mano
                </button>
              </div>
            </Banner>
          </div>
        ) : null}
        {assist.isError && !notice ? <p className="field-error">{errorMessage(assist.error)}</p> : null}
        {!notice ? (
          <div className="actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={assist.isPending || text.trim().length < 10}
              onClick={() => assist.mutate(false)}
            >
              {assist.isPending ? 'Sugiriendo…' : 'Sugerir mis datos'}
            </button>
            {!suggestions ? (
              <button type="button" className="btn btn-quiet" onClick={() => setDraft(draftFrom(p, null))}>
                Completar a mano
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {draft ? (
        <section className="card" aria-labelledby="revisa">
          <SectionTitle id="revisa" icon={IconListCheck}>
            {suggestions ? 'Revisa lo que entendimos' : 'Tus datos'}
          </SectionTitle>
          {suggestions ? (
            <p className="chips">
              <span className="chip">
                {suggestions.s.source === 'ai'
                  ? 'Sugerido por IA (revisado contra tu texto)'
                  : 'Sugerido por palabras clave'}
              </span>
            </p>
          ) : null}
          {suggestions?.notice ? <p className="support">{suggestions.notice}</p> : null}
          <p className="support">Nada se guarda hasta que confirmes. Corrige lo que no esté bien.</p>

          <div className="card-rows">
            <ReviewRow
              label="Rubro"
              value={CIIU_OPTIONS.find((o) => o.code === draft.ciiu)?.label ?? 'Sin elegir'}
              origin={origin(Boolean(suggestions?.s.ciiu))}
            >
              {(close) => (
                <div className="field">
                  <label className="field-label" htmlFor="rubro">
                    Elige tu rubro
                  </label>
                  <select
                    id="rubro"
                    className="select"
                    value={draft.ciiu ?? ''}
                    onChange={(e) => {
                      setDraft({ ...draft, ciiu: e.target.value || null });
                      close();
                    }}
                  >
                    <option value="">Sin elegir</option>
                    {CIIU_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} · {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </ReviewRow>
            <ReviewRow
              label="Equipos que más consumen"
              value={
                draft.equipment.length ? draft.equipment.map(equipmentLabel).join(' · ') : 'Ninguno marcado'
              }
              origin={origin(Boolean(suggestions?.s.equipment.length))}
            >
              {(close) => (
                <div>
                  {EQUIPMENT_OPTIONS.map((o) => (
                    <Checkbox
                      key={o.value}
                      label={o.label}
                      checked={draft.equipment.includes(o.value)}
                      onChange={(on) =>
                        setDraft({
                          ...draft,
                          equipment: on
                            ? [...draft.equipment, o.value]
                            : draft.equipment.filter((x) => x !== o.value),
                        })
                      }
                    />
                  ))}
                  <button type="button" className="btn btn-quiet" onClick={close}>
                    Listo
                  </button>
                </div>
              )}
            </ReviewRow>
            <ReviewRow
              label="Horno"
              value={ovenLabel(draft.ovenType)}
              origin={origin(Boolean(suggestions?.s.ovenType))}
            >
              {(close) => (
                <div className="field">
                  <label className="field-label" htmlFor="horno">
                    ¿Qué horno usan?
                  </label>
                  <select
                    id="horno"
                    className="select"
                    value={draft.ovenType}
                    onChange={(e) => {
                      setDraft({ ...draft, ovenType: e.target.value });
                      close();
                    }}
                  >
                    {OVEN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </ReviewRow>
            <ReviewRow
              label="Presupuesto del trimestre"
              value={draft.budget ? `${currency} ${draft.budget}` : 'No lo escribiste'}
              origin={origin(Boolean(suggestions?.s.budget))}
            >
              {() => (
                <Field
                  label={`Presupuesto del trimestre (${currency})`}
                  inputMode="decimal"
                  value={draft.budget}
                  onChange={(e) => setDraft({ ...draft, budget: e.target.value })}
                />
              )}
            </ReviewRow>
            <ReviewRow
              label="Horas por semana"
              value={draft.hours ? `${draft.hours} horas` : 'No lo escribiste'}
              origin={origin(
                suggestions?.s.hoursPerWeek !== null && suggestions?.s.hoursPerWeek !== undefined,
              )}
            >
              {() => (
                <Field
                  label="Horas por semana"
                  inputMode="decimal"
                  value={draft.hours}
                  onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
                />
              )}
            </ReviewRow>
          </div>
          {confirm.isError ? <p className="field-error">{errorMessage(confirm.error)}</p> : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => confirm.mutate(draft)}
              disabled={confirm.isPending}
            >
              Confirmar mis datos
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(null);
                setSuggestions(null);
              }}
            >
              Descartar
            </button>
          </div>
        </section>
      ) : (
        <section className="card" aria-labelledby="actuales">
          <SectionTitle id="actuales" icon={IconProfile}>
            Lo que sabemos hoy
          </SectionTitle>
          <ul className="list-plain">
            <li className="support">Rubro: {p.ciiu?.label ?? 'sin elegir'}</li>
            <li className="support">
              Equipos:{' '}
              {p.equipment?.length ? p.equipment.map(equipmentLabel).join(' · ') : 'todavía no los contaste'}
            </li>
            <li className="support">Horno: {ovenLabel(p.ovenType)}</li>
            <li className="support">
              Presupuesto:{' '}
              {p.budgetQuarterCents !== null ? `${currency} ${p.budgetQuarterCents / 100}` : 'sin dato'} ·
              Horas: {p.hoursPerWeek ?? 'sin dato'}
            </li>
          </ul>
        </section>
      )}

      <HistoryForm />
    </>
  );
}
