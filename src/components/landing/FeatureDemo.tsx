import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Brain, LayoutList, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { GameListCard } from "@/features/games/components/GameListCard";
import { NflPredictionsSection } from "@/features/games/detail/sections/nfl/NflPredictionsSection";
import { NflBettingSplitsSection } from "@/features/games/detail/sections/nfl/NflBettingSplitsSection";
import { MatchSimulatorSection } from "@/features/games/detail/sections/MatchSimulatorSection";
import {
  getNFLTeamColors,
  getNFLTeamInitials,
  getNFLTeamLogo,
  type NFLPrediction,
} from "@/features/games/api/nflGames";
import { getNBATeamLogo } from "@/features/games/api/nbaGames";
import { getNBATeamColors, getNBATeamInitials } from "@/utils/teamColors";
import type { GameFeedItem, TeamRef } from "@/features/games/types";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// SAMPLE DATA — real app components, demo numbers
// ─────────────────────────────────────────────
const nflTeam = (city: string): TeamRef => ({
  name: city,
  abbrev: getNFLTeamInitials(city),
  logoUrl: getNFLTeamLogo(city),
  colors: getNFLTeamColors(city),
});

const nbaTeam = (name: string): TeamRef => ({
  name,
  abbrev: getNBATeamInitials(name),
  logoUrl: getNBATeamLogo(name, []),
  colors: getNBATeamColors(name),
});

interface DemoNflGame {
  id: string;
  away: string;
  home: string;
  time: string;
  lines: GameFeedItem["lines"];
  edges: GameFeedItem["edges"];
}

const DEMO_NFL_GAMES: DemoNflGame[] = [
  {
    id: "demo-kc-buf",
    away: "Kansas City",
    home: "Buffalo",
    time: "8:15 PM ET",
    lines: { awayML: -125, homeML: 105, homeSpread: 2.5, awaySpread: -2.5, total: 51.5 },
    edges: { mlProb: 0.38, spreadEdge: 1.5, totalEdge: 2.5 },
  },
  {
    id: "demo-dal-phi",
    away: "Dallas",
    home: "Philadelphia",
    time: "4:25 PM ET",
    lines: { awayML: 195, homeML: -240, homeSpread: -6, awaySpread: 6, total: 44.5 },
    edges: { mlProb: 0.71, spreadEdge: -2, totalEdge: -1.5 },
  },
  {
    id: "demo-cin-ne",
    away: "Cincinnati",
    home: "New England",
    time: "1:00 PM ET",
    lines: { awayML: -155, homeML: 130, homeSpread: 3.5, awaySpread: -3.5, total: 43.5 },
    edges: { mlProb: 0.34, spreadEdge: 3.5, totalEdge: -3 },
  },
];

const toFeedItem = (g: DemoNflGame): GameFeedItem => ({
  sport: "nfl",
  id: g.id,
  awayTeam: nflTeam(g.away),
  homeTeam: nflTeam(g.home),
  gameDate: "",
  gameTimeLabel: g.time,
  timeSortKey: g.time,
  status: "scheduled",
  lines: g.lines,
  edges: g.edges,
  raw: {},
});

// Featured game for the Model Predictions + Public Betting widgets.
const DEMO_NFL_RAW: NFLPrediction = {
  id: "demo-kc-buf",
  away_team: "Kansas City",
  home_team: "Buffalo",
  home_ml: 105,
  away_ml: -125,
  home_spread: 2.5,
  away_spread: -2.5,
  over_line: 51.5,
  game_date: "",
  game_time: "",
  training_key: "demo-kc-buf",
  unique_id: "demo-kc-buf",
  home_away_ml_prob: 0.38,
  home_away_spread_cover_prob: 0.31,
  ou_result_prob: 0.74,
  run_id: null,
  temperature: null,
  precipitation: null,
  wind_speed: null,
  icon: null,
  spread_splits_label: "Sharp money on Kansas City (68%)",
  total_splits_label: "Public on Over (71%)",
  ml_splits_label: "Sharp money on Kansas City (64%)",
  home_spread_diff: -1.5,
  over_line_diff: 2.7,
};

const DEMO_DETAIL_GAME: GameFeedItem = {
  ...toFeedItem(DEMO_NFL_GAMES[0]),
  raw: DEMO_NFL_RAW,
};

// NBA game so the interactive Match Simulator widget has projected scores.
const DEMO_NBA_GAME: GameFeedItem = {
  sport: "nba",
  id: "demo-bos-lal",
  awayTeam: nbaTeam("Boston Celtics"),
  homeTeam: nbaTeam("Los Angeles Lakers"),
  gameDate: "",
  gameTimeLabel: "10:00 PM ET",
  timeSortKey: "10:00 PM ET",
  status: "scheduled",
  lines: { awayML: -140, homeML: 118, homeSpread: 2.5, awaySpread: -2.5, total: 224.5 },
  edges: { mlProb: 0.41, spreadEdge: 1.5, totalEdge: 2 },
  raw: { away_score_pred: 116, home_score_pred: 111 },
};

// ─────────────────────────────────────────────
// MAIN EXPORT — real in-app components with sample data
// ─────────────────────────────────────────────
export function FeatureDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string>(DEMO_NFL_GAMES[0].id);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".tool-card").forEach((card, i) => {
        gsap.from(card, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          delay: i * 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 88%",
          },
        });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const columns = [
    { label: "Games Feed", desc: "Lines, edges & prediction markets for every slate", icon: LayoutList },
    { label: "Model Predictions", desc: "Spread & total picks with confidence scores", icon: Brain },
    { label: "Game Widgets", desc: "Simulators, public betting facts & more", icon: Sparkles },
  ];

  return (
    <section ref={sectionRef} className="relative py-16 md:py-24 overflow-hidden">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 md:mb-14"
        >
          <span className="inline-block text-[11px] font-mono tracking-[0.25em] uppercase text-gray-500 dark:text-gray-400 mb-4 px-4 py-1.5 rounded-full bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/[0.06]">
            Professional-Grade Tools
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight mb-3">
            Data & Tools at
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-emerald-400"> Your Fingertips</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            These are the actual components from inside the app — game feeds, model predictions,
            and widgets — shown here with sample data.
          </p>
        </motion.div>

        {/* Column descriptor chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-8 md:mb-12">
          {columns.map((c) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm border border-gray-200/60 dark:border-white/[0.06]"
            >
              <c.icon className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{c.label}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:inline">— {c.desc}</span>
            </motion.div>
          ))}
        </div>

        {/* Real app components with sample data */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start mb-10">
          {/* Column 1: the real games-feed cards */}
          <div className="tool-card space-y-3">
            {DEMO_NFL_GAMES.map((g) => (
              <GameListCard
                key={g.id}
                item={toFeedItem(g)}
                isSelected={selectedId === g.id}
                isLocked={false}
                isAdmin={false}
                onSelect={setSelectedId}
                showSparkline={false}
              />
            ))}
          </div>

          {/* Column 2: the real Model Predictions detail widget */}
          <div className="tool-card">
            <NflPredictionsSection game={DEMO_DETAIL_GAME} completions={{}} />
          </div>

          {/* Column 3: Match Simulator (interactive) + Public Betting Facts */}
          <div className="tool-card space-y-4">
            <MatchSimulatorSection game={DEMO_NBA_GAME} />
            <NflBettingSplitsSection raw={DEMO_NFL_RAW} />
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link to="/account">
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group/btn px-7 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold text-sm shadow-lg hover:shadow-xl inline-flex items-center gap-2"
            >
              <span>Explore All Tools</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
