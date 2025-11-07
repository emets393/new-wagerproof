import { Platform, NativeModules } from 'react-native';

// RevenueCat API Key
const REVENUECAT_API_KEY = 'test_WwRgjLydsPjgngueRMOVfVgWZzg';

// Entitlement identifier
export const ENTITLEMENT_IDENTIFIER = 'WagerProof Pro';

// Product identifiers
export const PRODUCT_IDENTIFIERS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
} as const;

export type ProductIdentifier = typeof PRODUCT_IDENTIFIERS[keyof typeof PRODUCT_IDENTIFIERS];

// Track initialization state
let isConfigured = false;
let Purchases: any = null;
let CustomerInfo: any = null;
let PurchasesOffering: any = null;
let PurchasesPackage: any = null;
let LOG_LEVEL: any = null;

// Lazy load RevenueCat module to avoid errors if native module isn't available
function getPurchasesModule() {
  if (Purchases !== null) {
    return Purchases;
  }

  // Check if we're on web (native modules don't work on web)
  if (Platform.OS === 'web') {
    return null;
  }

  // Check if native module is available before requiring
  try {
    const RNPurchases = NativeModules.RNPurchases;
    if (!RNPurchases) {
      console.warn('RevenueCat native module (RNPurchases) not found in NativeModules');
      return null;
    }
  } catch (e) {
    console.warn('Could not check NativeModules:', e);
    // Continue anyway - might work
  }

  try {
    // Try to import the module - this might throw if native module isn't linked
    const purchasesModule = require('react-native-purchases');
    
    // Check if the module loaded correctly
    if (!purchasesModule || !purchasesModule.default) {
      console.warn('RevenueCat module loaded but default export not found');
      return null;
    }

    Purchases = purchasesModule.default;
    CustomerInfo = purchasesModule.CustomerInfo;
    PurchasesOffering = purchasesModule.PurchasesOffering;
    PurchasesPackage = purchasesModule.PurchasesPackage;
    LOG_LEVEL = purchasesModule.LOG_LEVEL;

    return Purchases;
  } catch (error: any) {
    // Catch the specific NativeEventEmitter error
    if (error?.message?.includes('NativeEventEmitter') || error?.message?.includes('non-null')) {
      console.warn('RevenueCat native module not linked. Make sure you:');
      console.warn('1. Rebuilt the app after installing: npx expo run:ios');
      console.warn('2. Are not using Expo Go (use Expo Dev Client)');
      console.warn('3. Restarted Metro bundler');
      return null;
    }
    console.warn('Failed to load RevenueCat module:', error.message);
    return null;
  }
}

/**
 * Check if RevenueCat is available and configured
 */
function isRevenueCatAvailable(): boolean {
  try {
    // Check if we're on web (native modules don't work on web)
    if (Platform.OS === 'web') {
      return false;
    }
    
    const module = getPurchasesModule();
    if (!module) {
      return false;
    }

    // Additional check: verify native module is linked
    try {
      const RNPurchases = NativeModules.RNPurchases;
      if (!RNPurchases) {
        console.warn('RevenueCat native module (RNPurchases) not found in NativeModules');
        return false;
      }
    } catch (e) {
      // NativeModules check failed, but module might still work
      console.warn('Could not verify RevenueCat native module:', e);
    }

    return isConfigured && module !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize RevenueCat SDK
 * Should be called once when the app starts
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  try {
    // Check platform first
    if (Platform.OS === 'web') {
      console.warn('RevenueCat is not available on web platform');
      return;
    }

    // Get the Purchases module
    const PurchasesModule = getPurchasesModule();
    if (!PurchasesModule) {
      console.warn('RevenueCat module not available. Make sure the app is rebuilt after installing react-native-purchases.');
      return;
    }

    // Verify native module is linked
    try {
      const RNPurchases = NativeModules.RNPurchases;
      if (!RNPurchases) {
        console.warn('RevenueCat native module (RNPurchases) not found. Run: cd ios && pod install && cd .. && npx expo run:ios');
        return;
      }
    } catch (e) {
      console.warn('Could not verify RevenueCat native module. The app may need to be rebuilt.');
    }

    // Configure RevenueCat first (must be called before any other methods)
    // TODO: Replace REVENUECAT_API_KEY with your production key before release
    await PurchasesModule.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId || null, // Use anonymous ID if not logged in
    });

    isConfigured = true;

    // Set log level AFTER configuration
    // Enable debug logging in development
    if (__DEV__ && LOG_LEVEL) {
      try {
        PurchasesModule.setLogLevel(LOG_LEVEL.DEBUG);
        console.log('RevenueCat debug logging enabled');
      } catch (logError) {
        console.warn('Could not set RevenueCat log level:', logError);
      }
    }

    // Optional: Allow sharing store account across devices
    // Uncomment if you want users to share subscriptions across devices
    // try {
    //   PurchasesModule.setAllowSharingStoreAccount(true);
    // } catch (e) {
    //   console.warn('Could not set allow sharing store account:', e);
    // }

    console.log('RevenueCat initialized successfully');
  } catch (error: any) {
    console.error('Error initializing RevenueCat:', error);
    // Don't throw - allow app to continue without RevenueCat
    isConfigured = false;
    if (error?.message?.includes('native') || error?.message?.includes('null')) {
      console.warn('RevenueCat native module error. Make sure to:');
      console.warn('1. Rebuild the app: npx expo run:ios or npx expo run:android');
      console.warn('2. For iOS: cd ios && pod install');
      console.warn('3. Restart Metro bundler');
    }
  }
}

