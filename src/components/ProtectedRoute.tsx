import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useAccessControl();
  
  // Priority 1: Check authentication first
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Priority 2: Redirect unauthenticated users immediately
  // Don't wait for access check - they need to login first
  if (!user) {
    return <Navigate to="/account" replace />;
  }
  
  // Priority 3: Check access for authenticated users
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Priority 4: Redirect users without access to paywall
  // OnboardingGuard handles onboarding redirect separately
  if (!hasAccess) {
    return <Navigate to="/access-denied" replace />;
  }
  
  // All checks passed - render the protected content
  return <>{children}</>;
}
