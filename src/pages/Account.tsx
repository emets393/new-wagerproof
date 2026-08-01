import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { ModernAuthForm } from '@/components/ModernAuthForm';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { Input } from '@/components/ui/input';
import debug from '@/utils/debug';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/lib/routes';
import { useOAuthErrorParam } from '@/hooks/useOAuthErrorParam';

export default function Account() {
  const { user, loading, signIn, signUp, signOut, signInWithProvider } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // A failed provider handshake comes back as a redirect param, not a thrown error.
  const oauthError = useOAuthErrorParam();
  useEffect(() => {
    if (oauthError) setError(oauthError);
  }, [oauthError]);
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [accessRestricted, setAccessRestricted] = useState(true);

  // Fetch access_restricted setting
  useEffect(() => {
    async function fetchAccessRestricted() {
      try {
        const { data, error } = await (supabase as any)
          .from('site_settings')
          .select('access_restricted')
          .single();
        
        if (error) {
          debug.error('Error fetching access_restricted setting:', error);
          setAccessRestricted(true); // Default to true if error
        } else {
          setAccessRestricted(data?.access_restricted ?? true);
        }
      } catch (err) {
        debug.error('Unexpected error fetching access_restricted setting:', err);
        setAccessRestricted(true); // Default to true if error
      }
    }

    fetchAccessRestricted();
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '3393') {
      setIsUnlocked(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const handleSubmit = async (email: string, password: string, action: 'login' | 'signup') => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = action === 'login' 
        ? await signIn(email, password, false)
        : await signUp(email, password);

      if (error) {
        setError(error.message);
      } else if (action === 'signup') {
        setSuccess('Check your email for the confirmation link!');
      } else if (action === 'login') {
        // OnboardingGuard will handle redirection based on onboarding status
        localStorage.setItem('wagerproof_show_welcome', 'true');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const { error } = await signInWithProvider('google');
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const { error } = await signInWithProvider('apple');
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      debug.log('Account page: Starting handleSignOut...');
      // Clear the welcome flag so next login will show it
      localStorage.removeItem('wagerproof_show_welcome');
      debug.log('Account page: Calling signOut...');
      await signOut();
      debug.log('Account page: signOut completed, navigating to /...');
      navigate('/', { replace: true });
      debug.log('Account page: Navigation completed');
    } catch (error) {
      debug.error('Account page: Error in handleSignOut:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication entry points should land on useful content, not an
  // intermediate confirmation card. The authenticated shell shows the
  // one-time welcome toast after this redirect.
  if (user) {
    return <Navigate to={DEFAULT_AUTHENTICATED_ROUTE} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4 text-black dark:bg-black dark:text-white">
      {accessRestricted && !isUnlocked ? (
        <div className="mx-auto w-full max-w-md rounded-[28px] border border-black/10 bg-white p-8 shadow-2xl shadow-black/10 dark:border-white/10 dark:bg-black dark:shadow-black/50">
          {/* Logo Section */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-xl" />
              <div className="relative rounded-2xl border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <Lock className="h-16 w-16 text-black dark:text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-center text-2xl font-semibold tracking-[-0.02em] text-black dark:text-white">
            Access Restricted
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm text-black/55 dark:text-white/55">
            Enter the password to unlock sign in
          </p>

          <form className="mt-8" onSubmit={handlePasswordSubmit}>
            <div className="mb-6">
              <Label htmlFor="access-password" className="text-xs tracking-[0.02em] text-black/65 dark:text-white/65">
                Password
              </Label>
              <Input
                id="access-password"
                placeholder="Enter password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="mt-2 h-11 border-black/10 bg-black/[0.04] text-black placeholder:text-black/30 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30"
                required
              />
            </div>

            {passwordError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <button
              className="group/btn relative block h-11 w-full rounded-xl bg-black font-medium text-white transition hover:bg-black/85 active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-white/90"
              type="submit"
            >
              Unlock &rarr;
              <BottomGradient />
            </button>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-black/10 dark:border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-black/40 dark:bg-black dark:text-white/40">
                    Don't have access?
                  </span>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <MovingBorderButton
                  as="a"
                  href="https://wagerproof.carrd.co/"
                  target="_blank"
                  rel="noopener noreferrer"
                  borderRadius="0.9rem"
                  containerClassName="h-12 w-full"
                  className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-honeydew-600 dark:text-honeydew-400 font-semibold border-gray-300 dark:border-gray-600"
                  borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]"
                  duration={2500}
                >
                  <span className="px-4">Join the Waitlist</span>
                </MovingBorderButton>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <ModernAuthForm
          onSubmit={handleSubmit}
          onGoogleSignIn={handleGoogleSignIn}
          onAppleSignIn={handleAppleSignIn}
          isLoading={isLoading}
          error={error}
          success={success}
          mode={mode}
          onModeChange={setMode}
        />
      )}
    </div>
  );
}

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};
