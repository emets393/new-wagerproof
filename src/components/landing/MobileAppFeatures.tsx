import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  TrendingUp,
  Zap,
  Activity,
  BarChart3,
  Bot,
  Sparkles,
  ArrowRight,
  LayoutList,
  LineChart,
  Trophy,
  History,
  Filter,
  ListChecks,
  Brain,
  Radar,
} from "lucide-react";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// PHONE FRAME
// Real app screenshots inside an iPhone-style bezel.
// ─────────────────────────────────────────────
const PhoneScreenshot = ({ src, alt }: { src: string; alt: string }) => (
  <div className="relative mx-auto w-full max-w-[300px]">
    {/* Ambient glow behind the phone */}
    <div className="absolute inset-4 rounded-[3rem] bg-emerald-500/10 blur-3xl pointer-events-none" />
    <div className="relative rounded-[2.6rem] border-[6px] border-gray-900 dark:border-gray-800 bg-gray-900 overflow-hidden shadow-2xl shadow-black/40">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="block w-full h-auto"
      />
    </div>
  </div>
);

// ─────────────────────────────────────────────
// FEATURES CONFIGURATION
// Six real mobile app screens with copy per screen.
// ─────────────────────────────────────────────
const featuresConfig = [
  {
    id: "games",
    num: "01",
    screenshot: "/landing/mobile/games.png",
    screenshotAlt: "WagerProof mobile Games feed showing MLB lines, model edges, and prediction market sparklines",
    title: "Every Slate. Every Line. One Feed.",
    subtitle: "Live lines, model edges, and prediction markets for every game.",
    description:
      "Flip between MLB, NFL, CFB, NBA, and NCAAB and see spreads, moneylines, totals, and our model's edges side by side — with live prediction-market sparklines on every card.",
    bullets: [
      { icon: LayoutList, text: "All five major sports in one swipeable feed" },
      { icon: TrendingUp, text: "Model edges for spread, moneyline, and totals on every card" },
      { icon: LineChart, text: "Live prediction-market win probability sparklines" },
    ],
    accent: "emerald",
  },
  {
    id: "outliers",
    num: "02",
    screenshot: "/landing/mobile/outliers.png",
    screenshotAlt: "WagerProof mobile Outliers screen with Parlay God tickets and spread trend cards",
    title: "Outliers: Where the Data Gets Loud",
    subtitle: "Situational trends and parlays built from perfect historical samples.",
    description:
      "The Outliers feed surfaces spots the market is ignoring — coaches who keep failing to cover, road-game patterns, and Parlay God tickets where every leg has hit 100% of its historical sample.",
    bullets: [
      { icon: Zap, text: "Parlay God — tickets where every leg has hit 100% of its sample" },
      { icon: BarChart3, text: "Spread and moneyline trend cards with real hit rates" },
      { icon: Filter, text: "Filter by sport, market, and game" },
    ],
    accent: "emerald",
  },
  {
    id: "agents-hq",
    num: "03",
    screenshot: "/landing/mobile/agents-hq.png",
    screenshotAlt: "WagerProof mobile Agents HQ pixel office with agents working and a leaderboard",
    title: "Your Agents, Hard at Work",
    subtitle: "Watch your AI workforce research the slate in a live pixel office.",
    description:
      "Every agent you create shows up in Agent HQ — researching, filing picks, and resting between shifts. Track combined units, win rate, and jump to the public leaderboard or top picks in one tap.",
    bullets: [
      { icon: Bot, text: "Up to 30 custom agents researching around the clock" },
      { icon: Trophy, text: "Public leaderboard and top-picks tabs" },
      { icon: Activity, text: "Combined net units and win rate at a glance" },
    ],
    accent: "violet",
  },
  {
    id: "agent-detail",
    num: "04",
    screenshot: "/landing/mobile/agent-detail.png",
    screenshotAlt: "WagerProof mobile agent profile showing record, net units, win rate, and cumulative units chart",
    title: "Every Agent Has a Public Record",
    subtitle: "Transparent W-L records, net units, and performance charts.",
    description:
      "No cherry-picking. Each agent's full record, win rate, streak, and cumulative units chart is tracked automatically — so you know exactly which strategies are actually winning.",
    bullets: [
      { icon: ListChecks, text: "Record, win rate, net units, and streak on every profile" },
      { icon: LineChart, text: "Cumulative units performance chart over time" },
      { icon: Sparkles, text: "Swipe to reveal today's picks as research completes" },
    ],
    accent: "emerald",
  },
  {
    id: "pick-history",
    num: "05",
    screenshot: "/landing/mobile/pick-history.png",
    screenshotAlt: "WagerProof mobile pick history stack of graded win, loss, and push cards",
    title: "A Verified Paper Trail",
    subtitle: "Every pick is graded and archived — wins, losses, and pushes.",
    description:
      "Pick history is permanent. Every wager an agent files gets graded against the final score and stacked in the archive, filterable by result, sport, and date. Nothing gets deleted.",
    bullets: [
      { icon: History, text: "Complete graded archive of every pick ever made" },
      { icon: Filter, text: "Filter by result, sport, and sort order" },
      { icon: Radar, text: "Results graded automatically against final scores" },
    ],
    accent: "emerald",
  },
  {
    id: "pick-reasoning",
    num: "06",
    screenshot: "/landing/mobile/parlay-detail.png",
    screenshotAlt: "WagerProof mobile parlay ticket detail with leg breakdown, summary, and key factors",
    title: "See the Reasoning Behind Every Pick",
    subtitle: "Full research summaries and key factors on every ticket.",
    description:
      "Open any ticket and read exactly why the agent made it — leg-by-leg odds and units, model win probabilities and edges, and the key factors that drove the decision.",
    bullets: [
      { icon: ListChecks, text: "Leg-by-leg breakdown with odds, units, and results" },
      { icon: Brain, text: "Model win probability and edge cited for each leg" },
      { icon: Sparkles, text: "Plain-English summary and key factors on every ticket" },
    ],
    accent: "blue",
  },
];

