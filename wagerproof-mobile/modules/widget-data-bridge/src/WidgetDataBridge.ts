import { NativeModules, Platform } from 'react-native';

const { WidgetDataBridgeModule } = NativeModules;

// MARK: - Types

export interface EditorPickForWidget {
  id: string;
  gameType: string;
  awayTeam: string;
  homeTeam: string;
  pickValue?: string;
  bestPrice?: string;
  sportsbook?: string;
  units?: number;
  result?: string;
  gameDate?: string;
}

export interface FadeAlertForWidget {
  gameId: string;
  sport: string;
  awayTeam: string;
  homeTeam: string;
  pickType: string;
  predictedTeam: string;
  confidence: number;
  gameTime?: string;
}

export interface PolymarketValueForWidget {
  gameId: string;
  sport: string;
  awayTeam: string;
  homeTeam: string;
  marketType: string;
  side: string;
  percentage: number;
}

export interface WidgetDataPayload {
  editorPicks: EditorPickForWidget[];
  fadeAlerts: FadeAlertForWidget[];
  polymarketValues: PolymarketValueForWidget[];
  lastUpdated: string;
}

// MARK: - Widget Data Bridge Functions

/**
 * Sync widget data to the iOS widget via App Groups
 * This writes data to shared UserDefaults that the widget can read
 * @param data - The widget data payload to sync
 * @returns Promise that resolves when sync is complete
 */
export async function syncWidgetData(data: WidgetDataPayload): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.log('Widget sync skipped: not on iOS');
    return;
  }

  if (!WidgetDataBridgeModule) {
    console.warn('WidgetDataBridgeModule not available');
    return;
  }

  try {
    const jsonString = JSON.stringify(data);
    await WidgetDataBridgeModule.syncWidgetData(jsonString);
    console.log('Widget data synced successfully');
  } catch (error) {
    console.error('Failed to sync widget data:', error);
    throw error;
  }
}

/**
 * Force reload all widget timelines
 * Call this when you want the widget to immediately refresh
 * @returns Promise that resolves when reload is triggered
 */
export async function reloadWidgets(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (!WidgetDataBridgeModule) {
    console.warn('WidgetDataBridgeModule not available');
    return;
  }

  try {
    await WidgetDataBridgeModule.reloadWidgets();
    console.log('Widget timelines reloaded');
  } catch (error) {
    console.error('Failed to reload widgets:', error);
    throw error;
  }
}

/**
 * Get the current widget data from App Group storage
 * Useful for debugging
 * @returns Promise with the current widget data or null
 */
export async function getWidgetData(): Promise<WidgetDataPayload | null> {
  if (Platform.OS !== 'ios') {
    return null;
  }

  if (!WidgetDataBridgeModule) {
    console.warn('WidgetDataBridgeModule not available');
    return null;
  }

  try {
    const jsonString = await WidgetDataBridgeModule.getWidgetData();
    if (!jsonString) {
      return null;
    }
    return JSON.parse(jsonString) as WidgetDataPayload;
  } catch (error) {
    console.error('Failed to get widget data:', error);
    return null;
  }
}

/**
 * Clear widget data from App Group storage
 * @returns Promise that resolves when data is cleared
 */
export async function clearWidgetData(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (!WidgetDataBridgeModule) {
    console.warn('WidgetDataBridgeModule not available');
    return;
  }

  try {
    await WidgetDataBridgeModule.clearWidgetData();
    console.log('Widget data cleared');
  } catch (error) {
    console.error('Failed to clear widget data:', error);
    throw error;
  }
}

/**
 * Check if widgets are supported on this device
 * @returns Promise with boolean indicating widget support
 */
export async function isWidgetSupported(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  if (!WidgetDataBridgeModule) {
    return false;
  }

  try {
    return await WidgetDataBridgeModule.isWidgetSupported();
  } catch (error) {
    console.error('Failed to check widget support:', error);
    return false;
  }
}
