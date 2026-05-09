import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(null);
  const [ready, setReady] = useState(false);
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const fr = await api('/api/auth/first-run');
        if (!cancelled) setFirstRun(fr.firstRun);
        if (getToken()) {
          const me = await api('/api/auth/me');
          if (!cancelled) setPlayer(me.player);
        }
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, pin) => {
    const { token, player } = await api('/api/auth/login', {
      method: 'POST',
      body: { username, pin },
    });
    setToken(token);
    setPlayer(player);
    setFirstRun(false);
    return player;
  }, []);

  const register = useCallback(async (username, pin) => {
    const { token, player } = await api('/api/auth/register', {
      method: 'POST',
      body: { username, pin },
    });
    setToken(token);
    setPlayer(player);
    setFirstRun(false);
    return player;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setPlayer(null);
  }, []);

  return (
    <AuthContext.Provider value={{ player, ready, firstRun, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
