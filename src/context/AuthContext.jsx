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

      const { data: membershipData } = await supabase
        .from('business_members')
        .select('*, businesses(*)')
        .eq('profile_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      const { data: systemInit } = await supabase.rpc('check_system_initialized');

      // If system initialized and user has no active business membership -> Revoked User
      if (systemInit && (!membershipData || !membershipData.business_id)) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        if (window.api && window.api.clearAuthSession) {
          window.api.clearAuthSession();
        }
        return null;
      }

      if (profileData) {
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

      if (currentSession?.user) {
        const fetchedProf = await fetchProfile(currentSession.user.id);
        if (fetchedProf && fetchedProf.business_id) {
          setSession(currentSession);
          setUser(currentSession.user);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } else {
        setSession(null);
        setUser(null);
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
      if (newSession?.user) {
        const fetchedProf = await fetchProfile(newSession.user.id);
        if (fetchedProf && fetchedProf.business_id) {
          setSession(newSession);
          setUser(newSession.user);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } else {
        setSession(null);
        setUser(null);
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

    if (data?.user) {
      const fetchedProf = await fetchProfile(data.user.id);
      if (!fetchedProf || !fetchedProf.business_id) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        if (window.api && window.api.clearAuthSession) {
          window.api.clearAuthSession();
        }
        return {
          data: null,
          error: new Error('Your account access has been revoked by the business owner.')
        };
      }
      setSession(data.session);
      setUser(data.user);
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

    // 1. Verify invitation token via RPC
    const { data: invites, error: inviteError } = await supabase
      .rpc('verify_invitation', { invite_token: token });

    if (inviteError || !invites || invites.length === 0) {
      throw new Error('Invalid, expired, or already used invitation token');
    }

    const invite = invites[0];

    // 2. SignUp auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (authError) throw authError;

    // 3. Obtain authenticated session
    let currentSession = authData?.session;
    if (!currentSession) {
      const { data: sessionRes } = await supabase.auth.getSession();
      currentSession = sessionRes?.session;
    }

    if (!currentSession) {
      const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
      currentSession = signInData?.session;
    }

    if (!currentSession || !currentSession.user) {
      throw new Error('No authenticated session exists after sign up. Please check your email or sign in.');
    }

    // 4. Create business member link with active authenticated session
    const { error: memberError } = await supabase
      .from('business_members')
      .upsert({
        business_id: invite.business_id,
        profile_id: currentSession.user.id,
        role: invite.role || 'staff',
        status: 'active'
      }, { onConflict: 'business_id,profile_id' });

    if (memberError) {
      console.error('Error creating business_member:', memberError);
      throw new Error(`Failed to join team: ${memberError.message}`);
    }

    // 5. Update invitation status to accepted
    await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invite.id);

    // 6. Refresh auth state
    setSession(currentSession);
    setUser(currentSession.user);
    await fetchProfile(currentSession.user.id);

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
