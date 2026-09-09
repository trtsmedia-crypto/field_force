import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api, tokens } from './api';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string;
  role: string;
  employee_id: string | null;
  full_name: string | null;
}

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    const refreshToken = tokens.refresh;
    tokens.clear();
    setUser(null);
    if (refreshToken) {
      api('/auth/logout', {
        method: 'POST',
        body: { refreshToken },
        skipAuth: true,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onSignedOut = () => setUser(null);
    window.addEventListener('ff:signed-out', onSignedOut);
    return () => window.removeEventListener('ff:signed-out', onSignedOut);
  }, []);

  useEffect(() => {
    if (!tokens.access) {
      setLoading(false);
      return;
    }
    api<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const data = await api<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; role: string };
    }>('/auth/login', {
      method: 'POST',
      body: { identifier, password, device: 'Admin web' },
      skipAuth: true,
    });

    tokens.set(data.accessToken, data.refreshToken);
    const me = await api<AuthUser>('/auth/me');

    // The admin console is for office roles. Field staff use the mobile app.
    if (me.role === 'FIELD_SALESMAN') {
      tokens.clear();
      throw new Error(
        'This account is a field employee. Sign in from the mobile app instead.',
      );
    }
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