/**
 * Set the user ID for RevenueCat
 * Call this when user logs in or when user ID changes
 */
export async function setRevenueCatUserId(userId: string): Promise<void> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      console.warn('RevenueCat is not configured. Skipping user ID set.');
      return;
    }
    await PurchasesModule.logIn(userId);
    console.log('RevenueCat user ID set:', userId);
  } catch (error) {
    console.error('Error setting RevenueCat user ID:', error);
    throw error;
  }
}

/**
 * Log out the current user from RevenueCat
 * Call this when user logs out
 */
export async function logOutRevenueCat(): Promise<void> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      console.warn('RevenueCat is not configured. Skipping logout.');
      return;
    }
    await PurchasesModule.logOut();
    console.log('RevenueCat user logged out');
  } catch (error) {
    console.error('Error logging out RevenueCat user:', error);
    throw error;
  }
}

/**
 * Get current customer info
 */
export async function getCustomerInfo(): Promise<any> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      throw new Error('RevenueCat is not configured');
    }
    const customerInfo = await PurchasesModule.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Error fetching customer info:', error);
    throw error;
  }
}

/**
 * Check if user has active entitlement
 */
export async function hasActiveEntitlement(): Promise<boolean> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      return false;
    }
    const customerInfo = await PurchasesModule.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
  } catch (error) {
    console.error('Error checking entitlement:', error);
    return false;
  }
}

/**
 * Get available offerings
 */
export async function getOfferings(): Promise<any> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      return null;
    }
    const offerings = await PurchasesModule.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(packageToPurchase: any): Promise<any> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      throw new Error('RevenueCat is not configured');
    }
    const { customerInfo } = await PurchasesModule.purchasePackage(packageToPurchase);
    return customerInfo;
  } catch (error: any) {
    // Handle user cancellation
    if (error.userCancelled) {
      throw new Error('Purchase cancelled by user');
    }
    // Handle other errors
    console.error('Error purchasing package:', error);
    throw error;
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<any> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      throw new Error('RevenueCat is not configured');
    }
    const customerInfo = await PurchasesModule.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
}

/**
 * Present Customer Center UI
 * Shows the native Customer Center modal with subscription management
 */
export async function presentCustomerCenter(): Promise<void> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      throw new Error('RevenueCat is not configured');
    }

    // Check if presentCustomerCenter method exists
    if (typeof PurchasesModule.presentCustomerCenter === 'function') {
      await PurchasesModule.presentCustomerCenter();
    } else {
      // Fallback: try presentCodeRedemptionSheet or show message
      console.warn('presentCustomerCenter not available. Customer Center may not be enabled in RevenueCat dashboard.');
      throw new Error('Customer Center is not available. Please enable it in RevenueCat dashboard.');
    }
  } catch (error: any) {
    console.error('Error presenting Customer Center:', error);
    throw error;
  }
}

/**
 * Get available packages from current offering
 */
export async function getAvailablePackages(): Promise<any[]> {
  try {
    const offering = await getOfferings();
    if (!offering) {
      return [];
    }
    return offering.availablePackages || [];
  } catch (error) {
    console.error('Error fetching packages:', error);
    return [];
  }
}

/**
 * Check if a specific product is purchased
 */
export function isProductPurchased(customerInfo: any, productIdentifier: string): boolean {
  return customerInfo?.entitlements?.active?.[ENTITLEMENT_IDENTIFIER]?.productIdentifier === productIdentifier;
}

/**
 * Get active subscription period type
 */
export function getActiveSubscriptionType(customerInfo: any): 'monthly' | 'yearly' | 'lifetime' | null {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER];
  if (!entitlement) {
    return null;
  }

  const productId = entitlement.productIdentifier.toLowerCase();
  if (productId.includes('monthly')) {
    return 'monthly';
  } else if (productId.includes('yearly') || productId.includes('annual')) {
    return 'yearly';
  } else if (productId.includes('lifetime')) {
    return 'lifetime';
  }

  return null;
}

/**
 * Check if subscription is active and not expired
 */
export function isSubscriptionActive(customerInfo: any): boolean {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER];
  if (!entitlement) {
    return false;
  }

  // Check if it's a lifetime purchase (no expiration)
  if (entitlement.willRenew === false && entitlement.periodType === 'NORMAL') {
    return true; // Lifetime purchase
  }

  // Check expiration date for subscriptions
  if (entitlement.expirationDate) {
    return new Date(entitlement.expirationDate) > new Date();
  }

  return entitlement.willRenew === true;
}

