import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import debug from "@/utils/debug";

interface SaleModeSettings {
  enabled: boolean;
  discount_percentage: number;
}

/**
 * Hook to access and manage sale mode
 */
export function useSaleMode() {
  const queryClient = useQueryClient();

  // Fetch sale mode status
  const { data: saleMode, isLoading } = useQuery<SaleModeSettings>({
    queryKey: ['sale-mode'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sale_mode');
      
      if (error) {
        debug.error('Error fetching sale mode:', error);
        return { enabled: false, discount_percentage: 50 };
      }
      
      return data as SaleModeSettings;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
  });

  // Mutation to update sale mode (admin only)
  const updateSaleModeMutation = useMutation({
    mutationFn: async ({ enabled, discountPercentage = 50 }: { enabled: boolean; discountPercentage?: number }) => {
      const { data, error } = await supabase.rpc('update_sale_mode', {
        enabled,
        discount_pct: discountPercentage,
      });
      
      if (error) {
        debug.error('Error updating sale mode:', error);
        throw error;
      }
      
      return data as SaleModeSettings;
    },
    onSuccess: () => {
      // Invalidate sale mode query to refetch
      queryClient.invalidateQueries({ queryKey: ['sale-mode'] });
      debug.log('Sale mode updated successfully');
    },
  });

  return {
    saleMode: saleMode ?? { enabled: false, discount_percentage: 50 },
    isSaleActive: saleMode?.enabled ?? false,
    discountPercentage: saleMode?.discount_percentage ?? 50,
    loading: isLoading,
    updateSaleMode: updateSaleModeMutation.mutate,
    isUpdating: updateSaleModeMutation.isPending,
  };
}

