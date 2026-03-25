import { Platform, NativeModules } from 'react-native';
import {
  SubscriptionType,
  trackPaywallDismissed,
  trackPaywallViewed,
  trackSubscriptionPurchased,
  trackSubscriptionRestored,
} from './analytics';

// RevenueCat API Keys - Platform specific
const REVENUECAT_API_KEY_IOS = 'appl_TFQYZRtHkCBrnaILkniTjsulyHK';
const REVENUECAT_API_KEY_ANDROID = 'goog_cilRlGISDEjNmpNebMglZPXnPLb';

// Get the appropriate API key based on platform
const getRevenueCatApiKey = (): string => {
  if (Platform.OS === 'android') {
    return REVENUECAT_API_KEY_ANDROID;
  }
  return REVENUECAT_API_KEY_IOS;
};

// Entitlement identifier
export const ENTITLEMENT_IDENTIFIER = 'WagerProof Pro';

// Product identifiers
export const PRODUCT_IDENTIFIERS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
} as const;

export type ProductIdentifier = typeof PRODUCT_IDENTIFIERS[keyof typeof PRODUCT_IDENTIFIERS];

// These identifiers must match the placements configured in RevenueCat.
export const PAYWALL_PLACEMENTS = {
  ONBOARDING: 'onboarding',
  GENERIC_FEATURE: 'generic_feature',
  AGENT_FEATURE: 'agent_feature',
} as const;

export type PaywallPlacement = typeof PAYWALL_PLACEMENTS[keyof typeof PAYWALL_PLACEMENTS];

type PaywallSource = string;

const normalizePaywallResult = (result: unknown): string => {
  return String(result || '').toUpperCase();
};

const getSubscriptionTypeFromProductId = (productId?: string): SubscriptionType | null => {
  if (!productId) {
    return null;
  }

  const normalizedProductId = productId.toLowerCase();
  if (normalizedProductId.includes('lifetime')) return 'lifetime';
  if (normalizedProductId.includes('annual') || normalizedProductId.includes('yearly')) return 'yearly';
  if (normalizedProductId.includes('monthly')) return 'monthly';
  return null;
};

const findPackageForProductId = (offering: any, productId?: string): any | null => {
  if (!offering || !productId) {
    return null;
  }

  return (
    offering.availablePackages?.find((pkg: any) => {
      return pkg?.product?.identifier?.toLowerCase() === productId.toLowerCase();
    }) || null
  );
};

const getActiveEntitlement = (customerInfo: any) => {
  return customerInfo?.entitlements?.active?.[ENTITLEMENT_IDENTIFIER];
};

const trackPaywallResult = async (
  paywallResult: unknown,
  offering: any,
  source: PaywallSource
): Promise<void> => {
  const normalizedResult = normalizePaywallResult(paywallResult);

  if (normalizedResult.includes('CANCEL')) {
    trackPaywallDismissed(source, normalizedResult);
    return;
  }

  if (!normalizedResult.includes('PURCHASE') && !normalizedResult.includes('RESTORE')) {
    return;
  }

  const PurchasesModule = getPurchasesModule();
  if (!PurchasesModule) {
    return;
  }

  try {
    const customerInfo = await PurchasesModule.getCustomerInfo();
    const entitlement = getActiveEntitlement(customerInfo);
    const subscriptionType =
      getActiveSubscriptionType(customerInfo) ||
      getSubscriptionTypeFromProductId(entitlement?.productIdentifier);

    if (!subscriptionType) {
      return;
    }

    const activeOffering = offering || (await getOfferings());
    const matchingPackage = findPackageForProductId(activeOffering, entitlement?.productIdentifier);
    const price = matchingPackage?.product?.price;
    const currency = matchingPackage?.product?.currencyCode || 'USD';
    const isTrial = entitlement?.periodType === 'TRIAL';

    if (normalizedResult.includes('RESTORE')) {
      trackSubscriptionRestored(subscriptionType);
      return;
    }

    trackSubscriptionPurchased(
      subscriptionType,
      price ?? 0,
      currency,
      undefined,
      false,
      isTrial
    );

  } catch (error) {
    console.error('Error tracking paywall result analytics:', error);
  }
};

// Track initialization state
let isConfigured = false;
let Purchases: any = null;
let CustomerInfo: any = null;
let PurchasesOffering: any = null;
let PurchasesPackage: any = null;
let LOG_LEVEL: any = null;

function getRevenueCatUIModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const purchasesUI = require('react-native-purchases-ui');
    return {
      RevenueCatUI: purchasesUI.default,
      PAYWALL_RESULT: purchasesUI.PAYWALL_RESULT,
    };
  } catch (error: any) {
    console.warn('Could not load react-native-purchases-ui:', error.message);
    return null;
  }
}

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
 * Check if RevenueCat SDK is properly configured
 * Use this to verify initialization was successful
 */
