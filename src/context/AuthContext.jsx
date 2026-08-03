import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isInitialized, setIsInitialized] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    if (!supabase || !userId) return null;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        const { data: membershipData } = await supabase
          .from('business_members')
          .select('*, businesses(*)')
          .eq('profile_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        const fullProfile = {
          ...profileData,
          role: membershipData?.role,
          business_id: membershipData?.business_id,
          business: membershipData?.businesses
        };

        setProfile(fullProfile);

        if (window.api && window.api.setAuthSession) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            window.api.setAuthSession(currentSession, fullProfile);
          }
        }
        return fullProfile;
      }
    } catch {
      // Profile fetch fallback
    }
    return null;
  }, []);

  const refreshAuthState = useCallback(async () => {
    if (!supabase) {
      setIsInitialized(false);
      setLoading(false);
      return;
    }

    try {
      const { data: initData } = await supabase.rpc('check_system_initialized');
      setIsInitialized(initData === true);
    } catch {
      setIsInitialized(false);
    }

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }
    } catch {
      setSession(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    refreshAuthState();

    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [refreshAuthState, fetchProfile]);

  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error };

    setSession(data.session);
    setUser(data.user);
    if (data.user) {
      await fetchProfile(data.user.id);
    }
    return { data, error: null };
  };

  const signUp = async (email, password, name, businessName) => {
    if (!supabase) throw new Error('Supabase client not initialized');

    if (isInitialized) {
      throw new Error('System is already initialized. Please ask for an invitation to join.');
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (authError) throw authError;

    // 2. Obtain session (check authData.session or supabase.auth.getSession())
    let currentSession = authData?.session;
    if (!currentSession) {
      const { data: sessionRes } = await supabase.auth.getSession();
      currentSession = sessionRes?.session;
    }

    // 3. Fallback to signInWithPassword if auto-confirm is enabled but session was not returned directly
    if (!currentSession) {
      const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
      currentSession = signInData?.session;
    }

    // 4. Verify authenticated session exists before initialize_system
    if (!currentSession || !currentSession.user) {
      throw new Error('No authenticated session exists after sign up. Please check your email for confirmation or sign in.');
    }

    // 5. Call initialize_system RPC with active session
    const { error: initError } = await supabase.rpc('initialize_system', {
      biz_name: businessName,
      o_name: name
    });

    if (initError) throw initError;

    // 6. Refresh auth state
    setIsInitialized(true);
    setSession(currentSession);
    setUser(currentSession.user);
    await fetchProfile(currentSession.user.id);

    return { data: authData, error: null };
  };

  const signUpWithInvite = async (email, password, name, token) => {
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data: invite, error: inviteError } = await supabase
      .rpc('verify_invitation', { invite_token: token })
      .single();

    if (inviteError || !invite) throw new Error('Invalid or expired invitation token');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });
    if (authError) throw authError;

    let currentSession = authData?.session;
    if (!currentSession) {
      const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
      currentSession = signInData?.session;
    }

    if (authData?.user) {
      const { error: memberError } = await supabase
        .from('business_members')
        .insert([{
          business_id: invite.business_id,
          profile_id: authData.user.id,
          role: invite.role,
          status: 'active'
        }]);
      if (memberError) throw memberError;

      await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invite.id);
    }

    if (currentSession?.user) {
      setSession(currentSession);
      setUser(currentSession.user);
      await fetchProfile(currentSession.user.id);
    }

    return { data: authData, error: null };
  };

  const signOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signout errors
      }
    }
    setSession(null);
    setUser(null);
    setProfile(null);

    if (window.api && window.api.clearAuthSession) {
      window.api.clearAuthSession();
    }
  };

  const resetPassword = async (email) => {
    if (!supabase) throw new Error('Supabase client not initialized');
    return await supabase.auth.resetPasswordForEmail(email);
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      loading,
      isInitialized,
      signIn,
      signUp,
      signUpWithInvite,
      signOut,
      resetPassword,
      refreshAuthState
    }}>
      {children}
    </AuthContext.Provider>
  );
}
