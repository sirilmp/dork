import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authApi, AuthUser } from '../api/auth';
import { getToken, setToken as persistToken } from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  /** Used by the accept-invite flow, which already has a token+user from the accept response. */
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  setSession: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => persistToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    persistToken(result.token);
    setUser(result.user);
  }

  async function register(email: string, password: string, name: string) {
    const result = await authApi.register(email, password, name);
    persistToken(result.token);
    setUser(result.user);
  }

  function logout() {
    persistToken(null);
    setUser(null);
  }

  function setSession(token: string, nextUser: AuthUser) {
    persistToken(token);
    setUser(nextUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
