import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import debug from "@/utils/debug";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useAccessControl();
  
  // Check if onboarding is completed (safety check)
  const { data: onboardingCompleted, isLoading: onboardingLoading } = useQuery({
    queryKey: ['onboarding-completed', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        debug.error('Error fetching onboarding status in ProtectedRoute:', error);
        return false;
      }
      
      return data?.onboarding_completed ?? false;
    },
    enabled: !!user
  });
  
  if (authLoading || accessLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/account" replace />;
  }
  
  // Safety check: If onboarding not completed, send to onboarding (should be caught by OnboardingGuard, but this is backup)
  if (onboardingCompleted === false) {
    debug.warn('User reached ProtectedRoute without completing onboarding, redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }
  
  // If onboarding is completed but user doesn't have access, show access-denied
  if (!hasAccess) {
    return <Navigate to="/access-denied" replace />;
  }
  
  return <>{children}</>;
}
