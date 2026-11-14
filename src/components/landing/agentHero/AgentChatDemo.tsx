import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, ChevronRight, Loader2, MessageSquare, Plus, SquarePen } from 'lucide-react';

import claudeIcon from '@/assets/mcp/providers/claude.svg';
import { DEMO_SCENARIOS, DEMO_SNAPSHOT_LABEL, type DemoScenario } from './demoScenarios';

// One number per stage of the scripted chat; later stages imply every earlier one is visible.
const enum Phase {
  Typing,
  Sent,
  ToolRunning,
  Intro,
  Card,
  Outro,
  Done,
}

interface Playback {
  phase: Phase;
  typed: number;
  intro: number;
  rows: number;
  outro: number;
}

const START: Playback = { phase: Phase.Typing, typed: 0, intro: 0, rows: 0, outro: 0 };

const wordCount = (text: string) => text.split(' ').length;
const firstWords = (text: string, count: number) => text.split(' ').slice(0, count).join(' ');

function finished(scenario: DemoScenario): Playback {
  return {
    phase: Phase.Done,
    typed: scenario.prompt.length,
    intro: wordCount(scenario.intro),
    rows: scenario.rows.length,
    outro: wordCount(scenario.outro),
  };
}

/** Plays one scenario as a timed script, then calls onDone so the parent can advance the loop. */
function usePlayback(scenario: DemoScenario, playing: boolean, onDone: () => void): Playback {
  const [state, setState] = useState<Playback>(START);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState(finished(scenario));
      return;
    }

    setState(START);
    // Off-screen: hold at the start instead of burning timers, and replay from the top when it scrolls in.
    if (!playing) return;

    let cancelled = false;
    const timers: number[] = [];
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    const patch = (next: Partial<Playback>) => {
      if (!cancelled) setState((current) => ({ ...current, ...next }));
    };

    (async () => {
      await sleep(600);
      for (let i = 1; i <= scenario.prompt.length; i += 1) {
        patch({ typed: i });
        // Small pause after spaces so it reads as a person typing, not a progress bar.
        await sleep(scenario.prompt[i - 1] === ' ' ? 55 : 24);
      }
      await sleep(380);
      patch({ phase: Phase.Sent });
      await sleep(800);
      patch({ phase: Phase.ToolRunning });
      await sleep(1700);
      patch({ phase: Phase.Intro });
      for (let i = 1; i <= wordCount(scenario.intro); i += 1) {
        patch({ intro: i });
        await sleep(34);
      }
      await sleep(250);
      patch({ phase: Phase.Card });
      for (let i = 1; i <= scenario.rows.length; i += 1) {
        patch({ rows: i });
        await sleep(280);
      }
      await sleep(350);
      patch({ phase: Phase.Outro });
      for (let i = 1; i <= wordCount(scenario.outro); i += 1) {
        patch({ outro: i });
        await sleep(34);
      }
      patch({ phase: Phase.Done });
      await sleep(4800);
      if (!cancelled) onDoneRef.current();
    })();

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [scenario, playing]);

  return state;
}

const TONE: Record<DemoScenario['rows'][number]['tone'], string> = {
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  blue: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
};

const RECENTS = ['NBA props for tonight', 'How did my agents do this week?', 'CFB Saturday slate', 'Bills line movement'];

function ClaudeSpark({ className = '', spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <img
      src={claudeIcon}
      alt=""
      aria-hidden
      className={`${className} ${spinning ? 'animate-[spin_2.4s_linear_infinite]' : ''}`}
    />
  );
}

