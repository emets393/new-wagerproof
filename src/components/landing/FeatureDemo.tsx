import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Brain, LayoutList, Percent, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { GameListCard } from "@/features/games/components/GameListCard";
import { NflSpreadSection } from "@/features/games/detail/sections/nfl/NflPredictionsSection";
import { MlbSideAnglesSection } from "@/features/trendsToday/detail/sections/MlbAngleSections";
import {
  getNFLTeamColors,
  getNFLTeamInitials,
  getNFLTeamLogo,
  type NFLPrediction,
} from "@/features/games/api/nflGames";
import { getMLBTeamColors } from "@/utils/teamColors";
import type { GameFeedItem, GamesSport, TeamRef } from "@/features/games/types";
import type { TrendAngle, TrendsFeedItem, TrendsTeam, TrendsVerdict } from "@/features/trendsToday/types";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// SAMPLE DATA — real app components + live Polymarket sparklines
// Matchups chosen because they have active Polymarket moneyline markets:
//   "Rams vs. Chiefs", "Eagles vs. Ravens", "Pittsburgh Pirates vs. New York Yankees"
// Team names match what getAllMarketsData / findMatchingEvent expects.
// ─────────────────────────────────────────────
const nflTeam = (city: string): TeamRef => ({
  name: city,
  abbrev: getNFLTeamInitials(city),
  logoUrl: getNFLTeamLogo(city),
  colors: getNFLTeamColors(city),
});

const mlbTeam = (name: string, abbrev: string): TeamRef => ({
  name,
  abbrev,
  logoUrl: `https://a.espncdn.com/i/teamlogos/mlb/500/${abbrev.toLowerCase()}.png`,
  colors: getMLBTeamColors(abbrev),
});

const mlbTrendsTeam = (name: string, abbrev: string): TrendsTeam => ({
  name,
  abbrev,
  logoUrl: `https://a.espncdn.com/i/teamlogos/mlb/500/${abbrev.toLowerCase()}.png`,
  colors: getMLBTeamColors(abbrev),
});

interface DemoGame {
  id: string;
  sport: GamesSport;
  awayTeam: TeamRef;
  homeTeam: TeamRef;
  time: string;
  lines: GameFeedItem["lines"];
  edges: GameFeedItem["edges"];
}

const DEMO_GAMES: DemoGame[] = [
  {
    id: "demo-lar-kc",
    sport: "nfl",
    // Polymarket: "Rams vs. Chiefs"
    awayTeam: nflTeam("Los Angeles Rams"),
    homeTeam: nflTeam("Kansas City"),
    time: "8:20 PM ET",
    lines: { awayML: -110, homeML: -110, homeSpread: -1.5, awaySpread: 1.5, total: 47.5 },
    edges: { mlProb: 0.485, spreadEdge: 1.5, totalEdge: 2.0 },
  },
  {
    id: "demo-phi-bal",
    sport: "nfl",
    // Polymarket: "Eagles vs. Ravens"
    awayTeam: nflTeam("Philadelphia"),
    homeTeam: nflTeam("Baltimore"),
    time: "4:25 PM ET",
    lines: { awayML: -115, homeML: -105, homeSpread: 1.5, awaySpread: -1.5, total: 46.5 },
    edges: { mlProb: 0.485, spreadEdge: -2.0, totalEdge: -1.5 },
  },
  {
    id: "demo-pit-nyy",
    sport: "mlb",
    // Polymarket: "Pittsburgh Pirates vs. New York Yankees"
    awayTeam: mlbTeam("Pittsburgh Pirates", "PIT"),
    homeTeam: mlbTeam("New York Yankees", "NYY"),
    time: "7:05 PM ET",
    lines: { awayML: 165, homeML: -185, homeSpread: -1.5, awaySpread: 1.5, total: 9.5 },
    edges: { mlProb: 0.615, spreadEdge: null, totalEdge: 0.7 },
  },
];

const toFeedItem = (g: DemoGame): GameFeedItem => ({
  sport: g.sport,
  id: g.id,
  awayTeam: g.awayTeam,
  homeTeam: g.homeTeam,
  gameDate: "",
  gameTimeLabel: g.time,
  timeSortKey: g.time,
  status: "scheduled",
  lines: g.lines,
  edges: g.edges,
  raw: {},
});

