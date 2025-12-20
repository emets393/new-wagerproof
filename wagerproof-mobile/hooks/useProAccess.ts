import { useRevenueCat } from '../contexts/RevenueCatContext';
import { useCallback } from 'react';
import { useIsAdmin } from './useIsAdmin';

/**
 * Hook to check if user has Pro access
 * Provides convenient methods for gating Pro features
 *
 * Access priority:
 * 1. If forceFreemiumMode is on, always show as non-pro (for testing)
 * 2. If user is admin, always has Pro access
 * 3. Otherwise, check RevenueCat subscription status
 */
export function useProAccess() {
  const { isPro: isRevenueCatPro, isLoading: isRevenueCatLoading, checkEntitlement, customerInfo, forceFreemiumMode, setForceFreemiumMode } = useRevenueCat();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  // Combined loading state
  const isLoading = isRevenueCatLoading || isAdminLoading;

  // Effective isPro: forceFreemiumMode overrides everything, then admin check, then RevenueCat
  const isPro = forceFreemiumMode ? false : (isAdmin || isRevenueCatPro);

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
    isAdmin,
    isLoading,
    hasProAccess,
    refreshAccess,
    getSubscriptionType,
    isSubscriptionActive,
    customerInfo,
    forceFreemiumMode,
    setForceFreemiumMode,
  };
}

