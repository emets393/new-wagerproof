import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useAccessControl();
  
  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/account" replace />;
  }
  
  // OnboardingGuard handles onboarding redirect, so we only check access here
  // If user doesn't have access (no subscription), show access-denied page
  if (!hasAccess) {
    return <Navigate to="/access-denied" replace />;
  }
  
  return <>{children}</>;
}
