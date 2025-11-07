import { useRevenueCat } from '../contexts/RevenueCatContext';
import { useCallback } from 'react';

/**
 * Hook to check if user has Pro access
 * Provides convenient methods for gating Pro features
 */
export function useProAccess() {
  const { isPro, isLoading, checkEntitlement, customerInfo } = useRevenueCat();

  /**
   * Check if user has active Pro entitlement
   */
  const hasProAccess = useCallback((): boolean => {
    return isPro;
  }, [isPro]);

  /**
   * Refresh entitlement status
   */
  const refreshAccess = useCallback(async (): Promise<boolean> => {
    return await checkEntitlement();
  }, [checkEntitlement]);

  /**
   * Get subscription type if user has Pro
   */
  const getSubscriptionType = useCallback((): 'monthly' | 'yearly' | 'lifetime' | null => {
    if (!customerInfo || !isPro) {
      return null;
    }

    const entitlement = customerInfo.entitlements.active['WagerProof Pro'];
    if (!entitlement) {
      return null;
    }

    const productId = entitlement.productIdentifier.toLowerCase();
    if (productId.includes('monthly')) {
      return 'monthly';
    } else if (productId.includes('yearly') || productId.includes('annual')) {
      return 'yearly';
    } else if (productId.includes('lifetime')) {
      return 'lifetime';
    }

    return null;
  }, [customerInfo, isPro]);

  /**
   * Check if subscription is active
   */
  const isSubscriptionActive = useCallback((): boolean => {
    if (!customerInfo || !isPro) {
      return false;
    }

    const entitlement = customerInfo.entitlements.active['WagerProof Pro'];
    if (!entitlement) {
      return false;
    }

    // Lifetime purchase
    if (entitlement.willRenew === false && entitlement.periodType === 'NORMAL') {
      return true;
    }

    // Check expiration date
    if (entitlement.expirationDate) {
      return new Date(entitlement.expirationDate) > new Date();
    }

    return entitlement.willRenew === true;
  }, [customerInfo, isPro]);

  return {
    isPro,
    isLoading,
    hasProAccess,
    refreshAccess,
    getSubscriptionType,
    isSubscriptionActive,
    customerInfo,
  };
}

