import { resolveSubscriptionTier, tierRank, isTieredCustomer as isTieredCatalogCustomer, type SubscriptionTier } from '@/features/tieredPaywall/access';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CustomerInfo, Offerings, Package } from '@revenuecat/purchases-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  initializeRevenueCat,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  syncPurchases,
  resetRevenueCat,
  isRevenueCatConfigured,
  setSandboxMode,
  ENTITLEMENT_IDENTIFIER,
  isUserCancelledPurchaseError,
  type VerifiedWebPurchaseResult,
} from '@/services/revenuecatWeb';
import {
  getHardPaywallPackages,
  hasRenderableYearlyIntroOffer,
} from '@/lib/revenuecatPaywall';
import {
  checkSupabaseSubscription,
  syncRevenueCatToSupabase,
} from '@/utils/syncRevenueCatToSupabase';
import debug from '@/utils/debug';

/**
 * Web Billing alone misses store purchases on other RC identities.
 * Promote when RC Web says Pro; otherwise OR in mirror + server resolve.
 */
async function resolveSubscriptionAccess(userId: string, info: CustomerInfo | null) {
  const active = Object.keys(info?.entitlements.active ?? {});
  const sdkTier = resolveSubscriptionTier(active);
  const sdkEnrolled = isTieredCatalogCustomer(Object.keys(info?.entitlements.all ?? {}),
    Object.values(info?.entitlements.all ?? {}).map(entitlement => entitlement.productIdentifier));
  if (sdkTier === 'pro') return { tier: sdkTier, enrolled: sdkEnrolled };

  // Server reconciliation checks store purchases on legacy alias identities.
  // A lower SDK tier must not be OR-ed with a coarse paid=true profile flag.
  try {
    const { data, error } = await supabase.functions.invoke('resolve-my-entitlement', { body: {} });
    if (!error && data) {
      if (data.isAdmin || data.hasPremiumAccess) return { tier: 'pro' as const, enrolled: sdkEnrolled || data.isTieredCustomer === true };
      const serverTier: SubscriptionTier | null = ['standard', 'premium', 'pro'].includes(data.subscriptionTier) ? data.subscriptionTier : null;
      if (serverTier || data.isTieredCustomer || sdkEnrolled) {
        return { tier: 'subscriptionTier' in data ? serverTier : sdkTier, enrolled: sdkEnrolled || data.isTieredCustomer === true };
      }
    }
  } catch { /* Continue with the SDK and authoritative tier cache. */ }
  // This table is server-written. Never use the legacy profile fallback for
  // an explicitly enrolled lower-tier customer, including after expiry.
  const { data: cache, error: cacheError } = await supabase.from('subscription_tier_access' as any)
    .select('tier,is_tiered_customer').eq('user_id', userId).maybeSingle();
  const cached = cache as unknown as { tier: SubscriptionTier | null; is_tiered_customer: boolean } | null;
  if (cached) return { tier: tierRank(cached.tier) > tierRank(sdkTier) ? cached.tier : sdkTier, enrolled: sdkEnrolled || cached.is_tiered_customer };
  if (sdkTier || sdkEnrolled) return { tier: sdkTier, enrolled: sdkEnrolled };
  // Missing cache during an outage is unresolved, not evidence of legacy Pro.
  if (cacheError) return { tier: null, enrolled: false };
  return { tier: await checkSupabaseSubscription(userId) ? 'pro' as const : null, enrolled: false };
}

