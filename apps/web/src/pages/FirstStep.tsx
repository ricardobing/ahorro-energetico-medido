import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EQUIPMENT_OPTIONS, formatMoney } from '@ppam/domain';
import { IconCheck } from '../components/Icons';
import { Banner, Checkbox, LEVEL_TEXT, PageHead, Question, SkeletonCards, SourceTag } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { refreshBusinessData, useFirstStep, useMe } from '../lib/queries';
import type { FirstStep } from '../lib/types';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** «¿Por qué esto?»: los datos usados y los casos de pares, en palabras, sin fórmulas. */
function WhyThis(props: { why: NonNullable<FirstStep['why']>; currency: 'PEN' | 'BOB' }) {
  const { peerCounts, dataUsed } = props.why;
  const equipment = (dataUsed.equipment ?? [])
    .map(
      (e) =>
        EQUIPMENT_OPTIONS.find((o) => o.value === e)
          ?.label.toLowerCase()
          .split(' (')[0],
    )
    .filter(Boolean);
  const items: ReactNode[] = [
    peerCounts.chose > 0
      ? `${peerCounts.chose} ${plural(peerCounts.chose, 'negocio parecido la eligió', 'negocios parecidos la eligieron')}, ${peerCounts.completed} la ${plural(peerCounts.completed, 'terminó', 'terminaron')} y ${peerCounts.measured} ${plural(peerCounts.measured, 'midió', 'midieron')} el resultado con sus facturas.`
      : 'Todavía ningún negocio parecido la eligió: la recomendamos por lo que dijiste de tu negocio.',
    dataUsed.budgetCents !== null
      ? `Tu presupuesto del trimestre: ${formatMoney(dataUsed.budgetCents, props.currency, props.currency === 'BOB' ? 'es-BO' : 'es-PE')}.`
      : 'No nos dijiste tu presupuesto: elegimos algo de inversión baja.',
    dataUsed.hoursPerWeek !== null
      ? `Tus horas: ${dataUsed.hoursPerWeek} por semana.`
      : 'No nos dijiste cuántas horas tienes por semana.',
    equipment.length ? `Tus equipos: ${equipment.join(' y ')}.` : 'Todavía no sabemos qué equipos usas.',
    `Tus facturas cargadas: ${dataUsed.billsCount}.`,
  ];
  return (
    <details className="disclosure">
      <summary>
        Ver con qué datos lo elegimos
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <ul className="list-plain">
        {items.map((item, i) => (
          <li className="support" key={i}>
            {item}
          </li>
        ))}
        <li className="support">
          Las reglas son las mismas para todos los negocios (versión {props.why.rulesetVersion}) y puedes
          elegir otro paso.
        </li>
      </ul>
    </details>
  );
}

