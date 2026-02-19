import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  syncWidgetData,
  getWidgetData,
  WidgetDataPayload,
  EditorPickForWidget,
  FadeAlertForWidget,
  PolymarketValueForWidget,
} from '../modules/widget-data-bridge';
import { EditorPick, GameData } from '../types/editorsPicks';
import { FadeAlert, ValueAlert } from '../services/outliersService';

// MARK: - Types

interface UseWidgetDataSyncOptions {
  /** Editor picks data (from picks query) */
  editorPicks?: EditorPick[];
  /** Game data map for editor picks */
  gameDataMap?: Map<string, GameData>;
  /** Fade alerts data (from outliers query) */
  fadeAlerts?: FadeAlert[];
  /** Value alerts data (from outliers query) */
  valueAlerts?: ValueAlert[];
  /** Whether sync is enabled */
  enabled?: boolean;
}

// MARK: - Transform Functions

/**
 * Transform editor picks from app format to widget format
 */
function transformEditorPicks(
  picks: EditorPick[],
  gameDataMap?: Map<string, GameData>
): EditorPickForWidget[] {
  return picks.slice(0, 5).map((pick) => {
    const gameData = gameDataMap?.get(pick.game_id);
    const archivedData = pick.archived_game_data;

    // Try to get team names from gameData first, then archived data
    const awayTeam =
      gameData?.away_team ||
      archivedData?.awayTeam ||
      archivedData?.away_team ||
      'Away';
    const homeTeam =
      gameData?.home_team ||
      archivedData?.homeTeam ||
      archivedData?.home_team ||
      'Home';
    const gameDate =
      gameData?.raw_game_date ||
      archivedData?.gameDate ||
      archivedData?.game_date;

    return {
      id: pick.id,
      gameType: pick.game_type,
      awayTeam,
      homeTeam,
      pickValue: pick.pick_value || undefined,
      bestPrice: pick.best_price || undefined,
      sportsbook: pick.sportsbook || undefined,
      units: pick.units || undefined,
      result: pick.result || undefined,
      gameDate: gameDate || undefined,
    };
  });
}

/**
 * Transform fade alerts from app format to widget format
 */
function transformFadeAlerts(alerts: FadeAlert[]): FadeAlertForWidget[] {
  return alerts.slice(0, 5).map((alert) => ({
    gameId: alert.gameId,
    sport: alert.sport,
    awayTeam: alert.awayTeam,
    homeTeam: alert.homeTeam,
    pickType: alert.pickType,
    predictedTeam: alert.predictedTeam,
    confidence: alert.confidence,
    gameTime: alert.game?.gameTime || undefined,
  }));
}

/**
 * Transform value alerts from app format to widget format
 */
function transformPolymarketValues(
  alerts: ValueAlert[]
): PolymarketValueForWidget[] {
  return alerts.slice(0, 5).map((alert) => ({
    gameId: alert.game.gameId,
    sport: alert.game.sport,
    awayTeam: alert.game.awayTeam,
    homeTeam: alert.game.homeTeam,
    marketType: alert.marketType,
    side: alert.side,
    percentage: alert.percentage,
  }));
}

// MARK: - Hook

/**
 * Hook to automatically sync data to the iOS widget
 *
 * This hook watches for changes in editor picks, fade alerts, and value alerts,
 * and syncs them to the iOS widget via App Groups shared storage.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data: editorPicks } = useEditorPicksQuery();
 *   const { data: fadeAlerts } = useFadeAlertsQuery();
 *   const { data: valueAlerts } = useValueAlertsQuery();
 *
 *   useWidgetDataSync({
 *     editorPicks,
 *     fadeAlerts,
 *     valueAlerts,
 *   });
 *
 *   // ... rest of component
 * }
 * ```
 */
export function useWidgetDataSync({
  editorPicks,
  gameDataMap,
  fadeAlerts,
  valueAlerts,
  enabled = true,
}: UseWidgetDataSyncOptions = {}): void {
  // Skip on non-iOS platforms
  if (Platform.OS !== 'ios') {
    return;
  }

  // Track last synced data to avoid duplicate syncs
  const lastSyncHashRef = useRef<string>('');
  const isSyncingRef = useRef<boolean>(false);

  // Sync function
  const performSync = useCallback(async () => {
    if (!enabled || isSyncingRef.current) {
      return;
    }

    // Build payload
    const existingData = await getWidgetData();
    const payload: WidgetDataPayload = {
      editorPicks: transformEditorPicks(editorPicks || [], gameDataMap),
      fadeAlerts: transformFadeAlerts(fadeAlerts || []),
      polymarketValues: transformPolymarketValues(valueAlerts || []),
      topAgentPicks: existingData?.topAgentPicks || [],
      lastUpdated: new Date().toISOString(),
    };

    // Create hash to detect changes
    const hash = JSON.stringify({
      picks: payload.editorPicks.map((p) => p.id).join(','),
      fades: payload.fadeAlerts.map((f) => f.gameId).join(','),
      poly: payload.polymarketValues.map((v) => v.gameId).join(','),
    });

    // Skip if no changes
    if (hash === lastSyncHashRef.current) {
      return;
    }

    // Perform sync
    isSyncingRef.current = true;
    try {
      await syncWidgetData(payload);
      lastSyncHashRef.current = hash;
    } catch (error) {
      console.error('Widget sync failed:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [editorPicks, gameDataMap, fadeAlerts, valueAlerts, enabled]);

  // Sync when data changes
  useEffect(() => {
    performSync();
  }, [performSync]);

  // Also sync when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Small delay to ensure data is fresh
        setTimeout(performSync, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [performSync]);
}

// MARK: - Standalone Sync Function

/**
 * Manually sync data to widget
 * Use this when you need to trigger a sync outside of the hook
 *
 * @example
 * ```tsx
 * import { syncDataToWidget } from '@/hooks/useWidgetDataSync';
 *
 * const handleSave = async () => {
 *   await saveData();
 *   await syncDataToWidget({ editorPicks, fadeAlerts, valueAlerts });
 * };
 * ```
 */
export async function syncDataToWidget(options: {
  editorPicks?: EditorPick[];
  gameDataMap?: Map<string, GameData>;
  fadeAlerts?: FadeAlert[];
  valueAlerts?: ValueAlert[];
}): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  const existingData = await getWidgetData();
  const payload: WidgetDataPayload = {
    editorPicks: transformEditorPicks(
      options.editorPicks || [],
      options.gameDataMap
    ),
    fadeAlerts: transformFadeAlerts(options.fadeAlerts || []),
    polymarketValues: transformPolymarketValues(options.valueAlerts || []),
    topAgentPicks: existingData?.topAgentPicks || [],
    lastUpdated: new Date().toISOString(),
  };

  await syncWidgetData(payload);
}

export default useWidgetDataSync;
