import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

// Lazy import Google Sign-In to avoid errors when native module isn't available
let GoogleSignin: any = null;
let googleSigninConfigured = false;

const configureGoogleSignIn = async () => {
  if (googleSigninConfigured) return;
  
  try {
    // Only import on native platforms
    if (Platform.OS !== 'web') {
      const googleSignInModule = await import('@react-native-google-signin/google-signin');
      GoogleSignin = googleSignInModule.GoogleSignin;
      
      GoogleSignin.configure({
        webClientId: '142325632215-5c9nahlmruos96rsiu60ac4uk2p2s1ua.apps.googleusercontent.com',
        iosClientId: '142325632215-agrfdkh87j01kgfa4uv4opuohl5l01lq.apps.googleusercontent.com',
        offlineAccess: true, // Enable to get serverAuthCode
      });
      
      googleSigninConfigured = true;
    }
  } catch (error) {
    console.warn('Google Sign-In module not available:', error);
    // Module not available, continue without it
  }
};

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
    // Configure Google Sign-In if available
    configureGoogleSignIn();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('=== AUTH STATE CHANGE ===');
        console.log('Event:', event);
        console.log('User:', session?.user?.email || 'no user');
        console.log('Session exists:', !!session);
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
        console.log('=== GOOGLE SIGN-IN START ===');

        await configureGoogleSignIn();

        if (!GoogleSignin) {
          console.error('Google Sign-In module not available');
          return { error: new Error('Google Sign-In is not available. Please rebuild the app with native modules.') };
        }

        // Check if Google Play Services are available (Android only)
        if (Platform.OS === 'android') {
          await GoogleSignin.hasPlayServices();
        }

        // Sign out first to show account picker
        try {
          await GoogleSignin.signOut();
        } catch (signOutError) {
          console.log('Could not clear previous Google sign-in:', signOutError);
        }

        // Sign in with Google
        const userInfo = await GoogleSignin.signIn();
        console.log('Google Sign-In response type:', userInfo?.type);

        // Get the ID token
        const idToken = userInfo?.data?.idToken || userInfo?.idToken;
        console.log('ID token received:', idToken ? 'yes' : 'no');

        if (!idToken) {
          return { error: new Error('No ID token received from Google') };
        }

        // Try using getTokens() to get a fresh token (might not have nonce)
        let tokenToUse = idToken;
        try {
          const tokens = await GoogleSignin.getTokens();
          if (tokens?.idToken) {
            console.log('Got fresh token from getTokens()');
            tokenToUse = tokens.idToken;
          }
        } catch (e) {
          console.log('getTokens() not available, using original token');
        }

        // Check if token has a nonce
        let hasNonce = false;
        try {
          const payload = JSON.parse(atob(tokenToUse.split('.')[1]));
          hasNonce = !!payload.nonce;
          console.log('Token has nonce:', hasNonce);
        } catch (e) {
          console.log('Could not decode token');
        }

        // Sign in to Supabase
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: tokenToUse,
        });

        if (error) {
          console.error('Supabase sign-in error:', error);
          return { error };
        }

        console.log('=== GOOGLE SIGN-IN SUCCESS ===');
        console.log('User:', data.user?.email);
        return { error: null };
        
      } else if (provider === 'apple') {
        // Native Apple Sign-In flow using expo-apple-authentication
        console.log('Starting native Apple Sign-In...');

        // Check if Apple Sign-In is available (iOS only)
        if (Platform.OS !== 'ios') {
          return { error: new Error('Apple Sign-In is only available on iOS') };
        }

        // Check availability
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
          return { error: new Error('Apple Sign-In is not available on this device') };
        }

        // Perform Apple Sign-In
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        console.log('Apple Sign-In credential received');

        if (!credential.identityToken) {
          console.error('No identity token received from Apple');
          return { error: new Error('No identity token received from Apple') };
        }

        console.log('Identity token received, signing in to Supabase...');

        // Sign in to Supabase using the Apple identity token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) {
          console.error('Supabase Apple sign-in error:', error);
          return { error };
        }

        console.log('Supabase session created successfully via Apple:', data.user?.email);
        return { error: null };
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

      // Handle Apple Sign-In specific errors
      if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED') {
        return { error: new Error('User cancelled sign-in') };
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

      // Sign out from Google Sign-In first (if available and signed in)
      // This clears the cached Google account so users can pick a different account next time
      if (GoogleSignin) {
        try {
          const isGoogleSignedIn = await GoogleSignin.isSignedIn();
          if (isGoogleSignedIn) {
            await GoogleSignin.signOut();
            console.log('Signed out from Google Sign-In');
          }
        } catch (googleError) {
          // Don't block Supabase sign-out if Google sign-out fails
          console.warn('Google sign-out error (continuing with Supabase sign-out):', googleError);
        }
      }

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

