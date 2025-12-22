import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import {
  initializeRevenueCat,
  setRevenueCatUserId,
  logOutRevenueCat,
  getCustomerInfo,
  hasActiveEntitlement,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getAvailablePackages,
  presentCustomerCenter,
  ENTITLEMENT_IDENTIFIER,
  getActiveSubscriptionType,
  isRevenueCatConfigured,
} from '../services/revenuecat';
import { useAuth } from './AuthContext';

interface RevenueCatContextType {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  packages: PurchasesPackage[];
  isPro: boolean;
  subscriptionType: 'monthly' | 'yearly' | 'lifetime' | null;
  error: string | null;
  forceFreemiumMode: boolean;

  // Actions
  refreshCustomerInfo: () => Promise<void>;
  refreshOfferings: () => Promise<void>;
  purchase: (packageToPurchase: PurchasesPackage) => Promise<CustomerInfo>;
  restore: () => Promise<CustomerInfo>;
  checkEntitlement: () => Promise<boolean>;
  openCustomerCenter: () => Promise<void>;
  setForceFreemiumMode: (enabled: boolean) => void;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isProInternal, setIsProInternalInternal] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | 'lifetime' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceFreemiumMode, setForceFreemiumMode] = useState(false);

  // Effective isPro - false if forceFreemiumMode is enabled (for admin testing)
  const isPro = forceFreemiumMode ? false : isProInternal;

  // Initialize RevenueCat
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setError(null);
        console.log('📱 RevenueCat: Starting initialization...');
        await initializeRevenueCat();

        // Verify that RevenueCat actually configured successfully
        const actuallyConfigured = isRevenueCatConfigured();
        console.log('📱 RevenueCat: Initialization complete, actually configured:', actuallyConfigured);

        if (isMounted) {
          setIsInitialized(actuallyConfigured);
          setIsLoading(false);

          if (!actuallyConfigured) {
            console.warn('📱 RevenueCat: SDK initialized but not properly configured (web or native module unavailable)');
          }
        }
      } catch (err: any) {
        console.error('📱 RevenueCat: Failed to initialize:', err);
        if (isMounted) {
          // Don't set error for native module issues - this is expected on web
          if (err?.message?.includes('native')) {
            console.warn('📱 RevenueCat: Native module not available. Continuing without RevenueCat.');
            setIsInitialized(false);
          } else {
            setError(err.message || 'Failed to initialize RevenueCat');
            setIsInitialized(false);
          }
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Set user ID when user logs in
  useEffect(() => {
    if (!isInitialized) {
      console.log('📱 RevenueCat: Skipping user ID set - not initialized yet');
      return;
    }

    const setUserId = async () => {
      try {
        if (user?.id) {
          console.log('📱 RevenueCat: Setting user ID for:', user.id);
          console.log('📱 RevenueCat: User email:', user.email);
          await setRevenueCatUserId(user.id);
          console.log('📱 RevenueCat: User ID set successfully, refreshing customer info...');
          // Refresh customer info after setting user ID
          await refreshCustomerInfo();
          await refreshOfferings();
          console.log('📱 RevenueCat: Customer info and offerings refreshed');
        } else {
          console.log('📱 RevenueCat: No user, logging out from RevenueCat');
          // Log out if no user
          await logOutRevenueCat();
          setCustomerInfo(null);
          setIsProInternal(false);
          setSubscriptionType(null);
        }
      } catch (err: any) {
        console.error('📱 RevenueCat: Error setting user ID:', err);
        setError(err.message || 'Failed to set user ID');
      }
    };

    setUserId();
  }, [user?.id, isInitialized]);

  // Refresh customer info
  const refreshCustomerInfo = useCallback(async () => {
    if (!isInitialized) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const info = await getCustomerInfo();
      setCustomerInfo(info);

      // Check entitlement - if it exists in .active, the user has access
      // RevenueCat only puts entitlements in .active if they're currently valid
      const activeEntitlement = info.entitlements.active[ENTITLEMENT_IDENTIFIER];
      const hasEntitlement = activeEntitlement !== undefined;

      // Log for debugging
      console.log('📱 RevenueCat entitlement check:', {
        entitlementId: ENTITLEMENT_IDENTIFIER,
        hasEntitlement,
        activeEntitlements: Object.keys(info.entitlements.active || {}),
        allEntitlements: Object.keys(info.entitlements.all || {}),
      });

      setIsProInternal(hasEntitlement);

      // Get subscription type
      const type = getActiveSubscriptionType(info);
      setSubscriptionType(type);
    } catch (err: any) {
      console.error('Error refreshing customer info:', err);
      // Don't set error if RevenueCat is not configured (expected on web)
      if (!err?.message?.includes('not configured')) {
        setError(err.message || 'Failed to refresh customer info');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Refresh offerings
  const refreshOfferings = useCallback(async () => {
    if (!isInitialized) {
      return;
    }
    try {
      setError(null);
      const currentOffering = await getOfferings();
      setOffering(currentOffering);

      if (currentOffering) {
        const availablePackages = await getAvailablePackages();
        setPackages(availablePackages);
      } else {
        setPackages([]);
      }
    } catch (err: any) {
      console.error('Error refreshing offerings:', err);
      // Don't set error if RevenueCat is not configured (expected on web)
      if (!err?.message?.includes('not configured')) {
        setError(err.message || 'Failed to refresh offerings');
      }
    }
  }, [isInitialized]);

  // Initial load
  useEffect(() => {
    if (!isInitialized) return;

    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([refreshCustomerInfo(), refreshOfferings()]);
    };

    loadData();
  }, [isInitialized, refreshCustomerInfo, refreshOfferings]);

  // Purchase package
  const purchase = useCallback(async (packageToPurchase: PurchasesPackage): Promise<CustomerInfo> => {
    try {
      setError(null);
      setIsLoading(true);
      const info = await purchasePackage(packageToPurchase);
      
      // Refresh customer info after purchase
      await refreshCustomerInfo();
      
      return info;
    } catch (err: any) {
      const errorMessage = err.message || 'Purchase failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCustomerInfo]);

  // Restore purchases
  const restore = useCallback(async (): Promise<CustomerInfo> => {
    try {
      setError(null);
      setIsLoading(true);
      const info = await restorePurchases();
      
      // Refresh customer info after restore
      await refreshCustomerInfo();
      
      return info;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to restore purchases';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCustomerInfo]);

  // Check entitlement
  const checkEntitlement = useCallback(async (): Promise<boolean> => {
    try {
      const hasEntitlement = await hasActiveEntitlement();
      setIsProInternal(hasEntitlement);
      return hasEntitlement;
    } catch (err: any) {
      console.error('Error checking entitlement:', err);
      setError(err.message || 'Failed to check entitlement');
      return false;
    }
  }, []);

  // Open Customer Center
  const openCustomerCenter = useCallback(async (): Promise<void> => {
    try {
      await presentCustomerCenter();
      // Refresh customer info after Customer Center is dismissed
      await refreshCustomerInfo();
    } catch (err: any) {
      console.error('Error opening Customer Center:', err);
      setError(err.message || 'Failed to open Customer Center');
      throw err;
    }
  }, [refreshCustomerInfo]);

  const value: RevenueCatContextType = {
    isInitialized,
    isLoading,
    customerInfo,
    offering,
    packages,
    isPro,
    subscriptionType,
    error,
    forceFreemiumMode,
    refreshCustomerInfo,
    refreshOfferings,
    purchase,
    restore,
    checkEntitlement,
    openCustomerCenter,
    setForceFreemiumMode,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}

