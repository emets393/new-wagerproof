import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMlbRpcFilters,
  defaultMlbFilters,
  mlbFiltersWeatherOnly,
  type MlbAnalysisBetType,
  type MlbAnalysisFilterState,
  type MlbAnalysisResponse,
  type MlbAnalysisUpcomingGame,
  type MlbPitcherOption,
} from '@/types/mlbHistoricalAnalysis';
import {
  fetchMlbAnalysis,
  fetchMlbAnalysisUpcoming,
  fetchMlbPitcherOptions,
  fetchMlbTeamAbbrs,
} from '@/services/mlbHistoricalAnalysisService';

export function useMlbHistoricalAnalysis() {
  const [betType, setBetType] = useState<MlbAnalysisBetType>('ml');
  const [filters, setFilters] = useState<MlbAnalysisFilterState>(defaultMlbFilters);
  const [data, setData] = useState<MlbAnalysisResponse | null>(null);
  const [upcoming, setUpcoming] = useState<MlbAnalysisUpcomingGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [teamOptions, setTeamOptions] = useState<{ abbr: string; name: string }[]>([]);
  const hasLoaded = useRef(false);

  useEffect(() => {
    fetchMlbTeamAbbrs().then(setTeamOptions);
  }, []);

  const rpcFilters = useMemo(() => buildMlbRpcFilters(filters, betType), [filters, betType]);
  const weatherOnly = useMemo(() => mlbFiltersWeatherOnly(rpcFilters), [rpcFilters]);

  useEffect(() => {
    if (hasLoaded.current) setIsRefetching(true);
    else setLoading(true);

    let cancelled = false;
    const t = setTimeout(async () => {
      const upcomingFilters = weatherOnly ? {} : rpcFilters;
      // Analysis first — paint hero even if upcoming is slow / times out.
      const a = await fetchMlbAnalysis(betType, rpcFilters);
      if (cancelled) return;
      setData(a);
      setLoading(false);
      setIsRefetching(false);
      hasLoaded.current = true;

      const u = await fetchMlbAnalysisUpcoming(betType, upcomingFilters);
      if (cancelled) return;
      setUpcoming(u);
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [betType, rpcFilters, weatherOnly]);

  const patchFilters = useCallback((patch: Partial<MlbAnalysisFilterState>) => {
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultMlbFilters());
  }, []);

  const applyTeamVsPitcher = useCallback((team: string, pitcher: MlbPitcherOption) => {
    setFilters(prev => ({
      ...prev,
      teams: [team],
      oppSp: [pitcher],
    }));
  }, []);

  const searchPitchers = useCallback(async (q: string) => fetchMlbPitcherOptions(q), []);

  const shownBars = useMemo(() => (data?.bars || []).filter(bar => {
    const total = bar.options.reduce((s, o) => s + (o?.n || 0), 0);
    return total > 0 && bar.options.every(o => o && o.n > 0 && o.n / total >= 0.1);
  }), [data]);

  return {
    betType,
    setBetType,
    filters,
    setFilters,
    patchFilters,
    resetFilters,
    rpcFilters,
    data,
    upcoming,
    loading,
    isRefetching,
    weatherOnly,
    teamOptions,
    shownBars,
    applyTeamVsPitcher,
    searchPitchers,
  };
}
