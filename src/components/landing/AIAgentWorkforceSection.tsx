import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Bot,
  Brain,
  Zap,
  ArrowRight,
  Gauge,
  Trophy,
  ChevronRight,
  Database,
  Globe,
  Activity,
  History,
  Newspaper,
  CloudRain,
  Cpu,
} from "lucide-react";

// ─────────────────────────────────────────────
// PIPELINE ANIMATION WIDGET
// Massive center showcase of parallel processing
// Adapted for light/dark mode in the main landing
// ─────────────────────────────────────────────
const HeroPipelineWidget = () => {
  const agents = [
    { name: "Contrarian", strategy: "Testing Fade Strategy", color: "#ef4444" },
    { name: "Chalk Grinder", strategy: "Testing Favorites", color: "#3b82f6" },
    { name: "Plus Money", strategy: "Seeking Value > +150", color: "#f59e0b" },
    { name: "Model Truther", strategy: "Aligning with Intrinsic Edge", color: "#10b981" },
    { name: "Momentum", strategy: "Analyzing Streak Form", color: "#8b5cf6" },
  ];

  const inputs = [
    { name: "Historical Data", icon: History, iconColor: "text-blue-500 dark:text-blue-400", bgColor: "bg-blue-500/10", particleColor: "#3b82f6" },
    { name: "Live Odds API", icon: Database, iconColor: "text-indigo-500 dark:text-indigo-400", bgColor: "bg-indigo-500/10", particleColor: "#6366f1" },
    { name: "Public Splits", icon: Globe, iconColor: "text-emerald-500 dark:text-emerald-400", bgColor: "bg-emerald-500/10", particleColor: "#10b981" },
    { name: "Recent News", icon: Newspaper, iconColor: "text-yellow-500 dark:text-yellow-400", bgColor: "bg-yellow-500/10", particleColor: "#eab308" },
    { name: "Situational Data", icon: CloudRain, iconColor: "text-cyan-500 dark:text-cyan-400", bgColor: "bg-cyan-500/10", particleColor: "#06b6d4" },
    { name: "ML Models", icon: Cpu, iconColor: "text-pink-500 dark:text-pink-400", bgColor: "bg-pink-500/10", particleColor: "#ec4899" },
  ];

  return (
    <div className="py-6 md:py-8 relative w-full flex flex-col items-center justify-center">
      <div className="relative w-full max-w-5xl mx-auto hidden lg:block h-[450px]">
        {/* Background panel */}
        <div className="absolute inset-4 bg-white/60 dark:bg-[#0A0D14]/80 border border-gray-200 dark:border-white/10 rounded-3xl shadow-xl dark:shadow-[0_0_100px_rgba(0,0,0,0.8)] backdrop-blur-xl" />
        
        {/* Nodes layer */}
        <div className="absolute inset-0 z-10">
          
          {/* Intake */}
          <div className="absolute left-[64px] w-[180px] h-full">
            {inputs.map((input, i) => (
              <div key={input.name} className="absolute left-0 w-full -translate-y-1/2 p-3 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl flex items-center justify-center gap-3 backdrop-blur-md overflow-hidden group shadow-sm" style={{ top: `${62.5 + i * 65}px` }}>
                <motion.div className={`absolute inset-0 ${input.bgColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <input.icon className={`w-5 h-5 ${input.iconColor}`} />
                <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{input.name}</span>
              </div>
            ))}
          </div>

          {/* Core */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-[128px]">
             <motion.div 
              className="w-32 h-32 rounded-full bg-white dark:bg-violet-600/20 border-2 border-violet-500/50 flex items-center justify-center relative z-10 shadow-lg dark:shadow-[0_0_60px_rgba(139,92,246,0.3)] backdrop-blur-xl"
              animate={{ scale: [1, 1.05, 1], borderColor: ["rgba(139,92,246,0.3)", "rgba(139,92,246,0.8)", "rgba(139,92,246,0.3)"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
             >
               <Brain className="w-12 h-12 text-violet-500 dark:text-violet-400" />
             </motion.div>
             <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/20 px-2 py-1 rounded border border-violet-200 dark:border-violet-500/30">WAGERPROOF CORE</div>
          </div>

          {/* Agents */}
          <div className="absolute right-[64px] w-[260px] h-full">
            {agents.map((agent, i) => (
              <div key={agent.name} className="absolute left-0 w-full -translate-y-1/2 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-2.5 flex items-center gap-3 overflow-hidden backdrop-blur-md group hover:border-gray-300 dark:hover:border-white/20 transition-colors shadow-sm" style={{ top: `${75 + i * 75}px` }}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-[#0A0D14] border border-gray-200 dark:border-white/10 relative z-10">
                    <Bot className="w-3.5 h-3.5" style={{ color: agent.color }} />
                  </div>
                  <div className="flex items-center gap-[2px]">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <motion.div
                        key={bar}
                        className="w-[2px] rounded-full"
                        style={{ backgroundColor: agent.color }}
                        animate={{ height: [2, 8, 2] }}
                        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: bar * 0.1 }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-gray-900 dark:text-white truncate">Agent: {agent.name}</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 shrink-0">#{i + 1}</span>
                  </div>
                  <div className="h-1 w-full bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full relative shadow-[0_0_10px_currentColor]"
                      style={{ backgroundColor: agent.color, color: agent.color }}
                      initial={{ width: "0%" }}
                      animate={{ width: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "linear", delay: Math.random() }}
                    >
                       <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/50 dark:bg-white/30 blur-[2px]" />
                    </motion.div>
                  </div>
                  <div className="text-[7px] font-mono text-gray-500 mt-1 uppercase tracking-wider">{agent.strategy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 1024 450" preserveAspectRatio="none">
           {/* Left to Center (6 inputs) */}
           {inputs.map((input, i) => (
             <path key={`path-${i}`} d={`M 230 ${62.5 + i * 65} C 310 ${62.5 + i * 65}, 400 225, 450 225`} fill="none" stroke="currentColor" className="text-gray-300 dark:text-white/10" strokeWidth="2" strokeDasharray="4 4" />
           ))}

           {/* Center to Right (5 outputs) */}
           <path d="M 570 225 C 640 225, 680 75, 750 75" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="2" />
           <path d="M 570 225 C 640 225, 680 150, 750 150" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="2" />
           <path d="M 570 225 C 640 225, 680 225, 750 225" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="2" />
           <path d="M 570 225 C 640 225, 680 300, 750 300" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="2" />
           <path d="M 570 225 C 640 225, 680 375, 750 375" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="2" />
           
           {/* Animated Data Particles */}
           {inputs.map((input, i) => (
             <motion.circle key={`particle-${i}`} r="4" fill={input.particleColor} filter={`drop-shadow(0 0 6px ${input.particleColor})`}>
               <animateMotion dur={`${2 + Math.random()}s`} repeatCount="indefinite" path={`M 230 ${62.5 + i * 65} C 310 ${62.5 + i * 65}, 400 225, 450 225`} />
             </motion.circle>
           ))}

           {agents.map((agent, i) => (
             <motion.circle key={i} r="3" fill={agent.color} filter={`drop-shadow(0 0 6px ${agent.color})`}>
               <animateMotion dur={`${1.5 + Math.random()}s`} repeatCount="indefinite" path={`M 570 225 C 640 225, 680 ${75 + i * 75}, 750 ${75 + i * 75}`} />
             </motion.circle>
           ))}
        </svg>
      </div>

      {/* Mobile fallback (stacked) */}
      <div className="flex flex-col gap-6 w-full px-4 lg:hidden relative z-10">
         <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 text-center shadow-sm">
            <Brain className="w-12 h-12 text-violet-500 dark:text-violet-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">WagerProof Core</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Ingesting thousands of data points and routing them to your autonomous agents.</p>
         </div>
         {agents.map((agent, i) => (
            <div key={agent.name} className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}>
                  <Bot className="w-5 h-5" style={{ color: agent.color }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{agent.name}</div>
                  <div className="text-[10px] font-mono text-gray-500 uppercase">{agent.strategy}</div>
                </div>
              </div>
              <div className="h-1.5 w-full bg-gray-100 dark:bg-white/10 rounded-full mt-2 overflow-hidden">
                 <motion.div 
                    className="h-full rounded-full"
                    style={{ backgroundColor: agent.color }}
                    initial={{ width: "0%" }}
                    animate={{ width: ["0%", "100%", "0%"] }}
                    transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, ease: "linear", delay: Math.random() }}
                  />
              </div>
            </div>
         ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN SECTION COMPONENT
// ─────────────────────────────────────────────
const AIAgentWorkforceSection = () => {
  useTheme();

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
    <section className="relative w-full py-20 md:py-32 overflow-hidden">
      {/* Background ambient */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/5 w-[500px] h-[500px] bg-violet-500/[0.04] dark:bg-violet-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-emerald-500/[0.03] dark:bg-emerald-500/[0.02] rounded-full blur-[140px]" />
      </div>

      {/* Noise */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative z-10 mx-auto">
        {/* ───── HEADER + PIPELINE (combined) ───── */}
        <div className="text-center max-w-5xl mx-auto px-4 md:px-6">
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

            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 dark:text-white mb-6 tracking-tight leading-[1.05] text-balance">
              Your Personal Workforce of <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-emerald-400 to-blue-500">
                Sports Data Scientists
              </span>
            </h2>

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-8 max-w-2xl mx-auto font-medium">
              Create an army of autonomous AI research agents that study sports 24/7 and report back to you.
              Test different strategies or copy the top leaderboard agents, their results are public so the accuracy is transparent.
            </p>
          </motion.div>
        </div>

        <div className="mb-8 w-full max-w-[1400px] mx-auto px-2 sm:px-4">
          <HeroPipelineWidget />
        </div>

        {/* ───── HOW IT WORKS FLOW ───── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto px-4 md:px-6"
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

          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">
            <Link to="/ai-agents">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-white/10 flex items-center justify-center gap-2"
              >
                <span>Learn More</span>
              </motion.button>
            </Link>
            <Link to="/account">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group/btn w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold text-sm shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <span>Create Your First Agent</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AIAgentWorkforceSection;