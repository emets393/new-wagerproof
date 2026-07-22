import * as React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BrainCircuit, Radar, SlidersHorizontal, Sparkles, Trophy } from 'lucide-react';
import { AgentHQ } from '@/components/agents/split/AgentHQ';
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

const capabilities = [
  { icon: Radar, title: 'Scans every slate', copy: 'Odds, trends, injuries, weather, splits, and market movement.' },
  { icon: SlidersHorizontal, title: 'Thinks your way', copy: 'Give every agent its own sport, risk profile, and betting philosophy.' },
  { icon: BarChart3, title: 'Proves its edge', copy: 'Every result is graded with transparent W-L and unit performance.' },
];

export default function AIAgentWorkforceSection() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-24 sm:px-6 md:py-36">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_38%,rgba(20,184,166,0.12),transparent_32%),radial-gradient(circle_at_18%_22%,rgba(59,130,246,0.09),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(34,197,94,0.08),transparent_22%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025] [background-image:url('data:image/svg+xml,%3Csvg_viewBox=%220_0_180_180%22_xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter_id=%22n%22%3E%3CfeTurbulence_type=%22fractalNoise%22_baseFrequency=%220.8%22_numOctaves=%223%22/%3E%3C/filter%3E%3Crect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

      <div className="mx-auto w-full max-w-[1380px]">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-5xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold tracking-[0.04em] text-emerald-700 dark:text-emerald-300">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            AGENT HQ · LIVE DEMO
          </div>
          <h2 className="text-balance text-4xl font-black leading-[0.98] tracking-[-0.04em] text-gray-950 dark:text-white sm:text-5xl md:text-7xl">
            Meet the betting desk that{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">never clocks out.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-3xl text-balance text-lg leading-relaxed text-gray-600 dark:text-gray-300 md:text-xl">
            Build a team of autonomous sports research agents. Each one studies the slate through a different lens, makes accountable picks, and builds a public track record inside your Agent HQ.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 34, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.75, delay: 0.08 }}
          className="relative mt-14 md:mt-20"
        >
          <div aria-hidden className="absolute -inset-8 -z-10 rounded-[56px] bg-gradient-to-b from-emerald-400/15 via-cyan-400/5 to-transparent blur-3xl" />
          <div className="overflow-hidden rounded-[30px] border border-black/10 bg-white/70 p-2.5 shadow-[0_42px_110px_-42px_rgba(2,20,31,0.5)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#070b11]/80 sm:p-4 md:rounded-[38px] md:p-6">
            <div className="mb-4 flex flex-col gap-3 px-2 pt-1 sm:flex-row sm:items-center sm:justify-between md:mb-6 md:px-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-500"><BrainCircuit className="h-5 w-5" /></div>
                <div><p className="text-sm font-black tracking-tight text-gray-950 dark:text-white">WagerProof Agent HQ</p><p className="text-xs text-gray-500 dark:text-gray-400">Six strategies researching today&apos;s board</p></div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">6 agents online</span>
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">5 sports covered</span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-600 dark:text-emerald-300">+54.26u tracked</span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[1180px]">
              <AgentHQ agents={DEMO_AGENTS} onSelectAgent={() => undefined} />
            </div>

            <div className="grid gap-2.5 p-2 pt-4 md:grid-cols-3 md:p-3 md:pt-6">
              {capabilities.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-black/[0.07] bg-white/55 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><Icon className="h-4 w-4" /></div>
                  <div><p className="text-sm font-extrabold text-gray-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{copy}</p></div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="mx-auto mt-16 max-w-6xl md:mt-24">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/agents" className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-gray-950 px-7 py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100">
              Enter Agent HQ <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/agents/create" className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-black/10 bg-white/60 px-7 py-3.5 text-sm font-extrabold text-gray-900 backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              <Sparkles className="h-4 w-4 text-emerald-500" /> Build your first agent
            </Link>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-gray-500 dark:text-gray-400"><Trophy className="h-3.5 w-3.5 text-amber-500" /> Every pick is graded. Every result stays visible.</p>
        </div>
      </div>
    </section>
  );
}
