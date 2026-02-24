import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Check,
  X,
  Minus,
  ArrowRight,
  Shield,
  Brain,
  Zap,
  Bot,
  Activity,
  Users,
  Target,
  BarChart3,
  Globe,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Dice5,
  Quote,
} from "lucide-react";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type CellStatus = "yes" | "no" | "partial";

interface ComparisonRow {
  feature: string;
  icon: React.ElementType;
  wagerproof: CellStatus;
  genericAI: CellStatus;
  sportsbooks: CellStatus;
  wpDetail?: string;
  aiDetail?: string;
  sbDetail?: string;
}

// ─────────────────────────────────────────────
// COMPARISON DATA
// ─────────────────────────────────────────────
const comparisonData: ComparisonRow[] = [
  {
    feature: "Live Sports Data Integration",
    icon: Activity,
    wagerproof: "yes",
    genericAI: "no",
    sportsbooks: "partial",
    wpDetail: "Real-time ESPN, odds, weather",
    aiDetail: "Training data months old",
    sbDetail: "Odds only, no analysis",
  },
  {
    feature: "ML-Powered Edge Analysis",
    icon: Brain,
    wagerproof: "yes",
    genericAI: "no",
    sportsbooks: "no",
    wpDetail: "Proprietary spread/total/ML models",
    aiDetail: "No sports-specific models",
    sbDetail: "No predictive modeling",
  },
  {
    feature: "Autonomous AI Agents",
    icon: Bot,
    wagerproof: "yes",
    genericAI: "no",
    sportsbooks: "no",
    wpDetail: "5 custom agents, 50+ params",
    aiDetail: "Generic chat, no autonomy",
    sbDetail: "Not available",
  },
  {
    feature: "Value Alert System",
    icon: Zap,
    wagerproof: "yes",
    genericAI: "no",
    sportsbooks: "no",
    wpDetail: "Model vs market divergence alerts",
    aiDetail: "No market awareness",
    sbDetail: "Promotes high-margin bets",
  },
  {
    feature: "Private Expert Community",
    icon: Users,
    wagerproof: "yes",
    genericAI: "no",
    sportsbooks: "partial",
    wpDetail: "Curated Discord, verified members",
    aiDetail: "No community features",
    sbDetail: "Social features, not analytical",
  },
  {
    feature: "Transparent Methodology",
    icon: Shield,
    wagerproof: "yes",
    genericAI: "partial",
    sportsbooks: "no",
    wpDetail: "Every prediction is auditable",
    aiDetail: "Black box reasoning",
    sbDetail: "Designed to favor the house",
  },
  {
    feature: "Natural Language Assistant",
    icon: MessageSquare,
    wagerproof: "yes",
    genericAI: "yes",
    sportsbooks: "no",
    wpDetail: "WagerBot with live data context",
    aiDetail: "Good chat, no live data",
    sbDetail: "Basic FAQs at best",
  },
  {
    feature: "Performance Tracking",
    icon: BarChart3,
    wagerproof: "yes",
    genericAI: "no",
    sportsbooks: "partial",
    wpDetail: "W-L-P records, unit tracking",
    aiDetail: "No tracking system",
    sbDetail: "Bet history only",
  },
  {
    feature: "Multi-Sport Coverage",
    icon: Globe,
    wagerproof: "yes",
    genericAI: "partial",
    sportsbooks: "yes",
    wpDetail: "NFL, CFB, NBA, NCAAB + more",
    aiDetail: "Generic knowledge, not deep",
    sbDetail: "Wide coverage, no analysis",
  },
  {
    feature: "Built for Your Profit",
    icon: Target,
    wagerproof: "yes",
    genericAI: "no",
    sportsbooks: "no",
    wpDetail: "Value-focused, not entertainment",
    aiDetail: "No betting focus",
    sbDetail: "Max engagement, not user profit",
  },
];

