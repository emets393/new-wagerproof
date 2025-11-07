import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { getActiveSubscriptionType } from '@/services/revenuecatWeb';
import type { ProductIdentifier } from '@/services/revenuecatWeb';

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
    currentOffering: offerings?.current ?? null,
    
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

