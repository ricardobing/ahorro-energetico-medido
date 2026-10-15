import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  IconBell,
  IconBills,
  IconChevron,
  IconDemo,
  IconPartners,
  IconProfile,
  IconReport,
} from '../components/Icons';
import { PageHead } from '../components/ui';
import { useNotifications } from '../lib/queries';

/** «Más» en el celular: lo que en escritorio está a la vista en la barra lateral. */
export function MorePage(props: { demoMode: boolean; role: 'owner' | 'partner' | 'staff' }): ReactNode {
  const owner = props.role === 'owner';
  const notifications = useNotifications(owner);
  const unread = notifications.data?.unread ?? 0;
  const items = [
    ...(owner
      ? [
          { to: '/mas/facturas', label: 'Mis facturas', icon: IconBills },
          { to: '/mas/avisos', label: unread ? `Avisos (${unread} sin leer)` : 'Avisos', icon: IconBell },
          { to: '/mas/reporte', label: 'Mi reporte', icon: IconReport },
          { to: '/mas/perfil', label: 'Perfil del negocio', icon: IconProfile },
        ]
      : [{ to: '/aliados', label: 'Informe para aliados', icon: IconPartners }]),
    ...(props.demoMode
      ? [{ to: '/mas/demo', label: 'Demostración: ver como, simular el tiempo', icon: IconDemo }]
      : []),
  ];
  return (
    <>
      <PageHead title="Más" />
      <div className="card card-rows" style={{ padding: '4px 16px' }}>
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="menu-link">
            <item.icon />
            {item.label}
            <IconChevron className="chev" />
          </Link>
        ))}
      </div>
    </>
  );
}
