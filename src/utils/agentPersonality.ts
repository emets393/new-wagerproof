import type { PersonalityParams } from '@/types/agent';

/**
 * Readable personality pills derived from an agent's tunable params
 * (moved from PublicAgentDetail so list cards and the detail pane share it).
 */
export function getPersonalityPills(params: PersonalityParams | null | undefined): string[] {
  if (!params) return [];
  const pills: string[] = [];

  const riskMap: Record<number, string> = { 1: 'Very Safe', 2: 'Conservative', 4: 'Aggressive', 5: 'High Risk' };
  if (params.risk_tolerance && riskMap[params.risk_tolerance]) pills.push(riskMap[params.risk_tolerance]);

  const betTypeMap: Record<string, string> = { spread: 'Spreads', moneyline: 'Moneylines', total: 'Totals' };
  if (params.preferred_bet_type && betTypeMap[params.preferred_bet_type]) pills.push(betTypeMap[params.preferred_bet_type]);

  const underdogMap: Record<number, string> = { 1: 'Chalk Only', 2: 'Favors Favorites', 4: 'Likes Underdogs', 5: 'Underdog Hunter' };
  if (params.underdog_lean && underdogMap[params.underdog_lean]) pills.push(underdogMap[params.underdog_lean]);

  const ouMap: Record<number, string> = { 1: 'Unders', 2: 'Leans Under', 4: 'Leans Over', 5: 'Overs' };
  if (params.over_under_lean && ouMap[params.over_under_lean]) pills.push(ouMap[params.over_under_lean]);

  if (params.chase_value) pills.push('Value Hunter');
  if (params.fade_public) pills.push('Fades Public');

  const confMap: Record<number, string> = { 1: 'Takes Any Edge', 4: 'Selective', 5: 'Very Picky' };
  if (params.confidence_threshold && confMap[params.confidence_threshold]) pills.push(confMap[params.confidence_threshold]);

  if (params.weather_impacts_totals) pills.push('Weather Aware');
  if (params.ride_hot_streaks) pills.push('Streak Rider');
  if (params.fade_cold_streaks) pills.push('Fades Cold Streaks');

  return pills.slice(0, 5);
}
