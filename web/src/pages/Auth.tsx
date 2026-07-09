import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setAuth } from '../api';
import { useI18n } from '../i18n';

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? json.error ?? 'error');
  return json;
}

export function Login() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuth(await post('/api/auth/login', { username, password }));
      nav('/');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>{t('login')}</h1>
        <form onSubmit={submit}>
          <label className="field">
            <span>{t('username')}</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="field">
            <span>{t('password')}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="feedback bad">{error}</div>}
          <button className="btn" type="submit">{t('login')}</button>
        </form>
        <p><Link to="/register">{t('register')} →</Link></p>
      </div>
    </div>
  );
}

export function Register() {
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const [form, setForm] = useState({
    username: '',
    password: '',
    displayName: '',
    grade: 8,
    under13: false,
    guardianEmail: '',
  });
  const [error, setError] = useState('');
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuth(
        await post('/api/auth/register', {
          role: 'student',
          username: form.username,
          password: form.password,
          displayName: form.displayName,
          grade: Number(form.grade),
          locale,
          under13: form.under13,
          guardianEmail: form.under13 ? form.guardianEmail : undefined,
        }),
      );
      nav('/');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>{t('register')}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('signupNote')}</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>{t('username')}</span>
            <input value={form.username} onChange={(e) => set('username', e.target.value)} required minLength={3} />
          </label>
          <label className="field">
            <span>{t('password')}</span>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} />
          </label>
          <label className="field">
            <span>{t('displayName')}</span>
            <input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} required />
          </label>
          <label className="field">
            <span>{t('grade')}</span>
            <select value={form.grade} onChange={(e) => set('grade', e.target.value)}>
              {[6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.under13}
              onChange={(e) => set('under13', e.target.checked)}
              style={{ width: 'auto' }}
            />
            <span style={{ margin: 0 }}>{t('under13')}</span>
          </label>
          {form.under13 && (
            <label className="field">
              <span>{t('guardianEmail')}</span>
              <input type="email" value={form.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} required />
            </label>
          )}
          {error && <div className="feedback bad">{error}</div>}
          <button className="btn" type="submit">{t('register')}</button>
        </form>
        <p><Link to="/login">{t('login')} →</Link></p>
      </div>
    </div>
  );
}
