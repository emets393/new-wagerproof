import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Globe } from 'lucide-react';

import { trackCTAClick } from '@/lib/mixpanel';
import AgentChatDemo from './AgentChatDemo';
import AgentConnectMenu, { AgentIcon } from './AgentConnectMenu';
import { HEADLINE_AGENTS } from './heroAgents';
import MarkerHighlight from './MarkerHighlight';

const SPRING = { type: 'spring' as const, damping: 30, stiffness: 300 };

// One laurel branch as a single drawing: the stem is an arc and every leaf is grown from a point
// on that arc at an angle off its tangent, so nothing floats. Generated, not hand-placed —
// don't nudge individual coordinates.
const LAUREL_STEM = 'M45.0 83.6A36 36 0 0 1 45.0 12.4';
const LAUREL_LEAVES = 'M40.6 82.7Q33.3 79.1 26.8 88.6Q38.1 90.5 40.6 82.7ZM40.6 82.7Q42.3 76.2 33.4 72.5Q33.8 82.1 40.6 82.7ZM29.0 77.2Q23.8 71.5 14.7 77.8Q24.2 83.4 29.0 77.2ZM29.0 77.2Q32.8 72.0 26.1 65.7Q23.2 74.4 29.0 77.2ZM20.1 68.0Q17.3 61.2 7.1 63.8Q13.8 71.9 20.1 68.0ZM20.1 68.0Q25.2 64.6 21.3 56.7Q15.8 63.6 20.1 68.0ZM15.0 56.3Q14.8 49.3 4.8 48.2Q8.1 57.6 15.0 56.3ZM15.0 56.3Q20.7 54.9 19.8 46.6Q12.6 50.9 15.0 56.3ZM14.3 43.5Q16.4 37.2 8.0 32.9Q7.7 42.4 14.3 43.5ZM14.3 43.5Q19.8 44.2 21.8 36.5Q14.0 37.9 14.3 43.5ZM18.1 31.3Q22.1 26.4 16.0 19.8Q12.7 28.1 18.1 31.3ZM18.1 31.3Q22.8 33.7 27.1 27.6Q19.7 26.3 18.1 31.3ZM26.0 21.2Q31.1 18.2 27.9 10.4Q22.2 16.6 26.0 21.2ZM26.0 21.2Q29.3 24.9 35.1 20.9Q29.1 17.3 26.0 21.2ZM36.9 14.5Q42.4 13.5 42.2 5.6Q35.1 9.2 36.9 14.5ZM36.9 14.5Q38.6 18.8 45.0 17.2Q40.9 12.0 36.9 14.5ZM45.0 12.4Q49.8 16.3 56.9 10.7Q48.5 7.2 45.0 12.4Z';

function Laurel({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="2 2 62 94"
      className={`h-[76px] w-[50px] text-black/30 dark:text-white/30 sm:h-[88px] sm:w-[58px] ${flip ? '-scale-x-100' : ''}`}
    >
      <path d={LAUREL_STEM} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d={LAUREL_LEAVES} fill="currentColor" />
    </svg>
  );
}

function Star() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 text-[#f5a524] sm:h-7 sm:w-7" fill="currentColor">
      <path d="M12 1.800l3.050 6.500 7.150.850-5.300 4.850 1.450 7-6.350-3.550L5.650 21l1.450-7-5.300-4.850 7.150-.850z" />
    </svg>
  );
}

