import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
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
  syncPurchases,
  purchasePackage,
  restorePurchases,
  getAvailablePackages,
  presentCustomerCenter,
  ENTITLEMENT_IDENTIFIER,
  getActiveSubscriptionType,
  getEntitlementPeriodType,
  isRevenueCatConfigured,
  addCustomerInfoUpdateListener,
} from '../services/revenuecat';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
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
// Denied cache is deliberately short. A user who just bought on mobile or
// was admin-granted on web should see Pro status within minutes, not an hour.
// The 7d granted cache still protects paying users from login flashes.
const DENIED_CACHE_TTL_MS = 5 * 60 * 1000;
// AsyncStorage key used to track automatic post-login reconciliation attempts.
// This uses syncPurchases/getCustomerInfo (not restorePurchases) so it is safe
// to run in background and aligns with RevenueCat guidance for non-user-initiated recovery.
const LOGIN_RECONCILE_ATTEMPTED_KEY_PREFIX = '@wagerproof/rc-login-reconcile-attempted/v2/';
const LOGIN_RECONCILE_RETRY_COOLDOWN_MS = 90 * 1000; // 90 seconds
const LOGIN_RECONCILE_MAX_ATTEMPTS = 12;

const getEntitlementCacheKey = (userId: string) => `${ENTITLEMENT_CACHE_KEY_PREFIX}${userId}`;
const getLoginReconcileAttemptedKey = (userId: string) =>
  `${LOGIN_RECONCILE_ATTEMPTED_KEY_PREFIX}${userId}`;

interface LoginReconcileState {
  attempts: number;
  lastAttemptAt: number;
  recovered: boolean;
}

// Classifies where a customer-info update came from. "trusted" sources are
// explicit network fetches (initial login, purchase, refresh, manual restore)
// and are allowed to downgrade granted→denied. "cached" sources (SDK
// addCustomerInfoUpdateListener fires) can upgrade denied→granted but are
// NOT allowed to downgrade — the SDK listener can fire with stale or
// anonymous-identity data at boot, which in the deployed build was locking
// paying users out. Real downgrades always arrive via a trusted refresh
// within minutes, so this isn't a permanent grant.
type CustomerInfoSource =
  | 'login'
  | 'login-restore'
  | 'refresh'
  | 'purchase'
  | 'restore'
  | 'listener';