interface RevenueCatContextType {
  customerInfo: CustomerInfo | null;
  offerings: Offerings | null;
  hasProAccess: boolean;
  subscriptionTier: SubscriptionTier | null;
  isTieredCustomer: boolean;
  hasSubscription: boolean;
  loading: boolean;
  offeringsLoading: boolean;
  error: string | null;
  refreshCustomerInfo: () => Promise<boolean>;
  refreshOfferings: () => Promise<void>;
  purchase: (pkg: Package) => Promise<VerifiedWebPurchaseResult>;
  syncPurchasesManually: () => Promise<boolean>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [access, setAccess] = useState<{ tier: SubscriptionTier | null; enrolled: boolean }>({ tier: null, enrolled: false });
  const subscriptionTier = access.tier;
  const isTieredCustomer = access.enrolled;
  const hasProAccess = subscriptionTier === 'pro';
  const hasSubscription = subscriptionTier !== null;
  const [loading, setLoading] = useState(true);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Configure RevenueCat only after Supabase has resolved a real authenticated
  // user. Every async state write is scoped to this effect so an old user's
  // customer data cannot land after sign-out or account switching.
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (authLoading) {
        setLoading(true);
        return;
      }

      if (!user) {
        resetRevenueCat();
        setCustomerInfo(null);
        setOfferings(null);
        setAccess({ tier: null, enrolled: false });
        setError(null);
        setLoading(false);
        setOfferingsLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check sandbox mode setting from database (best-effort when logged out)
        try {
          const { data: sandboxData } = await supabase.rpc('get_sandbox_mode');
          const isSandbox = !!sandboxData && typeof sandboxData === 'object' && 'enabled' in sandboxData && sandboxData.enabled === true;
          setSandboxMode(isSandbox);
          debug.log('Sandbox mode from DB:', isSandbox);
        } catch (err) {
          debug.log('Could not fetch sandbox mode, using production');
          setSandboxMode(false);
        }

        debug.log('Initializing RevenueCat for user:', user.id);
        await initializeRevenueCat(user.id);

        try {
          await syncPurchases();
        } catch (syncError) {
          debug.log('Could not sync purchases (non-critical):', syncError);
        }

        const info = await getCustomerInfo();
        if (cancelled) return;
        setCustomerInfo(info);

        // Sync only promotes — never writes false from a negative Web lookup
        try {
          await syncRevenueCatToSupabase(user.id, info);
        } catch (supabaseError) {
          debug.log('Could not sync to Supabase (non-critical):', supabaseError);
        }

        const resolvedAccess = await resolveSubscriptionAccess(user.id, info);
        if (cancelled) return;
        setAccess(resolvedAccess);

        debug.log('RevenueCat initialized successfully. Tier:', resolvedAccess.tier);
      } catch (err: any) {
        if (cancelled) return;
        debug.error('Error initializing RevenueCat:', err);
        setError(err.message || 'Failed to initialize RevenueCat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const fetchHardPaywallOfferings = useCallback(async (): Promise<Offerings> => {
    const geolocatedOfferings = await getOfferings();
    const geolocatedPackages = getHardPaywallPackages(geolocatedOfferings);
    if (
      geolocatedPackages &&
      hasRenderableYearlyIntroOffer(geolocatedPackages)
    ) {
      return geolocatedOfferings;
    }

    debug.log(
      'A required hardPaywall price or intro phase is unavailable for the geolocated currency; retrying USD.'
    );
    const usdOfferings = await getOfferings({ currency: 'USD' });
    const usdPackages = getHardPaywallPackages(usdOfferings);
    if (!usdPackages) {
      throw new Error(
        'The required WagerProof Pro plans are unavailable for your currency.'
      );
    }

    if (!hasRenderableYearlyIntroOffer(usdPackages)) {
      debug.log(
        'The yearly introductory phase is not available for this customer; hiding the ineligible intro plan.'
      );
    }

    return usdOfferings;
  }, []);

  // Fetch only the authenticated user's offerings. The first request uses
  // RevenueCat geolocation; the helper performs one explicit USD fallback and
  // fails closed unless all three required hardPaywall packages are present.
  useEffect(() => {
    let cancelled = false;

    if (authLoading || loading) return;
    if (!user || !isRevenueCatConfigured()) {
      setOfferings(null);
      setOfferingsLoading(false);
      return;
    }

    const fetchOfferingsForUser = async () => {
      try {
        setOfferingsLoading(true);
        const offers = await fetchHardPaywallOfferings();
        if (cancelled) return;

        debug.log('📦 hardPaywall offering fetched:', {
          allOfferingIds: Object.keys(offers.all),
          packageIds: getHardPaywallPackages(offers)?.map((pkg) => pkg.identifier),
        });
        setOfferings(offers);
      } catch (err: any) {
        if (cancelled) return;
        debug.error('Error fetching hardPaywall offering:', err);
        setOfferings(null);
        setError(err.message || 'Failed to load subscription plans');
      } finally {
        if (!cancelled) setOfferingsLoading(false);
      }
    };

    fetchOfferingsForUser();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    loading,
    user?.id,
    fetchHardPaywallOfferings,
  ]);

