import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import {
  IconBell,
  IconBill,
  IconBills,
  IconBusiness,
  IconDemo,
  IconPartners,
  IconPlan,
  IconProfile,
  IconReport,
  IconSavings,
  IconStep,
} from './Icons';

export interface ShellUser {
  displayName: string;
  businessName: string | null;
  role: 'owner' | 'partner' | 'staff';
}

type IconType = (p: { className?: string }) => ReactNode;

type Item = {
  to: string;
  label: string;
  /** Etiqueta corta para los botones de la sección en el celular. */
  short?: string;
  testId: string;
  icon: IconType;
  badge?: number;
};

type Group = { key: string; label: string; icon: IconType; testId: string; items: Item[] };

function ownerGroups(unread: number, demoMode: boolean): Group[] {
  return [
    {
      key: 'negocio',
      label: 'Mi negocio',
      icon: IconBusiness,
      testId: 'nav-grupo-negocio',
      items: [
        { to: '/', label: 'Primer paso', testId: 'nav-primer-paso', icon: IconStep },
        { to: '/plan', label: 'Mi plan', short: 'Plan', testId: 'nav-plan', icon: IconPlan },
        { to: '/ahorro', label: 'Mi ahorro', short: 'Ahorro', testId: 'nav-ahorro', icon: IconSavings },
        {
          to: '/perfil',
          label: 'Perfil del negocio',
          short: 'Perfil',
          testId: 'nav-perfil',
          icon: IconProfile,
        },
      ],
    },
    {
      key: 'facturas',
      label: 'Facturas',
      icon: IconBill,
      testId: 'nav-grupo-facturas',
      items: [
        { to: '/factura', label: 'Subir factura', testId: 'nav-factura', icon: IconBill },
        { to: '/facturas', label: 'Mis facturas', testId: 'nav-facturas', icon: IconBills },
      ],
    },
    {
      key: 'reportes',
      label: 'Reportes',
      icon: IconReport,
      testId: 'nav-grupo-reportes',
      items: [
        { to: '/reporte', label: 'Mi reporte', testId: 'nav-reporte', icon: IconReport },
        { to: '/avisos', label: 'Avisos', testId: 'nav-avisos', icon: IconBell, badge: unread },
        ...(demoMode
          ? [{ to: '/demo', label: 'Demostración', short: 'Demo', testId: 'nav-demo', icon: IconDemo }]
          : []),
      ],
    },
  ];
}

function partnerGroups(demoMode: boolean): Group[] {
  return [
    {
      key: 'reportes',
      label: 'Reportes',
      icon: IconPartners,
      testId: 'nav-grupo-reportes',
      items: [
        {
          to: '/aliados',
          label: 'Informe para aliados',
          short: 'Informe',
          testId: 'nav-aliados',
          icon: IconPartners,
        },
        ...(demoMode
          ? [{ to: '/demo', label: 'Demostración', short: 'Demo', testId: 'nav-demo', icon: IconDemo }]
          : []),
      ],
    },
  ];
}

const ROLE_LABEL: Record<ShellUser['role'], string> = {
  owner: 'Dueña del negocio',
  partner: 'Aliado del programa',
  staff: 'Equipo de Kamai',
};

const isActive = (to: string, pathname: string) => (to === '/' ? pathname === '/' : pathname === to);

/**
 * Navegación con los colores de Kamai, en tres secciones.
 * Escritorio (más de 900 px): barra lateral oscura de 248 px con los grupos y sus páginas a la vista.
 * Celular: las tres secciones son botones fijos abajo y las páginas de la sección abierta, botones arriba.
 * Es UN solo `<nav>`: el CSS lo acomoda según el ancho. Lo activo lleva fondo, peso y barra, no solo color.
 */
export function AppShell(props: {
  user: ShellUser;
  children: ReactNode;
  unread?: number;
  demoMode?: boolean;
  wide?: boolean;
}): ReactNode {
  const { pathname } = useLocation();
  const groups =
    props.user.role === 'owner'
      ? ownerGroups(props.unread ?? 0, Boolean(props.demoMode))
      : partnerGroups(Boolean(props.demoMode));

  return (
    <div className="shell">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <div className="brand">
          <Link to={props.user.role === 'owner' ? '/' : '/aliados'} className="brand-name">
            Kamai
          </Link>
          <span className="prototype-tag">Prototipo para el reto técnico de Agora</span>
        </div>

        <nav className="side-nav" aria-label="Navegación principal">
          {groups.map((group) => {
            const active = group.items.some((item) => isActive(item.to, pathname));
            const unread = group.items.reduce((acc, item) => acc + (item.badge ?? 0), 0);
            return (
              <div
                className="nav-group"
                key={group.key}
                data-active={active ? 'true' : 'false'}
                role="group"
                aria-labelledby={`grupo-${group.key}`}
              >
                <Link
                  id={`grupo-${group.key}`}
                  to={group.items[0]!.to}
                  className="nav-group-label"
                  data-testid={group.testId}
                  aria-current={active ? 'true' : undefined}
                >
                  <span className="nav-group-icon">
                    <group.icon />
                    {unread ? <span className="nav-dot" aria-hidden="true" /> : null}
                  </span>
                  <span>{group.label}</span>
                </Link>
                <div className="nav-items">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="nav-link"
                      data-testid={item.testId}
                      aria-current={isActive(item.to, pathname) ? 'page' : undefined}
                    >
                      <span className="nav-icon">
                        <item.icon />
                      </span>
                      <span className="nav-text">{item.label}</span>
                      <span className="nav-text-short" aria-hidden="true">
                        {item.short ?? item.label}
                      </span>
                      {item.badge ? (
                        <span className="nav-badge num" aria-label={`${item.badge} sin leer`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="who">
            <strong>{props.user.businessName ?? props.user.displayName}</strong>
            <span>{ROLE_LABEL[props.user.role]}</span>
          </div>
          {props.demoMode ? (
            <Link to="/demo" className="view-as">
              Ver como… (demostración)
            </Link>
          ) : null}
        </div>
      </aside>

      <main id="contenido" className={props.wide ? 'page wide' : 'page'} tabIndex={-1}>
        {props.children}
      </main>
    </div>
  );
}