const TRUSTED_CUSTOMER_INFO_SOURCES: ReadonlySet<CustomerInfoSource> = new Set([
  'login',
  'login-restore',
  'refresh',
  'purchase',
  'restore',
]);

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

  // Ref mirror of entitlementStatus so the callback can read the current
  // value without being re-created on every status change (which would
  // detach/re-attach the SDK listener and re-run the login effect).
  const entitlementStatusRef = useRef<EntitlementStatus>('unknown');
  useEffect(() => {
    entitlementStatusRef.current = entitlementStatus;
  }, [entitlementStatus]);

  const applyCustomerInfoState = useCallback(async (
    info: CustomerInfo,
    source: CustomerInfoSource,
    userId?: string
  ) => {
    const activeEntitlement = info.entitlements?.active?.[ENTITLEMENT_IDENTIFIER];
    const hasEntitlement = activeEntitlement !== undefined;
    const nextStatus: Exclude<EntitlementStatus, 'unknown'> = hasEntitlement ? 'granted' : 'denied';
    const nextSubscriptionType = getActiveSubscriptionType(info);
    const isTrusted = TRUSTED_CUSTOMER_INFO_SOURCES.has(source);

    // Trust-downgrade guard: never overwrite granted→denied from an untrusted
    // (cached) source. The SDK listener can fire with stale data during the
    // anonymous→identified login window; honoring it would lock out users
    // whose purchase RC has since aliased correctly. Real downgrades always
    // arrive via an explicit trusted-source refresh (foreground, network
    // recovery, manual refresh) within minutes, so this isn't a permanent lock.
    const currentStatus = entitlementStatusRef.current;
    const isRefusedDowngrade =
      currentStatus === 'granted' && nextStatus === 'denied' && !isTrusted;

    if (isRefusedDowngrade) {
      console.warn(`📱 RevenueCat: Refusing granted→denied downgrade from untrusted source=${source}`);
      // Allow listener upgrades to refresh customerInfo even when we refuse a
      // downgrade here — but since the nextStatus IS denied, there's nothing
      // to upgrade. Bail before touching any state.
      return;
    }

    setCustomerInfo(info);
    setEntitlementStatus(nextStatus);
    setIsProInternal(hasEntitlement);
    setSubscriptionType(nextSubscriptionType);
    entitlementStatusRef.current = nextStatus;
    console.log(`📱 RevenueCat: Entitlement resolved from ${source}:`, nextStatus, isTrusted ? '(trusted)' : '(cached)');

    if (userId) {
      // Persist entitlement state to AsyncStorage only from trusted sources.
      // Untrusted listener fires can upgrade in-memory state but must not
      // write to the durable cache — otherwise a stale denied flash at boot
      // would survive app restart.
      if (isTrusted) {
        await persistEntitlementState(userId, nextStatus, nextSubscriptionType);
      }

      // Supabase mirror write. Kept across all sources because more updates
      // to the mirror are strictly better — the mirror is a secondary record
      // and the damage untrusted sources can do is already bounded by the
      // trust-downgrade guard above.
      //
      // revenuecat_customer_id MUST be the real RC identity (originalAppUserId)
      // — not the Supabase user_id. For users whose anon→userId alias merge
      // didn't propagate on RC's backend, only the anon id resolves a RC API
      // lookup. Writing userId there strands them. RC treats all aliased ids
      // as interchangeable, so originalAppUserId is safe for ALL users.
      const expiresAt = activeEntitlement?.expirationDate ?? null;
      const rcAppUserId =
        (info as any)?.originalAppUserId ||
        (info as any)?.appUserId ||
        userId;
      supabase
        .from('profiles')
        .update({
          subscription_active: hasEntitlement,
          subscription_status: nextSubscriptionType ?? (hasEntitlement ? 'active' : 'inactive'),
          subscription_expires_at: expiresAt,
          revenuecat_customer_id: rcAppUserId,
        })
        .eq('user_id', userId)
        .then(({ error: syncError }) => {
          if (syncError) {
            console.warn('📱 RevenueCat: Failed to sync subscription to Supabase:', syncError.message);
          } else {
            console.log('📱 RevenueCat: Synced subscription_active =', hasEntitlement, 'to Supabase');
          }
        });
    }
  }, [persistEntitlementState]);

  // Safety timeout: if loading takes more than 10 seconds, force it to complete.
  // IMPORTANT: Never downgrade from "granted" to "denied" on timeout.
  // If status is still "unknown", try to hydrate from cache one more time before defaulting.
  useEffect(() => {
    if (!isLoading) return;

    const timeout = setTimeout(async () => {
      if (!isLoading) return;

      console.warn('📱 RevenueCat: Loading timeout reached (10s), forcing isLoading = false');

      if (entitlementStatus === 'unknown') {
        // Last-resort: try to hydrate from cache even with expired TTL.
        // It's better to show a stale "granted" than to lock a paying user out.
        try {
          if (user?.id) {
            const rawCache = await AsyncStorage.getItem(getEntitlementCacheKey(user.id));
            if (rawCache) {
              const parsed = JSON.parse(rawCache) as CachedEntitlementState;
              if (parsed.userId === user.id && parsed.status === 'granted') {
                console.log('📱 RevenueCat: Timeout recovery — using expired cache (granted)');
                setEntitlementStatus('granted');
                setIsProInternal(true);
                setSubscriptionType(parsed.subscriptionType ?? null);
                setIsLoading(false);
                return;
              }
            }
          }
        } catch {}

        // No cache or cache was "denied" — resolve to denied
        setEntitlementStatus('denied');
        setIsProInternal(false);
      }
      // If already "granted" from hydration, don't touch it
      setIsLoading(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isLoading, entitlementStatus, user?.id]);

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

          // Prefetch offerings immediately so paywall is instant when needed later.
          // Fire-and-forget — this caches in the SDK for subsequent reads.
          if (actuallyConfigured) {
            import('../services/revenuecat').then(({ getCurrentOfferingForPlacement }) => {
              getCurrentOfferingForPlacement('onboarding').catch(() => {});
            }).catch(() => {});
          }

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
          await hydrateEntitlementState(user.id);

          console.log('📱 RevenueCat: Setting user ID for:', user.id);
          console.log('📱 RevenueCat: User email:', user.email);

          const loginResult = await setRevenueCatUserId(user.id);

          if (loginResult) {
            const { customerInfo: loginCustomerInfo, created } = loginResult;
            console.log('📱 RevenueCat: Login response:', {
              created,
              activeEntitlements: Object.keys(loginCustomerInfo.entitlements?.active || {}),
            });
            await applyCustomerInfoState(loginCustomerInfo, 'login', user.id);

            const hasEntitlement =
              !!loginCustomerInfo.entitlements?.active?.[ENTITLEMENT_IDENTIFIER];
            const reconcileKey = getLoginReconcileAttemptedKey(user.id);

            if (created || !hasEntitlement) {
              let reconcileState: LoginReconcileState | null = null;
              try {
                const raw = await AsyncStorage.getItem(reconcileKey);
                reconcileState = raw ? (JSON.parse(raw) as LoginReconcileState) : null;
              } catch {
                reconcileState = null;
              }

              const now = Date.now();
              const attempts = reconcileState?.attempts ?? 0;
              const recovered = reconcileState?.recovered ?? false;
              const lastAttemptAt = reconcileState?.lastAttemptAt ?? 0;
              const withinCooldown = now - lastAttemptAt < LOGIN_RECONCILE_RETRY_COOLDOWN_MS;
              const exhausted = attempts >= LOGIN_RECONCILE_MAX_ATTEMPTS;

              if (recovered) {
                console.log('📱 RevenueCat: Skipping login reconcile (already recovered)');
              } else if (exhausted) {
                console.log('📱 RevenueCat: Skipping login reconcile (max attempts reached)');
              } else if (withinCooldown) {
                console.log('📱 RevenueCat: Skipping login reconcile (cooldown active)');
              } else {
                const nextState: LoginReconcileState = {
                  attempts: attempts + 1,
                  lastAttemptAt: now,
                  recovered: false,
                };
                await AsyncStorage.setItem(reconcileKey, JSON.stringify(nextState));

                console.log('📱 RevenueCat: Running post-login entitlement reconciliation');
                try {
                  await syncPurchases();
                  const reconciledInfo = await getCustomerInfo();
                  await applyCustomerInfoState(reconciledInfo, 'login-restore', user.id);
                  const wasRecovered =
                    !!reconciledInfo.entitlements?.active?.[ENTITLEMENT_IDENTIFIER];
                  if (wasRecovered) {
                    const recoveredState: LoginReconcileState = {
                      ...nextState,
                      recovered: true,
                    };
                    await AsyncStorage.setItem(reconcileKey, JSON.stringify(recoveredState));
                  }
                  console.log('📱 RevenueCat: Login reconcile completed, recovered =', wasRecovered);
                } catch (reconcileError: any) {
                  console.warn('📱 RevenueCat: Login reconcile failed (non-fatal):', reconcileError?.message);
                }
              }
            }

            console.log('📱 RevenueCat: Entitlements loaded, setting isLoading = false');
            setIsLoading(false);
          } else {
            console.log('📱 RevenueCat: No customer info from login, refreshing...');
            await refreshCustomerInfo();
          }

          refreshOfferings().catch(err => console.warn('📱 RevenueCat: Error refreshing offerings:', err));
        } else {
          console.log('📱 RevenueCat: No user (auth loaded, user is null), logging out from RevenueCat');
          await logOutRevenueCat();
          setCustomerInfo(null);
          setIsProInternal(false);
          setEntitlementStatus('denied');
          setSubscriptionType(null);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('📱 RevenueCat: Error setting user ID:', err);
        setError(err.message || 'Failed to set user ID');
        setEntitlementStatus((prev) => (prev === 'granted' ? 'granted' : 'unknown'));
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
      setEntitlementStatus((prev) => (prev === 'granted' ? 'granted' : 'unknown'));
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
      setEntitlementStatus((prev) => (prev === 'granted' ? 'granted' : 'unknown'));
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

  // Refresh entitlements when network connectivity recovers.
  // This ensures that a user who was offline gets their Pro status updated
  // as soon as they reconnect, rather than staying on a stale cache.
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected && state.isInternetReachable;
      if (isOnline && wasOfflineRef.current) {
        console.log('📱 RevenueCat: Network recovered — refreshing entitlements');
        wasOfflineRef.current = false;
        // Small delay to let the network stabilize
        setTimeout(() => {
          refreshCustomerInfo().catch((err) => {
            console.warn('📱 RevenueCat: Network recovery refresh failed:', err);
          });
        }, 2000);
      } else if (!isOnline) {
        wasOfflineRef.current = true;
      }
    });

    return () => unsubscribe();
  }, [user?.id, isInitialized, refreshCustomerInfo]);

  // Subscribe to real-time CustomerInfo updates from RevenueCat SDK.
  // This fires on purchases, renewals, expirations, and other lifecycle events
  // detected natively (StoreKit 2, Play Billing) — more reliable than only
  // checking on foreground/network recovery.
  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    const cleanup = addCustomerInfoUpdateListener(async (info) => {
      const infoUserId = (info as any)?.originalAppUserId || (info as any)?.appUserId;
      if (infoUserId && infoUserId !== user.id) {
        console.warn('📱 RevenueCat: Ignoring CustomerInfoUpdate for stale appUserId:', infoUserId);
        return;
      }
      console.log('📱 RevenueCat: CustomerInfoUpdateListener fired');
      await applyCustomerInfoState(info, 'listener', user.id);
    });

    return () => cleanup?.();
  }, [user?.id, isInitialized, applyCustomerInfoState]);

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
