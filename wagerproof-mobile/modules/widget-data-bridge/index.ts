/**
 * Widget Data Bridge Module
 *
 * This module provides a bridge between React Native and the iOS widget
 * via App Groups shared storage.
 *
 * Usage:
 * ```typescript
 * import { syncWidgetData, reloadWidgets } from '@/modules/widget-data-bridge';
 *
 * // Sync data to widget
 * await syncWidgetData({
 *   editorPicks: [...],
 *   fadeAlerts: [...],
 *   polymarketValues: [...],
 *   lastUpdated: new Date().toISOString(),
 * });
 *
 * // Force widget refresh
 * await reloadWidgets();
 * ```
 */

export {
  syncWidgetData,
  reloadWidgets,
  getWidgetData,
  clearWidgetData,
  isWidgetSupported,
  type WidgetDataPayload,
  type EditorPickForWidget,
  type FadeAlertForWidget,
  type PolymarketValueForWidget,
} from './src/WidgetDataBridge';
