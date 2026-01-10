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
import {
  trackSubscriptionStarted,
  trackSubscriptionPurchased,
  trackSubscriptionRestored,
  trackPurchaseFailed,
  trackPurchaseCancelled,
  trackPaywallViewed,
  SubscriptionType,
} from '../services/analytics';

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
  const { user, loading: authLoading } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isProInternal, setIsProInternal] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | 'lifetime' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceFreemiumMode, setForceFreemiumMode] = useState(false);

  // Effective isPro - false if forceFreemiumMode is enabled (for admin testing)
  const isPro = forceFreemiumMode ? false : isProInternal;

  // Safety timeout: if loading takes more than 10 seconds, force it to complete
  // This prevents the app from getting stuck if RevenueCat fails silently
  useEffect(() => {
    if (!isLoading) return;

    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('📱 RevenueCat: Loading timeout reached (10s), forcing isLoading = false');
        setIsLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

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
          // DON'T set isLoading = false here - wait until customer info is loaded
          // This prevents the race condition where isPro shows false before entitlements load

          if (!actuallyConfigured) {
            console.warn('📱 RevenueCat: SDK initialized but not properly configured (web or native module unavailable)');
            // Only set loading false if not configured (no entitlements to fetch)
            setIsLoading(false);
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
  // Wait for both RevenueCat init AND auth loading to complete before processing
  useEffect(() => {
    if (!isInitialized) {
      console.log('📱 RevenueCat: Skipping user ID set - not initialized yet');
      return;
    }

    // Wait for auth to finish loading before deciding there's "no user"
    // This prevents the race condition where RevenueCat thinks there's no user
    // just because the cached auth session hasn't loaded yet
    if (authLoading) {
      console.log('📱 RevenueCat: Waiting for auth to finish loading...');
      return;
    }

    const setUserId = async () => {
      try {
        if (user?.id) {
          console.log('📱 RevenueCat: Setting user ID for:', user.id);
          console.log('📱 RevenueCat: User email:', user.email);

          // setRevenueCatUserId now returns the customer info directly from login
          const loginCustomerInfo = await setRevenueCatUserId(user.id);

          if (loginCustomerInfo) {
            console.log('📱 RevenueCat: Using customer info from login response');
            console.log('📱 RevenueCat: Active entitlements from login:', Object.keys(loginCustomerInfo.entitlements?.active || {}));

            // Use the customer info directly from login - this is the most reliable
            setCustomerInfo(loginCustomerInfo);

            // Check entitlement from login response
            const activeEntitlement = loginCustomerInfo.entitlements?.active?.[ENTITLEMENT_IDENTIFIER];
            const hasEntitlement = activeEntitlement !== undefined;
            console.log('📱 RevenueCat: Has Pro entitlement from login:', hasEntitlement);
            setIsProInternal(hasEntitlement);

            // Get subscription type
            const type = getActiveSubscriptionType(loginCustomerInfo);
            setSubscriptionType(type);
            console.log('📱 RevenueCat: Subscription type:', type);

            // NOW we can set loading to false - entitlements are loaded
            console.log('📱 RevenueCat: Entitlements loaded, setting isLoading = false');
            setIsLoading(false);
          } else {
            console.log('📱 RevenueCat: No customer info from login, refreshing...');
            await refreshCustomerInfo();
            // refreshCustomerInfo already sets isLoading = false in its finally block
          }

          // Refresh offerings (don't block on this)
          refreshOfferings().catch(err => console.warn('📱 RevenueCat: Error refreshing offerings:', err));
          console.log('📱 RevenueCat: Offerings refresh started');
        } else {
          console.log('📱 RevenueCat: No user (auth loaded, user is null), logging out from RevenueCat');
          // Log out if no user
          await logOutRevenueCat();
          setCustomerInfo(null);
          setIsProInternal(false);
          setSubscriptionType(null);
          // No user means no entitlements to check - loading is done
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('📱 RevenueCat: Error setting user ID:', err);
        setError(err.message || 'Failed to set user ID');
        // On error, still set loading to false to unblock the UI
        setIsLoading(false);
      }
    };

    setUserId();
  }, [user?.id, isInitialized, authLoading]);

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

  // NOTE: Removed redundant "Initial load" effect that was causing race conditions.
  // Customer info and offerings are now fetched in the user ID effect above,
  // which ensures proper sequencing: init SDK → set user ID → fetch customer info → set isLoading = false

  // Helper to map package identifier to subscription type
  const getSubscriptionTypeFromPackage = (pkg: PurchasesPackage): SubscriptionType => {
    const identifier = pkg.identifier.toLowerCase();
    if (identifier.includes('lifetime')) return 'lifetime';
    if (identifier.includes('annual') || identifier.includes('yearly')) return 'yearly';
    return 'monthly';
  };

  // Purchase package
  const purchase = useCallback(async (packageToPurchase: PurchasesPackage): Promise<CustomerInfo> => {
    const subscriptionType = getSubscriptionTypeFromPackage(packageToPurchase);
    const price = packageToPurchase.product?.price || 0;
    const currency = packageToPurchase.product?.currencyCode || 'USD';

    try {
      setError(null);
      setIsLoading(true);

      // Track purchase started
      trackSubscriptionStarted(subscriptionType, price, currency);

      const info = await purchasePackage(packageToPurchase);

      // Track successful purchase
      trackSubscriptionPurchased(
        subscriptionType,
        price,
        currency,
        info.originalAppUserId,
        false, // isPromo
        false  // isTrial - could check if product has trial
      );

      // Refresh customer info after purchase
      await refreshCustomerInfo();

      return info;
    } catch (err: any) {
      const errorMessage = err.message || 'Purchase failed';
      setError(errorMessage);

      // Track purchase failure or cancellation
      if (errorMessage.includes('cancel') || errorMessage.includes('user cancelled')) {
        trackPurchaseCancelled(subscriptionType);
      } else {
        trackPurchaseFailed(subscriptionType, errorMessage);
      }

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

      // Track if subscription was restored
      const type = getActiveSubscriptionType(info);
      if (type) {
        trackSubscriptionRestored(type as SubscriptionType);
      }

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