  // Refresh customer info
  const refreshCustomerInfo = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setError(null);
      const info = await getCustomerInfo();
      setCustomerInfo(info);

      await syncRevenueCatToSupabase(user.id, info);

      const resolvedAccess = await resolveSubscriptionAccess(user.id, info);
      setAccess(resolvedAccess);
      return resolvedAccess.tier !== null;
    } catch (err: any) {
      debug.error('Error refreshing customer info:', err);
      setError(err.message || 'Failed to refresh customer info');
      throw err;
    }
  }, [user]);

  // Refresh offerings
  const refreshOfferings = useCallback(async () => {
    if (!user) {
      setOfferings(null);
      setOfferingsLoading(false);
      setError('Sign in to view WagerProof Pro plans.');
      return;
    }

    if (!isRevenueCatConfigured()) {
      try {
        await initializeRevenueCat(user.id);
      } catch (err: any) {
        debug.error('Could not configure RevenueCat for offerings refresh:', err);
        setError(err.message || 'Failed to configure RevenueCat');
        return;
      }
    }

    try {
      setOfferingsLoading(true);
      setError(null);
      const offers = await fetchHardPaywallOfferings();
      setOfferings(offers);
    } catch (err: any) {
      debug.error('Error refreshing offerings:', err);
      setError(err.message || 'Failed to refresh offerings');
      setOfferings(null);
    } finally {
      setOfferingsLoading(false);
    }
  }, [user, fetchHardPaywallOfferings]);

  // Purchase a package
  const purchase = useCallback(async (
    pkg: Package
  ): Promise<VerifiedWebPurchaseResult> => {
    if (!user) {
      throw new Error('User must be authenticated to make a purchase');
    }

    try {
      setError(null);
      debug.log('Purchasing package:', pkg.identifier);
      
      const result = await purchasePackage(pkg);
      setCustomerInfo(result.customerInfo);

      const tier = resolveSubscriptionTier(Object.keys(result.customerInfo.entitlements.active));
      if (tier) {
        await syncRevenueCatToSupabase(user.id, result.customerInfo);
        setAccess(await resolveSubscriptionAccess(user.id, result.customerInfo));
      } else {
        setError('Your payment completed, but your subscription could not be verified yet.');
      }

      return result;
    } catch (err: any) {
      if (isUserCancelledPurchaseError(err)) {
        debug.log('Purchase cancelled by user');
        throw err;
      }
      debug.error('Error during purchase:', err);
      setError(err.message || 'Purchase failed');
      throw err;
    }
  }, [user]);

  // Sync purchases manually
  const syncPurchasesManually = useCallback(async (): Promise<boolean> => {
    if (!user || !isRevenueCatConfigured()) return false;

    try {
      setError(null);
      await syncPurchases();
      const hasAccess = await refreshCustomerInfo();
      debug.log('Purchases synced successfully');
      return hasAccess;
    } catch (err: any) {
      debug.error('Error syncing purchases:', err);
      setError(err.message || 'Failed to sync purchases');
      throw err;
    }
  }, [user, refreshCustomerInfo]);

  const value = {
    customerInfo,
    offerings,
    hasProAccess,
    subscriptionTier,
    isTieredCustomer,
    hasSubscription,
    loading,
    offeringsLoading,
    error,
    refreshCustomerInfo,
    refreshOfferings,
    purchase,
    syncPurchasesManually,
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
