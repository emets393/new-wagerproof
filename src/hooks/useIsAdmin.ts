import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import debug from "@/utils/debug";

export function useIsAdmin() {
  const { user } = useAuth();
  
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      
      if (error) {
        debug.error('Admin check error:', error);
        return false;
      }
      return data as boolean;
    },
    enabled: !!user
  });
  
  return { isAdmin: isAdmin ?? false, isLoading };
}
