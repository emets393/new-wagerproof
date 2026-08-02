import {
  ErrorCode,
  Purchases,
  PurchasesError,
  type CustomerInfo,
  type GetOfferingsParams,
  type Offerings,
  type Package,
  type PurchaseResult,
  type RedemptionInfo,
} from '@revenuecat/purchases-js';
import debug from '@/utils/debug';

// Entitlement identifier - must match mobile app
export const ENTITLEMENT_IDENTIFIER = 'WagerProof Pro';

// Product identifiers - must match mobile app
export const PRODUCT_IDENTIFIERS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
} as const;

export type ProductIdentifier = typeof PRODUCT_IDENTIFIERS[keyof typeof PRODUCT_IDENTIFIERS];

let configuredInstance: Purchases | null = null;
let activeAuthenticatedUserId: string | null = null;

// RevenueCat Web Billing public keys (safe for the browser bundle). The
// production key is intentionally named explicitly so it can never be confused
// with the iOS `appl_` key or a secret RevenueCat API key.
const WEB_BILLING_PUBLIC_API_KEY = 'rcb_FimpgqhaUgXMNBUtlduWndNxaHLz';
const SANDBOX_API_KEY = 'rcb_TXEVSXWeblisvQJwlYTinPYQhbQH';

// Track which mode we're in (will be set from database)
let useSandboxMode = false;

/**
 * Set sandbox mode (called from context on initialization)
 */
export function setSandboxMode(enabled: boolean): void {
  useSandboxMode = enabled;
  debug.log('Sandbox mode set to:', enabled);
}

/**
 * Get the API key based on sandbox mode setting
 */
function getApiKey(): string {
  // Check if sandbox mode is enabled (from admin toggle)
  if (useSandboxMode) {
    debug.log('Using RevenueCat SANDBOX API key (test mode)');
    return SANDBOX_API_KEY;
  }
  
  debug.log('Using RevenueCat PRODUCTION API key');
  return WEB_BILLING_PUBLIC_API_KEY;
}

/**
 * RevenueCat App User IDs are case-sensitive. Native iOS normalizes Supabase
 * UUIDs to lowercase before login, and the React Native app uses the lowercase
 * Supabase `user.id`, so web must do the same.
 */
export function normalizeRevenueCatAppUserId(userId: string): string {
  const normalized = userId.trim().toLowerCase();
  if (!normalized) {
    throw new Error('A logged-in App User ID is required for RevenueCat Web Billing.');
  }
  return normalized;
}

/**
 * Configure RevenueCat once for an authenticated user. If another identified
 * account signs in during the same browser session, switch identities with the
 * SDK instead of trying to configure the singleton again.
 */
export async function initializeRevenueCat(userId: string): Promise<Purchases> {
  try {
    const appUserId = normalizeRevenueCatAppUserId(userId);

    if (!configuredInstance && Purchases.isConfigured()) {
      configuredInstance = Purchases.getSharedInstance();
    }

    if (!configuredInstance) {
      const apiKey = getApiKey();
      debug.log('Configuring RevenueCat Web SDK with authenticated user:', appUserId);
      configuredInstance = Purchases.configure({ apiKey, appUserId });
    } else if (configuredInstance.getAppUserId() !== appUserId) {
      debug.log('Changing RevenueCat Web SDK authenticated user:', appUserId);
      await configuredInstance.changeUser(appUserId);
    }

    if (configuredInstance.getAppUserId() !== appUserId) {
      throw new Error('RevenueCat App User ID did not match the logged-in WagerProof account.');
    }

    if (activeAuthenticatedUserId === appUserId) {
      debug.log('RevenueCat already configured, returning existing instance');
      return configuredInstance;
    }

    activeAuthenticatedUserId = appUserId;
    debug.log('RevenueCat Web SDK configured successfully');
    return configuredInstance;
  } catch (error) {
    debug.error('Error initializing RevenueCat:', error);
    activeAuthenticatedUserId = null;
    throw error;
  }
}

/**
 * Check if RevenueCat is configured
 */
export function isRevenueCatConfigured(): boolean {
  return configuredInstance !== null && activeAuthenticatedUserId !== null;
}

/**
 * Get the configured Purchases instance
 */
export function getPurchasesInstance(): Purchases {
  if (!configuredInstance || !activeAuthenticatedUserId) {
    throw new Error('RevenueCat is not configured for an authenticated user.');
  }

  if (configuredInstance.getAppUserId() !== activeAuthenticatedUserId) {
    throw new Error('RevenueCat identity does not match the logged-in WagerProof account.');
  }

  return configuredInstance;
}

/**
 * Get current customer info
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  try {
    const purchases = getPurchasesInstance();
    const customerInfo = await purchases.getCustomerInfo();
    debug.log('Customer info retrieved:', customerInfo);
    return customerInfo;
  } catch (error) {
    debug.error('Error fetching customer info:', error);
    throw error;
  }
}

/**
 * Check if user has active "WagerProof Pro" entitlement
 */
