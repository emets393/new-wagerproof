import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
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
  getEntitlementPeriodType,
  isRevenueCatConfigured,
} from '../services/revenuecat';
import { useAuth } from './AuthContext';
import {
  trackSubscriptionStarted,
  trackSubscriptionPurchased,
  trackSubscriptionRestored,
  trackPurchaseFailed,
  trackPurchaseCancelled,
  SubscriptionType,
} from '../services/analytics';

export type EntitlementStatus = 'unknown' | 'granted' | 'denied';

interface CachedEntitlementState {
  userId: string;
  status: Exclude<EntitlementStatus, 'unknown'>;
  subscriptionType: 'monthly' | 'yearly' | 'lifetime' | null;
  checkedAt: number;
  expiresAt: number;
}

const ENTITLEMENT_CACHE_KEY_PREFIX = '@wagerproof/entitlement-state/v1/';
const GRANTED_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DENIED_CACHE_TTL_MS = 5 * 60 * 1000;

const getEntitlementCacheKey = (userId: string) => `${ENTITLEMENT_CACHE_KEY_PREFIX}${userId}`;

interface RevenueCatContextType {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  packages: PurchasesPackage[];
  isPro: boolean;
  entitlementStatus: EntitlementStatus;
  isEntitlementResolved: boolean;
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
  const [entitlementStatus, setEntitlementStatus] = useState<EntitlementStatus>('unknown');
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | 'lifetime' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceFreemiumMode, setForceFreemiumMode] = useState(false);
  const isEntitlementResolved = entitlementStatus !== 'unknown';

  // Effective isPro - false if forceFreemiumMode is enabled (for admin testing)
  const isPro = forceFreemiumMode ? false : isProInternal;

  const persistEntitlementState = useCallback(async (
    userId: string,
    status: Exclude<EntitlementStatus, 'unknown'>,
    nextSubscriptionType: 'monthly' | 'yearly' | 'lifetime' | null
  ) => {
    try {
      const now = Date.now();
      const ttl = status === 'granted' ? GRANTED_CACHE_TTL_MS : DENIED_CACHE_TTL_MS;
      const cacheValue: CachedEntitlementState = {
        userId,
        status,
        subscriptionType: nextSubscriptionType,
        checkedAt: now,
        expiresAt: now + ttl,
      };
      await AsyncStorage.setItem(getEntitlementCacheKey(userId), JSON.stringify(cacheValue));
    } catch (cacheError) {
      console.warn('📱 RevenueCat: Failed to persist entitlement cache:', cacheError);
    }
  }, []);

  const hydrateEntitlementState = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const rawCache = await AsyncStorage.getItem(getEntitlementCacheKey(userId));
      if (!rawCache) {
        return false;
      }

      const parsed = JSON.parse(rawCache) as CachedEntitlementState;
      if (parsed.userId !== userId || parsed.expiresAt <= Date.now()) {
        await AsyncStorage.removeItem(getEntitlementCacheKey(userId));
        return false;
      }

      setEntitlementStatus(parsed.status);
      setIsProInternal(parsed.status === 'granted');
      setSubscriptionType(parsed.subscriptionType ?? null);
      setIsLoading(false);
      console.log('📱 RevenueCat: Hydrated entitlement state from cache:', parsed.status);
      return true;
    } catch (cacheError) {
      console.warn('📱 RevenueCat: Failed to hydrate entitlement cache:', cacheError);
      return false;
    }
  }, []);

  const applyCustomerInfoState = useCallback(async (
    info: CustomerInfo,
    source: string,
    userId?: string
  ) => {
    setCustomerInfo(info);
    const activeEntitlement = info.entitlements?.active?.[ENTITLEMENT_IDENTIFIER];
    const hasEntitlement = activeEntitlement !== undefined;
    const nextStatus: Exclude<EntitlementStatus, 'unknown'> = hasEntitlement ? 'granted' : 'denied';
    const nextSubscriptionType = getActiveSubscriptionType(info);

    setEntitlementStatus(nextStatus);
    setIsProInternal(hasEntitlement);
    setSubscriptionType(nextSubscriptionType);
    console.log(`📱 RevenueCat: Entitlement resolved from ${source}:`, nextStatus);

    if (userId) {
      await persistEntitlementState(userId, nextStatus, nextSubscriptionType);
    }
  }, [persistEntitlementState]);

  // Safety timeout: if loading takes more than 10 seconds, force it to complete
  // Resolve unknown -> denied on timeout so lock UI can make a deterministic decision.
  useEffect(() => {
    if (!isLoading) return;

    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('📱 RevenueCat: Loading timeout reached (10s), forcing isLoading = false');
        setEntitlementStatus((prev) => (prev === 'unknown' ? 'denied' : prev));
        if (entitlementStatus === 'unknown') {
          setIsProInternal(false);
        }
        setIsLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isLoading, entitlementStatus]);

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
            setEntitlementStatus('denied');
            setIsProInternal(false);
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
            setEntitlementStatus('denied');
          } else {
            setError(err.message || 'Failed to initialize RevenueCat');
            setIsInitialized(false);
            setEntitlementStatus('denied');
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
          // Hydrate local entitlement cache first to avoid lock flashes for paid users.
          await hydrateEntitlementState(user.id);

          console.log('📱 RevenueCat: Setting user ID for:', user.id);
          console.log('📱 RevenueCat: User email:', user.email);

          // setRevenueCatUserId now returns the customer info directly from login
          const loginCustomerInfo = await setRevenueCatUserId(user.id);

          if (loginCustomerInfo) {
            console.log('📱 RevenueCat: Using customer info from login response');
            console.log('📱 RevenueCat: Active entitlements from login:', Object.keys(loginCustomerInfo.entitlements?.active || {}));
            await applyCustomerInfoState(loginCustomerInfo, 'login', user.id);

            // NOW we can set loading to false - entitlements are loaded
            console.log('📱 RevenueCat: Entitlements loaded, setting isLoading = false');
            setIsLoading(false);
          } else {
            console.log('📱 RevenueCat: No customer info from login, refreshing...');
            await refreshCustomerInfo();
            // refreshCustomerInfo already sets isLoading = false in its finally block
          }

          // Defer offerings refresh to avoid competing with onboarding network calls.
          // Offerings are only needed when the paywall is shown (end of onboarding or later).
          setTimeout(() => {
            refreshOfferings().catch(err => console.warn('📱 RevenueCat: Error refreshing offerings:', err));
            console.log('📱 RevenueCat: Offerings refresh started (deferred)');
          }, 10000);
        } else {
          console.log('📱 RevenueCat: No user (auth loaded, user is null), logging out from RevenueCat');
          // Log out if no user
          await logOutRevenueCat();
          setCustomerInfo(null);
          setIsProInternal(false);
          setEntitlementStatus('denied');
          setSubscriptionType(null);
          // No user means no entitlements to check - loading is done
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('📱 RevenueCat: Error setting user ID:', err);
        setError(err.message || 'Failed to set user ID');
        // Keep optimistic grant if we have it, otherwise resolve to denied.
        setEntitlementStatus((prev) => (prev === 'granted' ? 'granted' : 'denied'));
        // On error, still set loading to false to unblock the UI
        setIsLoading(false);
      }
    };

    setUserId();
  }, [user?.id, isInitialized, authLoading, hydrateEntitlementState, applyCustomerInfoState]);

  // Refresh customer info
  const refreshCustomerInfo = useCallback(async () => {
    if (!isInitialized) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const info = await getCustomerInfo();
      await applyCustomerInfoState(info, 'refresh', user?.id);

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

    } catch (err: any) {
      console.error('Error refreshing customer info:', err);
      // Don't set error if RevenueCat is not configured (expected on web)
      if (!err?.message?.includes('not configured')) {
        setError(err.message || 'Failed to refresh customer info');
      }
      setEntitlementStatus((prev) => (prev === 'granted' ? 'granted' : 'denied'));
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, applyCustomerInfoState, user?.id]);

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
      const isTrial = getEntitlementPeriodType(info) === 'TRIAL';

      // Track successful purchase
      trackSubscriptionPurchased(
        subscriptionType,
        price,
        currency,
        undefined,
        false, // isPromo
        isTrial
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
      setEntitlementStatus(hasEntitlement ? 'granted' : 'denied');
      if (user?.id) {
        await persistEntitlementState(
          user.id,
          hasEntitlement ? 'granted' : 'denied',
          hasEntitlement ? subscriptionType : null
        );
      }
      return hasEntitlement;
    } catch (err: any) {
      console.error('Error checking entitlement:', err);
      setError(err.message || 'Failed to check entitlement');
      setEntitlementStatus((prev) => (prev === 'granted' ? 'granted' : 'denied'));
      return false;
    }
  }, [user?.id, persistEntitlementState, subscriptionType]);

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

  // Revalidate in the background when app returns to foreground.
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshCustomerInfo().catch((err) => {
          console.warn('📱 RevenueCat: Foreground entitlement refresh failed:', err);
        });
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [user?.id, isInitialized, refreshCustomerInfo]);

  const value: RevenueCatContextType = {
    isInitialized,
    isLoading,
    customerInfo,
    offering,
    packages,
    isPro,
    entitlementStatus,
    isEntitlementResolved,
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
