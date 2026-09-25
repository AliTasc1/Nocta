import './polyfills';
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { ConfirmProvider, ToastProvider } from './ui/ui';
import { Layout } from './Layout';
import { Login, NoAccess, Recovery, Splash } from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const Couples = lazy(() => import('./pages/Couples'));
const Games = lazy(() => import('./pages/Games'));
const Categories = lazy(() => import('./pages/Categories'));
const Questions = lazy(() => import('./pages/Questions'));
const Stories = lazy(() => import('./pages/Stories'));
const Reports = lazy(() => import('./pages/Reports'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Payments = lazy(() => import('./pages/Payments'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));

const PageFallback = () => (
  <div className="row muted small" style={{ padding: 24 }}><span className="spinner" />Yükleniyor…</div>
);

function Gate() {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'checking') return <Splash text="Yetki kontrol ediliyor…" />;
  if (status === 'recovery') return <Recovery />;
  if (status === 'signed_out') return <Login />;
  if (status !== 'admin') return <NoAccess />;
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="kullanicilar" element={<Suspense fallback={<PageFallback />}><Users /></Suspense>} />
          <Route path="ciftler" element={<Suspense fallback={<PageFallback />}><Couples /></Suspense>} />
          <Route path="oyunlar" element={<Suspense fallback={<PageFallback />}><Games /></Suspense>} />
          <Route path="sorular" element={<Suspense fallback={<PageFallback />}><Questions mode="questions" /></Suspense>} />
          <Route path="gorevler" element={<Suspense fallback={<PageFallback />}><Questions mode="challenges" /></Suspense>} />
          <Route path="hikayeler" element={<Suspense fallback={<PageFallback />}><Stories /></Suspense>} />
          <Route path="raporlar" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
          <Route path="abonelikler" element={<Suspense fallback={<PageFallback />}><Subscriptions /></Suspense>} />
          <Route path="odemeler" element={<Suspense fallback={<PageFallback />}><Payments /></Suspense>} />
          <Route path="analitik" element={<Suspense fallback={<PageFallback />}><Analytics /></Suspense>} />
          <Route path="kategoriler" element={<Suspense fallback={<PageFallback />}><Categories /></Suspense>} />
          <Route path="ayarlar" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
