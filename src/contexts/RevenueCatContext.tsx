import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CustomerInfo, Offerings, Package } from '@revenuecat/purchases-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  initializeRevenueCat,
  getCustomerInfo,
  hasActiveEntitlement,
  getOfferings,
  purchasePackage,
  syncPurchases,
  resetRevenueCat,
  isRevenueCatConfigured,
  setSandboxMode,
  ENTITLEMENT_IDENTIFIER,
} from '@/services/revenuecatWeb';
import { syncRevenueCatToSupabase } from '@/utils/syncRevenueCatToSupabase';
import debug from '@/utils/debug';

interface RevenueCatContextType {
  customerInfo: CustomerInfo | null;
  offerings: Offerings | null;
  hasProAccess: boolean;
  loading: boolean;
  offeringsLoading: boolean;
  error: string | null;
  refreshCustomerInfo: () => Promise<void>;
  refreshOfferings: () => Promise<void>;
  purchase: (pkg: Package) => Promise<CustomerInfo>;
  syncPurchasesManually: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [hasProAccess, setHasProAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize RevenueCat when the session changes. Authenticated users get a
  // named customer; signed-out sessions still configure anonymously so offerings
  // (and /paywall-test) can load plan prices for preview.
  useEffect(() => {
    const initialize = async () => {
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

        if (!user) {
          debug.log('No user — configuring RevenueCat anonymously for offerings preview');
          resetRevenueCat();
          await initializeRevenueCat();
          setCustomerInfo(null);
          setHasProAccess(false);
          return;
        }

        debug.log('Initializing RevenueCat for user:', user.id);
        await initializeRevenueCat(user.id);

        try {
          await syncPurchases();
        } catch (syncError) {
          debug.log('Could not sync purchases (non-critical):', syncError);
        }

        const info = await getCustomerInfo();
        setCustomerInfo(info);

        const hasAccess = ENTITLEMENT_IDENTIFIER in info.entitlements.active;
        setHasProAccess(hasAccess);

        try {
          await syncRevenueCatToSupabase(user.id, info);
        } catch (supabaseError) {
          debug.log('Could not sync to Supabase (non-critical):', supabaseError);
        }

        debug.log('RevenueCat initialized successfully. Has Pro:', hasAccess);
      } catch (err: any) {
        debug.error('Error initializing RevenueCat:', err);
        setError(err.message || 'Failed to initialize RevenueCat');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [user]);

  // Fetch offerings after initialization (works for anonymous + authenticated)
  useEffect(() => {
    const fetchOfferings = async (retryCount = 0) => {
      if (!isRevenueCatConfigured()) {
        // Wait for initialize() — retry briefly rather than giving up.
        if (retryCount < 6) {
          setTimeout(() => fetchOfferings(retryCount + 1), 400);
          return;
        }
        debug.log('RevenueCat not configured, skipping offerings fetch');
        setOfferingsLoading(false);
        return;
      }

      try {
        setOfferingsLoading(true);
        debug.log(`🔄 Fetching offerings from RevenueCat... (attempt ${retryCount + 1})`);
        const offers = await getOfferings();
        debug.log('📦 Offerings fetched:', {
          current: offers.current?.identifier,
          allOfferingsCount: Object.keys(offers.all).length,
          allOfferingIds: Object.keys(offers.all),
        });
        setOfferings(offers);
        setOfferingsLoading(false);
      } catch (err: any) {
        debug.error('❌ Error fetching offerings:', err);
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          debug.log(`Retrying offerings fetch in ${delay}ms...`);
          setTimeout(() => {
            fetchOfferings(retryCount + 1);
          }, delay);
        } else {
          debug.error('Failed to fetch offerings after 3 retries');
          setOfferingsLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchOfferings();
    }, 500);

    return () => clearTimeout(timer);
  }, [user, loading]);

  // Refresh customer info
  const refreshCustomerInfo = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const info = await getCustomerInfo();
      setCustomerInfo(info);
      
      const hasAccess = ENTITLEMENT_IDENTIFIER in info.entitlements.active;
      setHasProAccess(hasAccess);
      
      // Sync to Supabase
      await syncRevenueCatToSupabase(user.id, info);
    } catch (err: any) {
      debug.error('Error refreshing customer info:', err);
      setError(err.message || 'Failed to refresh customer info');
    }
  }, [user]);

  // Refresh offerings
  const refreshOfferings = useCallback(async () => {
    if (!isRevenueCatConfigured()) {
      try {
        await initializeRevenueCat(user?.id);
      } catch (err: any) {
        debug.error('Could not configure RevenueCat for offerings refresh:', err);
        setError(err.message || 'Failed to configure RevenueCat');
        return;
      }
    }

    try {
      setOfferingsLoading(true);
      const offers = await getOfferings();
      setOfferings(offers);
      setOfferingsLoading(false);
    } catch (err: any) {
      debug.error('Error refreshing offerings:', err);
      setError(err.message || 'Failed to refresh offerings');
      setOfferingsLoading(false);
    }
  }, [user?.id]);

  // Purchase a package
  const purchase = useCallback(async (pkg: Package): Promise<CustomerInfo> => {
    if (!user) {
      throw new Error('User must be authenticated to make a purchase');
    }

    try {
      setError(null);
      debug.log('Purchasing package:', pkg.identifier);
      
      const info = await purchasePackage(pkg);
      setCustomerInfo(info);
      
      const hasAccess = ENTITLEMENT_IDENTIFIER in info.entitlements.active;
      setHasProAccess(hasAccess);
      
      // Sync to Supabase
      await syncRevenueCatToSupabase(user.id, info);
      
      debug.log('Purchase successful, Pro access:', hasAccess);
      return info;
    } catch (err: any) {
      debug.error('Error during purchase:', err);
      setError(err.message || 'Purchase failed');
      throw err;
    }
  }, [user]);

  // Sync purchases manually
  const syncPurchasesManually = useCallback(async () => {
    if (!user || !isRevenueCatConfigured()) return;

    try {
      setError(null);
      await syncPurchases();
      await refreshCustomerInfo();
      debug.log('Purchases synced successfully');
    } catch (err: any) {
      debug.error('Error syncing purchases:', err);
      setError(err.message || 'Failed to sync purchases');
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

