import * as React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BrainCircuit, Radar, SlidersHorizontal, Sparkles, Trophy } from 'lucide-react';
import { DEMO_AGENTS } from '@/components/agents/demoAgents';
import { AgentHQ } from '@/components/agents/split/AgentHQ';
import MarkerHighlight from '@/components/landing/agentHero/MarkerHighlight';

const capabilities = [
  { icon: Radar, title: 'Scans every slate', copy: 'Odds, trends, injuries, weather, splits, and market movement.' },
  { icon: SlidersHorizontal, title: 'Thinks your way', copy: 'Give every agent its own sport, risk profile, and betting philosophy.' },
  { icon: BarChart3, title: 'Proves its edge', copy: 'Every result is graded with transparent W-L and unit performance.' },
];

export default function AIAgentWorkforceSection() {
  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
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
          {/* Same type treatment as the hero h1 (agentHero/LandingAgentHero.tsx) so the two read as one page. */}
          <h2 className="text-[2.3rem] font-black leading-[1.06] tracking-[-0.045em] text-gray-950 dark:text-white sm:text-[min(6.2vw,4.75rem)]">
            Meet the betting desk that{' '}
            <span className="leading-[1.22]"><MarkerHighlight>never clocks out.</MarkerHighlight></span>
          </h2>
          <p className="mx-auto mt-7 max-w-3xl text-balance text-lg leading-relaxed text-black/60 dark:text-white/60 md:text-xl">
            Build a team of autonomous sports research agents. Each one studies the slate through a different lens, makes accountable picks, and builds a public track record inside your Agent HQ.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 34, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.75, delay: 0.08 }}
          className="mt-12 md:mt-16"
        >
          {/* HQ is a square-ish canvas (864/800) that scales with its width, so capping the column is what shrinks it. */}
          <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-14">
            <div className="relative mx-auto w-full max-w-[560px]">
              <div aria-hidden className="absolute -inset-6 -z-10 rounded-[48px] bg-gradient-to-b from-emerald-400/15 via-emerald-400/5 to-transparent blur-3xl" />
              <div className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-white/70 p-2.5 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.45)] backdrop-blur-2xl dark:border-white/[0.1] dark:bg-[#161818]/80 sm:p-3">
                <div className="mb-3 flex items-center justify-between gap-3 px-1.5 pt-1">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-500"><BrainCircuit className="h-4 w-4" /></div>
                    <div className="text-left"><p className="text-sm font-black tracking-tight text-gray-950 dark:text-white">WagerProof Agent HQ</p><p className="text-xs text-black/50 dark:text-white/50">Six strategies researching today&apos;s board</p></div>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">+54.26u tracked</span>
                </div>
                <AgentHQ agents={DEMO_AGENTS} onSelectAgent={() => undefined} />
              </div>
            </div>

            <ul className="flex flex-col gap-7 text-left">
              {capabilities.map(({ icon: Icon, title, copy }) => (
                <li key={title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Icon className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xl font-black tracking-[-0.02em] text-gray-950 dark:text-white md:text-2xl">{title}</p>
                    <p className="mt-1.5 text-base leading-relaxed text-black/60 dark:text-white/60">{copy}</p>
                  </div>
                </li>
              ))}
              <li className="flex flex-wrap gap-2 text-xs font-bold text-black/60 dark:text-white/60">
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">6 agents online</span>
                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">5 sports covered</span>
              </li>
            </ul>
          </div>
        </motion.div>

        <div className="mx-auto mt-14 max-w-6xl md:mt-16">
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
