import { useEffect, useState } from 'react';
import { passwordError } from '../../auth/rules';
import { useAuth } from '../../store/AuthProvider';
import './Account.css';

function readHash(): { kind: 'verify' | 'reset'; token: string } | undefined {
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.includes('=') ? raw : '');
  const verify = params.get('verify');
  if (verify !== null && verify.length > 0) return { kind: 'verify', token: verify };
  const reset = params.get('reset');
  if (reset !== null && reset.length > 0) return { kind: 'reset', token: reset };
  const prefixed = raw.match(/^(verify|reset)=(.+)$/);
  if (prefixed !== null) return { kind: prefixed[1] as 'verify' | 'reset', token: decodeURIComponent(prefixed[2]) };
  return undefined;
}

function clearHash(): void {
  const url = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', url);
}

export function AuthHashHandler() {
  const auth = useAuth();
  const [resetToken, setResetToken] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const found = readHash();
    if (found === undefined) return;
    clearHash();
    if (found.kind === 'verify') void auth.verify(found.token);
    else setResetToken(found.token);
  }, [auth]);

  if (resetToken === undefined) return null;

  return (
    <div className="account-nudge" role="dialog" aria-label="Choose a new password">
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          const problem = passwordError(password);
          if (problem !== undefined) {
            setLocalError(problem);
            return;
          }
          void auth.reset(resetToken, password).then((ok) => {
            if (ok) setResetToken(undefined);
          });
        }}
      >
        <p>Choose a new password for this account.</p>
        <label className="account-field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {localError !== undefined ? <p>{localError}</p> : null}
        <div className="account-nudge-actions">
          <button type="submit" className="text-button" disabled={auth.busy}>
            Save password
          </button>
          <button type="button" className="ghost-button" onClick={() => setResetToken(undefined)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
