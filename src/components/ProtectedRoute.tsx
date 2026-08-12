import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useFreemiumAccess } from "@/hooks/useFreemiumAccess";
import { Loader2 } from "lucide-react";
import { PAYWALL_ROUTE } from "@/lib/routes";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowFreemium?: boolean;
  /** Sign-in is the ONLY requirement — no subscription and no paywall-bypass flag.
      For acquisition surfaces (competition): a brand-new free account goes straight in.
      allowFreemium still requires the paywall-dismissed localStorage flag; authOnly doesn't. */
  authOnly?: boolean;
}

export function ProtectedRoute({ children, allowFreemium = false, authOnly = false }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useAccessControl();
  const { isFreemiumUser } = useFreemiumAccess();
  
  // Priority 1: Check authentication first
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Priority 2: Redirect unauthenticated users immediately
  // Don't wait for access check - they need to login first
  if (!user) {
    return <Navigate to="/account" replace />;
  }

  // Auth-only routes: signed in is all it takes.
  if (authOnly) {
    return <>{children}</>;
  }
  
  // Priority 3: Check access for authenticated users
  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Priority 4: Allow freemium users on designated pages
  if (!hasAccess) {
    // If this route allows freemium and user is in freemium mode, allow access
    if (allowFreemium && isFreemiumUser) {
      return <>{children}</>;
    }
    
    // Otherwise redirect to access-denied
    return <Navigate to={PAYWALL_ROUTE} replace />;
  }
  
  // All checks passed - render the protected content
  return <>{children}</>;
}
