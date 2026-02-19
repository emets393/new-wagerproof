import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTopAgentsForWidget } from '@/services/topAgentsWidgetService';
import { getWidgetData, syncWidgetData } from '@/modules/widget-data-bridge';

interface UseTopAgentsWidgetSyncOptions {
  enabled?: boolean;
}

export async function syncTopAgentsWidgetData(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !userId) return;

  const [existingData, topAgentPicks] = await Promise.all([
    getWidgetData(),
    fetchTopAgentsForWidget(userId),
  ]);

  await syncWidgetData({
    editorPicks: existingData?.editorPicks || [],
    fadeAlerts: existingData?.fadeAlerts || [],
    polymarketValues: existingData?.polymarketValues || [],
    topAgentPicks,
    lastUpdated: new Date().toISOString(),
  });
}

export function useTopAgentsWidgetSync(options: UseTopAgentsWidgetSyncOptions = {}): void {
  const { enabled = true } = options;
  const { user } = useAuth();
  const isSyncingRef = useRef(false);
  const lastHashRef = useRef('');

  const syncData = useCallback(async () => {
    if (!enabled || !user?.id || isSyncingRef.current || Platform.OS !== 'ios') return;

    isSyncingRef.current = true;
    try {
      const topAgentPicks = await fetchTopAgentsForWidget(user.id);
      const nextHash = JSON.stringify(
        topAgentPicks.map((agent) => ({
          agentId: agent.agentId,
          picks: agent.picks.map((pick) => pick.id),
          isFavorite: agent.isFavorite,
        }))
      );

      if (nextHash === lastHashRef.current) return;

      const existingData = await getWidgetData();
      await syncWidgetData({
        editorPicks: existingData?.editorPicks || [],
        fadeAlerts: existingData?.fadeAlerts || [],
        polymarketValues: existingData?.polymarketValues || [],
        topAgentPicks,
        lastUpdated: new Date().toISOString(),
      });

      lastHashRef.current = nextHash;
    } catch (error) {
      console.error('Failed to sync top agents widget data:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    syncData();
  }, [syncData]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        setTimeout(syncData, 500);
      }
    });

    return () => subscription.remove();
  }, [syncData]);
}

export default useTopAgentsWidgetSync;
