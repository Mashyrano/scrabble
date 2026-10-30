import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase, toAppUser } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // getSession also finishes any sign-in carried in the URL (Google, reset links).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoadingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const user = useMemo(() => toAppUser(session?.user), [session]);

  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!session,
      isLoadingAuth,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
