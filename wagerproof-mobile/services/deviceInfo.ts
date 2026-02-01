/**
 * Device Info Service for WagerProof Mobile
 * 
 * Collects device information for the Meta SDK debugger tool.
 * Used to display device details and tracking status.
 * 
 * Note: Full functionality requires native modules. If unavailable,
 * fallback values are used until the app is rebuilt.
 */

import { Platform } from 'react-native';

/**
 * ATT (App Tracking Transparency) status labels for iOS
 */
export type ATTStatus = 'authorized' | 'denied' | 'restricted' | 'not_determined' | 'unavailable';

/**
 * Human-readable ATT status with emoji indicators
 */
export const ATT_STATUS_LABELS: Record<ATTStatus, { label: string; icon: string; color: string }> = {
  authorized: { label: 'Authorized', icon: 'check-circle', color: '#22c55e' },
  denied: { label: 'Denied', icon: 'close-circle', color: '#ef4444' },
  restricted: { label: 'Restricted', icon: 'alert-circle', color: '#f59e0b' },
  not_determined: { label: 'Not Determined', icon: 'help-circle', color: '#6b7280' },
  unavailable: { label: 'N/A', icon: 'minus-circle', color: '#6b7280' },
};

/**
 * Device information structure
 */
export interface DeviceInfo {
  platform: 'iOS' | 'Android' | 'Unknown';
  deviceModel: string;
  manufacturer: string;
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  attStatus: ATTStatus;
  advertisingId: string | null;
  isDevice: boolean;
  nativeModulesAvailable: boolean;
}

/**
 * Get the current ATT status (iOS only)
 * Returns 'unavailable' on Android or if native modules not available
 */
export const getATTStatus = async (): Promise<ATTStatus> => {
  if (Platform.OS !== 'ios') {
    return 'unavailable';
  }

  try {
    const TrackingTransparency = require('expo-tracking-transparency');
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    
    const PermissionStatus = TrackingTransparency.PermissionStatus;
    switch (status) {
      case PermissionStatus.GRANTED:
        return 'authorized';
      case PermissionStatus.DENIED:
        return 'denied';
      case PermissionStatus.UNDETERMINED:
        return 'not_determined';
      default:
        return 'restricted';
    }
  } catch (error) {
    console.log('ATT not available (native module missing or error):', error);
    return 'unavailable';
  }
};

/**
 * Request ATT permission (iOS only)
 * Returns the new status after the request
 */
export const requestATTPermission = async (): Promise<ATTStatus> => {
  if (Platform.OS !== 'ios') {
    return 'unavailable';
  }

  try {
    const TrackingTransparency = require('expo-tracking-transparency');
    const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
    
    const PermissionStatus = TrackingTransparency.PermissionStatus;
    switch (status) {
      case PermissionStatus.GRANTED:
        return 'authorized';
      case PermissionStatus.DENIED:
        return 'denied';
      case PermissionStatus.UNDETERMINED:
        return 'not_determined';
      default:
        return 'restricted';
    }
  } catch (error) {
    console.log('ATT request not available:', error);
    return 'unavailable';
  }
};

/**
 * Get the advertising identifier (IDFA on iOS, Android Advertising ID on Android)
 * Returns null if not available or permission not granted
 */
export const getAdvertisingId = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'ios') {
      const attStatus = await getATTStatus();
      if (attStatus !== 'authorized') {
        return null;
      }
      return 'ATT Authorized (IDFA available to SDK)';
    } else if (Platform.OS === 'android') {
      try {
        const Application = require('expo-application');
        const androidId = Application.getAndroidId();
        return androidId || null;
      } catch {
        return null;
      }
    }
    return null;
  } catch (error) {
    console.log('Error getting advertising ID:', error);
    return null;
  }
};

/**
 * Collect all device information
 */
export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  // Get platform
  const platform: 'iOS' | 'Android' | 'Unknown' = 
    Platform.OS === 'ios' ? 'iOS' : 
    Platform.OS === 'android' ? 'Android' : 'Unknown';

  let deviceModel = 'Unknown';
  let manufacturer = 'Unknown';
  let osVersion = `${platform} ${Platform.Version}`;
  let appVersion = '1.0.0';
  let buildNumber = '1';
  let isDevice = true;
  let nativeModulesAvailable = false;

  // Try to get device info from expo-device
  try {
    const Device = require('expo-device');
    deviceModel = Device.modelName || Device.modelId || 'Unknown';
    manufacturer = Device.manufacturer || 'Unknown';
    osVersion = `${platform} ${Device.osVersion || Platform.Version}`;
    isDevice = Device.isDevice ?? true;
    nativeModulesAvailable = true;
  } catch (error) {
    console.log('expo-device not available, using fallbacks');
  }

  // Try to get app version from expo-application
  try {
    const Application = require('expo-application');
    appVersion = Application.nativeApplicationVersion || '1.0.0';
    buildNumber = Application.nativeBuildVersion || '1';
  } catch (error) {
    console.log('expo-application not available, using fallbacks');
  }

  // Get ATT status (iOS) or unavailable (Android)
  const attStatus = await getATTStatus();

  // Get advertising ID if available
  const advertisingId = await getAdvertisingId();

  return {
    platform,
    deviceModel,
    manufacturer,
    osVersion,
    appVersion,
    buildNumber,
    attStatus,
    advertisingId,
    isDevice,
    nativeModulesAvailable,
  };
};

/**
 * Format device info for display
 */
export const formatDeviceInfoForDisplay = (info: DeviceInfo): Record<string, string> => {
  const attLabel = ATT_STATUS_LABELS[info.attStatus];
  
  return {
    'Platform': info.platform,
    'Device': `${info.manufacturer} ${info.deviceModel}`,
    'OS Version': info.osVersion,
    'App Version': `${info.appVersion} (${info.buildNumber})`,
    'Physical Device': info.isDevice ? 'Yes' : 'No (Simulator)',
    'ATT Status': attLabel.label,
    'Advertising ID': info.advertisingId || 'Not available',
  };
};
