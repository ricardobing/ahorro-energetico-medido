import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { AppShell } from './components/AppShell';
import { Banner, SkeletonCards } from './components/ui';
import { errorMessage } from './lib/api';
import { useMe, useNotifications } from './lib/queries';
import { FirstStepPage } from './pages/FirstStep';
import { MorePage } from './pages/More';
import { PlanPage } from './pages/Plan';
import { SavingsPage } from './pages/Savings';
import { BillUploadPage } from './pages/BillUpload';

// Pantallas que no son del recorrido principal: se cargan cuando se abren.
const BillsPage = lazy(() => import('./pages/Bills').then((m) => ({ default: m.BillsPage })));
const NotificationsPage = lazy(() =>
  import('./pages/Notifications').then((m) => ({ default: m.NotificationsPage })),
);
const ReportPage = lazy(() => import('./pages/Report').then((m) => ({ default: m.ReportPage })));
const ProfilePage = lazy(() => import('./pages/Profile').then((m) => ({ default: m.ProfilePage })));
const PartnersPage = lazy(() => import('./pages/Partners').then((m) => ({ default: m.PartnersPage })));
const DemoPage = lazy(() => import('./pages/Demo').then((m) => ({ default: m.DemoPage })));

function Loading() {
  return <SkeletonCards />;
}

export function App(): ReactNode {
  const me = useMe();
  const { pathname } = useLocation();
  const owner = me.data?.user.role === 'owner';
  const notifications = useNotifications(owner);

  if (me.isPending)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (me.isError || !me.data)
    return (
      <div className="page">
        <Banner tone="error">{errorMessage(me.error)}</Banner>
      </div>
    );

  const { user, business, demoMode } = me.data;
  const shellUser = { displayName: user.displayName, businessName: business?.name ?? null, role: user.role };
  const wide = pathname.startsWith('/aliados');

  return (
    <AppShell user={shellUser} unread={notifications.data?.unread ?? 0} demoMode={demoMode} wide={wide}>
      <Suspense fallback={<Loading />}>
        {owner ? (
          <Routes>
            <Route path="/" element={<FirstStepPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/factura" element={<BillUploadPage />} />
            <Route path="/ahorro" element={<SavingsPage />} />
            <Route path="/mas" element={<MorePage demoMode={demoMode} role={user.role} />} />
            <Route path="/mas/facturas" element={<BillsPage />} />
            <Route path="/mas/avisos" element={<NotificationsPage />} />
            <Route path="/mas/reporte" element={<ReportPage />} />
            <Route path="/mas/perfil" element={<ProfilePage />} />
            <Route path="/mas/demo" element={<DemoPage />} />
            <Route path="/aliados" element={<NotForOwner />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/aliados" element={<PartnersPage staff={user.role === 'staff'} />} />
            <Route path="/mas" element={<MorePage demoMode={demoMode} role={user.role} />} />
            <Route path="/mas/demo" element={<DemoPage />} />
            <Route path="*" element={<Navigate to="/aliados" replace />} />
          </Routes>
        )}
      </Suspense>
    </AppShell>
  );
}

function NotForOwner() {
  return (
    <Banner>
      El informe para aliados es para quienes financian el programa. En la demostración, ábrelo con «Ver como
      → Aliado».
    </Banner>
  );
}
