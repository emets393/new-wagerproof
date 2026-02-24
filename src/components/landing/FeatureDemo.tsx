import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Target,
  Brain,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Zap,
  Eye,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// COMPACT WIDGET 1: EDGE FINDER
// ─────────────────────────────────────────────
const EdgeFinderCard = () => {
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"spread" | "total">("spread");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (shouldReduce) { setRevealed(true); return; }
    const t = setTimeout(() => setRevealed(true), 600);
    const cycle = setInterval(() => setActiveTab((p) => (p === "spread" ? "total" : "spread")), 4500);
    return () => { clearTimeout(t); clearInterval(cycle); };
  }, [shouldReduce]);

  const tabs = useMemo(() => ({
    spread: { market: "KC -3.5", model: "KC -2.0", edge: "+1.5", edgeColor: "#10b981", conf: 67, dir: "Lean BUF cover" },
    total:  { market: "O/U 51.5", model: "54.2",   edge: "+2.7", edgeColor: "#3b82f6", conf: 74, dir: "Lean Over 51.5" },
  }), []);

  const d = tabs[activeTab];

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/[0.04] backdrop-blur-sm border border-gray-200/60 dark:border-white/[0.06] shadow-lg overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.12em] uppercase">Edge Finder</span>
        </div>
        <span className="text-[8px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">LIVE</span>
      </div>

      {/* Matchup */}
      <div className="px-4 py-2 flex items-center justify-center gap-3 border-b border-gray-100/50 dark:border-white/[0.03]">
        <div className="w-6 h-6 rounded bg-red-500/15 border border-red-500/20 flex items-center justify-center">
          <span className="text-[8px] font-bold text-red-600 dark:text-red-400">KC</span>
        </div>
        <span className="text-[9px] font-mono text-gray-400">@</span>
        <div className="w-6 h-6 rounded bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
          <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400">BUF</span>
        </div>
      </div>

      <div className="p-4">
        {/* Tabs */}
        <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg mb-3">
          {(["spread", "total"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 text-[9px] font-mono tracking-wider rounded-md transition-all ${
                activeTab === tab ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm font-bold" : "text-gray-400"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 rounded-lg bg-gray-50/80 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04]">
                <span className="text-[7px] font-mono text-gray-400 block mb-0.5">MARKET</span>
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{d.market}</span>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50/80 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04]">
                <span className="text-[7px] font-mono text-emerald-600 dark:text-emerald-500 block mb-0.5">MODEL</span>
                <span className="text-[11px] font-bold text-gray-900 dark:text-white">{d.model}</span>
              </div>
              <div className="text-center p-2 rounded-lg border" style={{ backgroundColor: d.edgeColor + "0a", borderColor: d.edgeColor + "20" }}>
                <span className="text-[7px] font-mono block mb-0.5" style={{ color: d.edgeColor }}>EDGE</span>
                <span className="text-[11px] font-bold" style={{ color: d.edgeColor }}>{d.edge}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-500/8 dark:bg-emerald-500/8 border border-emerald-500/15">
              <Zap className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">{d.dir}</span>
              <span className="ml-auto text-[8px] font-mono text-emerald-500/60">{d.conf}%</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// COMPACT WIDGET 2: OUTLIER SCANNER
// ─────────────────────────────────────────────
const OutlierCard = () => {
  const shouldReduce = useReducedMotion();
  const [scannedIdx, setScannedIdx] = useState(-1);

  const outliers = useMemo(() => [
    { matchup: "CIN @ NE", type: "Spread", gap: 37, tag: "Value Play",  tagColor: "#10b981", team: "CIN +8.5" },
    { matchup: "CIN @ NE", type: "Total",  gap: 30, tag: "Fade Alert", tagColor: "#ef4444", team: "Under 44.5" },
    { matchup: "DAL @ PHI", type: "Spread", gap: 31, tag: "Contrarian", tagColor: "#f59e0b", team: "PHI -6" },
  ], []);

  useEffect(() => {
    if (shouldReduce) { setScannedIdx(outliers.length - 1); return; }
    let i = -1;
    const t = setInterval(() => {
      i++;
      setScannedIdx(i);
      if (i >= outliers.length - 1) {
        clearInterval(t);
        setTimeout(() => {
          setScannedIdx(-1);
          let j = -1;
          const t2 = setInterval(() => { j++; setScannedIdx(j); if (j >= outliers.length - 1) clearInterval(t2); }, 800);
        }, 3500);
      }
    }, 800);
    return () => clearInterval(t);
  }, [shouldReduce, outliers.length]);

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/[0.04] backdrop-blur-sm border border-gray-200/60 dark:border-white/[0.06] shadow-lg overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-orange-500" />
          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.12em] uppercase">Outlier Scanner</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-2.5 h-2.5 text-orange-500" />
          <span className="text-[8px] font-mono text-orange-600 dark:text-orange-400">{outliers.length} FOUND</span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {outliers.map((o, i) => {
          const active = i <= scannedIdx;
          return (
            <motion.div
              key={i}
              animate={{ opacity: active ? 1 : 0.25, x: active ? 0 : -8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors"
              style={{ backgroundColor: active ? o.tagColor + "08" : "transparent", borderColor: active ? o.tagColor + "18" : "rgba(128,128,128,0.08)" }}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: active ? o.tagColor : "#9ca3af" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200">{o.matchup}</span>
                  <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-400">{o.type}</span>
                </div>
                <span className="text-[9px] text-gray-500 dark:text-gray-400">{o.team}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[8px] font-mono text-gray-400 block">GAP</span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: active ? o.tagColor : "#9ca3af" }}>{o.gap}%</span>
              </div>
              {active && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded text-white shrink-0" style={{ backgroundColor: o.tagColor }}>
                  {o.tag}
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// COMPACT WIDGET 3: AI SIMULATOR
// ─────────────────────────────────────────────
const SimulatorCard = () => {
  const shouldReduce = useReducedMotion();
  const [loaded, setLoaded] = useState(0);

  const models = useMemo(() => [
    { name: "EPA Composite", pct: 65, conf: 72, color: "#10b981" },
    { name: "Advanced Metrics", pct: 71, conf: 78, color: "#3b82f6" },
    { name: "Situational", pct: 64, conf: 71, color: "#8b5cf6" },
  ], []);

  useEffect(() => {
    if (shouldReduce) { setLoaded(models.length); return; }
    let i = 0;
    const t = setInterval(() => { i++; setLoaded(i); if (i >= models.length) clearInterval(t); }, 600);
    return () => clearInterval(t);
  }, [shouldReduce, models.length]);

  const consensus = loaded > 0 ? Math.round(models.slice(0, loaded).reduce((s, m) => s + m.pct, 0) / loaded) : 0;

  const circumference = 2 * Math.PI * 22;
  const offset = circumference - (consensus / 100) * circumference;

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/[0.04] backdrop-blur-sm border border-gray-200/60 dark:border-white/[0.06] shadow-lg overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3 h-3 text-violet-500" />
          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.12em] uppercase">AI Simulator</span>
        </div>
        <span className="text-[8px] font-mono text-violet-600 dark:text-violet-400 tabular-nums">{loaded}/{models.length}</span>
      </div>

      <div className="p-4">
        {/* Consensus + matchup */}
        <div className="flex items-center gap-3 mb-3">
          <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
            <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" className="text-gray-100 dark:text-white/5" strokeWidth="3" />
            <motion.circle
              cx="26" cy="26" r="22" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: shouldReduce ? 0 : 0.6, ease: "easeOut" }}
              transform="rotate(-90 26 26)"
            />
            <text x="26" y="28" textAnchor="middle" className="fill-gray-900 dark:fill-white text-xs font-bold" fontFamily="system-ui">{consensus}%</text>
          </svg>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-5 h-5 rounded bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <span className="text-[7px] font-bold text-red-600 dark:text-red-400">KC</span>
              </div>
              <span className="text-[9px] text-gray-400">vs</span>
              <div className="w-5 h-5 rounded bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <span className="text-[7px] font-bold text-blue-600 dark:text-blue-400">BUF</span>
              </div>
            </div>
            <p className="text-[11px] font-bold text-gray-900 dark:text-white">{consensus > 50 ? "KC Wins" : "..."}</p>
          </div>
        </div>

        {/* Models */}
        <div className="space-y-1.5">
          {models.map((m, i) => (
            <motion.div
              key={m.name}
              animate={{ opacity: i < loaded ? 1 : 0.2, x: i < loaded ? 0 : -8 }}
              transition={{ duration: 0.3, delay: shouldReduce ? 0 : i * 0.1 }}
              className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100/60 dark:border-white/[0.03]"
            >
              <div className="w-0.5 h-5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 flex-1 truncate">{m.name}</span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{m.pct}%</span>
              {i < loaded && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Check className="w-3 h-3 text-emerald-500" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN EXPORT — Compact bento grid layout
// ─────────────────────────────────────────────
export function FeatureDemo() {
  const sectionRef = useRef<HTMLElement>(null);

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

  const tools = [
    { label: "Edge Finder", desc: "Real-time model vs. market edge detection", icon: Target },
    { label: "Outlier Scanner", desc: "Contrarian and value play alerts", icon: TrendingUp },
    { label: "AI Simulator", desc: "Multi-model consensus predictions", icon: Brain },
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
            Edge detection, outlier alerts, and multi-model AI — all working together to surface value.
          </p>
        </motion.div>

        {/* Compact descriptor chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-8 md:mb-12">
          {tools.map((t) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm border border-gray-200/60 dark:border-white/[0.06]"
            >
              <t.icon className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{t.label}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:inline">— {t.desc}</span>
            </motion.div>
          ))}
        </div>

        {/* Bento grid: 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-10">
          <div className="tool-card">
            <EdgeFinderCard />
          </div>
          <div className="tool-card">
            <OutlierCard />
          </div>
          <div className="tool-card">
            <SimulatorCard />
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