// ─────────────────────────────────────────────
// BULLET POINT COMPONENT
// ─────────────────────────────────────────────
const FeatureBullet = ({ icon: Icon, text, delay }: { icon: React.ElementType; text: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.5, delay }}
    className="flex items-start gap-3 group"
  >
    <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
      <Icon className="w-3.5 h-3.5 text-emerald-500" />
    </div>
    <span className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">{text}</span>
  </motion.div>
);

// ─────────────────────────────────────────────
// FEATURE SECTION (one full row)
// Alternating layout: phone screenshot + rich text.
// ─────────────────────────────────────────────
const FeatureSection = ({
  feature,
  isReversed,
}: {
  feature: (typeof featuresConfig)[0];
  isReversed: boolean;
}) => {
  return (
    <div className="feature-section relative">
      {/* Optional ambient bg tint per-section */}
      {feature.accent === "violet" && (
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.02] via-transparent to-transparent dark:from-violet-500/[0.03] pointer-events-none" />
      )}
      {feature.accent === "blue" && (
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.02] via-transparent to-transparent dark:from-blue-500/[0.03] pointer-events-none" />
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 py-16 md:py-24 lg:py-28">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
            isReversed ? "lg:[direction:rtl]" : ""
          }`}
        >
          {/* Screenshot Column */}
          <div className={`feature-el flex justify-center ${isReversed ? "lg:[direction:ltr]" : ""}`}>
            <motion.div
              whileHover={{ scale: 1.015 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="w-full"
            >
              <PhoneScreenshot src={feature.screenshot} alt={feature.screenshotAlt} />
            </motion.div>
          </div>

          {/* Text Column */}
          <div className={`feature-el ${isReversed ? "lg:[direction:ltr]" : ""}`}>
            {/* Feature number */}
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.08 }}
              viewport={{ once: true }}
              className="block text-[120px] md:text-[160px] font-black leading-none -mb-16 md:-mb-20 select-none text-gray-900 dark:text-white pointer-events-none"
            >
              {feature.num}
            </motion.span>

            <div className="relative">
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3 leading-[1.1] tracking-tight">
                {feature.title}
              </h3>
              <p className="text-lg sm:text-xl text-emerald-600 dark:text-emerald-400 font-medium mb-4">
                {feature.subtitle}
              </p>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8 max-w-xl">
                {feature.description}
              </p>

              {/* Bullet points */}
              <div className="space-y-4 mb-10">
                {feature.bullets.map((bullet, i) => (
                  <FeatureBullet key={i} icon={bullet.icon} text={bullet.text} delay={i * 0.1} />
                ))}
              </div>

              {/* CTA */}
              <Link to="/account">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="group/btn px-7 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold text-sm transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <span>Try It Free</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN EXPORT
// Six real mobile app screens with scroll-triggered
// GSAP entrances and a subtle noise overlay.
// ─────────────────────────────────────────────
export function MobileAppFeatures() {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".feature-section").forEach((section) => {
        const els = section.querySelectorAll<HTMLElement>(".feature-el");
        gsap.from(els, {
          y: 80,
          opacity: 0,
          duration: 1.2,
          stagger: 0.25,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
          },
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative bg-white dark:bg-[#050508] overflow-hidden">
      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")',
        }}
      />

      {/* Section intro */}
      <div className="relative z-10 text-center pt-20 md:pt-32 pb-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-block text-[11px] font-mono tracking-[0.25em] uppercase text-emerald-600 dark:text-emerald-400 mb-4 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            The Mobile App
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight max-w-3xl mx-auto leading-tight">
            Everything You Need to
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-emerald-400"> Bet Smarter</span>
          </h2>
        </motion.div>
      </div>

      {/* Feature sections */}
      <div className="relative z-10">
        {featuresConfig.map((feature, index) => (
          <FeatureSection key={feature.id} feature={feature} isReversed={index % 2 !== 0} />
        ))}
      </div>
    </section>
  );
}

export default MobileAppFeatures;
