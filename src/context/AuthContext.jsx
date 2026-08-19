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
  const isSigningUpRef = React.useRef(false);

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
      // Skip automatic signout if invite signup is actively in progress
      if (systemInit && (!membershipData || !membershipData.business_id) && !isSigningUpRef.current) {
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
        let isSuperAdmin = profileData.is_super_admin === true;
        if (!isSuperAdmin && membershipData?.role === 'owner') {
          try {
            const { data: firstBiz } = await supabase
              .from('businesses')
              .select('id')
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            if (firstBiz && firstBiz.id === membershipData.business_id) {
              isSuperAdmin = true;
            }
          } catch {
            // fallback
          }
        }

        const fullProfile = {
          ...profileData,
          role: membershipData?.role,
          business_id: membershipData?.business_id,
          business: membershipData?.businesses,
          is_super_admin: isSuperAdmin
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
        } else if (!isSigningUpRef.current) {
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
      if (isSigningUpRef.current) {
        return;
      }
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
    isSigningUpRef.current = true;

    try {
      // 1. Verify invitation token via RPC
      const { data: invites, error: inviteError } = await supabase
        .rpc('verify_invitation', { invite_token: token });

      if (inviteError || !invites || invites.length === 0) {
        throw new Error('Invalid, expired, or already used invitation token');
      }

      const invite = invites[0];

      // 2. Create user account via signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }
        }
      });

      if (authError) {
        const errorMsg = (authError.message || '').toLowerCase();
        const isExistingUser = errorMsg.includes('already registered') || errorMsg.includes('already exists') || authError.code === 'user_already_exists';
        if (!isExistingUser) {
          throw authError;
        }
      }

      // 3. Authenticate IMMEDIATELY so Supabase client attaches the Bearer token for RLS REST calls
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.session) {
        if (signInError?.message?.toLowerCase().includes('invalid login credentials')) {
          throw new Error('An account with this email already exists. Please enter your existing account password or use a different email address.');
        }
        if (signInError?.message?.toLowerCase().includes('email not confirmed')) {
          throw new Error('Email is not confirmed yet. Please verify your email or disable "Confirm email" in Supabase Auth settings.');
        }
        throw new Error(signInError?.message || 'Failed to authenticate newly created account.');
      }

      const currentSession = signInData.session;
      const authUser = signInData.user;

      // 4. Create profile record (Authenticated request)
      try {
        await supabase.from('profiles').upsert({
          id: authUser.id,
          email: email,
          full_name: name
        }, { onConflict: 'id' });
      } catch {
        // Ignore if handled by trigger
      }

      // 5. Insert business_members record (Authenticated request using insert, NOT upsert)
      const { error: memberError } = await supabase
        .from('business_members')
        .insert([{
          business_id: invite.business_id,
          profile_id: authUser.id,
          role: invite.role || 'staff',
          status: 'active'
        }]);

      if (memberError && !memberError.message.includes('duplicate key')) {
        console.error('Error creating business_member:', memberError);
        throw new Error(`Failed to join team: ${memberError.message}`);
      }

      // 6. Update invitation status to accepted (Authenticated request)
      try {
        await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invite.id);
      } catch {
        // Ignore update error
      }

      // 7. Update AuthContext state with active session and fetch profile
      setSession(currentSession);
      setUser(authUser);
      await fetchProfile(authUser.id);

      return { data: authData, error: null };
    } finally {
      isSigningUpRef.current = false;
    }
  };

  const registerBusinessWithInvite = async (email, password, name, businessName, token) => {
    if (!supabase) throw new Error('Supabase client not initialized');
    isSigningUpRef.current = true;

    try {
      // 1. Verify invitation token via RPC
      const { data: invites, error: inviteError } = await supabase
        .rpc('verify_business_invitation', { invite_token: token });

      if (inviteError || !invites || invites.length === 0) {
        throw new Error('Invalid, expired, or already used business invitation link');
      }

      // 2. Create user account via signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }
        }
      });

      if (authError) {
        const errorMsg = (authError.message || '').toLowerCase();
        const isExistingUser = errorMsg.includes('already registered') || errorMsg.includes('already exists') || authError.code === 'user_already_exists';
        if (!isExistingUser) {
          throw authError;
        }
      }

      // 3. Authenticate to establish session
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.session) {
        if (signInError?.message?.toLowerCase().includes('invalid login credentials')) {
          throw new Error('An account with this email already exists. Please enter your existing account password or use a different email address.');
        }
        if (signInError?.message?.toLowerCase().includes('email not confirmed')) {
          throw new Error('Email is not confirmed yet. Please verify your email or disable "Confirm email" in Supabase Auth settings.');
        }
        throw new Error(signInError?.message || 'Failed to authenticate newly created account.');
      }

      const currentSession = signInData.session;
      const authUser = signInData.user;

      // 4. Call register_business_with_invite RPC (creates business, assigns owner, burns token)
      const { data: newBizId, error: rpcError } = await supabase
        .rpc('register_business_with_invite', {
          invite_token: token,
          biz_name: businessName,
          o_name: name
        });

      if (rpcError) {
        console.error('Error in register_business_with_invite:', rpcError);
        throw new Error(rpcError.message || 'Failed to register business');
      }

      // 5. Update AuthContext state
      setIsInitialized(true);
      setSession(currentSession);
      setUser(authUser);
      await fetchProfile(authUser.id);

      return { data: { ...authData, business_id: newBizId }, error: null };
    } finally {
      isSigningUpRef.current = false;
    }
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
      registerBusinessWithInvite,
      signOut,
      resetPassword,
      refreshAuthState
    }}>
      {children}
    </AuthContext.Provider>
  );
}
