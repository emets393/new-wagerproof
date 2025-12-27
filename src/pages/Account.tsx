import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, User, Lock } from 'lucide-react';
import { ModernAuthForm } from '@/components/ModernAuthForm';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { Input } from '@/components/ui/input';
import debug from '@/utils/debug';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export default function Account() {
  const { user, loading, signIn, signUp, signOut, signInWithProvider } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
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

  // Show user profile if authenticated
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Welcome Back!</CardTitle>
              <CardDescription>You're signed in as {user.email}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      {accessRestricted && !isUnlocked ? (
        <div className="shadow-input mx-auto w-full max-w-md rounded-2xl bg-white p-8 dark:bg-black">
          {/* Logo Section */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-indigo-500 rounded-xl blur-md opacity-30"></div>
              <div className="relative p-3 bg-gradient-to-br from-neutral-900 to-neutral-800 dark:from-neutral-100 dark:to-neutral-200 rounded-xl">
                <Lock className="h-16 w-16 text-white dark:text-black" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-neutral-800 dark:text-neutral-200">
            Access Restricted
          </h2>
          <p className="mt-2 text-center max-w-sm mx-auto text-sm text-neutral-600 dark:text-neutral-300">
            Enter the password to unlock sign in
          </p>

          <form className="mt-8" onSubmit={handlePasswordSubmit}>
            <div className="mb-6">
              <Label htmlFor="access-password" className="text-neutral-800 dark:text-neutral-200">
                Password
              </Label>
              <Input
                id="access-password"
                placeholder="Enter password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="mt-2"
                required
              />
            </div>

            {passwordError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <button
              className="bg-gradient-to-br relative group/btn from-black dark:from-zinc-900 dark:to-zinc-900 to-neutral-600 block dark:bg-zinc-800 w-full text-white rounded-md h-10 font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset]"
              type="submit"
            >
              Unlock &rarr;
              <BottomGradient />
            </button>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-300 dark:border-neutral-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-black text-neutral-500">
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