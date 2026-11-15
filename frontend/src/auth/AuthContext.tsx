import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchAuthSession, getCurrentUser, signIn, signOut, signUp, confirmSignUp } from 'aws-amplify/auth';

type AuthContextValue = {
  ready: boolean;
  signedIn: boolean;
  email?: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  confirm: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string>();
  const refresh = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setEmail(user.signInDetails?.loginId ?? user.username);
      await fetchAuthSession();
    } catch {
      setEmail(undefined);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const value = useMemo<AuthContextValue>(() => ({
    ready, signedIn: Boolean(email), email, refresh,
    login: async (username, password) => {
      const result = await signIn({ username, password });
      if (!result.isSignedIn) throw new Error(`Additional sign-in step required: ${result.nextStep.signInStep}`);
      await refresh();
    },
    register: async (username, password) => {
      await signUp({ username, password, options: { userAttributes: { email: username } } });
    },
    confirm: async (username, confirmationCode) => {
      await confirmSignUp({ username, confirmationCode });
    },
    logout: async () => { await signOut(); setEmail(undefined); },
  }), [ready, email, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
