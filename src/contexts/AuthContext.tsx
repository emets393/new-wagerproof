import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import debug from '@/utils/debug';
import { identifyUser, trackSignIn, trackSignUp, trackSignOut, resetTracking } from '@/lib/mixpanel';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signingOut: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: any }>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<{ error: any }>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        debug.log('Auth state change:', event, session?.user?.email || 'no user');
        
        // If user just signed in (including OAuth), set welcome flag
        // OnboardingGuard will handle the redirection logic based on onboarding status
        if (event === 'SIGNED_IN' && session?.user) {
          debug.log('✅ User signed in, setting welcome flag');
          localStorage.setItem('wagerproof_show_welcome', 'true');
          
          // Track sign in and identify user for Mixpanel
          const userId = session.user.id;
          const userEmail = session.user.email || 'unknown';
          
          // Extract user's name from metadata
          const userName = session.user.user_metadata?.full_name || 
                          session.user.user_metadata?.display_name || 
                          session.user.user_metadata?.name ||
                          null;
          
          // Determine auth method from user metadata
          let authMethod: 'email' | 'google' | 'apple' = 'email';
          
          // Check app_metadata.provider first
          if (session.user.app_metadata?.provider) {
            const provider = session.user.app_metadata.provider.toLowerCase();
            if (provider === 'google') authMethod = 'google';
            else if (provider === 'apple') authMethod = 'apple';
          } 
          // Fallback to checking identities array
          else if (session.user.identities && session.user.identities.length > 0) {
            const provider = session.user.identities[0].provider.toLowerCase();
            if (provider === 'google') authMethod = 'google';
            else if (provider === 'apple') authMethod = 'apple';
          }
          
          // Identify user in Mixpanel with standard properties
          identifyUser(userId, {
            $email: userEmail,  // Mixpanel standard property
            $name: userName,    // Mixpanel standard property
            email: userEmail,   // Custom property for backward compatibility
            name: userName,     // Custom property for backward compatibility
            auth_method: authMethod,
            user_id: userId,
            last_login: new Date().toISOString(),
          });
          
          // Track sign in event
          trackSignIn(authMethod);
          
          debug.log(`[Mixpanel] User signed in: ${userEmail}${userName ? ` (${userName})` : ''} via ${authMethod}`);
        }
        
        // Track sign out
        if (event === 'SIGNED_OUT') {
          debug.log('User signed out, resetting Mixpanel tracking');
          resetTracking();
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    // Track successful sign up and identify user immediately
    if (!error && data.user) {
      const userId = data.user.id;
      const userEmail = data.user.email || email;
      const userName = data.user.user_metadata?.full_name || 
                       data.user.user_metadata?.display_name || 
                       null;
      
      // Identify user in Mixpanel with their email and name
      identifyUser(userId, {
        $email: userEmail,
        $name: userName,
        email: userEmail,
        name: userName,
        auth_method: 'email',
        user_id: userId,
        signup_date: new Date().toISOString(),
      });
      
      // Track sign up event
      trackSignUp('email');
      debug.log(`[Mixpanel] User signed up via email: ${userEmail}${userName ? ` (${userName})` : ''}`);
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signInWithProvider = async (provider: 'google' | 'apple') => {
    const redirectUrl = `${window.location.origin}/wagerbot-chat`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        queryParams: { prompt: 'consent' }
      }
    });
    return { error };
  };

  const sendPasswordReset = async (email: string) => {
    const redirectUrl = `${window.location.origin}/account?reset=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const signOut = async () => {
    try {
      debug.log('Starting sign out process...');
      setSigningOut(true);
      
      // Calculate session duration if possible
      let sessionDuration: number | undefined;
      if (session?.expires_at) {
        const sessionStart = (session as any).created_at;
        if (sessionStart) {
          sessionDuration = Math.floor((Date.now() / 1000) - sessionStart);
        }
      }
      
      // Track sign out before clearing session
      trackSignOut(sessionDuration);
      debug.log('[Mixpanel] User signed out');
      
      // Clear the welcome flag so next login will show welcome message
      localStorage.removeItem('wagerproof_show_welcome');
      debug.log('Calling supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        debug.error('Supabase sign out error:', error);
        throw error;
      }
      debug.log('Sign out successful');
    } catch (error) {
      debug.error('Sign out error:', error);
      // Clear local state even if server logout fails
      setSession(null);
      setUser(null);
      // Reset tracking even on error
      resetTracking();
    } finally {
      setSigningOut(false);
      debug.log('Sign out process completed');
    }
  };

  const value = {
    user,
    session,
    loading,
    signingOut,
    signUp,
    signIn,
    signInWithProvider,
    sendPasswordReset,
    updatePassword,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}