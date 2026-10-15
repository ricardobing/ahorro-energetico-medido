import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateLong } from '@ppam/domain';
import { IconBell } from '../components/Icons';
import { Banner, PageHead, SkeletonCards } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { keys, useNotifications } from '../lib/queries';

/** Avisos dentro de la app: el canal principal (el correo es una copia). */
export function NotificationsPage(): ReactNode {
  const query = useNotifications();
  const client = useQueryClient();
  const unread = query.data?.items.filter((n) => !n.readAt) ?? [];

  // Al abrir la pantalla, los avisos quedan leídos (el contador de la navegación se apaga).
  useEffect(() => {
    if (unread.length === 0) return;
    void Promise.all(
      unread.map((n) => api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined)),
    ).then(() => client.invalidateQueries({ queryKey: keys.notifications }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.map((n) => n.id).join()]);

  if (query.isPending) return <SkeletonCards count={2} label="Cargando tus avisos…" />;
  if (query.isError) return <Banner tone="error">{errorMessage(query.error)}</Banner>;
  const items = query.data.items;
  return (
    <>
      <PageHead icon={IconBell} title="Avisos" sub="Lo importante queda acá aunque el correo no llegue." />
      {items.length === 0 ? (
        <Banner>No tienes avisos por ahora.</Banner>
      ) : (
        <section className="card">
          <ul className="list-plain card-rows" style={{ marginTop: 0 }}>
            {items.map((n) => (
              <li className="step notice-row" key={n.id}>
                <span className={n.readAt ? 'tile' : 'tile sage'} aria-hidden="true">
                  <IconBell />
                </span>
                <strong>{n.title}</strong>
                <p className="support" style={{ marginTop: 0 }}>
                  {n.body}
                </p>
                <span className="field-hint">{formatDateLong(n.createdAt.slice(0, 10), 'es-PE')}</span>
                {n.link ? (
                  <div>
                    <Link to={n.link} className="btn btn-quiet" style={{ paddingLeft: 0 }}>
                      Ir
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
