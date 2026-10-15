import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDateLong } from '@ppam/domain';
import { IconSpark } from '../components/Icons';
import { Banner, Checkbox, Field, PageHead, Question, SkeletonCards, SourceTag } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { refreshBusinessData, useFirstStep, useMe, usePlans } from '../lib/queries';
import type { Plan, PlanStep } from '../lib/types';

function StepRow(props: { plan: Plan; step: PlanStep }) {
  const client = useQueryClient();
  const toggle = useMutation({
    mutationFn: (done: boolean) =>
      api(`/user-eco-card/${props.plan.id}`, {
        method: 'PATCH',
        json: { steps: [{ _id: props.step._id, status: done ? 'completed' : 'not_started' }] },
      }),
    onSuccess: () => refreshBusinessData(client),
  });
  const ideas = useMutation({
    mutationFn: () =>
      api(`/user-eco-card/${props.plan.id}/steps/${props.step._id}/ideas`, { method: 'POST' }),
    onSuccess: () => refreshBusinessData(client),
  });
  const done = props.step.status === 'completed';
  const editable = props.plan.status !== 'completed';
  return (
    <li className="step">
      <Checkbox
        label={props.step.title}
        checked={done}
        disabled={!editable || toggle.isPending}
        onChange={(v) => toggle.mutate(v)}
      />
      {props.step.subSteps.length ? (
        <ul className="step-ideas">
          {props.step.subSteps.map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
      ) : editable ? (
        <div style={{ marginLeft: 26 }}>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={ideas.isPending}
            onClick={() => ideas.mutate()}
          >
            <IconSpark /> {ideas.isPending ? 'Buscando ideas…' : 'Ideas para este paso'}
          </button>
          {ideas.isError ? (
            <p className="field-hint" role="status">
              {errorMessage(ideas.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function FinishForm(props: { plan: Plan; today: string; onCancel: () => void }) {
  const client = useQueryClient();
  const [date, setDate] = useState(props.today);
  const finish = useMutation({
    mutationFn: () =>
      api<Plan>(`/user-eco-card/${props.plan.id}`, {
        method: 'PATCH',
        json: { status: 'completed', implementedAt: date || null },
      }),
    onSuccess: () => refreshBusinessData(client),
  });
  const fieldError =
    finish.error instanceof ApiError && finish.error.status === 422 ? finish.error.message : null;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    finish.mutate();
  };
  return (
    <form onSubmit={onSubmit} noValidate>
      <Field
        label="¿Qué día terminaste?"
        hint="La fecha en que el cambio quedó hecho. Con ella sabemos qué facturas comparar."
        type="date"
        value={date}
        max={props.today}
        onChange={(e) => setDate(e.target.value)}
        error={fieldError}
        required
      />
      {finish.isError && !fieldError ? (
        <div style={{ marginTop: 12 }}>
          <Banner tone="error">{errorMessage(finish.error)}</Banner>
        </div>
      ) : null}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={finish.isPending}>
          Guardar
        </button>
        <button type="button" className="btn btn-secondary" onClick={props.onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function OtherPlans(props: { plans: Plan[] }) {
  const client = useQueryClient();
  const resume = useMutation({
    mutationFn: (id: string) =>
      api(`/user-eco-card/${id}`, { method: 'PATCH', json: { status: 'in_progress' } }),
    onSuccess: () => refreshBusinessData(client),
  });
  if (!props.plans.length) return null;
  return (
    <section className="card" style={{ marginTop: 14 }} aria-labelledby="otros-planes">
      <h2 id="otros-planes" className="answer md" style={{ marginTop: 0 }}>
        Otros planes
      </h2>
      <ul className="list-plain card-rows">
        {props.plans.map((p) => (
          <li key={p.id} className="bill-row">
            <span>
              <strong>{p.title}</strong>
              <br />
              <span className="field-hint">
                {p.status === 'paused'
                  ? 'En pausa: no se pierde nada.'
                  : p.status === 'completed'
                    ? 'Terminado.'
                    : 'En curso.'}
              </span>
            </span>
            {p.status === 'paused' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => resume.mutate(p.id)}
                disabled={resume.isPending}
              >
                Retomar
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PlanPage(): ReactNode {
  const plans = usePlans();
  const step = useFirstStep();
  const me = useMe();
  const [finishing, setFinishing] = useState(false);

  if (plans.isPending) return <SkeletonCards count={2} label="Cargando tu plan…" />;
  if (plans.isError) return <Banner tone="error">{errorMessage(plans.error)}</Banner>;

  const chosenId = step.data?.decision?.planId;
  const plan =
    plans.data.find((p) => p.id === chosenId) ??
    plans.data.find((p) => p.status !== 'paused' && p.status !== 'completed') ??
    plans.data.find((p) => p.status === 'completed');
  const others = plans.data.filter((p) => p.id !== plan?.id);
  const today = me.data?.today ?? new Date().toISOString().slice(0, 10);

  if (!plan)
    return (
      <>
        <PageHead title="Tu plan" />
        <Banner>
          Todavía no elegiste tu primer paso.{' '}
          <Link to="/" className="btn btn-quiet">
            Ver tu primer paso
          </Link>
        </Banner>
        <OtherPlans plans={others} />
      </>
    );

  const done = plan.steps.filter((s) => s.status === 'completed').length;
  const completed = plan.status === 'completed';

  return (
    <>
      <PageHead
        title="Tu plan"
        sub={
          completed && plan.implementedAt
            ? `Terminado el ${formatDateLong(plan.implementedAt, 'es-PE')}`
            : plan.title
        }
      />
      {plan.stalled ? (
        <Banner>
          Este plan no avanza hace {plan.daysWithoutChange} días. Si es mucho para este trimestre,{' '}
          <Link to="/" className="btn btn-quiet">
            mira tu primer paso
          </Link>
        </Banner>
      ) : null}
      <div className="stack">
        <Question
          n={1}
          question="¿Qué me falta?"
          answer={
            completed
              ? 'Nada: ya lo terminaste'
              : done === plan.steps.length && plan.steps.length > 0
                ? 'Solo avisarnos que terminaste'
                : `${plan.steps.length - done} de ${plan.steps.length} pasos`
          }
        >
          <p className="support">{plan.title}</p>
          <SourceTag source={plan.dataSource} />
          <ul className="list-plain">
            {plan.steps.map((s) => (
              <StepRow key={s._id} plan={plan} step={s} />
            ))}
          </ul>
          <p className="field-hint">
            Las ideas son opcionales: tus pasos están siempre, aunque el servicio de ideas no responda.
          </p>
        </Question>

        <Question
          n={2}
          question="¿Cuándo lo sabré?"
          answer={completed ? 'Con tus próximas facturas' : 'Cuando termines y lleguen tus facturas'}
          answerSize="md"
        >
          {completed && plan.measurementHint ? (
            <>
              <p className="support">{plan.measurementHint.message}</p>
              <div className="actions">
                <Link className="btn btn-secondary" to="/ahorro">
                  Ver mi ahorro
                </Link>
                <Link className="btn btn-quiet" to="/factura">
                  Subir una factura
                </Link>
              </div>
            </>
          ) : finishing ? (
            <FinishForm plan={plan} today={today} onCancel={() => setFinishing(false)} />
          ) : (
            <>
              <p className="support">
                Cuando el cambio quede hecho, dinos qué día. Te decimos con qué factura se va a ver el
                resultado.
              </p>
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={() => setFinishing(true)}>
                  Terminé
                </button>
              </div>
            </>
          )}
        </Question>
      </div>
      <OtherPlans plans={others} />
    </>
  );
}