export function isRevenueCatConfigured(): boolean {
  return isConfigured && getPurchasesModule() !== null;
}

/**
 * Initialize RevenueCat SDK
 * Should be called once when the app starts
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    const PurchasesModule = getPurchasesModule();
    if (!PurchasesModule) return;

    // Configure is the only required call — everything else is deferred
    const apiKey = getRevenueCatApiKey();
    await PurchasesModule.configure({
      apiKey,
      appUserID: userId || null,
    });

    isConfigured = true;

    // Set log level in dev
    if (__DEV__ && LOG_LEVEL) {
      try { PurchasesModule.setLogLevel(LOG_LEVEL.DEBUG); } catch {}
    }

    // Device identifiers & Facebook attribution are non-blocking — fire and forget
    // They can complete in the background after configure() returns
    Promise.all([
      PurchasesModule.collectDeviceIdentifiers().catch(() => {}),
      (async () => {
        try {
          const { AppEventsLogger } = require('react-native-fbsdk-next');
          const fbAnonId = await AppEventsLogger.getAnonymousID();
          if (fbAnonId) await PurchasesModule.setFBAnonymousID(fbAnonId);
        } catch {}
      })(),
    ]).catch(() => {});
  } catch (error: any) {
    // Don't throw — allow app to continue without RevenueCat
    isConfigured = false;
    if (__DEV__) {
      console.warn('RevenueCat init failed:', error?.message);
    }
  }
}

/**
 * Re-collect device identifiers and FB anonymous ID after ATT prompt resolves.
 * Call this once the user has responded to the ATT dialog so RevenueCat
 * picks up the IDFA (if granted) and the Meta integration has the strongest
 * possible signal.
 */
export async function refreshDeviceIdentifiers(): Promise<void> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!PurchasesModule || !isConfigured) return;

    await Promise.all([
      PurchasesModule.collectDeviceIdentifiers().catch(() => {}),
      (async () => {
        try {
          const { AppEventsLogger } = require('react-native-fbsdk-next');
          const fbAnonId = await AppEventsLogger.getAnonymousID();
          if (fbAnonId) await PurchasesModule.setFBAnonymousID(fbAnonId);
        } catch {}
      })(),
    ]);
  } catch {}
}

/**
 * Set the user ID for RevenueCat
 * Call this when user logs in or when user ID changes
 * Returns the CustomerInfo from the login response
 */
export async function setRevenueCatUserId(userId: string): Promise<any | null> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      return null;
    }

    const { customerInfo } = await PurchasesModule.logIn(userId);
    return customerInfo;
  } catch (error: any) {
    if (__DEV__) console.warn('RevenueCat logIn failed:', error?.message);
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
  } catch (error) {
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

export async function getCurrentOfferingForPlacement(placementIdentifier: string): Promise<any> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      return null;
    }

    if (typeof PurchasesModule.getCurrentOfferingForPlacement !== 'function') {
      throw new Error('Current RevenueCat SDK does not expose getCurrentOfferingForPlacement');
    }

    const offering = await PurchasesModule.getCurrentOfferingForPlacement(placementIdentifier);
    return offering;
  } catch {
    return null;
  }
}

export async function getPaywallOffering(placementIdentifier?: string | null): Promise<any> {
  if (placementIdentifier) {
    return getCurrentOfferingForPlacement(placementIdentifier);
  }

  return getOfferings();
}

/**
 * Get all offerings (not just current)
 */
export async function getAllOfferings(): Promise<any> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) return null;
    
    const offerings = await PurchasesModule.getOfferings();
    return offerings;
  } catch (error: any) {
    if (__DEV__) console.warn('Error fetching all offerings:', error?.message);
    return null;
  }
}

/**
 * Sync purchases and refresh offerings from server
 * This forces a refresh from RevenueCat servers, bypassing cache
 */
export async function syncPurchases(): Promise<void> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      throw new Error('RevenueCat is not configured');
    }
    await PurchasesModule.syncPurchases();
  } catch (error) {
    console.error('Error syncing purchases:', error);
    throw error;
  }
}

/**
 * Get a specific offering by identifier
 */
