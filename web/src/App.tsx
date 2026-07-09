import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { getAuth, setAuth, type User } from './api';
import { I18nProvider, useI18n } from './i18n';
import { ReferenceSheetDrawer } from './components/ReferenceSheet';
import { GraphCalculator } from './components/GraphCalculator';
import { Login, Register } from './pages/Auth';
import { CurriculumMap } from './pages/CurriculumMap';
import { Lesson } from './pages/Lesson';
import { Practice } from './pages/Practice';
import { ExitTicket } from './pages/ExitTicket';
import { Sprint } from './pages/Sprint';
import { Review } from './pages/Review';
import { Progress } from './pages/Progress';

function useUser(): User | null {
  const [user, setUser] = useState<User | null>(getAuth()?.user ?? null);
  useEffect(() => {
    const onChange = () => setUser(getAuth()?.user ?? null);
    window.addEventListener('auth-changed', onChange);
    return () => window.removeEventListener('auth-changed', onChange);
  }, []);
  return user;
}

function TopBar({ user }: { user: User | null }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <header className="topbar">
      <span className="brand">∑ {t('appName')}</span>
      {user && (
        <nav>
          <NavLink to="/" end>{t('curriculum')}</NavLink>
          <NavLink to="/sprint">{t('sprint')}</NavLink>
          <NavLink to="/review">{t('review')}</NavLink>
          <NavLink to="/progress">{t('progress')}</NavLink>
          <NavLink to="/calculator">{t('calculator')}</NavLink>
        </nav>
      )}
      <button
        className="pill"
        onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
        aria-label="language"
      >
        {locale === 'en' ? '🇪🇸 ES' : '🇺🇸 EN'}
      </button>
      {user && (
        <button className="pill" onClick={() => setAuth(null)}>
          {t('logout')}
        </button>
      )}
    </header>
  );
}

/** App-style bottom tab bar on phones (design: students on phones first). */
function BottomNav() {
  const { t } = useI18n();
  const tabs = [
    { to: '/', icon: '📘', label: t('curriculum'), end: true },
    { to: '/sprint', icon: '⚡', label: t('sprint') },
    { to: '/review', icon: '📚', label: t('review') },
    { to: '/progress', icon: '📈', label: t('progress') },
    { to: '/calculator', icon: '🧮', label: t('calculator') },
  ];
  return (
    <nav className="bottom-nav" aria-label="main">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}>
          <span className="icon" aria-hidden>{tab.icon}</span>
          <span className="label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  if (!getAuth()) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function CalculatorPage() {
  const { t } = useI18n();
  return (
    <div className="container">
      <h1>🧮 {t('calculator')}</h1>
      <GraphCalculator />
    </div>
  );
}

export function App() {
  const user = useUser();
  return (
    <I18nProvider>
      <BrowserRouter>
        <TopBar user={user} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RequireAuth><CurriculumMap /></RequireAuth>} />
          <Route path="/lesson/:id" element={<RequireAuth><Lesson /></RequireAuth>} />
          <Route path="/practice/:skillId" element={<RequireAuth><Practice /></RequireAuth>} />
          <Route path="/exit-ticket/:lessonId" element={<RequireAuth><ExitTicket /></RequireAuth>} />
          <Route path="/sprint" element={<RequireAuth><Sprint /></RequireAuth>} />
          <Route path="/review" element={<RequireAuth><Review /></RequireAuth>} />
          <Route path="/progress" element={<RequireAuth><Progress /></RequireAuth>} />
          <Route path="/progress/:studentId" element={<RequireAuth><Progress /></RequireAuth>} />
          <Route path="/calculator" element={<RequireAuth><CalculatorPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {user && <ReferenceSheetDrawer />}
        {user && <BottomNav />}
      </BrowserRouter>
    </I18nProvider>
  );
}
