import * as React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Bot, Gauge, Trophy, Zap } from 'lucide-react';
import { AgentHQ } from '@/components/agents/split/AgentHQ';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import type { AgentWithPerformance, ArchetypeId, Sport } from '@/types/agent';

const NOW = new Date().toISOString();

function demoAgent(
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
    custom_insights: { betting_philosophy: null, perceived_edges: null, avoid_situations: null, target_situations: null },
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

const DEMO_AGENTS = [
  demoAgent('demo-line-hawk', 'Line Hawk', '🦅', '#38bdf8', 0, ['nfl', 'cfb'], 31, 19, 11.42),
  demoAgent('demo-value-hunter', 'Value Hunter', '🎯', '#f59e0b', 1, ['nba', 'ncaab'], 27, 18, 8.76, true),
  demoAgent('demo-model-maven', 'Model Maven', '🧠', '#2dd4bf', 2, ['mlb'], 36, 22, 14.18),
  demoAgent('demo-contrarian', 'Contrarian', '⚡', '#fb7185', 3, ['nfl'], 24, 17, 6.35, true),
  demoAgent('demo-odds-oracle', 'Odds Oracle', '🔮', '#a78bfa', 4, ['nba'], 29, 21, 7.91),
  demoAgent('demo-trend-spotter', 'Trend Spotter', '📈', '#4ade80', 5, ['cfb', 'ncaab'], 22, 15, 5.64),
];

const workflow = [
  { icon: Bot, label: 'Create', copy: 'Pick a sport' },
  { icon: Gauge, label: 'Configure', copy: 'Set its strategy' },
  { icon: Zap, label: 'Deploy', copy: 'Research the slate' },
  { icon: Trophy, label: 'Track', copy: 'Grade every result' },
];

export default function AIAgentWorkforceSection() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-20 sm:px-6 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.10),transparent_34%),radial-gradient(circle_at_72%_28%,rgba(34,211,238,0.06),transparent_24%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025] [background-image:url('data:image/svg+xml,%3Csvg_viewBox=%220_0_180_180%22_xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter_id=%22n%22%3E%3CfeTurbulence_type=%22fractalNoise%22_baseFrequency=%220.8%22_numOctaves=%223%22/%3E%3C/filter%3E%3Crect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

      <div className="mx-auto w-full max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            AI Agents — Now Live
          </div>
          <h2 className="text-balance text-4xl font-black leading-[1.02] tracking-[-0.035em] text-gray-950 dark:text-white sm:text-5xl md:text-6xl">
            Your personal workforce of{' '}
            <span className="text-emerald-500 dark:text-emerald-400">sports data scientists.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-balance text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Create autonomous research agents with different strategies, then watch them work inside Agent HQ. Every pick, result, and unit is tracked transparently.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 34, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.75, delay: 0.08 }}
          className="relative mx-auto mt-12 max-w-[880px] md:mt-14"
        >
          <div className="mx-auto w-full max-w-[760px]">
            <AgentHQ agents={DEMO_AGENTS} onSelectAgent={() => undefined} />
          </div>
        </motion.div>

        <div className="mx-auto mt-10 max-w-4xl md:mt-12">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {workflow.map(({ icon: Icon, label, copy }, index) => (
              <div key={label} className="relative rounded-2xl border border-gray-200 bg-white/45 px-3 py-4 text-center backdrop-blur dark:border-white/10 dark:bg-white/[0.025]">
                <span className="absolute right-3 top-1 text-3xl font-black text-gray-950/[0.045] dark:text-white/[0.05]">{index + 1}</span>
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500"><Icon className="h-4 w-4" /></div>
                <p className="text-xs font-bold text-gray-950 dark:text-white">{label}</p><p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center">
            <Link to="/agents/create">
              <MovingBorderButton
                borderRadius="0.5rem"
                containerClassName="h-[50px] w-[170px]"
                className="border-gray-300 bg-white text-sm font-semibold text-honeydew-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-honeydew-400 dark:hover:bg-gray-800"
                borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]"
                duration={2500}
              >
                Create an Agent Today
              </MovingBorderButton>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
