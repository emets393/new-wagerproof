import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Brain,
  TrendingUp,
  ShieldCheck,
  Zap,
  Terminal,
  Activity,
  Wifi,
  Users,
  Check,
  BarChart3,
  Cpu,
  Bot,
  Radar,
  MessageSquare,
  Sparkles,
  Lock,
  Globe,
  Radio,
  CircleDot,
  Network,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// WIDGET 1 — THE ANALYTICS DASHBOARD
// A rich, multi-layered diagnostic shuffler
// with sparklines and a confidence gauge.
// ─────────────────────────────────────────────
const AnalyticsDashboard = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const shouldReduce = useReducedMotion();

  const cards = useMemo(
    () => [
      {
        id: 1,
        label: "SPREAD",
        matchup: "KC vs BUF",
        vegas: "KC -3.0",
        model: "KC -5.5",
        edge: "+2.5",
        confidence: 87,
        sparkline: [30, 35, 28, 42, 50, 46, 55, 62, 58, 70],
        color: "#10b981",
      },
      {
        id: 2,
        label: "TOTAL",
        matchup: "DAL vs PHI",
        vegas: "O 45.0",
        model: "O 49.5",
        edge: "+4.5",
        confidence: 92,
        sparkline: [40, 38, 45, 42, 55, 60, 58, 68, 72, 78],
        color: "#3b82f6",
      },
      {
        id: 3,
        label: "MONEYLINE",
        matchup: "SF vs SEA",
        vegas: "+110",
        model: "-115",
        edge: "ELITE",
        confidence: 95,
        sparkline: [20, 25, 30, 28, 35, 50, 65, 70, 80, 88],
        color: "#f59e0b",
      },
    ],
    []
  );

  useEffect(() => {
    if (shouldReduce) return;
    const t = setInterval(() => setActiveIdx((p) => (p + 1) % cards.length), 3500);
    return () => clearInterval(t);
  }, [shouldReduce, cards.length]);

  const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const h = 32;
    const w = 100;
    const pts = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sp-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
        <polygon fill={`url(#sp-${color.replace("#", "")})`} points={`0,${h} ${pts} ${w},${h}`} />
      </svg>
    );
  };

  const ConfidenceRing = ({ value, color }: { value: number; color: string }) => {
    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (value / 100) * circumference;
    return (
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" className="text-gray-200 dark:text-white/5" strokeWidth="3" />
        <motion.circle
          cx="24"
          cy="24"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="26" textAnchor="middle" className="fill-gray-800 dark:fill-white text-[10px] font-bold" fontFamily="monospace">
          {value}
        </text>
      </svg>
    );
  };

  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      {/* Ambient glow */}
      <div className="absolute -inset-8 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] rounded-[4rem] blur-2xl pointer-events-none" />

      <div className="relative rounded-[2rem] bg-white dark:bg-[#080810] border border-gray-200/80 dark:border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.15em] uppercase">WagerProof Analytics</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 tracking-wide">LIVE</span>
          </div>
        </div>

        {/* Cards area */}
        <div className="relative h-[320px] p-5">
          <AnimatePresence mode="popLayout">
            {cards.map((card, i) => {
              const pos = (i - activeIdx + cards.length) % cards.length;
              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: -50, scale: 0.85 }}
                  animate={{
                    opacity: pos === 0 ? 1 : pos === 1 ? 0.5 : 0.2,
                    y: pos * 28,
                    scale: 1 - pos * 0.06,
                    zIndex: 10 - pos,
                  }}
                  exit={{ opacity: 0, y: 50, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className="absolute left-5 right-5 rounded-2xl bg-white dark:bg-[#0c0c18] border border-gray-200/80 dark:border-white/[0.08] shadow-xl overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: card.color }} />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[9px] font-mono text-gray-400 tracking-[0.2em] block">{card.label}</span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{card.matchup}</span>
                      </div>
                      <ConfidenceRing value={card.confidence} color={card.color} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase block mb-0.5">Vegas</span>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{card.vegas}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-500 uppercase block mb-0.5 flex items-center gap-0.5">
                          <Brain className="w-2.5 h-2.5" /> Model
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{card.model}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase block mb-0.5">Edge</span>
                        <span
                          className="text-sm font-bold px-2 py-0.5 rounded-md inline-block"
                          style={{ color: card.color, backgroundColor: card.color + "15" }}
                        >
                          {card.edge}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-white/5 pt-2">
                      <span className="text-[9px] text-gray-400 mb-1 block">MODEL TREND (7d)</span>
                      <Sparkline data={card.sparkline} color={card.color} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// WIDGET 2 — THE AI COMMAND CENTER
// A cinematic terminal with multi-stage analysis,
// status sidebar, and progressive reveal.
// ─────────────────────────────────────────────
const AICommandCenter = () => {
  const [lines, setLines] = useState<{ text: string; done: boolean }[]>([]);
  const [charIdx, setCharIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const shouldReduce = useReducedMotion();

  const script = useMemo(
    () => [
      { text: "$ wagerproof analyze --week 4 --sport NFL", pause: 600 },
      { text: "  → Connecting to live odds feeds...", pause: 300 },
      { text: "  → Ingesting weather data: 12mph NW, 42°F", pause: 200 },
      { text: "  → Running spread model (v3.8.1)...", pause: 400 },
      { text: "  ✓ High-value edge detected", pause: 300 },
      { text: "  ✓ DAL vs NYG Under 42.5 — Confidence: 91.4%", pause: 500 },
      { text: "  → Cross-referencing public money splits...", pause: 300 },
      { text: "  ✓ 73% public on Over — contrarian signal", pause: 200 },
      { text: "  RECOMMENDATION: UNDER 42.5 ★★★★★", pause: 2000 },
    ],
    []
  );

  useEffect(() => {
    if (shouldReduce) {
      setLines(script.map((s) => ({ text: s.text, done: true })));
      return;
    }

    let rafId: number;
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
          if (updated.length <= lineIdx) {
            updated.push({ text: "", done: false });
          }
          updated[lineIdx] = { text: currentLine.text.slice(0, charIdx + 1), done: false };
          return updated;
        });
        setCharIdx((c) => c + 1);
      }, 18 + Math.random() * 25);
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

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafId);
    };
  }, [lineIdx, charIdx, shouldReduce, script]);

  const stages = [
    { label: "ODDS FEED", active: lineIdx >= 1 },
    { label: "WEATHER", active: lineIdx >= 2 },
    { label: "MODEL", active: lineIdx >= 3 },
    { label: "VALIDATE", active: lineIdx >= 6 },
  ];

  return (
    <div className="relative w-full max-w-[480px] mx-auto">
      <div className="absolute -inset-8 bg-emerald-500/[0.03] rounded-[4rem] blur-2xl pointer-events-none" />

      <div className="relative rounded-[2rem] bg-[#08080f] border border-gray-800/80 shadow-2xl overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0a0a14]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-mono text-gray-500 tracking-[0.15em]">WAGERPROOF CLI</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-mono text-emerald-500 tracking-wider">LIVE</span>
          </div>
        </div>

        <div className="flex">
          {/* Status sidebar */}
          <div className="hidden sm:flex flex-col gap-2 p-3 border-r border-white/5 min-w-[90px]">
            {stages.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <motion.div
                  animate={{
                    backgroundColor: s.active ? "#10b981" : "#1f2937",
                    scale: s.active ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.4 }}
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                />
                <span className={`text-[8px] font-mono tracking-wider ${s.active ? "text-emerald-400" : "text-gray-600"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Terminal body */}
          <div className="flex-1 p-4 min-h-[280px] max-h-[320px] overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.04)_0%,transparent_60%)] pointer-events-none" />
            <div className="space-y-1 relative z-10">
              {lines.map((line, i) => (
                <div key={i} className="flex items-start gap-1">
                  <pre
                    className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${
                      line.text.includes("✓")
                        ? "text-emerald-400"
                        : line.text.includes("RECOMMENDATION")
                        ? "text-yellow-400 font-bold"
                        : line.text.startsWith("$")
                        ? "text-blue-400"
                        : "text-gray-400"
                    }`}
                  >
                    {line.text}
                  </pre>
                </div>
              ))}
              {lineIdx < script.length && (
                <span className="inline-block w-[7px] h-[14px] bg-emerald-500/80 animate-pulse ml-0.5" />
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            animate={{ width: `${(lineIdx / script.length) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// WIDGET 3 — THE AGENT SWARM
// Network visualization of autonomous AI agents
// orbiting a central intelligence hub.
// Replaces the old "Expert Picks" scheduler.
// ─────────────────────────────────────────────
const AgentSwarm = () => {
  const shouldReduce = useReducedMotion();
  const [spawned, setSpawned] = useState(0);

  const agents = useMemo(
    () => [
      { id: 1, label: "NFL", angle: -90, color: "#10b981", delay: 0 },
      { id: 2, label: "NBA", angle: -18, color: "#3b82f6", delay: 0.6 },
      { id: 3, label: "CFB", angle: 54, color: "#f59e0b", delay: 1.2 },
      { id: 4, label: "NCAAB", angle: 126, color: "#8b5cf6", delay: 1.8 },
      { id: 5, label: "LIVE", angle: 198, color: "#ef4444", delay: 2.4 },
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
    }, 700);
    return () => clearInterval(t);
  }, [shouldReduce, agents.length]);

  const cx = 200;
  const cy = 180;
  const radius = 110;

  const getPos = (angle: number) => ({
    x: cx + radius * Math.cos((angle * Math.PI) / 180),
    y: cy + radius * Math.sin((angle * Math.PI) / 180),
  });

  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <div className="absolute -inset-8 bg-violet-500/[0.04] dark:bg-violet-500/[0.06] rounded-[4rem] blur-2xl pointer-events-none" />

      <div className="relative rounded-[2rem] bg-[#060610] border border-gray-800/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Network className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[10px] font-mono text-gray-400 tracking-[0.15em] uppercase">Agent Network</span>
          </div>
          <div className="flex items-center gap-1.5 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-violet-500"
            />
            <span className="text-[8px] font-mono text-violet-400 tracking-wider">{spawned}/{agents.length} DEPLOYED</span>
          </div>
        </div>

        <div className="relative h-[340px]">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 360" fill="none">
            {/* Concentric orbit rings */}
            {[0.4, 0.7, 1].map((scale, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={radius * scale}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
                strokeDasharray="4 6"
                fill="none"
              />
            ))}

            {/* Connection lines to center */}
            {agents.slice(0, spawned).map((agent) => {
              const p = getPos(agent.angle);
              return (
                <motion.line
                  key={`line-${agent.id}`}
                  x1={cx}
                  y1={cy}
                  x2={p.x}
                  y2={p.y}
                  stroke={agent.color}
                  strokeWidth="1"
                  strokeDasharray="3 5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 0.8, delay: agent.delay }}
                />
              );
            })}

            {/* Cross-connections between adjacent agents */}
            {agents.slice(0, spawned).map((agent, i) => {
              if (i === 0) return null;
              const prev = agents[i - 1];
              const p1 = getPos(prev.angle);
              const p2 = getPos(agent.angle);
              return (
                <motion.line
                  key={`cross-${agent.id}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: agent.delay + 0.3 }}
                />
              );
            })}
          </svg>

          {/* Data particles flowing along connections */}
          {!shouldReduce &&
            agents.slice(0, spawned).map((agent) => {
              const p = getPos(agent.angle);
              return (
                <motion.div
                  key={`particle-${agent.id}`}
                  className="absolute w-1 h-1 rounded-full"
                  style={{ backgroundColor: agent.color, boxShadow: `0 0 6px ${agent.color}` }}
                  animate={{
                    left: [cx - 1, p.x - 1, cx - 1],
                    top: [cy - 1, p.y - 1, cy - 1],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    delay: agent.delay + 1,
                    ease: "easeInOut",
                  }}
                />
              );
            })}

          {/* Central intelligence hub */}
          <div className="absolute" style={{ left: cx - 24, top: cy - 24 }}>
            <motion.div
              animate={shouldReduce ? {} : { boxShadow: ["0 0 20px rgba(139,92,246,0.3)", "0 0 40px rgba(139,92,246,0.5)", "0 0 20px rgba(139,92,246,0.3)"] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-violet-500/20 border-2 border-violet-500 flex items-center justify-center backdrop-blur-sm"
            >
              <Brain className="w-5 h-5 text-violet-400" />
            </motion.div>
          </div>

          {/* Agent nodes */}
          {agents.map((agent, i) => {
            const p = getPos(agent.angle);
            if (i >= spawned) return null;
            return (
              <motion.div
                key={agent.id}
                className="absolute flex flex-col items-center gap-1"
                style={{ left: p.x - 20, top: p.y - 20 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 250, damping: 18, delay: agent.delay }}
              >
                <motion.div
                  animate={shouldReduce ? {} : { y: [0, -4, 0] }}
                  transition={{ duration: 2.5 + i * 0.3, repeat: Infinity }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[9px] font-bold text-white border backdrop-blur-sm"
                  style={{ backgroundColor: agent.color + "25", borderColor: agent.color + "60" }}
                >
                  <Bot className="w-4 h-4" style={{ color: agent.color }} />
                </motion.div>
                <span className="text-[8px] font-mono tracking-wider" style={{ color: agent.color }}>
                  {agent.label}
                </span>
              </motion.div>
            );
          })}

          {/* Bottom status */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: spawned >= agents.length ? 1 : 0.5, y: 0 }}
              transition={{ delay: 3.5 }}
              className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3"
            >
              <div className="flex -space-x-1.5">
                {agents.slice(0, spawned).map((a) => (
                  <div key={a.id} className="w-3 h-3 rounded-full border border-black" style={{ backgroundColor: a.color }} />
                ))}
              </div>
              <span className="text-[9px] font-mono text-white/70 tracking-widest">
                {spawned >= agents.length ? "ALL AGENTS ACTIVE — RESEARCHING" : "DEPLOYING..."}
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// WIDGET 4 — THE DATA VERIFIER
// Rows of incoming data that get scanned and
// verified with checkmarks in real time.
// ─────────────────────────────────────────────
const DataVerifier = () => {
  const shouldReduce = useReducedMotion();
  const [verifiedCount, setVerifiedCount] = useState(0);
  const totalRows = 6;

  const dataRows = useMemo(
    () => [
      { source: "ESPN", label: "KC @ BUF — Score Feed", delay: 0 },
      { source: "ODDS", label: "DraftKings Spread -3.0", delay: 0.8 },
      { source: "WEATHER", label: "Orchard Park — 42°F NW 12mph", delay: 1.6 },
      { source: "ESPN", label: "DAL @ PHI — Injury Report", delay: 2.4 },
      { source: "MODEL", label: "Spread Prediction v3.8.1", delay: 3.2 },
      { source: "PUBLIC", label: "Money Split: 73% Over", delay: 4.0 },
    ],
    []
  );

  useEffect(() => {
    if (shouldReduce) {
      setVerifiedCount(totalRows);
      return;
    }
    let count = 0;
    const t = setInterval(() => {
      count++;
      setVerifiedCount(count);
      if (count >= totalRows) {
        clearInterval(t);
        setTimeout(() => setVerifiedCount(0), 3000);
        setTimeout(() => {
          count = 0;
          const t2 = setInterval(() => {
            count++;
            setVerifiedCount(count);
            if (count >= totalRows) clearInterval(t2);
          }, 800);
        }, 3500);
      }
    }, 800);
    return () => clearInterval(t);
  }, [shouldReduce]);

  const sourceColor: Record<string, string> = {
    ESPN: "#ef4444",
    ODDS: "#f59e0b",
    WEATHER: "#3b82f6",
    MODEL: "#10b981",
    PUBLIC: "#8b5cf6",
  };

  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <div className="absolute -inset-8 bg-emerald-500/[0.03] rounded-[4rem] blur-2xl pointer-events-none" />

      <div className="relative rounded-[2rem] bg-[#060610] border border-gray-800/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-mono text-gray-400 tracking-[0.15em] uppercase">Data Integrity</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-500 tabular-nums">{verifiedCount}/{totalRows} VERIFIED</span>
        </div>

        {/* Background grid */}
        <div className="relative min-h-[320px] p-4">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_50%,transparent_100%)]" />

          {/* Scanning laser */}
          {!shouldReduce && (
            <motion.div
              className="absolute left-0 right-0 h-12 bg-gradient-to-b from-transparent via-emerald-500/15 to-transparent z-10 pointer-events-none"
              animate={{ top: ["-10%", "110%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Data rows */}
          <div className="relative z-20 space-y-2">
            {dataRows.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{
                  opacity: i < verifiedCount + 1 ? 1 : 0.2,
                  x: 0,
                }}
                transition={{ duration: 0.4, delay: shouldReduce ? 0 : row.delay * 0.2 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div
                  className="shrink-0 px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider"
                  style={{
                    color: sourceColor[row.source] || "#888",
                    backgroundColor: (sourceColor[row.source] || "#888") + "15",
                  }}
                >
                  {row.source}
                </div>
                <span className="text-[11px] font-mono text-gray-400 flex-1 truncate">{row.label}</span>
                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {i < verifiedCount ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    </motion.div>
                  ) : i === verifiedCount ? (
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-yellow-500"
                    />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-700" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Verified badge */}
          <AnimatePresence>
            {verifiedCount >= totalRows && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative z-20 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-[0.15em]">ALL DATA STREAMS VERIFIED</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// WIDGET 5 — THE VALUE DETECTOR
// Animated SVG line chart showing model vs market
// divergence with a pulse alert.
// ─────────────────────────────────────────────
const ValueDetector = () => {
  const shouldReduce = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (shouldReduce) {
      setProgress(1);
      return;
    }
    let raf: number;
    let start: number;
    const duration = 4000;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          start = 0 as any;
          setProgress(0);
          raf = requestAnimationFrame(animate);
        }, 3000);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [shouldReduce]);

  const w = 360;
  const h = 160;
  const vegasLine = [50, 52, 48, 55, 58, 60, 62, 64, 66, 68, 70, 72, 74, 75, 76];
  const modelLine = [50, 52, 50, 56, 62, 68, 76, 84, 92, 100, 106, 110, 112, 114, 115];
  const divergeStart = 5;

  const toPath = (data: number[], maxVisible: number) => {
    const visible = Math.min(Math.floor(maxVisible * data.length), data.length);
    const maxVal = 120;
    return data
      .slice(0, visible)
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (v / maxVal) * h;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  const showAlert = progress > 0.6;

  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <div className="absolute -inset-8 bg-yellow-500/[0.03] dark:bg-yellow-500/[0.04] rounded-[4rem] blur-2xl pointer-events-none" />

      <div className="relative rounded-[2rem] bg-white dark:bg-[#080810] border border-gray-200/80 dark:border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.15em] uppercase">Market Divergence</span>
          </div>
          <Wifi className="w-3.5 h-3.5 text-emerald-500" />
        </div>

        <div className="p-5">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] bg-gray-400 rounded" />
              <span className="text-[9px] font-mono text-gray-400">VEGAS LINE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] bg-emerald-500 rounded" />
              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">WAGERPROOF MODEL</span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="relative rounded-xl overflow-hidden bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[160px]" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((y) => (
                <line key={y} x1="0" y1={h * y} x2={w} y2={h * y} stroke="currentColor" className="text-gray-200 dark:text-white/5" strokeWidth="0.5" />
              ))}

              {/* Value zone fill between lines */}
              {progress > 0.4 && (
                <motion.path
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.15 }}
                  transition={{ duration: 1 }}
                  d={(() => {
                    const visible = Math.min(Math.floor(progress * vegasLine.length), vegasLine.length);
                    const startI = divergeStart;
                    if (visible <= startI) return "";
                    const maxVal = 120;
                    let path = "";
                    for (let i = startI; i < visible; i++) {
                      const x = (i / (vegasLine.length - 1)) * w;
                      const y = h - (modelLine[i] / maxVal) * h;
                      path += `${i === startI ? "M" : "L"}${x},${y} `;
                    }
                    for (let i = visible - 1; i >= startI; i--) {
                      const x = (i / (vegasLine.length - 1)) * w;
                      const y = h - (vegasLine[i] / maxVal) * h;
                      path += `L${x},${y} `;
                    }
                    path += "Z";
                    return path;
                  })()}
                  fill="#10b981"
                />
              )}

              {/* Vegas line */}
              <path d={toPath(vegasLine, progress)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />

              {/* Model line */}
              <path d={toPath(modelLine, progress)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
            </svg>

            {/* Divergence marker */}
            {progress > 0.5 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-2 right-3 text-[8px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20"
              >
                +4.5 EDGE
              </motion.div>
            )}
          </div>

          {/* Alert badge */}
          <AnimatePresence>
            {showAlert && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="mt-4 p-3 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2"
              >
                <motion.div animate={shouldReduce ? {} : { scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: 3 }}>
                  <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                </motion.div>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold tracking-[0.12em]">
                  VALUE DETECTED — MODEL DIVERGING FROM MARKET
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// WIDGET 6 — THE COMMUNITY HUB
// Social radar with connection web, mini chat
// bubbles, and member activity feed.
// ─────────────────────────────────────────────
const CommunityHub = () => {
  const shouldReduce = useReducedMotion();
  const [memberCount, setMemberCount] = useState(1247);

  useEffect(() => {
    if (shouldReduce) return;
    const t = setInterval(() => {
      setMemberCount((c) => c + Math.floor(Math.random() * 3));
    }, 4000);
    return () => clearInterval(t);
  }, [shouldReduce]);

  const chatBubbles = useMemo(
    () => [
      { text: "Under 42.5 looking sharp 🔥", pos: { top: "12%", left: "8%" }, delay: 0 },
      { text: "Edge on KC -5.5", pos: { top: "60%", right: "6%" }, delay: 2 },
      { text: "Model says contrarian play", pos: { bottom: "22%", left: "12%" }, delay: 4 },
    ],
    []
  );

  const signals = useMemo(
    () => [
      { top: "18%", left: "28%", color: "#10b981" },
      { top: "72%", left: "68%", color: "#3b82f6" },
      { top: "28%", left: "76%", color: "#f59e0b" },
      { top: "78%", left: "22%", color: "#8b5cf6" },
      { top: "45%", left: "88%", color: "#ef4444" },
      { top: "55%", left: "12%", color: "#10b981" },
    ],
    []
  );

  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <div className="absolute -inset-8 bg-blue-500/[0.03] dark:bg-blue-500/[0.05] rounded-[4rem] blur-2xl pointer-events-none" />

      <div className="relative rounded-[2rem] bg-[#060610] border border-gray-800/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-mono text-gray-400 tracking-[0.15em] uppercase">Community Pulse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-mono text-gray-400 tabular-nums">{memberCount.toLocaleString()} online</span>
          </div>
        </div>

        <div className="relative h-[340px] flex items-center justify-center">
          {/* Concentric rings */}
          {[1, 2, 3].map((ring) => (
            <div
              key={ring}
              className="absolute border border-white/[0.04] rounded-full"
              style={{ width: `${ring * 90}px`, height: `${ring * 90}px` }}
            />
          ))}

          {/* Radar sweep */}
          {!shouldReduce && (
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 270,
                height: 270,
                background: "conic-gradient(from 0deg, transparent 0deg, rgba(59,130,246,0.15) 60deg, transparent 60deg)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Sonar ripples */}
          {!shouldReduce &&
            [0, 2].map((delay) => (
              <motion.div
                key={delay}
                className="absolute w-8 h-8 rounded-full border border-blue-500/40"
                animate={{ scale: [1, 5], opacity: [0.6, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, delay, ease: "easeOut" }}
              />
            ))}

          {/* Signal dots */}
          {signals.map((sig, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{ ...sig, backgroundColor: sig.color, boxShadow: `0 0 8px ${sig.color}` }}
              animate={shouldReduce ? {} : { opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.6 }}
            />
          ))}

          {/* Chat bubbles */}
          {chatBubbles.map((bubble, i) => (
            <motion.div
              key={i}
              className="absolute z-20 max-w-[140px]"
              style={bubble.pos as any}
              animate={shouldReduce ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0], y: [6, 6, 0, 0, -6] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                delay: bubble.delay,
                times: [0, 0.1, 0.15, 0.85, 0.95],
              }}
            >
              <div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[7px] font-mono text-gray-500">MEMBER</span>
                </div>
                <p className="text-[9px] text-white/80 leading-snug">{bubble.text}</p>
              </div>
            </motion.div>
          ))}

          {/* Center avatar */}
          <div className="relative z-10 w-14 h-14 rounded-full bg-[#0a0a18] border-2 border-blue-500 flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.35)]">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-gray-500" />
            <span className="text-[9px] font-mono text-gray-500 tracking-wider">PRIVATE • INVITE ONLY</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] font-mono text-blue-400 tracking-wider">DISCORD</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// FEATURES CONFIGURATION
// Each feature has: widget, title, subtitle, description,
// bullet points, and a unique accent color.
// ─────────────────────────────────────────────
const featuresConfig = [
  {
    id: "analytics",
    num: "01",
    Widget: AnalyticsDashboard,
    title: "Professional Analytics. On Mobile & Web.",
    subtitle: "See the full picture in seconds — not hours.",
    description:
      "Our models compare real-time sportsbook lines against proprietary predictions across every major market. You get the answer. The math. The edge.",
    bullets: [
      { icon: TrendingUp, text: "Compare Vegas lines vs. model projections in one glance" },
      { icon: BarChart3, text: "Confidence scores and 7-day model trend sparklines" },
      { icon: Globe, text: "Works on web, iOS, and Android — same data, everywhere" },
    ],
    accent: "emerald",
  },
  {
    id: "assistant",
    num: "02",
    Widget: AICommandCenter,
    title: "Your Personal Betting Assistant",
    subtitle: "AI that speaks your language, powered by live data.",
    description:
      "Ask a question in plain English. Get back a multi-step analysis that pulls weather, odds, injury reports, and model predictions into a single recommendation — in seconds.",
    bullets: [
      { icon: Terminal, text: "Natural-language queries powered by real-time data" },
      { icon: Radio, text: "Live weather, injury, and market impact assessments" },
      { icon: Sparkles, text: "Personalized recommendations tuned to your betting style" },
    ],
    accent: "emerald",
  },
  {
    id: "agents",
    num: "03",
    Widget: AgentSwarm,
    title: "Build Your Autonomous Agent Army",
    subtitle: "Deploy AI research agents that work 24/7 so you don't have to.",
    description:
      "Create up to 5 specialized AI agents — each with a unique personality, risk tolerance, and sport focus. They study matchups, crunch data, and generate picks autonomously. Like having a team of data scientists that never sleep.",
    bullets: [
      { icon: Bot, text: "Up to 5 custom agents with 50+ tunable parameters each" },
      { icon: Cpu, text: "Agents analyze markets and generate picks autonomously" },
      { icon: Activity, text: "Transparent W-L records and performance tracking" },
      { icon: Network, text: "Public leaderboard — share and follow top agents" },
    ],
    accent: "violet",
  },
  {
    id: "integrity",
    num: "04",
    Widget: DataVerifier,
    title: "AI Grounded in Reality",
    subtitle: "Predictions built on verified live data — never hallucinations.",
    description:
      "Every prediction is traceable back to its source. We continuously ingest and cross-reference data from ESPN, weather services, sportsbook APIs, and public money splits before a single number reaches you.",
    bullets: [
      { icon: ShieldCheck, text: "Continuous integrity verification of all data streams" },
      { icon: Globe, text: "Cross-referenced against ESPN, weather APIs, and sportsbook feeds" },
      { icon: CircleDot, text: "Every prediction is auditable back to its source data" },
    ],
    accent: "emerald",
  },
  {
    id: "alerts",
    num: "05",
    Widget: ValueDetector,
    title: "Spot Value Before the Market Corrects",
    subtitle: "Our models detect when the math shifts in your favor.",
    description:
      "We track model-vs-market divergence in real time. When our predictions spike past what Vegas is offering, you get alerted before the line corrects — giving you a window to act.",
    bullets: [
      { icon: Activity, text: "Real-time monitoring of model vs. market divergence" },
      { icon: Zap, text: "Instant alerts when edge opportunities emerge" },
      { icon: TrendingUp, text: "Historical value detection accuracy tracking" },
    ],
    accent: "emerald",
  },
  {
    id: "community",
    num: "06",
    Widget: CommunityHub,
    title: "Join the Inner Circle",
    subtitle: "Connect with serious, data-driven bettors in an exclusive community.",
    description:
      "Our private Discord isn't a chat room — it's a war room. Verified members share value finds, debate strategies in real time, and get direct access to WagerProof analysts and model updates.",
    bullets: [
      { icon: Lock, text: "Private Discord with verified, serious members only" },
      { icon: MessageSquare, text: "Real-time discussion of value finds and strategy" },
      { icon: Radar, text: "Direct access to WagerProof analysts and model updates" },
    ],
    accent: "blue",
  },
];

// ─────────────────────────────────────────────
// BULLET POINT COMPONENT
// Animated check + text for each feature bullet.
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
// Full-width, alternating layout with large widget,
// rich text, bullets, and cinematic entrance.
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 py-20 md:py-32 lg:py-40">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
            isReversed ? "lg:[direction:rtl]" : ""
          }`}
        >
          {/* Widget Column */}
          <div className={`feature-el flex justify-center ${isReversed ? "lg:[direction:ltr]" : ""}`}>
            <motion.div
              whileHover={{ scale: 1.015 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="w-full max-w-[480px]"
            >
              <feature.Widget />
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
// Wraps all six sections with scroll-triggered
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
            Platform Features
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
