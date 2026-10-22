'use client';

import {useState, type FormEvent} from 'react';
import {ArrowRight, Eye, EyeOff, LockKeyhole, UserRound} from 'lucide-react';

export default function AuthPanel({setup, onSuccess}: {setup: boolean; onSuccess: () => void}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mode: setup ? 'setup' : 'login', username, password}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Die Anmeldung ist fehlgeschlagen.');
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^Error: /, '') : 'Die Anmeldung ist fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <aside className="auth-brand-panel" aria-label="quovadis">
        <div className="auth-brand-art" aria-hidden="true">
          <div className="auth-contours" />
          <div className="auth-trail" />
          <span className="auth-orbit-dot auth-orbit-dot-one" />
          <span className="auth-orbit-dot auth-orbit-dot-two" />
        </div>
        <div className="auth-wordmark">quovadis<span>by PLLANA</span></div>
        <div className="auth-brand-copy">
          <p className="auth-brand-kicker">IT Opportunity Radar</p>
          <h2>Wissen,<br />wohin.</h2>
          <p>Chancen erkennen.<br />Entscheidungen treffen.</p>
        </div>
        <div className="auth-brand-footer">Ein klarer Blick auf die nächste Chance.</div>
      </aside>

      <section className="auth-main" aria-labelledby="auth-title">
        <div className="auth-mobile-brand" aria-hidden="true">quovadis <span>by PLLANA</span></div>
        <div className="auth-content">
          <div className="auth-eyebrow">{setup ? 'ERSTEINRICHTUNG' : 'INTERNER BEREICH'}</div>
          <h1 id="auth-title">{setup ? 'Willkommen bei quovadis.' : 'Willkommen zurück.'}</h1>
          <p className="auth-description">
            {setup
              ? 'Erstelle deinen Administratorzugang und starte mit der Einrichtung.'
              : 'Melde dich an, um deine Chancen zu sehen.'}
          </p>

          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="auth-username">Benutzername</label>
            <div className="auth-input-wrap">
              <UserRound size={19} strokeWidth={1.8} aria-hidden="true" />
              <input id="auth-username" name="username" autoComplete="username" placeholder="Benutzername eingeben" minLength={setup ? 3 : undefined} required value={username} onChange={event => setUsername(event.target.value)} />
            </div>

            <label htmlFor="auth-password">Passwort</label>
            <div className="auth-input-wrap">
              <LockKeyhole size={19} strokeWidth={1.8} aria-hidden="true" />
              <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={setup ? 'new-password' : 'current-password'} placeholder="Passwort eingeben" minLength={setup ? 16 : 1} required value={password} onChange={event => setPassword(event.target.value)} />
              <button className="auth-visibility" type="button" aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                {showPassword ? <EyeOff size={19} strokeWidth={1.8} /> : <Eye size={19} strokeWidth={1.8} />}
              </button>
            </div>
            {setup && <p className="auth-hint">Mindestens 16 Zeichen für dein Passwort.</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={pending}>
              <span>{pending ? 'Einen Moment …' : setup ? 'Zugang erstellen' : 'Anmelden'}</span>
              {!pending && <ArrowRight size={20} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          </form>
        </div>
        <div className="auth-footer"><LockKeyhole size={15} aria-hidden="true" /> Geschützter Zugang · PLLANA</div>
      </section>
    </main>
  );
}
