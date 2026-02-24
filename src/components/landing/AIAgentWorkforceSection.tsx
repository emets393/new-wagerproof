import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Bot,
  Brain,
  Zap,
  TrendingUp,
  Shield,
  Users,
  Crosshair,
  ArrowRight,
  Sparkles,
  Gauge,
  Trophy,
  Clock,
  Target,
  ChevronRight,
} from "lucide-react";

// ─────────────────────────────────────────────
// SUB-WIDGET: AGENT ROSTER
// Shows 5 agent slots — 3 populated with animated
// avatars, 2 empty "deploy" slots.
// ─────────────────────────────────────────────
const AgentRoster = () => {
  const shouldReduce = useReducedMotion();
  const [spawned, setSpawned] = useState(0);

  const agents = useMemo(
    () => [
      { emoji: "🐻", name: "The Contrarian", sport: "NFL", color: "#ef4444", record: "47-31", units: "+18.4" },
      { emoji: "📊", name: "Model Truther", sport: "NBA", color: "#3b82f6", record: "62-44", units: "+24.1" },
      { emoji: "🌧️", name: "Weather Watcher", sport: "CFB", color: "#10b981", record: "38-28", units: "+12.7" },
    ],
    []
  );

  useEffect(() => {
    if (shouldReduce) {
      setSpawned(agents.length);
      return;
    }
    let i = 0;
    const t = setInterval(() => {
      i++;
      setSpawned(i);
      if (i >= agents.length) clearInterval(t);
    }, 600);
    return () => clearInterval(t);
  }, [shouldReduce, agents.length]);

  return (
    <div className="space-y-3">
      {agents.map((agent, i) => (
        <motion.div
          key={agent.name}
          initial={{ opacity: 0, x: -20 }}
          animate={i < spawned ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 22, delay: shouldReduce ? 0 : i * 0.15 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/[0.06] group hover:border-gray-300 dark:hover:border-white/10 transition-colors"
        >
          <motion.div
            animate={shouldReduce ? {} : { scale: [1, 1.06, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.8 }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: agent.color + "18", border: `1px solid ${agent.color}30` }}
          >
            {agent.emoji}
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{agent.name}</span>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">{agent.sport}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{agent.record}</span>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{agent.units} units</span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-mono text-emerald-600 dark:text-emerald-400 tracking-wider hidden sm:block">ACTIVE</span>
          </div>
        </motion.div>
      ))}

      {/* Empty deploy slots */}
      {[0, 1].map((i) => (
        <motion.div
          key={`empty-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: shouldReduce ? 0 : 2 + i * 0.2 }}
          className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-600 hover:border-emerald-500/30 hover:text-emerald-500 transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
            <span className="text-lg leading-none">+</span>
          </div>
          <span className="text-xs font-medium">Deploy Agent {4 + i}</span>
        </motion.div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// SUB-WIDGET: ARCHETYPE CAROUSEL
// Cycles through preset agent archetypes with
// their philosophy and key personality traits.
// ─────────────────────────────────────────────
const ArchetypeCarousel = () => {
  const [active, setActive] = useState(0);
  const shouldReduce = useReducedMotion();

  const archetypes = useMemo(
    () => [
      {
        name: "The Contrarian",
        emoji: "🐻",
        color: "#ef4444",
        philosophy: "Fade the public. When 70%+ of bets are on one side, I look the other way.",
        traits: ["High Risk", "Underdog Lean", "Fade Public"],
      },
      {
        name: "Chalk Grinder",
        emoji: "🏦",
        color: "#3b82f6",
        philosophy: "Favorites win for a reason. I take the sure thing and grind out profits.",
        traits: ["Low Risk", "Favorites Only", "Selective"],
      },
      {
        name: "Plus Money Hunter",
        emoji: "🎯",
        color: "#f59e0b",
        philosophy: "Plus money or nothing. One big hit pays for the losses.",
        traits: ["Max Risk", "Dogs Only", "Chase Value"],
      },
      {
        name: "Model Truther",
        emoji: "📊",
        color: "#10b981",
        philosophy: "The model is smarter than my gut. When it shows value, I bet.",
        traits: ["Moderate", "Trust Math", "Skip Weak Slates"],
      },
      {
        name: "Momentum Rider",
        emoji: "🔥",
        color: "#8b5cf6",
        philosophy: "Hot teams stay hot. I ride winning streaks until they break.",
        traits: ["NBA Focus", "Hot Streaks", "Recent Form"],
      },
    ],
    []
  );

  useEffect(() => {
    if (shouldReduce) return;
    const t = setInterval(() => setActive((a) => (a + 1) % archetypes.length), 3500);
    return () => clearInterval(t);
  }, [shouldReduce, archetypes.length]);

  const current = archetypes[active];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.15em] uppercase">Presets</span>
        </div>
        <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500 tabular-nums">
          {active + 1}/{archetypes.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          className="flex-1 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: current.color + "18", border: `1px solid ${current.color}30` }}
            >
              {current.emoji}
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">{current.name}</h4>
              <div className="flex gap-1 mt-0.5">
                {current.traits.map((t) => (
                  <span key={t} className="text-[8px] font-mono px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic">
            "{current.philosophy}"
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-white/5">
        {archetypes.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === active
                ? "w-5 bg-emerald-500"
                : "w-1.5 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SUB-WIDGET: THINKING TRACE
// Terminal showing an agent analyzing a game
// with staged typewriter output.
// ─────────────────────────────────────────────
const ThinkingTrace = () => {
  const [lines, setLines] = useState<{ text: string; done: boolean }[]>([]);
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const shouldReduce = useReducedMotion();

  const script = useMemo(
    () => [
      { text: '🧠 Agent "The Contrarian" • NFL Week 4', pause: 500 },
      { text: "→ Loading KC @ BUF market data...", pause: 250 },
      { text: "→ Public money: 73% on KC -3", pause: 200 },
      { text: "→ Fade threshold met (>60%)", pause: 300 },
      { text: "→ Model edge: BUF +3 → +2.5 units", pause: 250 },
      { text: "→ Weather: 42°F, 12mph NW — Unders lean", pause: 300 },
      { text: "✓ PICK: BUF +3 (-110)", pause: 200 },
      { text: "✓ Confidence: 87.3% — 3.2 unit edge", pause: 2500 },
    ],
    []
  );

  useEffect(() => {
    if (shouldReduce) {
      setLines(script.map((s) => ({ text: s.text, done: true })));
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const currentLine = script[lineIdx];

    if (!currentLine) {
      timeout = setTimeout(() => {
        setLines([]);
        setLineIdx(0);
        setCharIdx(0);
      }, 3000);
      return () => clearTimeout(timeout);
    }

    if (charIdx < currentLine.text.length) {
      timeout = setTimeout(() => {
        setLines((prev) => {
          const updated = [...prev];
          if (updated.length <= lineIdx) updated.push({ text: "", done: false });
          updated[lineIdx] = { text: currentLine.text.slice(0, charIdx + 1), done: false };
          return updated;
        });
        setCharIdx((c) => c + 1);
      }, 15 + Math.random() * 20);
    } else {
      timeout = setTimeout(() => {
        setLines((prev) => {
          const updated = [...prev];
          if (updated[lineIdx]) updated[lineIdx].done = true;
          return updated;
        });
        setLineIdx((l) => l + 1);
        setCharIdx(0);
      }, currentLine.pause);
    }

    return () => clearTimeout(timeout);
  }, [lineIdx, charIdx, shouldReduce, script]);

  return (
    <div className="h-full flex flex-col">
      {/* Terminal chrome */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/70" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
          <div className="w-2 h-2 rounded-full bg-green-500/70" />
        </div>
        <div className="flex items-center gap-1.5">
          <Brain className="w-3 h-3 text-emerald-500" />
          <span className="text-[9px] font-mono text-gray-500 tracking-wider">AGENT TRACE</span>
        </div>
      </div>

      {/* Lines */}
      <div className="flex-1 space-y-1 overflow-hidden">
        {lines.map((line, i) => (
          <pre
            key={i}
            className={`text-[10px] sm:text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${
              line.text.includes("✓")
                ? "text-emerald-400"
                : line.text.startsWith("🧠")
                ? "text-white font-bold"
                : "text-gray-400"
            }`}
          >
            {line.text}
          </pre>
        ))}
        {lineIdx < script.length && (
          <span className="inline-block w-[6px] h-[12px] bg-emerald-500/80 animate-pulse" />
        )}
      </div>

      {/* Progress indicator */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="h-[2px] bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500"
            animate={{ width: `${(lineIdx / script.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SUB-WIDGET: PERSONALITY SLIDERS
// Animated parameter sliders showing the
// depth of customization available.
// ─────────────────────────────────────────────
const PersonalitySliders = () => {
  const shouldReduce = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  const configs = useMemo(
    () => [
      [
        { label: "Risk Tolerance", value: 80, color: "#ef4444" },
        { label: "Underdog Lean", value: 90, color: "#f59e0b" },
        { label: "Confidence", value: 40, color: "#3b82f6" },
        { label: "Trust Model", value: 60, color: "#10b981" },
      ],
      [
        { label: "Risk Tolerance", value: 20, color: "#ef4444" },
        { label: "Underdog Lean", value: 10, color: "#f59e0b" },
        { label: "Confidence", value: 95, color: "#3b82f6" },
        { label: "Trust Model", value: 85, color: "#10b981" },
      ],
      [
        { label: "Risk Tolerance", value: 50, color: "#ef4444" },
        { label: "Underdog Lean", value: 50, color: "#f59e0b" },
        { label: "Confidence", value: 70, color: "#3b82f6" },
        { label: "Trust Model", value: 100, color: "#10b981" },
      ],
    ],
    []
  );

  useEffect(() => {
    if (shouldReduce) return;
    const t = setInterval(() => setCycle((c) => (c + 1) % configs.length), 3000);
    return () => clearInterval(t);
  }, [shouldReduce, configs.length]);

  const current = configs[cycle];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.15em] uppercase">Parameters</span>
        </div>
        <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500">50+ TUNABLE</span>
      </div>

      <div className="flex-1 space-y-5">
        {current.map((param) => (
          <div key={param.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">{param.label}</span>
              <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: param.color }}>
                {param.value}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: param.color }}
                animate={{ width: `${param.value}%` }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SUB-WIDGET: PERFORMANCE DASHBOARD
// Animated W-L-P counters, units, and a mini
// leaderboard preview.
// ─────────────────────────────────────────────
const PerformanceDashboard = () => {
  const shouldReduce = useReducedMotion();
  const [counts, setCounts] = useState({ w: 0, l: 0, units: 0 });

  useEffect(() => {
    if (shouldReduce) {
      setCounts({ w: 127, l: 98, units: 42.3 });
      return;
    }
    const target = { w: 127, l: 98, units: 42.3 };
    let frame = 0;
    const totalFrames = 60;
    const t = setInterval(() => {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounts({
        w: Math.round(target.w * eased),
        l: Math.round(target.l * eased),
        units: Math.round(target.units * eased * 10) / 10,
      });
      if (frame >= totalFrames) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [shouldReduce]);

  const leaderboard = useMemo(
    () => [
      { rank: 1, name: "The Contrarian", units: "+42.3", trend: "up" },
      { rank: 2, name: "Model Truther", units: "+38.7", trend: "up" },
      { rank: 3, name: "Weather Watcher", units: "+24.1", trend: "down" },
    ],
    []
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.15em] uppercase">Leaderboard</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/5">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{counts.w}</div>
          <div className="text-[8px] font-mono text-emerald-600/70 dark:text-emerald-400/70">WINS</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-red-500/10 dark:bg-red-500/5">
          <div className="text-lg font-bold text-red-500 dark:text-red-400 tabular-nums">{counts.l}</div>
          <div className="text-[8px] font-mono text-red-500/70 dark:text-red-400/70">LOSSES</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-gray-100 dark:bg-white/5">
          <div className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">+{counts.units}</div>
          <div className="text-[8px] font-mono text-gray-500 dark:text-gray-400">UNITS</div>
        </div>
      </div>

      {/* Mini leaderboard */}
      <div className="flex-1 space-y-2">
        {leaderboard.map((row, i) => (
          <motion.div
            key={row.rank}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 py-1.5"
          >
            <span className={`text-[10px] font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : "text-gray-400"}`}>
              #{row.rank}
            </span>
            <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{row.name}</span>
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{row.units}</span>
            <TrendingUp className={`w-3 h-3 ${row.trend === "up" ? "text-emerald-500" : "text-red-400 rotate-180"}`} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN SECTION COMPONENT
// Full cinematic layout with header, bento grid,
// how-it-works flow, and CTA.
// ─────────────────────────────────────────────
const AIAgentWorkforceSection = () => {
  const { theme } = useTheme();

  const bentoCardBase =
    "relative p-5 sm:p-6 rounded-2xl backdrop-blur-xl border shadow-xl overflow-hidden transition-all duration-300 group";
  const bentoLight = "bg-white/60 border-gray-200/80 hover:shadow-2xl";
  const bentoDark = "dark:bg-[#0A0D14]/70 dark:border-gray-800/80 dark:hover:border-gray-700/80";
  const bentoCard = `${bentoCardBase} ${bentoLight} ${bentoDark}`;

  const steps = useMemo(
    () => [
      { icon: Bot, label: "Create", desc: "Name your agent and pick a sport" },
      { icon: Gauge, label: "Configure", desc: "50+ personality parameters" },
      { icon: Zap, label: "Deploy", desc: "Agent begins 24/7 analysis" },
      { icon: Trophy, label: "Track", desc: "W-L record and unit tracking" },
    ],
    []
  );

  return (
    <section className="relative w-full py-20 md:py-32 px-4 md:px-6 overflow-hidden">
      {/* Background ambient */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/5 w-[500px] h-[500px] bg-violet-500/[0.06] dark:bg-violet-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-emerald-500/[0.05] dark:bg-emerald-500/[0.03] rounded-full blur-[140px]" />
        <div className="absolute top-2/3 left-1/2 w-[400px] h-[400px] bg-blue-500/[0.04] dark:bg-blue-500/[0.03] rounded-full blur-[100px]" />
      </div>

      {/* Noise */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* ───── HEADER ───── */}
        <div className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 text-xs font-semibold mb-6 border border-violet-200 dark:border-violet-800/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
              AI Agents — Now Live
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight leading-[1.1]">
              Your Personal Workforce of{" "}
              <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-emerald-400 to-blue-500">
                Sports Data Scientists
              </span>
            </h2>

            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-8 max-w-2xl mx-auto">
              Create an army of autonomous AI research agents that study sports 24/7 and report back to you.
              Instead of spending $500k a year on a team of analysts, they work for you — inside WagerProof.
            </p>

            {/* Bullet highlights */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-10 text-sm text-gray-600 dark:text-gray-400">
              {[
                { icon: Bot, text: "Up to 5 custom agents" },
                { icon: Gauge, text: "50+ personality parameters" },
                { icon: Clock, text: "24/7 autonomous analysis" },
                { icon: Trophy, text: "Transparent W-L tracking" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-1.5">
                  <item.icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <Link to="/account">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="group/btn px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold text-sm shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <span>Create Your First Agent</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ───── BENTO GRID ───── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 max-w-6xl mx-auto mb-16 md:mb-20">
          {/* Card 1: Agent Roster (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className={`${bentoCard} md:col-span-2`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-gray-500 dark:text-gray-400 text-[10px] font-mono tracking-[0.15em] uppercase mb-1">Your Squad</h3>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Agent Roster</div>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 tracking-wider">3/5 ACTIVE</span>
              </div>
            </div>
            <AgentRoster />
          </motion.div>

          {/* Card 2: Archetype Carousel (1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className={bentoCard}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <ArchetypeCarousel />
          </motion.div>

          {/* Card 3: Thinking Trace (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`${bentoCardBase} md:col-span-2 bg-[#08080f] dark:bg-[#08080f] border-gray-800/60 dark:border-gray-800/60 shadow-xl overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] to-transparent pointer-events-none" />
            <ThinkingTrace />
          </motion.div>

          {/* Card 4: Personality Sliders (1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className={bentoCard}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <PersonalitySliders />
          </motion.div>

          {/* Card 5: Performance Dashboard (1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className={bentoCard}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <PerformanceDashboard />
          </motion.div>

          {/* Card 6: Cost Comparison (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className={`${bentoCard} md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-5`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="flex-1">
              <div className="inline-flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg mb-3">
                <Shield className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Replace a $500k Analyst Team</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                Your agents run the same analysis a professional sports data team would — continuously, autonomously, for a fraction of the cost.
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto shrink-0">
              <div className="flex-1 sm:flex-none bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-[10px] text-gray-500 uppercase font-mono mb-1 tracking-wider">Human Team</div>
                <div className="text-xl font-bold text-gray-400 line-through decoration-red-500/50 decoration-2">$500k/yr</div>
              </div>
              <div className="flex-1 sm:flex-none bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40 relative overflow-hidden text-center">
                <motion.div
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent pointer-events-none"
                />
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-mono mb-1 tracking-wider flex items-center justify-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  AI Agents
                </div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Included</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ───── HOW IT WORKS FLOW ───── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <h3 className="text-center text-sm font-mono text-gray-400 dark:text-gray-500 tracking-[0.2em] uppercase mb-8">
            How It Works
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative text-center p-4 sm:p-5 rounded-2xl bg-white/50 dark:bg-[#0A0D14]/60 border border-gray-200/60 dark:border-gray-800/60 group hover:border-emerald-500/20 transition-colors"
              >
                {/* Step number */}
                <div className="text-[80px] font-black text-gray-100 dark:text-white/[0.03] absolute top-1 right-3 leading-none select-none pointer-events-none">
                  {i + 1}
                </div>

                <div className="relative z-10">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <step.icon className="w-4.5 h-4.5 text-emerald-500" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{step.label}</h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </div>

                {/* Connector arrow (not on last) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AIAgentWorkforceSection;
