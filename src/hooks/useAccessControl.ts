import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAccessControl() {
  const { user } = useAuth();
  
  const { data: hasAccess, isLoading } = useQuery({
    queryKey: ['user-access', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .rpc('user_has_access', { _user_id: user.id });
      
      if (error) {
        console.error('Access check error:', error);
        return false;
      }
      return data as boolean;
    },
    enabled: !!user
  });
  
  return { hasAccess: hasAccess ?? false, isLoading };
}