export async function hasActiveEntitlement(): Promise<boolean> {
  try {
    const customerInfo = await getCustomerInfo();
    const hasEntitlement = ENTITLEMENT_IDENTIFIER in customerInfo.entitlements.active;
    debug.log('Has active entitlement:', hasEntitlement);
    return hasEntitlement;
  } catch (error) {
    debug.error('Error checking entitlement:', error);
    return false;
  }
}

/**
 * Get available offerings
 */
export async function getOfferings(params?: GetOfferingsParams): Promise<Offerings> {
  try {
    const purchases = getPurchasesInstance();
    const offerings = await purchases.getOfferings(params);
    debug.log('Offerings retrieved:', offerings);
    debug.log('Environment:', useSandboxMode ? 'SANDBOX' : 'PRODUCTION');
    debug.log('Current offering:', offerings.current);
    debug.log('All offerings:', Object.keys(offerings.all));
    
    return offerings;
  } catch (error) {
    debug.error('Error fetching offerings:', error);
    throw error;
  }
}

/**
 * A purchase result paired with a fresh post-checkout CustomerInfo read. The
 * returned entitlement boolean is the only signal the paywall may use to
 * unlock after a web purchase.
 */
export interface VerifiedWebPurchaseResult {
  purchaseResult: PurchaseResult;
  customerInfo: CustomerInfo;
  redemptionInfo: RedemptionInfo | null;
  hasProEntitlement: boolean;
}

export function isUserCancelledPurchaseError(error: unknown): boolean {
  return (
    error instanceof PurchasesError &&
    error.errorCode === ErrorCode.UserCancelledError
  );
}

export async function purchasePackage(pkg: Package): Promise<VerifiedWebPurchaseResult> {
  try {
    const purchases = getPurchasesInstance();
    debug.log('Initiating purchase for package:', pkg.identifier);
    debug.log('Environment:', useSandboxMode ? 'SANDBOX' : 'PRODUCTION');
    debug.log('Package details:', {
      identifier: pkg.identifier,
      productId: pkg.webBillingProduct.identifier,
      price: pkg.webBillingProduct.price.formattedPrice,
      currency: pkg.webBillingProduct.price.currency,
    });
    
    const purchaseResult = await purchases.purchase({ rcPackage: pkg });
    const customerInfo = await purchases.getCustomerInfo();
    const hasProEntitlement =
      ENTITLEMENT_IDENTIFIER in customerInfo.entitlements.active;

    debug.log('Purchase completed. Fresh Pro entitlement:', hasProEntitlement);
    return {
      purchaseResult,
      customerInfo,
      redemptionInfo: purchaseResult.redemptionInfo,
      hasProEntitlement,
    };
  } catch (error: unknown) {
    if (isUserCancelledPurchaseError(error)) {
      debug.log('Purchase cancelled by user');
      throw error;
    }
    
    debug.error('Error purchasing package:', error);
    const purchaseError = error as {
      message?: string;
      errorCode?: number;
      underlyingErrorMessage?: string | null;
    };
    debug.error('Error details:', {
      message: purchaseError.message,
      errorCode: purchaseError.errorCode,
      underlyingErrorMessage: purchaseError.underlyingErrorMessage,
      environment: useSandboxMode ? 'SANDBOX' : 'PRODUCTION',
    });
    throw error;
  }
}

/**
 * Sync purchases (Web SDK doesn't need explicit sync - just fetch customer info)
 */
export async function syncPurchases(): Promise<void> {
  try {
    // Web SDK automatically syncs when we fetch customer info
    await getCustomerInfo();
    debug.log('Customer info refreshed successfully');
  } catch (error) {
    debug.error('Error refreshing customer info:', error);
    throw error;
  }
}

/**
 * Get active subscription type
 */
export function getActiveSubscriptionType(customerInfo: CustomerInfo): ProductIdentifier | null {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER];
  if (!entitlement) {
    return null;
  }

  const productId = entitlement.productIdentifier.toLowerCase();
  
  if (productId.includes('monthly')) {
    return PRODUCT_IDENTIFIERS.MONTHLY;
  } else if (productId.includes('yearly') || productId.includes('annual')) {
    return PRODUCT_IDENTIFIERS.YEARLY;
  } else if (productId.includes('lifetime')) {
    return PRODUCT_IDENTIFIERS.LIFETIME;
  }

  return null;
}

/**
 * Check if subscription is active and not expired
 */
export function isSubscriptionActive(customerInfo: CustomerInfo): boolean {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER];
  if (!entitlement) {
    return false;
  }

  // Check if it's active (RevenueCat only includes active entitlements in the active object)
  return true;
}

/**
 * Deactivate RevenueCat on logout without reconfiguring the singleton
 * anonymously. A future authenticated session will call `changeUser` before
 * any customer, offering, or purchase request is allowed.
 */
export function resetRevenueCat(): void {
  debug.log('Deactivating RevenueCat for signed-out session');
  activeAuthenticatedUserId = null;
}
