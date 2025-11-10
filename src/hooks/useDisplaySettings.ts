import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import debug from '@/utils/debug';

interface DisplaySettings {
  show_nfl_moneyline_pills: boolean;
  show_extra_value_suggestions: boolean;
}

/**
 * Hook to access and manage display settings
 */
export function useDisplaySettings() {
  const queryClient = useQueryClient();

  // Fetch display settings
  const { data: displaySettings, isLoading } = useQuery<DisplaySettings>({
    queryKey: ['display-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_display_settings');
      
      if (error) {
        debug.error('Error fetching display settings:', error);
        return { show_nfl_moneyline_pills: true, show_extra_value_suggestions: true };
      }
      
      return data as DisplaySettings;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
  });

  // Mutation to update display settings (admin only)
  const updateDisplaySettingsMutation = useMutation({
    mutationFn: async ({ 
      showMoneyline, 
      showValueSuggestions 
    }: { 
      showMoneyline: boolean; 
      showValueSuggestions: boolean;
    }) => {
      const { data, error } = await supabase.rpc('update_display_settings', {
        show_moneyline: showMoneyline,
        show_value_suggestions: showValueSuggestions,
      });
      
      if (error) {
        debug.error('Error updating display settings:', error);
        throw error;
      }
      
      return data as DisplaySettings;
    },
    onSuccess: () => {
      // Invalidate display settings query to refetch
      queryClient.invalidateQueries({ queryKey: ['display-settings'] });
      debug.log('Display settings updated successfully');
    },
  });

  return {
    displaySettings: displaySettings ?? { show_nfl_moneyline_pills: true, show_extra_value_suggestions: true },
    showNFLMoneylinePills: displaySettings?.show_nfl_moneyline_pills ?? true,
    showExtraValueSuggestions: displaySettings?.show_extra_value_suggestions ?? true,
    loading: isLoading,
    updateDisplaySettings: updateDisplaySettingsMutation.mutate,
    isUpdating: updateDisplaySettingsMutation.isPending,
  };
}