function ResultCard({ scenario, rows }: { scenario: DemoScenario; rows: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_8px_30px_-18px_rgba(0,0,0,0.35)] dark:border-white/[0.09] dark:bg-[#1b1b1a]"
    >
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.07]">
        <img src="/wagerproofGreenDark.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{scenario.cardTitle}</p>
          <p className="text-[11px] text-black/45 dark:text-white/45">{scenario.cardKicker}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live data
        </span>
      </div>
      <ul>
        {scenario.rows.slice(0, rows).map((row) => (
          <motion.li
            key={row.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 border-b border-black/[0.05] px-4 py-3 last:border-b-0 dark:border-white/[0.06]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-950 dark:text-white">{row.label}</p>
              <p className="text-xs leading-5 text-black/50 dark:text-white/50">{row.detail}</p>
            </div>
            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${TONE[row.tone]}`}>
              {row.value}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

export default function AgentChatDemo() {
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scenario = DEMO_SCENARIOS[index];
  const play = usePlayback(scenario, inView, () => setIndex((current) => (current + 1) % DEMO_SCENARIOS.length));

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Keep the newest line in view as the reply streams, the way a real chat pins to the bottom.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [play]);

  const typing = play.phase === Phase.Typing;

  return (
    <div ref={rootRef}>
      <div className="relative mx-auto flex max-w-3xl items-center justify-center">
        <div role="tablist" aria-label="Demo conversations" className="flex items-center gap-1 sm:gap-3">
          {DEMO_SCENARIOS.map((item, itemIndex) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              onClick={() => setIndex(itemIndex)}
              className={`whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:px-4 sm:text-lg ${
                itemIndex === index
                  ? 'text-gray-950 dark:text-white'
                  : 'text-black/35 hover:text-black/60 dark:text-white/35 dark:hover:text-white/60'
              }`}
            >
              {item.tab}
            </button>
          ))}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-8 hidden -rotate-6 text-gray-900 dark:text-gray-100 lg:block"
          style={{ fontFamily: "'Caveat', 'Bradley Hand', 'Segoe Print', cursive" }}
        >
          <span className="block text-[30px] font-semibold leading-none">How it works</span>
          <svg className="ml-16 mt-1 h-14 w-10" viewBox="0 0 40 56" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2c9 14 6 32-12 46" />
            <path d="M9 36 9.500 48.500 22 46" />
          </svg>
        </div>
      </div>

      <div className="relative mt-5">
        <div aria-hidden className="absolute -inset-x-6 -bottom-6 top-10 rounded-[40px] bg-gradient-to-b from-emerald-400/20 via-emerald-400/5 to-transparent blur-3xl" />
        <div className="relative overflow-hidden rounded-[22px] border border-black/[0.08] bg-[#faf9f5] text-left shadow-[0_40px_100px_-40px_rgba(0,0,0,0.45)] dark:border-white/[0.1] dark:bg-[#262624]">
          <div className="relative flex h-11 items-center border-b border-black/[0.06] bg-[#f3f1ea] px-4 dark:border-white/[0.07] dark:bg-[#1f1e1d]">
            <span className="flex gap-2" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/15" />
              <span className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/15" />
              <span className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/15" />
            </span>
            <span className="absolute inset-x-0 text-center text-sm font-medium text-black/45 dark:text-white/45">Claude</span>
          </div>

          <div className="flex h-[600px] sm:h-[620px]">
            <aside className="hidden w-60 shrink-0 flex-col border-r border-black/[0.06] bg-[#f3f1ea] p-3 dark:border-white/[0.07] dark:bg-[#1f1e1d] md:flex">
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-black/70 dark:text-white/70">
                <SquarePen className="h-4 w-4" />
                New chat
              </div>
              <p className="px-2.5 pb-1.5 pt-4 text-xs font-medium text-black/40 dark:text-white/40">Chats</p>
              {DEMO_SCENARIOS.map((item, itemIndex) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setIndex(itemIndex)}
                  className={`flex items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    itemIndex === index
                      ? 'bg-black/[0.07] font-medium text-gray-950 dark:bg-white/[0.09] dark:text-white'
                      : 'text-black/60 hover:bg-black/[0.04] dark:text-white/60 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate">{item.chatTitle}</span>
                </button>
              ))}
              {RECENTS.map((title) => (
                <div key={title} className="flex items-center gap-2 px-2.5 py-2 text-sm text-black/40 dark:text-white/35">
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="truncate">{title}</span>
                </div>
              ))}
              <div className="mt-auto flex items-center gap-2.5 rounded-xl bg-black/[0.04] px-2.5 py-2 dark:bg-white/[0.05]">
                <img src="/wagerproofGreenDark.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-950 dark:text-white">WagerProof</p>
                  <p className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </p>
                </div>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth px-4 py-6 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto flex max-w-2xl flex-col gap-5">
                  {typing && (
                    <div className="flex flex-col items-center gap-4 pt-24 text-center sm:pt-32">
                      <ClaudeSpark className="h-10 w-10" />
                      <p className="font-serif text-2xl text-black/70 dark:text-white/75 sm:text-[28px]">
                        What are we betting on today?
                      </p>
                    </div>
                  )}
                  {play.phase >= Phase.Sent && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="ml-auto max-w-[85%] rounded-2xl bg-[#efece3] px-4 py-3 text-[15px] leading-6 text-gray-950 dark:bg-[#141413] dark:text-white sm:text-base"
                    >
                      {scenario.prompt}
                    </motion.div>
                  )}

                  {play.phase === Phase.Sent && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                      <ClaudeSpark className="h-6 w-6" spinning />
                    </motion.div>
                  )}

                  {play.phase >= Phase.ToolRunning && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-1.5 text-[15px] text-black/50 dark:text-white/50">
                        {play.phase === Phase.ToolRunning ? 'Using WagerProof' : 'Used WagerProof'}
                        <ChevronRight className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2.5 text-[15px]">
                        <img src="/wagerproofGreenDark.png" alt="" className="h-6 w-6 rounded-md object-cover" />
                        <span className="font-semibold text-gray-950 dark:text-white">WagerProof</span>
                        <code className="truncate font-mono text-[13px] text-black/50 dark:text-white/50">{scenario.tool}</code>
                        {play.phase === Phase.ToolRunning ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-black/40 dark:text-white/40" />
                        ) : (
                          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                    </motion.div>
                  )}

                  {play.phase >= Phase.Intro && (
                    <p className="font-serif text-[16px] leading-7 text-gray-900 dark:text-[#f5f4ef] sm:text-[17px]">
                      {firstWords(scenario.intro, play.intro)}
                    </p>
                  )}

                  {play.phase >= Phase.Card && <ResultCard scenario={scenario} rows={play.rows} />}

                  {play.phase >= Phase.Outro && (
                    <p className="font-serif text-[16px] leading-7 text-gray-900 dark:text-[#f5f4ef] sm:text-[17px]">
                      {firstWords(scenario.outro, play.outro)}
                    </p>
                  )}

                  {play.phase === Phase.Done && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between gap-3">
                      <ClaudeSpark className="h-6 w-6" />
                      <span className="text-[11px] text-black/35 dark:text-white/35">
                        {DEMO_SNAPSHOT_LABEL} · model estimates, not guarantees
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="px-4 pb-4 sm:px-8 sm:pb-6">
                <div className="mx-auto max-w-2xl rounded-2xl border border-black/[0.1] bg-white px-4 pb-3 pt-3.5 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.3)] dark:border-white/[0.1] dark:bg-[#30302e]">
                  <p className="min-h-[24px] text-[15px] leading-6 sm:text-base">
                    {typing ? (
                      <span className="text-gray-950 dark:text-white">
                        {scenario.prompt.slice(0, play.typed)}
                        <span className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[0.18em] animate-pulse bg-gray-950 dark:bg-white" />
                      </span>
                    ) : (
                      <span className="text-black/35 dark:text-white/35">Reply to Claude…</span>
                    )}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.1] text-black/50 dark:border-white/[0.12] dark:text-white/50">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-600/25 bg-emerald-500/[0.08] px-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      <img src="/wagerproofGreenDark.png" alt="" className="h-4 w-4 rounded object-cover" />
                      WagerProof
                    </span>
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={typing && play.typed > 0 ? 'ready' : 'idle'}
                        initial={{ scale: 0.85, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`ml-auto grid h-8 w-8 place-items-center rounded-lg text-white ${
                          typing && play.typed > 0 ? 'bg-[#d97757]' : 'bg-[#d97757]/45'
                        }`}
                      >
                        <ArrowUp className="h-4 w-4" strokeWidth={2.6} />
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