// Featured NFL game for the Spread widget (matches first feed card).
const DEMO_NFL_RAW: NFLPrediction = {
  id: "demo-lar-kc",
  away_team: "Los Angeles Rams",
  home_team: "Kansas City",
  home_ml: -110,
  away_ml: -110,
  home_spread: -1.5,
  away_spread: 1.5,
  over_line: 47.5,
  game_date: "",
  game_time: "",
  training_key: "demo-lar-kc",
  unique_id: "demo-lar-kc",
  home_away_ml_prob: 0.485,
  home_away_spread_cover_prob: 0.42,
  ou_result_prob: 0.58,
  run_id: null,
  temperature: null,
  precipitation: null,
  wind_speed: null,
  icon: null,
  spread_splits_label: "Sharp money on Los Angeles Rams (61%)",
  total_splits_label: "Public on Over (66%)",
  ml_splits_label: "Sharp money on Los Angeles Rams (54%)",
  home_spread_diff: -1.5,
  over_line_diff: 2.0,
};

const DEMO_SPREAD_GAME: GameFeedItem = {
  ...toFeedItem(DEMO_GAMES[0]),
  raw: DEMO_NFL_RAW,
};

function angle(
  key: string,
  label: string,
  awaySit: string,
  homeSit: string,
  awayPct: number,
  homePct: number,
): TrendAngle {
  const empty = {
    sideRecord: null as string | null,
    sideGames: null as number | null,
    overPct: null as number | null,
    underPct: null as number | null,
    ouRecord: null as string | null,
    ouGames: null as number | null,
  };
  return {
    key,
    label,
    away: { situation: awaySit, sidePct: awayPct, ...empty },
    home: { situation: homeSit, sidePct: homePct, ...empty },
    sideLean: awayPct === homePct ? null : awayPct > homePct ? "away" : "home",
    ouLean: null,
  };
}

const DEMO_MLB_ANGLES: TrendAngle[] = [
  angle("last_game", "Last game", "After loss", "After win", 59.6, 60.0),
  angle("home_away", "Home / away", "Away", "Home", 50.0, 53.2),
  angle("fav_dog", "Favorite / underdog", "Underdog", "Favorite", 51.2, 57.5),
  angle("rest", "Days off", "1 day off", "1 day off", 48.4, 55.1),
  angle("rest_edge", "Rest edge", "Equal rest", "Equal rest", 49.0, 52.8),
  angle("league", "League", "Interleague", "Interleague", 46.7, 54.3),
  angle("division", "Division", "Non-division", "Non-division", 47.9, 56.1),
];

const DEMO_MLB_VERDICT: TrendsVerdict = {
  side: "home",
  sideAgree: 7,
  sideTotal: 7,
  awayAvgSidePct: 50.4,
  homeAvgSidePct: 55.6,
  sideMarginPts: 5.2,
  total: null,
  totalAgree: 0,
  totalTotal: 0,
  awayAvgOverPct: null,
  homeAvgOverPct: null,
  totalMarginPts: null,
};

const DEMO_MLB_TRENDS_GAME: TrendsFeedItem = {
  sport: "mlb",
  id: "demo-pit-nyy-trends",
  away: mlbTrendsTeam("Pittsburgh Pirates", "PIT"),
  home: mlbTrendsTeam("New York Yankees", "NYY"),
  gameDate: "",
  gameTimeLabel: "7:05 PM ET",
  timeSortKey: "7:05 PM ET",
  angles: DEMO_MLB_ANGLES,
  verdict: DEMO_MLB_VERDICT,
  scores: { ouConsensus: 0, sideDominance: 5.2 },
};

// ─────────────────────────────────────────────
// MAIN EXPORT — real in-app components with sample data
// ─────────────────────────────────────────────
export function FeatureDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string>(DEMO_GAMES[0].id);

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
    { label: "Games Feed", desc: "Lines, edges & live Polymarket win probs", icon: LayoutList },
    { label: "Model Predictions", desc: "Spread picks with confidence scores", icon: Brain },
    { label: "Situational Trends", desc: "Moneyline by situation for MLB matchups", icon: Percent },
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
            These are the actual components from inside the app — game feeds with live prediction-market
            sparklines, model predictions, and situational widgets.
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

        {/* Real app components with sample data + live Polymarket sparklines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start mb-10">
          {/* Column 1: games feed — 2 NFL + 1 MLB (sparklines fetch live) */}
          <div className="tool-card space-y-3">
            {DEMO_GAMES.map((g) => (
              <GameListCard
                key={g.id}
                item={toFeedItem(g)}
                isSelected={selectedId === g.id}
                isLocked={false}
                isAdmin={false}
                onSelect={setSelectedId}
              />
            ))}
          </div>

          {/* Column 2: NFL Spread model prediction */}
          <div className="tool-card">
            <NflSpreadSection game={DEMO_SPREAD_GAME} completions={{}} />
          </div>

          {/* Column 3: MLB Moneyline by situation */}
          <div className="tool-card">
            <MlbSideAnglesSection game={DEMO_MLB_TRENDS_GAME} />
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
