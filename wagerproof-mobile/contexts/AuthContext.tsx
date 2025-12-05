import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '142325632215-5c9nahlmruos96rsiu60ac4uk2p2s1ua.apps.googleusercontent.com',
  offlineAccess: false,
});

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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email || 'no user');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    // TODO: Update with your app's redirect URL
    const redirectUrl = 'wagerproof://';
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
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
    try {
      if (provider === 'google') {
        // Native Google Sign-In flow
        console.log('Starting native Google Sign-In...');
        
        // Check if Google Play Services are available
        await GoogleSignin.hasPlayServices();
        
        // Sign in with Google and get user info including ID token
        const userInfo = await GoogleSignin.signIn();
        console.log('Google Sign-In response:', JSON.stringify(userInfo, null, 2));
        
        // Get the ID token from Google Sign-In
        // Note: The response structure can vary, check both possible locations
        const idToken = userInfo?.data?.idToken || userInfo?.idToken;
        
        if (!idToken) {
          console.error('No ID token received from Google. Response:', userInfo);
          return { error: new Error('No ID token received from Google') };
        }
        
        console.log('ID token received, signing in to Supabase...');
        
        // Sign in to Supabase using the Google ID token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        
        if (error) {
          console.error('Supabase sign-in error:', error);
          return { error };
        }
        
        console.log('Supabase session created successfully:', data.user?.email);
        return { error: null };
        
      } else if (provider === 'apple') {
        // Apple Sign-In not yet implemented for mobile
        // TODO: Implement native Apple Sign-In
        console.log('Apple Sign-In not yet implemented for mobile');
        return { error: new Error('Apple Sign-In not yet implemented for mobile') };
      }
      
      return { error: new Error(`Unknown provider: ${provider}`) };
      
    } catch (error: any) {
      console.error('Sign-in error:', error);
      
      // Handle specific Google Sign-In errors
      if (error.code === 'SIGN_IN_CANCELLED') {
        return { error: new Error('User cancelled sign-in') };
      } else if (error.code === 'IN_PROGRESS') {
        return { error: new Error('Sign-in already in progress') };
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        return { error: new Error('Google Play Services not available') };
      }
      
      return { error: error as Error };
    }
  };

  const sendPasswordReset = async (email: string) => {
    const redirectUrl = 'wagerproof://reset-password';
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
      console.log('Starting sign out process...');
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase sign out error:', error);
        throw error;
      }
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
      // Clear local state even if server logout fails
      setSession(null);
      setUser(null);
    } finally {
      setSigningOut(false);
      console.log('Sign out process completed');
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

