import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import {
  IconBell,
  IconBill,
  IconBills,
  IconMore,
  IconPartners,
  IconPlan,
  IconReport,
  IconSavings,
  IconStep,
} from './Icons';

export interface ShellUser {
  displayName: string;
  businessName: string | null;
  role: 'owner' | 'partner' | 'staff';
}

type Item = {
  to: string;
  label: string;
  short?: string;
  testId: string;
  icon: (p: { className?: string }) => ReactNode;
  /** Orden en las pestañas del celular (1 a 5); sin orden = solo en la barra lateral. */
  tab?: number;
  /** Solo en las pestañas del celular («Más» agrupa lo que en escritorio está a la vista). */
  mobileOnly?: boolean;
  badge?: number;
  /** Rutas hijas que también lo marcan como activo. */
  match?: string[];
};
type Group = { label: string; items: Item[] };

function ownerGroups(unread: number): Group[] {
  return [
    {
      label: 'Mi negocio',
      items: [
        { to: '/', label: 'Primer paso', testId: 'nav-primer-paso', icon: IconStep, tab: 1 },
        { to: '/plan', label: 'Mi plan', short: 'Plan', testId: 'nav-plan', icon: IconPlan, tab: 2 },
        {
          to: '/ahorro',
          label: 'Mi ahorro',
          short: 'Ahorro',
          testId: 'nav-ahorro',
          icon: IconSavings,
          tab: 4,
        },
      ],
    },
    {
      label: 'Facturas',
      items: [
        { to: '/mas/facturas', label: 'Mis facturas', testId: 'nav-facturas', icon: IconBills },
        {
          to: '/factura',
          label: 'Subir factura',
          short: 'Factura',
          testId: 'nav-factura',
          icon: IconBill,
          tab: 3,
        },
      ],
    },
    {
      label: 'Reportes',
      items: [
        { to: '/mas/reporte', label: 'Mi reporte', testId: 'nav-reporte', icon: IconReport },
        { to: '/mas/avisos', label: 'Avisos', testId: 'nav-avisos', icon: IconBell, badge: unread },
        {
          to: '/mas',
          label: 'Más',
          testId: 'nav-mas',
          icon: IconMore,
          tab: 5,
          mobileOnly: true,
          badge: unread,
          match: ['/mas/facturas', '/mas/reporte', '/mas/avisos', '/mas/perfil', '/mas/demo'],
        },
      ],
    },
  ];
}

const partnerGroups: Group[] = [
  {
    label: 'Reportes',
    items: [
      {
        to: '/aliados',
        label: 'Informe para aliados',
        short: 'Informe',
        testId: 'nav-aliados',
        icon: IconPartners,
        tab: 1,
      },
      { to: '/mas', label: 'Más', testId: 'nav-mas', icon: IconMore, tab: 2, match: ['/mas/demo'] },
    ],
  },
];

/** Id sin espacios ni tildes: `aria-labelledby` separa por espacios. */
const groupId = (label: string) =>
  `grupo-${label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;

const ROLE_LABEL: Record<ShellUser['role'], string> = {
  owner: 'Dueña del negocio',
  partner: 'Aliado del programa',
  staff: 'Equipo de Kamai',
};

/**
 * Navegación con los colores de Kamai: barra lateral oscura de 248 px
 * con grupos en pantallas de más de 900 px y pestañas fijas abajo en celular. Es UN solo `<nav>`: el CSS
 * lo ubica según el ancho. El ítem activo lleva fondo, peso y barra de 3 px, no solo color.
 */
export function AppShell(props: {
  user: ShellUser;
  children: ReactNode;
  unread?: number;
  demoMode?: boolean;
  wide?: boolean;
}): ReactNode {
  const { pathname } = useLocation();
  const groups = props.user.role === 'owner' ? ownerGroups(props.unread ?? 0) : partnerGroups;

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
          {groups.map((group) => (
            <div className="nav-group" key={group.label} role="group" aria-labelledby={groupId(group.label)}>
              <div className="nav-group-label" id={groupId(group.label)}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active =
                  item.to === '/'
                    ? pathname === '/'
                    : pathname === item.to ||
                      (item.match ?? []).some((m) => pathname.startsWith(m)) ||
                      (item.to !== '/mas' && pathname.startsWith(`${item.to}/`));
                const classes = [
                  'nav-link',
                  item.tab ? `nav-order-${item.tab}` : 'nav-desktop-only',
                  item.mobileOnly ? 'nav-mobile-only' : '',
                ].join(' ');
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={classes}
                    data-testid={item.testId}
                    aria-current={active ? 'page' : undefined}
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
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="who">
            <strong>{props.user.businessName ?? props.user.displayName}</strong>
            <span>{ROLE_LABEL[props.user.role]}</span>
          </div>
          {props.demoMode ? (
            <Link to="/mas/demo" className="view-as">
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
