import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  fetchMe,
  forgotPassword,
  isApiConfigured,
  loginAccount,
  registerAccount,
  resetPassword,
  saveAccountEmail,
  verifyAccountEmail,
} from '../sync/api';
import type { AccountUser } from '../sync/session';
import { getUser, onSessionChange, setSession } from '../sync/session';
import { clearSession, loadSession, saveSession } from './db';

interface AuthApi {
  ready: boolean;
  configured: boolean;
  user: AccountUser | undefined;
  busy: boolean;
  message: string | undefined;
  error: string | undefined;
  hint: string | undefined;
  register: (username: string, password: string, email: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addEmail: (email: string) => Promise<boolean>;
  forgot: (username: string) => Promise<boolean>;
  reset: (token: string, password: string) => Promise<boolean>;
  verify: (token: string) => Promise<boolean>;
  clearBanner: () => void;
}

const AuthContext = createContext<AuthApi | undefined>(undefined);

async function persist(token: string, user: AccountUser): Promise<void> {
  setSession(token, user);
  await saveSession(token, user);
}

function failMessage(error: unknown): { error: string; hint?: string } {
  if (error instanceof ApiError) return { error: error.message, ...(error.hint !== undefined ? { hint: error.hint } : {}) };
  return { error: 'Something went wrong.' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isApiConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<AccountUser | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [hint, setHint] = useState<string | undefined>(undefined);

  useEffect(() => onSessionChange(() => setUser(getUser())), []);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    let active = true;
    void (async () => {
      const stored = await loadSession();
      if (!active) return;
      if (stored === undefined) {
        setReady(true);
        return;
      }
      setSession(stored.token, stored.user);
      setUser(stored.user);
      try {
        const live = await fetchMe();
        if (!active) return;
        await persist(stored.token, live);
        setUser(live);
      } catch {
        if (!active) return;
        setSession(undefined, undefined);
        await clearSession();
        setUser(undefined);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [configured]);

  const run = useCallback(async (task: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(undefined);
    setHint(undefined);
    setMessage(undefined);
    try {
      await task();
      return true;
    } catch (caught) {
      const failed = failMessage(caught);
      setError(failed.error);
      setHint(failed.hint);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const register = useCallback(
    (username: string, password: string, email: string) =>
      run(async () => {
        const result = await registerAccount(username, password, email);
        await persist(result.token, result.user);
        setUser(result.user);
      }),
    [run],
  );

  const login = useCallback(
    (username: string, password: string) =>
      run(async () => {
        const result = await loginAccount(username, password);
        await persist(result.token, result.user);
        setUser(result.user);
      }),
    [run],
  );

  const logout = useCallback(async () => {
    setSession(undefined, undefined);
    await clearSession();
    setUser(undefined);
    setMessage(undefined);
    setError(undefined);
    setHint(undefined);
  }, []);

  const addEmail = useCallback(
    (email: string) =>
      run(async () => {
        const result = await saveAccountEmail(email);
        const stored = await loadSession();
        if (stored !== undefined) await persist(stored.token, result.user);
        setUser(result.user);
        setMessage(result.message);
      }),
    [run],
  );

  const forgot = useCallback(
    (username: string) =>
      run(async () => {
        const result = await forgotPassword(username);
        setMessage(result.message);
      }),
    [run],
  );

  const reset = useCallback(
    (token: string, password: string) =>
      run(async () => {
        const result = await resetPassword(token, password);
        await persist(result.token, result.user);
        setUser(result.user);
        setMessage('Password updated.');
      }),
    [run],
  );

  const verify = useCallback(
    (token: string) =>
      run(async () => {
        const result = await verifyAccountEmail(token);
        await persist(result.token, result.user);
        setUser(result.user);
        setMessage('Email confirmed. You can use Forgot password now.');
      }),
    [run],
  );

  const clearBanner = useCallback(() => {
    setError(undefined);
    setHint(undefined);
    setMessage(undefined);
  }, []);

  const value = useMemo<AuthApi>(
    () => ({
      ready,
      configured,
      user,
      busy,
      message,
      error,
      hint,
      register,
      login,
      logout,
      addEmail,
      forgot,
      reset,
      verify,
      clearBanner,
    }),
    [
      ready,
      configured,
      user,
      busy,
      message,
      error,
      hint,
      register,
      login,
      logout,
      addEmail,
      forgot,
      reset,
      verify,
      clearBanner,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const value = useContext(AuthContext);
  if (value === undefined) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
