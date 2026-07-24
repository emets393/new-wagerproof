/**
 * Shared demo roster for Agent HQ embeds (landing, onboarding pitch, paywall).
 * Mirrors the iOS PixelOffice fallback / paywall previewAgents set.
 */
import type { AgentWithPerformance, ArchetypeId, Sport } from '@/types/agent';

const NOW = new Date().toISOString();

export function demoAgent(
  id: string,
  name: string,
  emoji: string,
  color: string,
  spriteIndex: number,
  sports: Sport[],
  wins: number,
  losses: number,
  netUnits: number,
  ready = false
): AgentWithPerformance {
  return {
    id,
    user_id: 'agent-hq-demo',
    name,
    avatar_emoji: emoji,
    avatar_color: color,
    sprite_index: spriteIndex,
    preferred_sports: sports,
    archetype: 'the_analyst' as ArchetypeId,
    personality_params: {},
    custom_insights: {
      betting_philosophy: null,
      perceived_edges: null,
      avoid_situations: null,
      target_situations: null,
    },
    is_public: true,
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    auto_generate: true,
    auto_generate_time: '09:00',
    auto_generate_timezone: 'America/Chicago',
    is_widget_favorite: false,
    last_generated_at: ready ? NOW : null,
    last_auto_generated_at: ready ? NOW : null,
    owner_last_active_at: NOW,
    daily_generation_count: ready ? 1 : 0,
    last_generation_date: ready ? NOW.slice(0, 10) : null,
    performance: {
      avatar_id: id,
      total_picks: wins + losses,
      wins,
      losses,
      pushes: 0,
      pending: 0,
      win_rate: wins / (wins + losses),
      net_units: netUnits,
      current_streak: 3,
      best_streak: 7,
      worst_streak: -3,
      stats_by_sport: {},
      stats_by_bet_type: {},
      last_calculated_at: NOW,
    },
  } as AgentWithPerformance;
}

export const DEMO_AGENTS: AgentWithPerformance[] = [
  demoAgent('demo-line-hawk', 'Line Hawk', '🦅', '#38bdf8', 0, ['nfl', 'cfb'], 31, 19, 11.42),
  demoAgent('demo-value-hunter', 'Value Hunter', '🎯', '#f59e0b', 1, ['nba', 'ncaab'], 27, 18, 8.76, true),
  demoAgent('demo-model-maven', 'Model Maven', '🧠', '#2dd4bf', 2, ['mlb'], 36, 22, 14.18),
  demoAgent('demo-contrarian', 'Contrarian', '⚡', '#fb7185', 3, ['nfl'], 24, 17, 6.35, true),
  demoAgent('demo-odds-oracle', 'Odds Oracle', '🔮', '#a78bfa', 4, ['nba'], 29, 21, 7.91),
  demoAgent('demo-trend-spotter', 'Trend Spotter', '📈', '#4ade80', 5, ['cfb', 'ncaab'], 22, 15, 5.64),
];

/** Paywall/pitch roster — optionally leads with the user's draft agent. */
export function buildDemoAgents(opts?: {
  name?: string;
  spriteIndex?: number | null;
  avatarColor?: string;
}): AgentWithPerformance[] {
  const trimmed = opts?.name?.trim();
  if (!trimmed) return DEMO_AGENTS;
  const lead = demoAgent(
    'demo-user-agent',
    trimmed,
    '⭐',
    opts?.avatarColor ?? '#22c55e',
    (opts?.spriteIndex ?? 2) % 8,
    ['nfl', 'nba'],
    12,
    8,
    4.2
  );
  return [lead, ...DEMO_AGENTS.slice(0, 5)];
}
