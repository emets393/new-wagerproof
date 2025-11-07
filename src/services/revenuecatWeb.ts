import { Purchases, CustomerInfo, Offerings, Package } from '@revenuecat/purchases-js';
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

// Track initialization state
let isConfigured = false;
let configuredInstance: Purchases | null = null;

/**
 * Get the API key based on environment
 */
function getApiKey(): string {
  // Use sandbox key in development, production key in production
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  
  if (isDevelopment) {
    const sandboxKey = import.meta.env.VITE_REVENUECAT_WEB_SANDBOX_API_KEY;
    if (sandboxKey) {
      debug.log('Using RevenueCat sandbox API key');
      return sandboxKey;
    }
  }
  
  const publicKey = import.meta.env.VITE_REVENUECAT_WEB_PUBLIC_API_KEY;
  if (!publicKey) {
    throw new Error('RevenueCat API key not found in environment variables');
  }
  
  return publicKey;
}

/**
 * Initialize RevenueCat SDK
 * Should be called once when the user is authenticated
 */
export async function initializeRevenueCat(userId?: string): Promise<Purchases | null> {
  try {
    // Don't re-configure if already configured
    if (isConfigured && configuredInstance) {
      debug.log('RevenueCat already configured, returning existing instance');
      return configuredInstance;
    }

    const apiKey = getApiKey();
    
    debug.log('Configuring RevenueCat Web SDK with user:', userId || 'anonymous');
    
    // Configure the SDK
    const purchases = Purchases.configure(apiKey, userId);
    
    isConfigured = true;
    configuredInstance = purchases;
    
    debug.log('RevenueCat Web SDK configured successfully');
    return purchases;
  } catch (error) {
    debug.error('Error initializing RevenueCat:', error);
    isConfigured = false;
    configuredInstance = null;
    throw error;
  }
}

/**
 * Check if RevenueCat is configured
 */
export function isRevenueCatConfigured(): boolean {
  return isConfigured && configuredInstance !== null;
}

/**
 * Get the configured Purchases instance
 */
export function getPurchasesInstance(): Purchases {
  if (!isConfigured || !configuredInstance) {
    throw new Error('RevenueCat is not configured. Call initializeRevenueCat() first.');
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
export async function getOfferings(): Promise<Offerings> {
  try {
    const purchases = getPurchasesInstance();
    const offerings = await purchases.getOfferings();
    debug.log('Offerings retrieved:', offerings);
    return offerings;
  } catch (error) {
    debug.error('Error fetching offerings:', error);
    throw error;
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(pkg: Package): Promise<CustomerInfo> {
  try {
    const purchases = getPurchasesInstance();
    debug.log('Initiating purchase for package:', pkg.identifier);
    
    const { customerInfo } = await purchases.purchase({ rcPackage: pkg });
    
    debug.log('Purchase completed successfully:', customerInfo);
    return customerInfo;
  } catch (error: any) {
    // User cancellation is normal, don't log as error
    if (error?.errorCode === 1 || error?.message?.includes('cancel')) {
      debug.log('Purchase cancelled by user');
      throw new Error('USER_CANCELLED');
    }
    
    debug.error('Error purchasing package:', error);
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
 * Reset the configuration state (useful for logout)
 */
export function resetRevenueCat(): void {
  debug.log('Resetting RevenueCat configuration');
  isConfigured = false;
  configuredInstance = null;
}

