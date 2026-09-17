import { useState, type FormEvent } from 'react';
import { emailError, passwordError, usernameError } from '../../auth/rules';
import { useAuth } from '../../store/AuthProvider';
import './Account.css';

type Panel = 'signin' | 'register' | 'forgot';

export function AccountSection() {
  const auth = useAuth();
  const [panel, setPanel] = useState<Panel>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');

  if (!auth.configured) {
    return (
      <section className="account">
        <h2 className="settings-section-title">Account</h2>
        <p className="account-copy">
          Sign-in is optional. This build has no API URL, so everything still stays on this device.
          Set <span className="mono">VITE_API_URL</span> if this copy is on GitHub Pages. On the
          Cloudflare Worker host, accounts use this same origin.
        </p>
      </section>
    );
  }

  if (auth.user !== undefined) {
    const needsEmail = auth.user.email === null || !auth.user.emailVerified;
    return (
      <section className="account">
        <h2 className="settings-section-title">Account</h2>
        <p className="account-identity">
          Signed in as <span className="mono">{auth.user.username}</span>
        </p>
        {auth.user.email === null ? (
          <p className="account-copy">
            Add an email while you still know this password. It is the only way to use Forgot
            password later.
          </p>
        ) : auth.user.emailVerified ? (
          <p className="account-copy">Recovery email: {auth.user.email}</p>
        ) : (
          <p className="account-copy">
            {auth.user.email} is saved but not confirmed yet. Check that inbox, or save it again to
            resend the link.
          </p>
        )}
        {needsEmail ? (
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault();
              const problem = emailError(newEmail) ?? (newEmail.trim() === '' ? 'Enter an email address.' : undefined);
              if (problem !== undefined) return;
              void auth.addEmail(newEmail);
            }}
          >
            <label className="account-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button type="submit" className="text-button" disabled={auth.busy}>
              {auth.user.email === null ? 'Add email' : 'Update email'}
            </button>
          </form>
        ) : null}
        <Status auth={auth} />
        <button type="button" className="ghost-button account-signout" onClick={() => void auth.logout()}>
          Sign out
        </button>
      </section>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (panel === 'forgot') {
      const problem = usernameError(username);
      if (problem !== undefined) return;
      void auth.forgot(username);
      return;
    }
    const nameProblem = usernameError(username);
    const passProblem = passwordError(password);
    if (nameProblem !== undefined || passProblem !== undefined) return;
    if (panel === 'register') {
      const mailProblem = emailError(email);
      if (mailProblem !== undefined) return;
      void auth.register(username, password, email);
      return;
    }
    void auth.login(username, password);
  };

  return (
    <section className="account">
      <h2 className="settings-section-title">Account</h2>
      <p className="account-copy">
        Optional. Sign in to keep reading speed and place in sync across your devices. Book files
        stay on each device.
      </p>
      <div className="account-tabs" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'signin'}
          className="account-tab"
          onClick={() => setPanel('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'register'}
          className="account-tab"
          onClick={() => setPanel('register')}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'forgot'}
          className="account-tab"
          onClick={() => setPanel('forgot')}
        >
          Forgot password
        </button>
      </div>
      <form className="account-form" onSubmit={submit}>
        <label className="account-field">
          <span>Username</span>
          <input
            type="text"
            autoComplete="username"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        {panel === 'forgot' ? null : (
          <label className="account-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={panel === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        {panel === 'register' ? (
          <label className="account-field">
            <span>Email (recommended)</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Needed to reset a forgotten password"
            />
          </label>
        ) : null}
        {panel === 'register' ? (
          <p className="account-copy">
            You can skip email, but if you forget this password there will be no way to recover the
            account until you add one while signed in.
          </p>
        ) : null}
        <button type="submit" className="text-button" disabled={auth.busy}>
          {panel === 'forgot' ? 'Send reset link' : panel === 'register' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <Status auth={auth} />
    </section>
  );
}

function Status({ auth }: { auth: ReturnType<typeof useAuth> }) {
  if (auth.error === undefined && auth.message === undefined) return null;
  return (
    <div className="account-status" role="status">
      {auth.error !== undefined ? <p>{auth.error}</p> : null}
      {auth.hint !== undefined ? <p className="account-copy">{auth.hint}</p> : null}
      {auth.message !== undefined ? <p>{auth.message}</p> : null}
    </div>
  );
}
