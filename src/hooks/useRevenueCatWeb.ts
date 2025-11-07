import { useEffect } from 'react';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { getActiveSubscriptionType } from '@/services/revenuecatWeb';
import type { ProductIdentifier } from '@/services/revenuecatWeb';
import debug from '@/utils/debug';

/**
 * Hook to easily access RevenueCat Web functionality
 */
export function useRevenueCatWeb() {
  const {
    customerInfo,
    offerings,
    hasProAccess,
    loading,
    error,
    refreshCustomerInfo,
    refreshOfferings,
    purchase,
    syncPurchasesManually,
  } = useRevenueCat();

  // Get subscription type if user has Pro access
  const subscriptionType: ProductIdentifier | null = customerInfo && hasProAccess
    ? getActiveSubscriptionType(customerInfo)
    : null;

  // Check if user is on a specific plan
  const isMonthly = subscriptionType === 'monthly';
  const isYearly = subscriptionType === 'yearly';
  const isLifetime = subscriptionType === 'lifetime';

  const currentOffering = offerings?.current ?? null;

  // Log when offerings change (for debugging)
  useEffect(() => {
    debug.log('📊 useRevenueCatWeb - Hook state:', {
      hasOfferings: !!offerings,
      offeringsObject: offerings,
      currentOffering: currentOffering,
      currentId: currentOffering?.identifier,
      hasPackages: !!currentOffering?.availablePackages?.length,
      packageCount: currentOffering?.availablePackages?.length || 0,
      packageIds: currentOffering?.availablePackages?.map(pkg => pkg.identifier) || [],
      loading: loading,
    });
  }, [offerings, currentOffering, loading]);

  return {
    // Customer info
    customerInfo,
    hasProAccess,
    subscriptionType,
    isMonthly,
    isYearly,
    isLifetime,
    
    // Offerings
    offerings,
    currentOffering: currentOffering,
    
    // State
    loading,
    error,
    
    // Actions
    refreshCustomerInfo,
    refreshOfferings,
    purchase,
    syncPurchases: syncPurchasesManually,
  };
}