function RotatingAgent() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % HEADLINE_AGENTS.length), 2400);
    return () => window.clearInterval(timer);
  }, []);

  const agent = HEADLINE_AGENTS[index];

  return (
    // popLayout lifts the outgoing name out of flow, so the words on either side
    // slide to the new width (layout="position") instead of snapping.
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={agent.key}
        layout="position"
        initial={{ y: '0.45em', opacity: 0, filter: 'blur(8px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        exit={{ y: '-0.45em', opacity: 0, filter: 'blur(8px)' }}
        transition={SPRING}
        className="inline-flex items-center gap-[0.16em] whitespace-nowrap"
      >
        {agent.key === 'claude' ? (
          // Claude's spark reads better bare than boxed in a tile.
          <img src={agent.icon} alt="" aria-hidden className="h-[0.86em] w-[0.86em]" />
        ) : (
          <AgentIcon agent={agent} className="h-[0.86em] w-[0.86em] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.5)]" />
        )}
        {agent.name}
      </motion.span>
    </AnimatePresence>
  );
}

export default function LandingAgentHero() {
  return (
    <section className="relative bg-[#f4f1ea] px-4 pb-20 pt-28 text-center dark:bg-[#0d0e0e] sm:px-6 md:pb-28 md:pt-32">
      {/* @import must be the first rule in its sheet, so the handwriting font gets its own <style>. */}
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap');"}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.14),transparent_60%)]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-center gap-1" role="img" aria-label="Rated 5 stars, 10k+ users">
          <Laurel />
          <div aria-hidden>
            <div className="flex items-center justify-center gap-0.5">
              {[0, 1, 2, 3, 4].map((star) => (
                <Star key={star} />
              ))}
            </div>
            <p className="mt-1.5 text-base font-semibold text-black/70 dark:text-white/70 sm:text-lg">10k+ users</p>
          </div>
          <Laurel flip />
        </div>

        <h1
          aria-label="Let Claude, ChatGPT, Grok, or any AI agent find you actual high probability bets, with real live pro data."
          className="mt-8 text-[2.3rem] font-black leading-[1.02] tracking-[-0.045em] text-gray-950 dark:text-white sm:text-[min(6.2vw,4.75rem)]"
        >
          <LayoutGroup>
            {/* One row from sm up (the fluid font size guarantees the longest name fits); on phones
                "find you actual" always takes its own row so a longer name can't reflow the page. */}
            <span aria-hidden className="flex flex-wrap items-center justify-center gap-x-[0.24em] sm:flex-nowrap">
              <span className="inline-flex items-center gap-[0.24em]">
                <motion.span layout="position" transition={SPRING}>Let</motion.span>
                <RotatingAgent />
              </span>
              <motion.span layout="position" transition={SPRING} className="basis-full whitespace-nowrap sm:basis-auto">
                find you actual
              </motion.span>
            </span>
          </LayoutGroup>
          <span aria-hidden className="block text-balance">high probability bets,</span>
          <span aria-hidden className="mt-[0.12em] block leading-[1.22]">
            <MarkerHighlight>with real live pro data.</MarkerHighlight>
          </span>
        </h1>

        <div className="relative z-30 mx-auto mt-10 flex max-w-md flex-col items-stretch justify-center gap-4 sm:max-w-none sm:flex-row sm:items-center">
          <AgentConnectMenu />
          <Link
            to="/account"
            onClick={() => trackCTAClick('Try on Web', 'Hero', '/account')}
            className="inline-flex h-[60px] items-center justify-center gap-2 rounded-2xl border border-black/[0.08] bg-white px-6 text-lg font-semibold text-gray-950 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.4)] transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-white/[0.1] dark:bg-[#161818] dark:text-white dark:hover:bg-[#1e2020]"
          >
            <Globe className="h-5 w-5" />
            Try on web
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <a href="https://apps.apple.com/us/app/wagerproof-sports-picks-ai/id6757089957" target="_blank" rel="noopener noreferrer">
            <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" className="h-10" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.wagerproof.mobile" target="_blank" rel="noopener noreferrer">
            {/* Google's badge PNG ships with built-in padding, hence the larger height to match Apple's. */}
            <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" className="-mx-2 h-[59px]" />
          </a>
        </div>

        <div className="mt-12 md:mt-14">
          <AgentChatDemo />
        </div>
      </div>
    </section>
  );
}