export function FirstStepPage(): ReactNode {
  const query = useFirstStep();
  const me = useMe();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [pause, setPause] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [alternative, setAlternative] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: (body: { action: 'accept' | 'choose'; ecoId?: string; pausePlanId?: string }) =>
      api('/first-step/decision', { method: 'POST', json: body }),
    onSuccess: async () => {
      await refreshBusinessData(client);
      navigate('/plan');
    },
  });

  if (query.isPending) return <SkeletonCards label="Buscando tu primer paso…" />;
  if (query.isError) return <Banner tone="error">{errorMessage(query.error)}</Banner>;
  const data = query.data;
  const eco = data.recommendation?.eco;
  const currency = me.data?.business?.country === 'BO' ? 'BOB' : 'PEN';
  const pausePlanId = pause && data.stalledPlan ? data.stalledPlan.id : undefined;

  if (data.decision) {
    const chosen =
      data.decision.ecoId === eco?.ecoId
        ? eco?.title
        : data.alternatives.find((a) => a.ecoId === data.decision!.ecoId)?.title;
    return (
      <>
        <PageHead title="Tu primer paso" sub={me.data?.business?.name} />
        <Question n={1} question="¿Qué hago primero?" answer={chosen ?? 'Ya elegiste tu primer paso'}>
          <p className="support">Ya lo elegiste. Ahora se trata de terminarlo: los pasos están en tu plan.</p>
          <div className="actions">
            <Link className="btn btn-primary" to="/plan">
              Ver mi plan
            </Link>
          </div>
        </Question>
      </>
    );
  }

  if (!eco)
    return (
      <>
        <PageHead title="Tu primer paso" />
        <Banner>
          Por ahora no encontramos un paso que entre en tu presupuesto y en tus horas. Revisa tus datos en
          «Más → Perfil del negocio».
        </Banner>
      </>
    );

  return (
    <>
      <PageHead title="Tu primer paso" sub={`${me.data?.business?.name ?? ''} · pagar menos luz`} />

      {data.stalledPlan ? (
        <Banner>
          <p>
            <strong>«{data.stalledPlan.title}»</strong> no avanza hace {data.stalledPlan.daysWithoutChange}{' '}
            días. Es un cambio grande para este trimestre: puedes pausarlo sin perder nada y empezar por algo
            que puedas terminar.
          </p>
          <Checkbox
            label={`Pausar «${data.stalledPlan.title}» al empezar`}
            checked={pause}
            onChange={setPause}
          />
        </Banner>
      ) : null}

      <div className="stack">
        <Question n={1} question="¿Qué hago primero?" answer={eco.title}>
          <div className="chips">
            <span className="chip">{LEVEL_TEXT.investment[eco.investment]}</span>
            <span className="chip">{LEVEL_TEXT.time[eco.time]}</span>
            <span className="chip">{LEVEL_TEXT.complexity[eco.complexity]}</span>
            <SourceTag source={eco.dataSource} />
          </div>
          <p className="support">{eco.impact}.</p>
          <ol className="list-plain">
            {eco.steps.map((s, i) => (
              <li className="support" key={s}>
                {i + 1}. {s}
              </li>
            ))}
          </ol>
        </Question>

        <Question n={2} question="¿Por qué esto?" answer="Porque lo puedes terminar" answerSize="md">
          <ul className="list-plain">
            {data.explanation.reasons.map((r) => (
              <li className="reason" key={r}>
                <IconCheck />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {data.why ? <WhyThis why={data.why} currency={currency} /> : null}
        </Question>

        <Question
          n={3}
          question="¿Qué no sabemos todavía?"
          answer="Cuánto vas a ahorrar tú"
          answerSize="md"
          tone="peach"
        >
          <p className="support">{data.explanation.unknown}</p>
        </Question>
      </div>

      {decide.isError ? (
        <div style={{ marginTop: 14 }}>
          <Banner tone="error">{errorMessage(decide.error)}</Banner>
        </div>
      ) : null}

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ action: 'accept', pausePlanId })}
        >
          Empezar este paso
        </button>
        {data.alternatives.length ? (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => setChoosing((v) => !v)}
            aria-expanded={choosing}
          >
            Prefiero otra
          </button>
        ) : null}
      </div>

      {choosing ? (
        <section className="card" style={{ marginTop: 14 }} aria-labelledby="otras">
          <h2 id="otras" className="answer md" style={{ marginTop: 0 }}>
            Otras que también puedes hacer
          </h2>
          <p className="support">No tienes que explicarnos por qué. Elige la que te quede mejor.</p>
          <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0' }}>
            <legend className="sr-only">Elegir otra ecoinnovación</legend>
            {data.alternatives.map((a) => (
              <label className="check" key={a.ecoId}>
                <input
                  type="radio"
                  name="alternativa"
                  className="sr-only check-input"
                  checked={alternative === a.ecoId}
                  onChange={() => setAlternative(a.ecoId)}
                />
                <span className="check-box radio" aria-hidden="true" />
                <span>
                  <strong>{a.title}</strong>
                  <br />
                  <span className="field-hint">
                    {LEVEL_TEXT.investment[a.investment]} · {LEVEL_TEXT.time[a.time]}
                    {a.mayExceedBudget ? ' · puede pasar tu presupuesto' : ''}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!alternative || decide.isPending}
              onClick={() =>
                alternative && decide.mutate({ action: 'choose', ecoId: alternative, pausePlanId })
              }
            >
              Elegir esta
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
