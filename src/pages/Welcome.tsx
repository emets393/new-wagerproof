import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, BarChart3, Target, TrendingUp, Brain, Lock } from 'lucide-react';
import { ModernAuthForm } from '@/components/ModernAuthForm';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Welcome() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Redirect authenticated users to WagerBot chat with welcome message
  useEffect(() => {
    if (user && !loading) {
      // On every login, redirect to WagerBot Chat with welcome message
      localStorage.setItem('wagerproof_show_welcome', 'true');
      navigate('/wagerbot-chat', { replace: true });
    }
  }, [user, loading, navigate]);

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
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Brain,
      title: "Pattern Recognition",
      description: "Identify profitable betting trends with advanced AI algorithms"
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Live game data and comprehensive performance metrics"
    },
    {
      icon: TrendingUp,
      title: "ROI Tracking",
      description: "Monitor and optimize your betting performance over time"
    },
    {
      icon: Target,
      title: "Custom Models",
      description: "Build personalized prediction algorithms tailored to your strategy"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-primary/80 relative overflow-hidden">
      {/* Additional gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-accent/5 to-accent/10"></div>
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-4rem)]">
          
          {/* Left Side - Branding & Features */}
          <div className="space-y-8">
            {/* Logo and Hero */}
            <div className="text-center lg:text-left space-y-6">
              <div className="flex justify-center lg:justify-start">
                <div className="p-6 bg-white rounded-xl shadow-lg">
                  <img 
                    src="/lovable-uploads/40569607-0bf3-433c-a0f5-bca0ee0de005.png" 
                    alt="WAGER PROOF" 
                    className="h-60 w-auto" 
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-bold text-accent drop-shadow-lg">
                  Advanced Baseball Analytics
                </h1>
                <p className="text-xl text-white/90">
                  Data-driven insights for serious bettors. Make informed decisions with professional-grade analytics.
                </p>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="p-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 rounded-lg bg-accent/20">
                      <feature.icon className="h-6 w-6 text-accent" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm text-white/80">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Password Gate or Authentication Forms */}
          <div className="flex justify-center lg:justify-end">
            {!isUnlocked ? (
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
                isLoading={isLoading}
                error={error}
                success={success}
                mode={mode}
                onModeChange={setMode}
              />
            )}
          </div>
        </div>
      </div>
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