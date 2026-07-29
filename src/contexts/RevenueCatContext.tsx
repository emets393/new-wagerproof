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
  resolveServerEntitlement,
  syncRevenueCatToSupabase,
} from '@/utils/syncRevenueCatToSupabase';
import debug from '@/utils/debug';

/**
 * Web Billing alone misses store purchases on other RC identities.
 * Promote when RC Web says Pro; otherwise OR in mirror + server resolve.
 */
async function resolveHasProAccess(
  userId: string,
  customerInfo: CustomerInfo | null,
): Promise<boolean> {
  if (customerInfo && ENTITLEMENT_IDENTIFIER in customerInfo.entitlements.active) {
    return true;
  }
  if (await checkSupabaseSubscription(userId)) {
    return true;
  }
  return resolveServerEntitlement();
}

interface RevenueCatContextType {
  customerInfo: CustomerInfo | null;
  offerings: Offerings | null;
  hasProAccess: boolean;
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
  const [hasProAccess, setHasProAccess] = useState(false);
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
        setHasProAccess(false);
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
          const isSandbox = sandboxData?.enabled ?? false;
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

        const hasAccess = await resolveHasProAccess(user.id, info);
        if (cancelled) return;
        setHasProAccess(hasAccess);

        debug.log('RevenueCat initialized successfully. Has Pro:', hasAccess);
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

      const hasAccess = await resolveHasProAccess(user.id, info);
      setHasProAccess(hasAccess);
      return hasAccess;
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

      if (result.hasProEntitlement) {
        await syncRevenueCatToSupabase(user.id, result.customerInfo);
        setHasProAccess(true);
        debug.log('Purchase verified with fresh WagerProof Pro entitlement.');
      } else {
        setHasProAccess(false);
        const verificationError =
          'Your payment completed, but WagerProof Pro could not be verified yet.';
        setError(verificationError);
        debug.error(verificationError);
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