// ─────────────────────────────────────────────
// STATUS CELL COMPONENT
// ─────────────────────────────────────────────
const StatusCell = ({
  status,
  detail,
  accent,
}: {
  status: CellStatus;
  detail?: string;
  accent: "emerald" | "red" | "yellow";
}) => {
  const iconMap = {
    yes: Check,
    no: X,
    partial: Minus,
  };
  const Icon = iconMap[status];

  const colorMap = {
    emerald: {
      yes: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      no: "text-gray-300 dark:text-gray-600 bg-gray-100 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.06]",
      partial: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    },
    red: {
      yes: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      no: "text-red-400 bg-red-500/10 border-red-500/20",
      partial: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    },
    yellow: {
      yes: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      no: "text-red-400 bg-red-500/10 border-red-500/20",
      partial: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    },
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${colorMap[accent][status]}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      {detail && (
        <span className="text-[9px] text-gray-400 dark:text-gray-500 text-center leading-tight max-w-[120px] hidden lg:block">
          {detail}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// APPROACH CARD COMPONENT
// Visual card for each competitor approach.
// ─────────────────────────────────────────────
const ApproachCard = ({
  title,
  subtitle,
  icon: Icon,
  points,
  accent,
  isHighlighted,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  points: string[];
  accent: string;
  isHighlighted?: boolean;
}) => {
  const accentColors: Record<string, { bg: string; border: string; text: string; iconBg: string; dot: string }> = {
    emerald: {
      bg: "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06]",
      border: "border-emerald-500/20 dark:border-emerald-500/15",
      text: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      dot: "bg-emerald-500",
    },
    red: {
      bg: "bg-red-500/[0.03] dark:bg-red-500/[0.04]",
      border: "border-red-500/15 dark:border-red-500/10",
      text: "text-red-500 dark:text-red-400",
      iconBg: "bg-red-500/10 border-red-500/20",
      dot: "bg-red-400",
    },
    yellow: {
      bg: "bg-yellow-500/[0.03] dark:bg-yellow-500/[0.04]",
      border: "border-yellow-500/15 dark:border-yellow-500/10",
      text: "text-yellow-600 dark:text-yellow-400",
      iconBg: "bg-yellow-500/10 border-yellow-500/20",
      dot: "bg-yellow-400",
    },
  };

  const c = accentColors[accent] || accentColors.emerald;

  return (
    <div
      className={`relative rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${c.bg} ${c.border} ${
        isHighlighted ? "ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/[0.05]" : ""
      }`}
    >
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-mono tracking-wider font-bold shadow-lg">
          RECOMMENDED
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${c.iconBg}`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <div>
          <h4 className={`text-base font-bold ${isHighlighted ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>
            {title}
          </h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {points.map((point, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${c.dot}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// ANIMATED SCORE BAR
// Shows WagerProof's advantage as a visual bar.
// ─────────────────────────────────────────────
const ScoreBar = () => {
  const shouldReduce = useReducedMotion();

  const scores = useMemo(
    () => [
      { label: "WagerProof", score: 10, max: 10, color: "#10b981" },
      { label: "Generic AI", score: 2, max: 10, color: "#ef4444" },
      { label: "Sportsbooks", score: 3, max: 10, color: "#eab308" },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {scores.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-24 text-right shrink-0">{s.label}</span>
          <div className="flex-1 h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: s.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(s.score / s.max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduce ? 0 : 1.2, ease: "easeOut", delay: 0.2 }}
            />
          </div>
          <span className="text-xs font-mono font-bold tabular-nums w-8" style={{ color: s.color }}>
            {s.score}/{s.max}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────
export function CompetitorComparison() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".comp-row").forEach((row, i) => {
        gsap.from(row, {
          opacity: 0,
          x: -20,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: row,
            start: "top 90%",
          },
        });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-20 md:py-32 overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/[0.04] dark:bg-emerald-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/3 w-[400px] h-[400px] bg-blue-500/[0.03] dark:bg-blue-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ───── HEADER ───── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 md:mb-20"
        >
          <span className="inline-block text-[11px] font-mono tracking-[0.25em] uppercase text-emerald-600 dark:text-emerald-400 mb-4 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            The Comparison
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-4 leading-tight">
            Why Choose{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-emerald-400">
              WagerProof?
            </span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            See how professional-grade analytics stack up against generic AI chatbots and sportsbook apps.
            We built the tool we wish existed.
          </p>
        </motion.div>

        {/* ───── COMPARISON TABLE ───── */}
        <div className="max-w-5xl mx-auto mb-16 md:mb-24">
          <div className="rounded-2xl bg-white/60 dark:bg-[#0A0D14]/60 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80 shadow-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px] lg:grid-cols-[1fr_140px_140px_140px] items-center px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.02]">
              <span className="text-[10px] font-mono text-gray-400 tracking-[0.15em] uppercase">Feature</span>
              <div className="text-center">
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 tracking-wider font-bold">WagerProof</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-mono text-gray-400 tracking-wider">AI Chatbots</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-mono text-gray-400 tracking-wider">Sportsbooks</span>
              </div>
            </div>

            {/* Table rows */}
            {comparisonData.map((row, i) => (
              <div
                key={row.feature}
                className={`comp-row grid grid-cols-[1fr_80px_80px_80px] lg:grid-cols-[1fr_140px_140px_140px] items-center px-4 sm:px-6 py-3.5 ${
                  i < comparisonData.length - 1 ? "border-b border-gray-100/80 dark:border-white/[0.03]" : ""
                } hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-500/[0.02] transition-colors`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <row.icon className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{row.feature}</span>
                </div>
                <StatusCell status={row.wagerproof} detail={row.wpDetail} accent="emerald" />
                <StatusCell status={row.genericAI} detail={row.aiDetail} accent="red" />
                <StatusCell status={row.sportsbooks} detail={row.sbDetail} accent="yellow" />
              </div>
            ))}

            {/* Score summary */}
            <div className="px-4 sm:px-6 py-5 bg-gray-50/80 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
              <ScoreBar />
            </div>
          </div>
        </div>

        {/* ───── THREE APPROACH CARDS ───── */}
        <div className="max-w-5xl mx-auto mb-16 md:mb-24">
          <motion.h3
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm font-mono text-gray-400 dark:text-gray-500 tracking-[0.2em] uppercase mb-8"
          >
            Three Approaches, One Clear Winner
          </motion.h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <ApproachCard
                title="WagerProof"
                subtitle="Professional analytics platform"
                icon={Sparkles}
                accent="emerald"
                isHighlighted
                points={[
                  "Data made transparent and simple — only highest-value insights surface",
                  "Real-time model calculations with quantified betting edges",
                  "Curated picks from experts with transparent track records",
                  "Private Discord with committed, data-driven bettors",
                  "WagerBot AI assistant with live data context",
                  "Teaches you to make smarter decisions over time",
                ]}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <ApproachCard
                title="Generic AI Chatbots"
                subtitle="ChatGPT, Claude, Gemini"
                icon={AlertTriangle}
                accent="red"
                points={[
                  "Training data is months or years old — no live awareness",
                  "No sports-specific models, edge analysis, or confidence scoring",
                  "Can't access current odds, lines, or weather conditions",
                  "Generic, one-size-fits-all answers with no accountability",
                  "No community, no tracking, no performance history",
                  "Unreliable for any serious betting decisions",
                ]}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <ApproachCard
                title="Sportsbooks & Apps"
                subtitle="DraftKings, FanDuel, PrizePicks"
                icon={Dice5}
                accent="yellow"
                points={[
                  "Basic odds and lines with zero edge analysis or value identification",
                  "Designed to maximize house profit, not yours",
                  "Promotes low-probability parlays and high-margin props",
                  "Overwhelming firehose of data without clear direction",
                  "Focused on entertainment and engagement, not informed decisions",
                  "No predictive modeling or transparent methodology",
                ]}
              />
            </motion.div>
          </div>
        </div>

        {/* ───── DEVELOPER MESSAGE ───── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto mb-14"
        >
          <div className="relative rounded-2xl bg-white/50 dark:bg-[#0A0D14]/50 backdrop-blur-xl border border-gray-200/60 dark:border-gray-800/60 p-6 sm:p-8 md:p-10">
            {/* Quote mark */}
            <Quote className="w-8 h-8 text-emerald-500/20 dark:text-emerald-500/15 mb-4" />

            <div className="space-y-4 text-gray-700 dark:text-gray-300 text-[15px] leading-relaxed">
              <p>
                <span className="font-semibold text-gray-900 dark:text-white">Let's be honest:</span> if anyone
                tries to sell you guarantees in sports betting, they're just trying to take your money. We're data
                analysts and developers, not fortune tellers.
              </p>
              <p>
                Sports betting is always uncertain — there's risk in every pick. But with smart decisions,
                transparent data, and disciplined value spotting, you can give yourself a{" "}
                <span className="font-semibold text-gray-900 dark:text-white">real advantage over time.</span>
              </p>
              <p>
                Sometimes{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  avoiding a bad pick is more valuable
                </span>{" "}
                than chasing an influencer's "Lock of the Week." We'll be the first to tell you that. Our goal
                isn't to hype you up — it's to give you the tools to make smarter decisions on your own terms.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-200/60 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">The WagerProof Team</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Data analysts & developers who love sports</p>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 italic text-right max-w-[200px]">
                "Build your edge with data, not empty promises."
              </p>
            </div>
          </div>
        </motion.div>

        {/* ───── CTA ───── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <Link to="/account">
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group/btn px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold text-sm shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
            >
              <span>Start Winning Today</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
