import { useCallback, useEffect, useState } from 'react';
import type { PurchasesOffering } from 'react-native-purchases';
import { getCurrentOfferingForPlacement } from '@/services/revenuecat';

export function usePlacementOffering(placementId: string, enabled = true) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const nextOffering = await getCurrentOfferingForPlacement(placementId);
      setOffering(nextOffering);
    } catch (err: any) {
      setOffering(null);
      setError(err?.message || 'Failed to load offering');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, placementId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    offering,
    isLoading,
    error,
    refresh,
  };
}
