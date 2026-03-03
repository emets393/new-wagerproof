import { Platform, NativeModules } from 'react-native';
import {
  SubscriptionType,
  trackPaywallDismissed,
  trackPaywallViewed,
  trackSubscriptionPurchased,
  trackSubscriptionRestored,
  trackTrialStarted,
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

    if (isTrial) {
      trackTrialStarted(subscriptionType, source, price, currency);
    }
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
    // Use platform-specific API key
    const apiKey = getRevenueCatApiKey();
    console.log('🔑 Configuring RevenueCat with platform:', Platform.OS);
    console.log('🔑 Using API key:', apiKey.substring(0, 20) + '...');
    console.log('🔑 Full API key:', apiKey);
    console.log('🔑 API key length:', apiKey.length);
    console.log('🔑 API key starts with:', Platform.OS === 'android' ? 'goog_' : 'appl_');
    
    await PurchasesModule.configure({
      apiKey: apiKey,
      appUserID: userId || null, // Use anonymous ID if not logged in
    });

    console.log('✅ RevenueCat configured successfully for', Platform.OS);

    // Collect device identifiers (IDFA on iOS, GAID on Android) for attribution
    // This must be called after configure() so RevenueCat can pass identifiers to integrations like Meta
    try {
      await PurchasesModule.collectDeviceIdentifiers();
      console.log('✅ RevenueCat device identifiers collected (IDFA/GAID)');
    } catch (idError: any) {
      console.warn('⚠️ Could not collect device identifiers:', idError.message);
    }

    // Set Facebook Anonymous ID for Meta attribution integration
    try {
      const { AppEventsLogger } = require('react-native-fbsdk-next');
      const fbAnonId = await AppEventsLogger.getAnonymousID();
      if (fbAnonId) {
        await PurchasesModule.setFBAnonymousID(fbAnonId);
        console.log('✅ RevenueCat Facebook Anonymous ID set:', fbAnonId.substring(0, 10) + '...');
      }
    } catch (fbError: any) {
      console.warn('⚠️ Could not set Facebook Anonymous ID:', fbError.message);
    }

    // Verify configuration by checking if we can get customer info
    try {
      const testCustomerInfo = await PurchasesModule.getCustomerInfo();
      console.log('✅ Configuration verified - customer info retrieved');
      console.log('✅ Customer info entitlements:', Object.keys(testCustomerInfo.entitlements.active || {}));
    } catch (verifyError: any) {
      console.warn('⚠️ Could not verify configuration:', verifyError.message);
    }

    isConfigured = true;
    console.log('✅ RevenueCat configuration completed');

    // Set log level AFTER configuration
    // Enable debug logging in development
    if (__DEV__ && LOG_LEVEL) {
      try {
        PurchasesModule.setLogLevel(LOG_LEVEL.DEBUG);
        console.log('✅ RevenueCat debug logging enabled');
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

    console.log('✅ RevenueCat initialized successfully');
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
 * Returns the CustomerInfo from the login response
 */
export async function setRevenueCatUserId(userId: string): Promise<any | null> {
  try {
    console.log('🔑 setRevenueCatUserId called with:', userId);
    console.log('🔑 isConfigured:', isConfigured);

    const PurchasesModule = getPurchasesModule();
    console.log('🔑 PurchasesModule available:', !!PurchasesModule);

    if (!isConfigured || !PurchasesModule) {
      console.warn('🔑 RevenueCat is not configured. Skipping user ID set.');
      console.warn('🔑 This means the user will NOT be identified in RevenueCat!');
      return null;
    }

    console.log('🔑 Calling Purchases.logIn() with userId:', userId);
    const { customerInfo, created } = await PurchasesModule.logIn(userId);

    console.log('✅ RevenueCat user logged in successfully');
    console.log('✅ User ID:', userId);
    console.log('✅ New user created in RevenueCat:', created);
    console.log('✅ Customer originalAppUserId:', customerInfo?.originalAppUserId);
    console.log('✅ Active entitlements:', Object.keys(customerInfo?.entitlements?.active || {}));
    console.log('✅ All entitlements:', Object.keys(customerInfo?.entitlements?.all || {}));

    // Return the customer info from login - this is the most accurate source
    return customerInfo;
  } catch (error: any) {
    console.error('❌ Error setting RevenueCat user ID:', error);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error code:', error?.code);
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
    console.log('📦 Placement offering fetched:', {
      placementIdentifier,
      offeringIdentifier: offering?.identifier ?? null,
    });
    return offering;
  } catch (error) {
    console.error('Error fetching offering for placement:', placementIdentifier, error);
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
    console.log('📦 getAllOfferings() called');
    console.log('📦 Platform:', Platform.OS);
    console.log('📦 isConfigured:', isConfigured);
    
    const PurchasesModule = getPurchasesModule();
    if (!isConfigured || !PurchasesModule) {
      console.error('❌ RevenueCat not configured or module not available');
      console.error('❌ isConfigured:', isConfigured);
      console.error('❌ PurchasesModule:', !!PurchasesModule);
      return null;
    }
    
    console.log('📦 Fetching offerings from RevenueCat...');
    const offerings = await PurchasesModule.getOfferings();
    
    console.log('📦 Offerings received:', {
      hasAll: !!offerings.all,
      hasCurrent: !!offerings.current,
      allKeys: offerings.all ? Object.keys(offerings.all) : [],
      currentId: offerings.current?.identifier,
    });

    // Debug: Log full offerings structure for iOS debugging
    if (Platform.OS === 'ios') {
      console.log('📦 [iOS DEBUG] Full offerings.all:', JSON.stringify(offerings.all, null, 2));
      console.log('📦 [iOS DEBUG] Full offerings.current:', JSON.stringify(offerings.current, null, 2));
      if (!offerings.current && (!offerings.all || Object.keys(offerings.all).length === 0)) {
        console.error('❌ [iOS DEBUG] No offerings found! Check RevenueCat Dashboard:');
        console.error('❌ 1. Are iOS products imported from App Store Connect?');
        console.error('❌ 2. Is the "default" offering created with iOS products?');
        console.error('❌ 3. Is "default" set as the Current Offering?');
        console.error('❌ 4. Are iOS and Android in the SAME RevenueCat project?');
      }
    }
    
    return offerings;
  } catch (error: any) {
    console.error('❌ Error fetching all offerings:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
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
    console.log('🔄 Syncing purchases and refreshing offerings...');
    await PurchasesModule.syncPurchases();
    console.log('✅ Sync completed');
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
    if (!isConfigured || !PurchasesModule) {
      console.error('❌ RevenueCat not configured or module not available');
      return null;
    }
    
    console.log('📦 Fetching all offerings...');
    const offerings = await PurchasesModule.getOfferings();
    
    console.log('📦 Full offerings object:', JSON.stringify(offerings, null, 2));
    console.log('📦 Platform:', Platform.OS);
    console.log('📦 Looking for offering:', identifier);
    
    // Log all available offering identifiers
    if (offerings.all) {
      const allIdentifiers = Object.keys(offerings.all);
      console.log('📦 Available offering identifiers:', allIdentifiers);
      
      // Check if the offering exists in offerings.all
      if (offerings.all[identifier]) {
        console.log('✅ Found offering:', identifier);
        return offerings.all[identifier];
      } else {
        console.warn('⚠️ Offering not found in offerings.all');
        console.warn('⚠️ Available offerings:', allIdentifiers);
      }
    } else {
      console.warn('⚠️ offerings.all is null or undefined');
    }
    
    // Also check current offering
    if (offerings.current) {
      console.log('📦 Current offering identifier:', offerings.current.identifier);
      if (offerings.current.identifier === identifier) {
        console.log('✅ Found offering as current:', identifier);
        return offerings.current;
      }
    }
    
    console.warn('⚠️ Offering not found:', identifier);
    return null;
  } catch (error) {
    console.error('❌ Error fetching offering by ID:', error);
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
    console.log('📱 presentPaywall() called - Paywalls V2');
    console.log('Platform:', Platform.OS);
    console.log('Offering provided:', !!offering);
    
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
    console.log('🎬 Calling RevenueCatUI.presentPaywall() with V2 API...');
    const paywallResult = await RevenueCatUI.presentPaywall({
      offering: offering || undefined,
      displayCloseButton: true, // Only affects original template paywalls, ignored for V2
    });
    
    console.log('✅ Paywall V2 presented, result:', paywallResult);
    await trackPaywallResult(paywallResult, offering, source);
    
    // Return the result as a string for easier comparison
    return paywallResult;
  } catch (error: any) {
    console.error('❌ Error presenting paywall V2:', error);
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
    console.log('📱 presentPaywallIfNeeded() called - Paywalls V2');
    console.log('Required entitlement:', requiredEntitlementIdentifier);
    console.log('Offering provided:', !!offering);
    
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
    console.log('🎬 Calling RevenueCatUI.presentPaywallIfNeeded() with V2 API...');
    const paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier,
      offering: offering || undefined,
      displayCloseButton: true, // Only affects original template paywalls, ignored for V2
    });
    
    console.log('✅ Paywall V2 presentIfNeeded result:', paywallResult);
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
