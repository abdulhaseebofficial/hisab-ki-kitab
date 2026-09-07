import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import authService from './api/authApi';
import { setSessionExpiredHandler, getErrorMessage } from '../../shared/api/client';

const AuthContext = createContext(null);

/**
 * Owns the signed-in student, and restores the session on boot.
 *
 * Nothing is read from localStorage any more - the access token is not stored
 * anywhere a script can reach it. A fresh page load therefore starts with no
 * token in memory and two ways back in, tried in order:
 *
 *   /auth/me       the httpOnly access cookie authenticates it directly. This
 *                  is the common case and costs no rotation.
 *
 *   /auth/refresh  the access cookie has expired, so the longer-lived refresh
 *                  cookie mints a new session.
 *
 * Trying /auth/me first matters: refreshing on every reload would rotate the
 * refresh token every time somebody pressed F5.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  // The axios interceptor calls this when a refresh attempt finally fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      toast.error('Your session expired. Please log in again.');
    });
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        // The access cookie is sent automatically; no token in memory is the
        // normal state on a fresh load, not a signed-out one.
        const me = await authService.me();
        if (!cancelled) setUser(me);
      } catch {
        try {
          // The access cookie has expired. The refresh cookie outlives it by a
          // long way, and this is exactly what it is for.
          const refreshed = await authService.refresh();
          if (!cancelled) setUser(refreshed);
        } catch {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const loggedIn = await authService.login(credentials);
    setUser(loggedIn);
    toast.success(`Welcome back, ${loggedIn.name.split(' ')[0]}!`);
    return loggedIn;
  }, []);

  const register = useCallback(async (payload) => {
    const created = await authService.register(payload);
    setUser(created);
    toast.success('Account created. Let us set things up.');
    return created;
  }, []);

  /**
   * Signs in with a Google credential, and reports whether the account is new
   * so the caller can send a first timer to onboarding rather than a dashboard
   * with nothing on it yet.
   */
  const loginWithGoogle = useCallback(async (idToken) => {
    const result = await authService.google(idToken);
    setUser(result.user);
    toast.success(result.created ? 'Account created. Let us set things up.' : 'Welcome back.');
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    toast.success('Logged out');
  }, []);

  /** Merge a partial update (profile edit, onboarding) into the cached user. */
  const updateUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      needsOnboarding: Boolean(user) && !user.onboardingCompleted,
      currency: user ? user.currency : 'INR',
      login,
      loginWithGoogle,
      register,
      logout,
      updateUser,
      refreshUser,
    }),
    [user, loading, login, loginWithGoogle, register, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};

export default AuthContext;
