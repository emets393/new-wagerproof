import { Link } from 'react-router-dom';
import { Button as MovingBorderButton } from '@/components/ui/moving-border';
import { GradientText } from '@/components/ui/gradient-text';
import { OutliersDashboard } from '@/features/outliers/components/OutliersDashboard';
import { trackCTAClick } from '@/lib/mixpanel';
import { useTheme } from '@/contexts/ThemeContext';

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
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl md:text-6xl lg:text-7xl">
            <GradientText text="Build bots" gradient={gradient} transition={transition} className="font-bold" />{' '}
            that find{' '}
            <GradientText text="plays" gradient={gradient} transition={transition} className="font-bold" />{' '}
            for you
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-600 dark:text-gray-300 md:text-xl">
            Get access to professional-grade predictions &amp; data for NFL, College Football, and more.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href="https://apps.apple.com/us/app/wagerproof-sports-picks-ai/id6757089957" target="_blank" rel="noopener noreferrer" className="flex items-center">
              <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" className="h-[40px] w-[120px] object-contain md:h-[54px] md:w-[160px]" />
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.wagerproof.mobile" target="_blank" rel="noopener noreferrer" className="flex items-center">
              <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" className="h-[54px] w-[180px] object-contain md:h-[75px] md:w-[250px]" />
            </a>
            <Link to="/account" onClick={() => trackCTAClick('Try on Web', 'Hero', '/account')}>
              <MovingBorderButton borderRadius="0.5rem" containerClassName="h-[50px] w-[170px]" className="border-gray-300 bg-white text-base font-semibold text-honeydew-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-honeydew-400 dark:hover:bg-gray-800" borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]" duration={2500}>
                <span>Try on Web</span>
              </MovingBorderButton>
            </Link>
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            Follow us on
            <a href="https://twitter.com/wagerproofai" target="_blank" rel="noopener noreferrer" aria-label="WagerProof on X" className="transition-colors hover:text-gray-700 dark:hover:text-gray-200">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            &amp;
            <a href="https://instagram.com/wagerproof.official" target="_blank" rel="noopener noreferrer" aria-label="WagerProof on Instagram" className="transition-colors hover:text-gray-700 dark:hover:text-gray-200">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 3.675A6.162 6.162 0 1 0 12 18.162 6.162 6.162 0 0 0 12 5.838zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 1 0 2.88 1.44 1.44 0 0 1 0-2.88z" /></svg>
            </a>
            for free daily picks and analysis.
          </p>
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
