import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import type { Transition } from 'framer-motion';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { GradientText } from '@/components/ui/gradient-text';
import { OutliersDashboard } from '@/features/outliers/components/OutliersDashboard';
import { trackCTAClick } from '@/lib/mixpanel';
import { useTheme } from '@/contexts/ThemeContext';

const HERO_HEADLINE = 'Build bots that find plays for you';

function TypewriterHeadline({ gradient, transition }: { gradient: string; transition: Transition }) {
  const [visibleCharacters, setVisibleCharacters] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleCharacters(HERO_HEADLINE.length);
      return;
    }

    let typingTimer: number | undefined;
    const startTimer = window.setTimeout(() => {
      typingTimer = window.setInterval(() => {
        setVisibleCharacters((current) => {
          if (current >= HERO_HEADLINE.length) {
            window.clearInterval(typingTimer);
            return current;
          }
          return current + 1;
        });
      }, 55);
    }, 250);

    return () => {
      window.clearTimeout(startTimer);
      if (typingTimer !== undefined) window.clearInterval(typingTimer);
    };
  }, []);

  const first = HERO_HEADLINE.slice(0, Math.min(visibleCharacters, 10));
  const middle = HERO_HEADLINE.slice(10, Math.min(visibleCharacters, 21));
  const plays = HERO_HEADLINE.slice(21, Math.min(visibleCharacters, 26));
  const ending = HERO_HEADLINE.slice(26, visibleCharacters);

  return (
    <h1
      aria-label={HERO_HEADLINE}
      className="relative text-balance text-4xl font-black leading-[1.02] tracking-[-0.045em] text-gray-900 dark:text-gray-100 sm:text-5xl md:text-[3.25rem] lg:text-[3.375rem]"
      style={{ fontFamily: "'SFMono-Regular', 'Cascadia Code', 'Roboto Mono', ui-monospace, monospace" }}
    >
      <span aria-hidden className="invisible">{HERO_HEADLINE}</span>
      <span aria-hidden className="absolute inset-0">
        <GradientText text={first} gradient={gradient} transition={transition} className="font-black" />
        {middle}
        <GradientText text={plays} gradient={gradient} transition={transition} className="font-black" />
        {ending}
        <span className="ml-[0.08em] inline-block h-[0.9em] w-[0.08em] translate-y-[0.06em] animate-pulse bg-emerald-400 motion-reduce:hidden" />
      </span>
    </h1>
  );
}

export default function LandingOutliersHero() {
  const { theme } = useTheme();
  const gradient = theme === 'light'
    ? 'linear-gradient(90deg, #15803d 0%, #22c55e 20%, #166534 50%, #22c55e 80%, #15803d 100%)'
    : 'linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)';
  const transition = { duration: 6, repeat: Infinity, ease: 'linear' as const };
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 md:pb-24 md:pt-36">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_50%_0%,rgba(0,201,104,0.18),transparent_62%)]" />
      <div aria-hidden className="pointer-events-none absolute left-[12%] top-52 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute right-[10%] top-24 h-64 w-64 rounded-full bg-lime-300/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl">
        <div className="grid items-center gap-10 text-center lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:text-left">
          <div className="max-w-3xl">
            <div className="flex items-start gap-4 text-left">
              <Bot aria-hidden className="mt-1.5 h-10 w-10 shrink-0 text-emerald-500" strokeWidth={1.8} />
              <TypewriterHeadline gradient={gradient} transition={transition} />
            </div>
            <p className="mt-6 max-w-3xl pl-14 text-left text-lg text-gray-600 dark:text-gray-300 md:text-xl">
              Get access to professional-grade predictions &amp; data for NFL, College Football, and more.
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-[332px] flex-col items-center lg:mx-0 lg:items-stretch">
            <div className="grid grid-cols-2 items-center gap-4">
              <a href="https://apps.apple.com/us/app/wagerproof-sports-picks-ai/id6757089957" target="_blank" rel="noopener noreferrer" className="flex h-[54px] w-full items-center justify-center">
                <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" className="h-[48px] w-[144px] object-contain" />
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.wagerproof.mobile" target="_blank" rel="noopener noreferrer" className="flex h-[54px] w-full items-center justify-center">
                <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" className="h-[54px] w-[158px] scale-125 object-contain" />
              </a>
            </div>
            <Link className="mt-4 block w-full" to="/account" onClick={() => trackCTAClick('Try on Web', 'Hero', '/account')}>
              <MovingBorderButton borderRadius="0.5rem" containerClassName="h-[54px] w-full" className="border-gray-300 bg-white text-base font-semibold text-honeydew-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-honeydew-400 dark:hover:bg-gray-800" borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]" duration={2500}>
                <span>Try on Web</span>
              </MovingBorderButton>
            </Link>

            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              Follow us on
              <a href="https://twitter.com/wagerproofai" target="_blank" rel="noopener noreferrer" aria-label="WagerProof on X" className="transition-colors hover:text-gray-700 dark:hover:text-gray-200">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              &amp;
              <a href="https://instagram.com/wagerproof.official" target="_blank" rel="noopener noreferrer" aria-label="WagerProof on Instagram" className="transition-colors hover:text-gray-700 dark:hover:text-gray-200">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 3.675A6.162 6.162 0 1 0 12 18.162 6.162 6.162 0 0 0 12 5.838zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 1 0 2.88 1.44 1.44 0 0 1 0-2.88z" /></svg>
              </a>
              for daily picks.
            </p>
          </div>
        </div>

        <div className="relative mt-12 md:mt-16">
          <div aria-hidden className="absolute -inset-4 rounded-[36px] bg-gradient-to-b from-emerald-400/15 via-transparent to-transparent blur-2xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.08] bg-white/78 p-4 shadow-[0_30px_80px_-34px_rgba(0,0,0,0.35)] backdrop-blur-2xl dark:border-white/[0.1] dark:bg-black/55 sm:p-6">
            <div className="mb-5 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
              <h2 className="text-xl font-black tracking-tight text-gray-950 dark:text-gray-50 sm:text-2xl">Today&apos;s Outliers</h2>
            </div>
            <OutliersDashboard limited />
          </div>
        </div>
      </div>
    </section>
  );
}
