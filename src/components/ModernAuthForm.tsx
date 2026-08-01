import React, { useState } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import {
  IconBrandGoogle,
  IconBrandApple,
} from "@tabler/icons-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Loader2 } from "lucide-react";

interface ModernAuthFormProps {
  onSubmit: (email: string, password: string, action: 'login' | 'signup') => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
  onAppleSignIn?: () => Promise<void>;
  isLoading: boolean;
  error: string;
  success: string;
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
}

export function ModernAuthForm({
  onSubmit,
  onGoogleSignIn,
  onAppleSignIn,
  isLoading,
  error,
  success,
  mode,
  onModeChange
}: ModernAuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [matchError, setMatchError] = useState('');
  const [isEighteenPlus, setIsEighteenPlus] = useState(false); // New state for the checkbox

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setMatchError(''); // Clear previous password mismatch error

    if (mode === 'signup' && password !== confirmPassword) {
      setMatchError('Passwords do not match.');
      return;
    }

    if (mode === 'signup' && !isEighteenPlus) {
      setMatchError('You must confirm you are 18+ and understand the platform is for analytics only.');
      return;
    }
    
    await onSubmit(email, password, mode);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] border border-white/10 bg-black p-6 text-white shadow-2xl shadow-black/50 sm:p-8">
      {/* Logo Section */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-xl" />
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <img 
              src="/wagerproofGreenLight.png" 
              alt="WAGERPROOF" 
              className="hidden h-16 w-auto rounded-lg object-contain"
            />
            <img 
              src="/wagerproofGreenDark.png" 
              alt="WAGERPROOF" 
              className="block h-16 w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      </div>

      <h2 className="text-center text-2xl font-semibold tracking-[-0.02em] text-white">
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-white/55">
        {mode === 'login' 
          ? 'Access your account'
          : 'Get started with professional sports betting analytics'
        }
      </p>

      <form className="mt-8" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="mb-4 flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
            <LabelInputContainer>
              <Label htmlFor="firstname" className="text-xs tracking-[0.02em] text-white/65">First name</Label>
              <Input 
                id="firstname" 
                placeholder="John" 
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-emerald-400/60"
              />
            </LabelInputContainer>
            <LabelInputContainer>
              <Label htmlFor="lastname" className="text-xs tracking-[0.02em] text-white/65">Last name</Label>
              <Input 
                id="lastname" 
                placeholder="Doe" 
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-emerald-400/60"
              />
            </LabelInputContainer>
          </div>
        )}
        
        <LabelInputContainer className="mb-4">
          <Label htmlFor="email" className="text-xs tracking-[0.02em] text-white/65">Email address</Label>
          <Input 
            id="email" 
            placeholder="you@example.com" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            className="h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-emerald-400/60"
          />
        </LabelInputContainer>
        
        <LabelInputContainer className="mb-8">
          <Label htmlFor="password" className="text-xs tracking-[0.02em] text-white/65">Password</Label>
          <Input
            id="password"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            className="h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-emerald-400/60"
          />
        </LabelInputContainer>

        {mode === 'signup' && (
          <LabelInputContainer className="mb-8">
            <Label htmlFor="confirm-password" className="text-xs tracking-[0.02em] text-white/65">Confirm password</Label>
            <Input
              id="confirm-password"
              placeholder="••••••••"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
              className="h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-emerald-400/60"
            />
          </LabelInputContainer>
        )}

        {mode === 'signup' && (
          <div className="mb-8 flex items-center">
            <input
              type="checkbox"
              id="age-confirmation"
              checked={isEighteenPlus}
              onChange={(e) => setIsEighteenPlus(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/10 accent-emerald-400 focus:ring-emerald-400"
              disabled={isLoading}
            />
            <label htmlFor="age-confirmation" className="ml-2 block text-sm text-white/65">
              I am 18+ and understand this platform is for analytics only.
            </label>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {matchError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{matchError}</AlertDescription>
          </Alert>
        )}

        <button
          className="group/btn relative block h-11 w-full rounded-xl bg-white font-medium text-black transition duration-150 hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </span>
          ) : (
            <>
              {mode === 'login' ? 'Sign in' : 'Sign up'} &rarr;
            </>
          )}
          <BottomGradient />
        </button>

        <div className="my-7 flex items-center gap-3 text-[11px] uppercase tracking-[0.08em] text-white/35 before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">or</div>

        <div className="flex flex-col space-y-4">
          <button
            className="group/btn relative flex h-11 w-full items-center justify-center space-x-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 font-medium text-white transition hover:bg-white/10 active:scale-[0.98]"
            type="button"
            onClick={onGoogleSignIn}
            disabled={isLoading}
          >
            <IconBrandGoogle className="h-4 w-4 text-white/80" />
            <span className="text-sm text-white/80">
              Sign in with Google
            </span>
            <BottomGradient />
          </button>
          <button
            className="group/btn relative flex h-11 w-full items-center justify-center space-x-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 font-medium text-white transition hover:bg-white/10 active:scale-[0.98]"
            type="button"
            onClick={onAppleSignIn}
            disabled={isLoading}
          >
            <IconBrandApple className="h-4 w-4 text-white/80" />
            <span className="text-sm text-white/80">
              Sign in with Apple
            </span>
            <BottomGradient />
          </button>
        </div>

        {/* Mode Switcher Link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onModeChange(mode === 'login' ? 'signup' : 'login')}
            className="min-h-11 text-sm text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            disabled={isLoading}
          >
            {mode === 'login' 
              ? "Create Account?"
              : "Already have an account?"
            }
          </button>
        </div>
      </form>
    </div>
  );
}

const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-8 -bottom-px block h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent opacity-0 transition duration-200 group-hover/btn:opacity-100" />
    </>
  );
};

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex w-full flex-col space-y-2", className)}>
      {children}
    </div>
  );
};
