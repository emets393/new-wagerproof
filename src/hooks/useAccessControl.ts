import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasActiveEntitlement, isRevenueCatConfigured } from "@/services/revenuecatWeb";
import {
  checkSupabaseSubscription,
  resolveServerEntitlement,
} from "@/utils/syncRevenueCatToSupabase";
import debug from "@/utils/debug";

export function useAccessControl() {
  const { user } = useAuth();
  
  const { data: hasAccess, isLoading } = useQuery({
    queryKey: ['user-access', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      // FIRST: Check if user is admin - admins always have access
      try {
        const { data: isAdmin, error } = await supabase
          .rpc('has_role', { _user_id: user.id, _role: 'admin' });
        
        if (!error && isAdmin) {
          debug.log('User is admin, granting full access');
          return true;
        }
      } catch (error) {
        debug.error('Admin check error:', error);
        // Continue to other checks
      }
      
      // Primary: RevenueCat Web Billing (authoritative when it finds Pro).
      // A negative result is NOT authoritative — store purchases often live on
      // another RC identity the Web SDK never sees. Fall through instead of
      // returning false (docs claim a 3-tier cascade; keep that promise).
      if (isRevenueCatConfigured()) {
        try {
          const hasEntitlement = await hasActiveEntitlement();
          debug.log('RevenueCat access check:', hasEntitlement);
          if (hasEntitlement) {
            return true;
          }
        } catch (error) {
          debug.error('RevenueCat access check error, falling back:', error);
        }
      }
      
      // Fallback 1: Supabase mirror (webhook / mobile sync)
      try {
        const hasSupabaseAccess = await checkSupabaseSubscription(user.id);
        if (hasSupabaseAccess) {
          debug.log('Supabase subscription check: has access');
          return true;
        }
      } catch (error) {
        debug.error('Supabase subscription check error:', error);
      }

      // Fallback 2: Server multi-id resolve (heals poisoned mirrors + uppercase twin)
      try {
        const hasServerAccess = await resolveServerEntitlement();
        if (hasServerAccess) {
          debug.log('Server entitlement resolve: has access');
          return true;
        }
      } catch (error) {
        debug.error('Server entitlement resolve error:', error);
      }
      
      // Fallback 3: Legacy RPC (launch_mode / require_subscription)
      try {
        const { data, error } = await supabase
          .rpc('user_has_access', { _user_id: user.id });
        
        if (error) {
          debug.error('RPC access check error:', error);
          return false;
        }
        return data as boolean;
      } catch (error) {
        debug.error('Access check error:', error);
        return false;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchInterval: 1000 * 60 * 15, // Refetch every 15 minutes
  });
  
  return { hasAccess: hasAccess ?? false, isLoading };
}
