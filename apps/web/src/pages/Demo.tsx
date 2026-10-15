import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateLong } from '@ppam/domain';
import { IconAlert, IconBell, IconCalendar, IconDemo, IconProfile } from '../components/Icons';
import { Banner, PageHead, SectionTitle } from '../components/ui';
import { api, currentDemoUser, errorMessage, setDemoUser, type DemoUser } from '../lib/api';

const USERS: { key: DemoUser; label: string; note: string }[] = [
  { key: 'ines', label: 'Inés · Panadería Santa Inés', note: 'Datos del caso del reto' },
  { key: 'nuevo', label: 'Rosa · Panadería El Trigal', note: 'Negocio nuevo, sintético' },
  { key: 'aliado', label: 'Aliado del programa', note: 'Solo el informe agregado' },
  { key: 'equipo', label: 'Equipo de Kamai', note: 'Informe y cierre de periodos' },
];

const FAILURES: { service: string; mode: string; label: string }[] = [
  { service: 'subtasks', mode: 'quota', label: 'Ideas: sin cupo (402)' },
  { service: 'subtasks', mode: 'slow', label: 'Ideas: lentas (más de 10 s)' },
  { service: 'subtasks', mode: 'error', label: 'Ideas: caídas' },
  { service: 'messaging', mode: 'error', label: 'Correo: caído' },
  { service: 'messaging', mode: 'bounce', label: 'Correo: rebota' },
  { service: 'currency', mode: 'down', label: 'Tipo de cambio: caído' },
];

/** Panel de la demostración (solo con DEMO_MODE): «Ver como», el paso del tiempo y los modos de falla. */
export function DemoPage(): ReactNode {
  const client = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const state = useQuery({
    queryKey: ['demo-state'],
    queryFn: () => api<{ today: string; simulatedMonths: number }>('/demo/state'),
  });
  const outbox = useQuery({
    queryKey: ['demo-outbox'],
    queryFn: () =>
      api<{ items: { id: string; to: string; subject: string; status: string; attempts: number }[] }>(
        '/demo/outbox',
      ),
  });
  const run = useMutation({
    mutationFn: async (action: { path: string; body?: unknown; done: string }) => {
      await api(action.path, { method: 'POST', json: action.body ?? {} });
      return action.done;
    },
    onSuccess: async (done) => {
      setMessage(done);
      await client.invalidateQueries();
    },
  });
  const viewAs = (user: DemoUser) => {
    setDemoUser(user);
    window.location.assign(user === 'aliado' || user === 'equipo' ? '/aliados' : '/');
  };
  const current = currentDemoUser();

  return (
    <>
      <PageHead
        icon={IconDemo}
        title="Demostración"
        sub="Solo existe con DEMO_MODE=true: la API se niega a usarlo en producción."
      />
      {message ? (
        <Banner onClose={() => setMessage(null)}>
          <p>{message}</p>
        </Banner>
      ) : null}
      {run.isError ? <Banner tone="error">{errorMessage(run.error)}</Banner> : null}

      <section className="card" aria-labelledby="ver-como">
        <SectionTitle id="ver-como" icon={IconProfile}>
          Ver como
        </SectionTitle>
        <div className="card-rows">
          {USERS.map((u) => (
            <div className="bill-row" key={u.key}>
              <span>
                <strong>{u.label}</strong>
                <br />
                <span className="field-hint">{u.note}</span>
              </span>
              <button
                type="button"
                className={u.key === current ? 'btn btn-primary' : 'btn btn-secondary'}
                aria-pressed={u.key === current}
                onClick={() => viewAs(u.key)}
              >
                {u.key === current ? 'Viendo' : 'Ver'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="tiempo">
        <SectionTitle id="tiempo" icon={IconCalendar}>
          Simular el paso del tiempo
        </SectionTitle>
        <p className="support">
          Hoy en la demostración:{' '}
          <strong>{state.data ? formatDateLong(state.data.today, 'es-PE') : '…'}</strong>. Llegan las facturas
          sintéticas de Inés de julio a septiembre (con foto), y el reloj avanza 5 días después de cada
          cierre.
        </p>
        <div className="actions">
          {(
            [
              ['jul', 'Llega julio'],
              ['ago', 'Llega agosto'],
              ['sep', 'Llega septiembre'],
            ] as const
          ).map(([through, label]) => (
            <button
              key={through}
              type="button"
              className="btn btn-secondary"
              disabled={run.isPending}
              onClick={() =>
                run.mutate({
                  path: '/demo/simulate-time',
                  body: { through },
                  done: `Listo: ${label.toLowerCase()}.`,
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={run.isPending}
            onClick={() =>
              run.mutate({
                path: '/demo/run-workers',
                done: 'Corrieron los recordatorios y la bandeja de correos.',
              })
            }
          >
            Correr recordatorios y correos
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={run.isPending}
            onClick={() =>
              run.mutate({ path: '/demo/reset', done: 'La demostración volvió al estado inicial del caso.' })
            }
          >
            Reiniciar la demostración
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="fallas">
        <SectionTitle id="fallas" icon={IconAlert}>
          Modos de falla de los servicios simulados
        </SectionTitle>
        <p className="support">
          Para ver cómo responde la app cuando un servicio de Kamai falla. «Normal» vuelve todo atrás.
        </p>
        <div className="actions">
          {FAILURES.map((f) => (
            <button
              key={`${f.service}-${f.mode}`}
              type="button"
              className="btn btn-secondary"
              disabled={run.isPending}
              onClick={() =>
                run.mutate({
                  path: '/demo/mocks',
                  body: { service: f.service, mode: f.mode },
                  done: `Activado: ${f.label}.`,
                })
              }
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-quiet"
            disabled={run.isPending}
            onClick={async () => {
              for (const service of ['subtasks', 'messaging', 'currency'])
                await api('/demo/mocks', { method: 'POST', json: { service, mode: 'ok' } }).catch(
                  () => undefined,
                );
              setMessage('Todos los servicios simulados funcionan normal.');
            }}
          >
            Normal
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="bandeja">
        <SectionTitle id="bandeja" icon={IconBell}>
          Bandeja de correos
        </SectionTitle>
        {outbox.data?.items.length ? (
          <ul className="list-plain card-rows">
            {outbox.data.items.map((m) => (
              <li className="bill-row" key={m.id}>
                <span>
                  <strong>{m.subject}</strong>
                  <br />
                  <span className="field-hint">
                    {m.to} · {m.attempts} {m.attempts === 1 ? 'intento' : 'intentos'}
                  </span>
                </span>
                <span className="tag">{m.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="support">Todavía no se mandó ningún correo.</p>
        )}
      </section>
    </>
  );
}
