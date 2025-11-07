import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import debug from "@/utils/debug";

interface SandboxModeSettings {
  enabled: boolean;
}

/**
 * Hook to access and manage sandbox mode (test vs production RevenueCat)
 */
export function useSandboxMode() {
  const queryClient = useQueryClient();

  // Fetch sandbox mode status
  const { data: sandboxMode, isLoading } = useQuery<SandboxModeSettings>({
    queryKey: ['sandbox-mode'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sandbox_mode');
      
      if (error) {
        debug.error('Error fetching sandbox mode:', error);
        return { enabled: false };
      }
      
      return data as SandboxModeSettings;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
  });

  // Mutation to update sandbox mode (admin only)
  const updateSandboxModeMutation = useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      const { data, error } = await supabase.rpc('update_sandbox_mode', {
        enabled,
      });
      
      if (error) {
        debug.error('Error updating sandbox mode:', error);
        throw error;
      }
      
      return data as SandboxModeSettings;
    },
    onSuccess: () => {
      // Invalidate sandbox mode query to refetch
      queryClient.invalidateQueries({ queryKey: ['sandbox-mode'] });
      debug.log('Sandbox mode updated successfully - page reload recommended');
    },
  });

  return {
    sandboxMode: sandboxMode ?? { enabled: false },
    isSandboxActive: sandboxMode?.enabled ?? false,
    loading: isLoading,
    updateSandboxMode: updateSandboxModeMutation.mutate,
    isUpdating: updateSandboxModeMutation.isPending,
  };
}