export async function getOfferingById(identifier: string): Promise<any> {
  try {
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) return null;

    const offerings = await PurchasesModule.getOfferings();

    if (offerings.all?.[identifier]) return offerings.all[identifier];
    if (offerings.current?.identifier === identifier) return offerings.current;

    return null;
  } catch {
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
 * Present RevenueCat Paywall V2 UI
 * Uses the official RevenueCatUI.presentPaywall() method
 * Returns the paywall result (PURCHASED, RESTORED, CANCELLED, NOT_PRESENTED, ERROR)
 * 
 * Paywalls V2 are fully configured in the RevenueCat dashboard.
 * The offering parameter is optional - if not provided, uses the current offering.
 */
export async function presentPaywall(
  offering?: any,
  source: PaywallSource = 'unknown'
): Promise<string> {
  try {
    // Check if we're on web (native modules don't work on web)
    if (Platform.OS === 'web') {
      throw new Error('RevenueCat Paywalls are not available on web platform');
    }

    // Check if RevenueCat is configured
    if (!isConfigured) {
      throw new Error('RevenueCat is not configured. Make sure initializeRevenueCat() was called successfully.');
    }

    const uiModule = getRevenueCatUIModule();
    if (!uiModule) {
      throw new Error('RevenueCat UI module not available. Make sure the app is rebuilt after installing react-native-purchases-ui.');
    }

    const { RevenueCatUI } = uiModule;

    if (!RevenueCatUI) {
      throw new Error('RevenueCat UI is not available');
    }

    trackPaywallViewed(source);

    // Present paywall using V2 API
    // Note: For V2, the paywall is configured in the dashboard and attached to an offering
    const paywallResult = await RevenueCatUI.presentPaywall({
      offering: offering || undefined,
      displayCloseButton: true, // Only affects original template paywalls, ignored for V2
    });
    
    await trackPaywallResult(paywallResult, offering, source);
    return paywallResult;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Present RevenueCat Paywall V2 if user doesn't have required entitlement
 * Uses the official RevenueCatUI.presentPaywallIfNeeded() method
 * 
 * This is the recommended way to show paywalls - it automatically checks
 * if the user already has the entitlement and only shows the paywall if needed.
 */
export async function presentPaywallIfNeeded(requiredEntitlementIdentifier: string, offering?: any): Promise<string> {
  try {
    // Check if we're on web (native modules don't work on web)
    if (Platform.OS === 'web') {
      throw new Error('RevenueCat Paywalls are not available on web platform');
    }

    // Check if RevenueCat is configured
    if (!isConfigured) {
      throw new Error('RevenueCat is not configured. Make sure initializeRevenueCat() was called successfully.');
    }

    const uiModule = getRevenueCatUIModule();
    if (!uiModule) {
      throw new Error('RevenueCat UI module not available. Make sure the app is rebuilt after installing react-native-purchases-ui.');
    }

    const { RevenueCatUI } = uiModule;

    if (!RevenueCatUI) {
      throw new Error('RevenueCat UI is not available');
    }

    // Present paywall if needed using V2 API
    const paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier,
      offering: offering || undefined,
      displayCloseButton: true, // Only affects original template paywalls, ignored for V2
    });
    
    return paywallResult;
  } catch (error: any) {
    console.error('Error presenting paywall if needed:', error);
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

export async function getAvailablePackagesForPlacement(placementIdentifier: string): Promise<any[]> {
  try {
    const offering = await getCurrentOfferingForPlacement(placementIdentifier);
    return offering?.availablePackages || [];
  } catch (error) {
    console.error('Error fetching packages for placement:', placementIdentifier, error);
    return [];
  }
}

export function didPaywallGrantEntitlement(result: string | null | undefined): boolean {
  const uiModule = getRevenueCatUIModule();
  const paywallResult = uiModule?.PAYWALL_RESULT;

  if (!paywallResult || !result) {
    return false;
  }

  return result === paywallResult.PURCHASED || result === paywallResult.RESTORED;
}

export async function presentPaywallForPlacement(
  placementIdentifier: string,
  source: PaywallSource = placementIdentifier
): Promise<string> {
  const uiModule = getRevenueCatUIModule();
  if (!uiModule?.RevenueCatUI) {
    throw new Error('RevenueCat UI is not available');
  }

  const offering = await getCurrentOfferingForPlacement(placementIdentifier);
  if (!offering) {
    return uiModule.PAYWALL_RESULT?.NOT_PRESENTED ?? 'NOT_PRESENTED';
  }

  return presentPaywall(offering, source);
}

export async function presentPaywallForPlacementIfNeeded(
  requiredEntitlementIdentifier: string,
  placementIdentifier: string,
  source: PaywallSource = placementIdentifier
): Promise<string> {
  const uiModule = getRevenueCatUIModule();
  if (!uiModule?.RevenueCatUI) {
    throw new Error('RevenueCat UI is not available');
  }

  const offering = await getCurrentOfferingForPlacement(placementIdentifier);
  if (!offering) {
    return uiModule.PAYWALL_RESULT?.NOT_PRESENTED ?? 'NOT_PRESENTED';
  }

  trackPaywallViewed(source);
  const result = await presentPaywallIfNeeded(requiredEntitlementIdentifier, offering);
  await trackPaywallResult(result, offering, source);
  return result;
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

export function getEntitlementPeriodType(customerInfo: any): string | null {
  return customerInfo?.entitlements?.active?.[ENTITLEMENT_IDENTIFIER]?.periodType || null;
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
