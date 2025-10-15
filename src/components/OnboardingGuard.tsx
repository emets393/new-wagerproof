import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [onboardingStatus, setOnboardingStatus] = useState<{
    completed: boolean | null;
    loading: boolean;
  }>({ completed: null, loading: true });

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setOnboardingStatus({ completed: null, loading: false });
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          // If there's an error, assume onboarding is not completed to be safe
          setOnboardingStatus({ completed: false, loading: false });
          return;
        }

        setOnboardingStatus({ 
          completed: profile?.onboarding_completed ?? false, 
          loading: false 
        });
      } catch (error) {
        console.error("Unexpected error checking onboarding status:", error);
        setOnboardingStatus({ completed: false, loading: false });
      }
    };

    checkOnboardingStatus();
  }, [user]);

  // Show loading while checking auth or onboarding status
  if (authLoading || onboardingStatus.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is not authenticated, let ProtectedRoute handle the redirect
  if (!user) {
    return <>{children}</>;
  }

  // If user is authenticated but hasn't completed onboarding, redirect to onboarding
  // Exception: if they're already on the onboarding page, don't redirect
  if (onboardingStatus.completed === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has completed onboarding or is on onboarding page, render children
  return <>{children}</>;
}
