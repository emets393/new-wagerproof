import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTheme } from "@/contexts/ThemeContext";
import LandingNavBar from "@/components/landing/LandingNavBar";
import Footer from "@/components/landing/Footer";
import { SEO } from "@/components/landing/SEO";
import FloatingThemeToggle from "@/components/FloatingThemeToggle";
import { Link } from "react-router-dom";
import { 
  Bot, Brain, Zap, Shield, Trophy, Activity, 
  ArrowRight, SlidersHorizontal, 
  Database, Layers, Network, CheckCircle2,
  Terminal, LineChart, Target, Cpu, Radar, Code2, Globe
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// MAGNETIC BUTTON 
// ─────────────────────────────────────────────
const MagneticButton = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={`relative overflow-hidden ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
};

// ─────────────────────────────────────────────
// HERO SECTION (Cinematic Parallax & 3D Cards)
// ─────────────────────────────────────────────
const HeroSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-title-word", {
        y: 100,
        opacity: 0,
        rotateX: -45,
        stagger: 0.1,
        duration: 1.5,
        ease: "power4.out",
        transformOrigin: "bottom center"
      });
      gsap.from(".hero-card", {
        y: 50,
        opacity: 0,
        scale: 0.8,
        stagger: 0.2,
        duration: 1.5,
        delay: 0.5,
        ease: "elastic.out(1, 0.5)",
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative min-h-[90vh] pt-32 pb-20 px-4 flex flex-col items-center justify-center overflow-hidden perspective-1000">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[#030305] z-0" />
      <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Grid Floor */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_100%,#000_20%,transparent_100%)] z-0 pointer-events-none" />

      <motion.div style={{ y: y1, opacity }} className="relative z-10 w-full max-w-6xl mx-auto flex flex-col items-center">
        
        {/* Badge */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-gray-300 tracking-widest">WAGERPROOF AGENTS LIVE</span>
        </motion.div>

        {/* Massive Typography */}
        <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter text-white text-center leading-[0.9] mb-8 [perspective:1000px]">
          <div className="overflow-hidden"><div className="hero-title-word inline-block">BUILD</div> <div className="hero-title-word inline-block text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500">YOUR</div></div>
          <div className="overflow-hidden"><div className="hero-title-word inline-block">UNFAIR</div> <div className="hero-title-word inline-block">ADVANTAGE.</div></div>
        </h1>

        <motion.p 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }}
          className="text-lg md:text-2xl text-gray-400 max-w-4xl text-center mb-12 leading-relaxed"
        >
          Test theories and strategies simultaneously, completely without emotion. 
          It's like having a team of Harvard grad data scientists working for you 24/7, for next to no cost. Isn't that valuable?
        </motion.p>

        <div className="flex gap-4">
          <Link to="/account">
            <MagneticButton className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg flex items-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              Initialize Workforce <Zap className="w-5 h-5 fill-black" />
            </MagneticButton>
          </Link>
        </div>

      </motion.div>

      {/* Floating 3D Cards */}
      <motion.div style={{ y: y2 }} className="absolute bottom-10 left-0 right-0 h-[300px] pointer-events-none hidden lg:block perspective-1000">
        <div className="absolute left-[10%] top-20 hero-card w-64 h-40 bg-[#0A0D14]/80 border border-white/10 rounded-2xl backdrop-blur-xl p-5 transform -rotate-y-12 rotate-x-12 -rotate-z-6 shadow-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center"><Bot className="w-4 h-4 text-violet-400" /></div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">ACTIVE</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white mb-1">The Contrarian</div>
            <div className="text-xs text-gray-500 font-mono mb-2">Fade Public: 95%</div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
               <motion.div className="h-full bg-violet-500 w-[95%]" />
            </div>
          </div>
        </div>
        
        <div className="absolute right-[10%] top-10 hero-card w-64 h-40 bg-[#0A0D14]/80 border border-white/10 rounded-2xl backdrop-blur-xl p-5 transform rotate-y-12 rotate-x-12 rotate-z-6 shadow-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><Brain className="w-4 h-4 text-blue-400" /></div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">ANALYZING</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white mb-1">Model Truther</div>
            <div className="text-xs text-gray-500 font-mono mb-2">Trust Model: 100%</div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
               <motion.div className="h-full bg-blue-500 w-[100%]" />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

// ─────────────────────────────────────────────
// PIPELINE ANIMATION WIDGET
// Massive center showcase of parallel processing
// ─────────────────────────────────────────────
const HeroPipelineWidget = () => {
  const agents = [
    { name: "Contrarian", strategy: "Testing Fade Strategy", color: "#ef4444" },
    { name: "Chalk Grinder", strategy: "Testing Favorites", color: "#3b82f6" },
    { name: "Plus Money", strategy: "Seeking Value > +150", color: "#f59e0b" },
    { name: "Model Truther", strategy: "Aligning with Intrinsic Edge", color: "#10b981" },
    { name: "Momentum", strategy: "Analyzing Streak Form", color: "#8b5cf6" },
  ];

  return (
    <section className="py-24 relative w-full overflow-hidden flex flex-col items-center justify-center bg-[#030305] border-t border-white/5">
      
      <div className="text-center mb-16 relative z-10 max-w-4xl px-4">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
          Simultaneous, <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">Emotionless Execution.</span>
        </h2>
        <p className="text-xl text-gray-400 leading-relaxed">
          While others guess, your digital workforce runs thousands of logic loops simultaneously. 
          Test multiple conflicting strategies in parallel, entirely without bias. 
          Your own personal Wall Street quant team.
        </p>
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-4 hidden lg:block h-[500px]">
        {/* Background panel */}
        <div className="absolute inset-4 bg-[#0A0D14]/80 border border-white/10 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] backdrop-blur-xl" />
        
        {/* Nodes layer */}
        <div className="absolute inset-0 flex items-center justify-between px-16 z-10">
          
          {/* Intake */}
          <div className="w-[200px] flex flex-col gap-10">
             <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 backdrop-blur-md relative overflow-hidden group">
               <motion.div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
               <Database className="w-5 h-5 text-blue-400" />
               <span className="text-xs font-mono text-gray-300">Live Odds API</span>
             </div>
             <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 backdrop-blur-md relative overflow-hidden group">
               <motion.div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
               <Globe className="w-5 h-5 text-emerald-400" />
               <span className="text-xs font-mono text-gray-300">Public Splits</span>
             </div>
             <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 backdrop-blur-md relative overflow-hidden group">
               <motion.div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
               <Activity className="w-5 h-5 text-yellow-400" />
               <span className="text-xs font-mono text-gray-300">Telemetry</span>
             </div>
          </div>

          {/* Core */}
          <div className="relative">
             <div className="absolute inset-0 bg-violet-600/30 blur-[80px] rounded-full scale-150" />
             <motion.div 
              className="w-40 h-40 rounded-full bg-violet-600/20 border border-violet-500/50 flex items-center justify-center relative z-10 shadow-[0_0_60px_rgba(139,92,246,0.3)] backdrop-blur-xl"
              animate={{ scale: [1, 1.05, 1], borderColor: ["rgba(139,92,246,0.3)", "rgba(139,92,246,0.8)", "rgba(139,92,246,0.3)"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
             >
               <Brain className="w-16 h-16 text-violet-400" />
             </motion.div>
             <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono font-bold text-violet-400 bg-violet-500/20 px-2 py-1 rounded border border-violet-500/30">WAGERPROOF CORE</div>
          </div>

          {/* Agents */}
          <div className="w-[280px] flex flex-col gap-4">
            {agents.map((agent, i) => (
              <div key={agent.name} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-4 relative overflow-hidden backdrop-blur-md group hover:border-white/20 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#0A0D14] border border-white/10 relative z-10">
                  <Bot className="w-4 h-4" style={{ color: agent.color }} />
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-white truncate">{agent.name}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full relative shadow-[0_0_10px_currentColor]"
                      style={{ backgroundColor: agent.color, color: agent.color }}
                      initial={{ width: "0%" }}
                      animate={{ width: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "linear", delay: Math.random() }}
                    >
                       <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/30 blur-[2px]" />
                    </motion.div>
                  </div>
                  <div className="text-[8px] font-mono text-gray-500 mt-1 uppercase tracking-wider">{agent.strategy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 1152 500" preserveAspectRatio="none">
           {/* Left to Center (3 inputs) */}
           <path d="M 264 120 C 350 120, 450 250, 500 250" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="4 4" />
           <path d="M 264 250 C 350 250, 450 250, 500 250" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="4 4" />
           <path d="M 264 380 C 350 380, 450 250, 500 250" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="4 4" />

           {/* Center to Right (5 outputs) */}
           <path d="M 650 250 C 720 250, 750 85, 824 85" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="2" />
           <path d="M 650 250 C 720 250, 750 167, 824 167" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="2" />
           <path d="M 650 250 C 720 250, 750 250, 824 250" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="2" />
           <path d="M 650 250 C 720 250, 750 332, 824 332" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="2" />
           <path d="M 650 250 C 720 250, 750 415, 824 415" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="2" />
           
           {/* Animated Data Particles */}
           <motion.circle r="4" fill="#60a5fa" filter="drop-shadow(0 0 8px #60a5fa)">
             <animateMotion dur="2.5s" repeatCount="indefinite" path="M 264 120 C 350 120, 450 250, 500 250" />
           </motion.circle>
           <motion.circle r="4" fill="#34d399" filter="drop-shadow(0 0 8px #34d399)">
             <animateMotion dur="2s" repeatCount="indefinite" path="M 264 250 C 350 250, 450 250, 500 250" />
           </motion.circle>
           <motion.circle r="4" fill="#fbbf24" filter="drop-shadow(0 0 8px #fbbf24)">
             <animateMotion dur="3s" repeatCount="indefinite" path="M 264 380 C 350 380, 450 250, 500 250" />
           </motion.circle>

           {agents.map((agent, i) => (
             <motion.circle key={i} r="3" fill={agent.color} filter={`drop-shadow(0 0 8px ${agent.color})`}>
               <animateMotion dur={`${1.5 + Math.random()}s`} repeatCount="indefinite" path={`M 650 250 C 720 250, 750 ${85 + i * 82.5}, 824 ${85 + i * 82.5}`} />
             </motion.circle>
           ))}
        </svg>
      </div>
      
      {/* Mobile fallback (stacked) */}
      <div className="flex flex-col gap-6 w-full px-4 lg:hidden relative z-10">
         <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <Brain className="w-12 h-12 text-violet-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">The Central Engine</h3>
            <p className="text-sm text-gray-400">Ingesting thousands of data points and routing them to your autonomous agents.</p>
         </div>
         {agents.map((agent, i) => (
            <div key={agent.name} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40` }}>
                  <Bot className="w-5 h-5" style={{ color: agent.color }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{agent.name}</div>
                  <div className="text-[10px] font-mono text-gray-400 uppercase">{agent.strategy}</div>
                </div>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full mt-2 overflow-hidden">
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
    </section>
  );
};

// ─────────────────────────────────────────────
// DATA TICKER MARQUEE
// ─────────────────────────────────────────────
const TickerMarquee = () => {
  return (
    <div className="w-full bg-emerald-500/10 border-y border-emerald-500/20 py-3 overflow-hidden flex whitespace-nowrap z-20 relative">
      <motion.div
        className="flex gap-8 items-center"
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 20 }}
      >
        {[...Array(4)].map((_, i) => (
          <React.Fragment key={i}>
            <span className="text-emerald-400 font-mono text-xs tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> INGESTING ESPN FEEDS</span>
            <span className="text-emerald-400 font-mono text-xs tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> PROCESSING ODDS API</span>
            <span className="text-emerald-400 font-mono text-xs tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> EXECUTING PREDICTIVE MODELS</span>
            <span className="text-emerald-400 font-mono text-xs tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> TRACKING SHARP MONEY</span>
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PINNED SCROLL SECTION (The 3-Step Process)
// ─────────────────────────────────────────────
const PinnedScrollSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Pin the right column while the left scrolls
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        pin: rightColRef.current,
        pinSpacing: false,
      });

      // Crossfade steps in the right column based on scroll position of left column items
      const steps = gsap.utils.toArray<HTMLElement>(".scroll-step");
      const visualStates = gsap.utils.toArray<HTMLElement>(".visual-state");

      steps.forEach((step, i) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 50%",
          end: "bottom 50%",
          onEnter: () => {
            gsap.to(visualStates, { opacity: 0, duration: 0.5 });
            gsap.to(visualStates[i], { opacity: 1, duration: 0.5 });
            gsap.to(step, { opacity: 1, duration: 0.3 });
          },
          onEnterBack: () => {
            gsap.to(visualStates, { opacity: 0, duration: 0.5 });
            gsap.to(visualStates[i], { opacity: 1, duration: 0.5 });
            gsap.to(step, { opacity: 1, duration: 0.3 });
          },
          onLeave: () => gsap.to(step, { opacity: 0.3, duration: 0.3 }),
          onLeaveBack: () => gsap.to(step, { opacity: 0.3, duration: 0.3 })
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative bg-[#030305] py-20 px-4">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row relative">
        
        {/* Left Scroll Column */}
        <div className="w-full lg:w-1/2 lg:py-[30vh] space-y-[40vh] relative z-20 pointer-events-none lg:pointer-events-auto">
          
          <div className="scroll-step opacity-30">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Phase 1: Ingest.</h2>
            <p className="text-xl text-gray-400 leading-relaxed max-w-md">
              Agents consume millions of data points continuously. Live odds, sharp money splits, weather conditions, and injury reports are synthesized in real-time, completely neutralizing human fatigue.
            </p>
          </div>

          <div className="scroll-step opacity-30">
            <div className="w-12 h-12 rounded-full bg-violet-500/20 border border-violet-500 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              <Cpu className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Phase 2: Analyze.</h2>
            <p className="text-xl text-gray-400 leading-relaxed max-w-md">
              The neural engine cross-references ingested data against proprietary models. Every agent applies its unique personality sliders—filtering the noise, discarding biases, and isolating true mathematical edge.
            </p>
          </div>

          <div className="scroll-step opacity-30">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Phase 3: Execute.</h2>
            <p className="text-xl text-gray-400 leading-relaxed max-w-md">
              When the math strictly aligns with an agent's philosophy, it strikes. A full, auditable receipt of the logic is generated, and the pick is cemented into the transparent W-L ledger. No tilting. No chasing losses.
            </p>
          </div>

        </div>

        {/* Right Pinned Column */}
        <div className="w-full lg:w-1/2 h-[60vh] lg:h-screen lg:absolute lg:right-0 lg:top-0 flex items-center justify-center" ref={rightColRef}>
          <div className="relative w-full max-w-md aspect-square">
            
            {/* Visual State 1: Ingest */}
            <div className="visual-state absolute inset-0 opacity-100 flex items-center justify-center">
              <div className="relative w-72 h-72 border border-blue-500/30 rounded-full flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border border-blue-500/10 rounded-full border-t-blue-500/50" />
                <motion.div animate={{ rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute inset-4 border border-blue-500/5 rounded-full border-b-blue-500/30" />
                <Database className="w-20 h-20 text-blue-400 opacity-90 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
                {/* Floating data dots */}
                {[...Array(8)].map((_, i) => (
                  <motion.div key={i} className="absolute w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_10px_#60a5fa]"
                    animate={{ 
                      x: [Math.random() * 240 - 120, 0], 
                      y: [Math.random() * 240 - 120, 0],
                      scale: [0, 1.5, 0],
                      opacity: [0, 1, 0]
                    }}
                    transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.4 }}
                  />
                ))}
              </div>
            </div>

            {/* Visual State 2: Analyze */}
            <div className="visual-state absolute inset-0 opacity-0 flex items-center justify-center">
               <div className="w-full h-72 bg-[#0A0D14] border border-violet-500/30 rounded-3xl p-8 overflow-hidden relative shadow-[0_0_80px_rgba(139,92,246,0.15)]">
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.15)_0%,transparent_70%)]" />
                 <div className="space-y-4 relative z-10 h-full flex flex-col justify-center">
                   <div className="h-2 w-1/2 bg-violet-500/20 rounded-full overflow-hidden"><motion.div className="h-full bg-violet-400 shadow-[0_0_10px_#a78bfa]" animate={{ width: ["0%", "100%", "0%"] }} transition={{ duration: 2, repeat: Infinity }} /></div>
                   <div className="h-2 w-3/4 bg-violet-500/20 rounded-full overflow-hidden"><motion.div className="h-full bg-fuchsia-400 shadow-[0_0_10px_#e879f9]" animate={{ width: ["0%", "80%", "0%"] }} transition={{ duration: 2.5, repeat: Infinity }} /></div>
                   <div className="h-2 w-full bg-violet-500/20 rounded-full overflow-hidden"><motion.div className="h-full bg-violet-500 shadow-[0_0_10px_#8b5cf6]" animate={{ width: ["0%", "90%", "0%"] }} transition={{ duration: 1.8, repeat: Infinity }} /></div>
                   <div className="h-2 w-2/3 bg-violet-500/20 rounded-full overflow-hidden"><motion.div className="h-full bg-fuchsia-500 shadow-[0_0_10px_#d946ef]" animate={{ width: ["0%", "60%", "0%"] }} transition={{ duration: 2.2, repeat: Infinity }} /></div>
                 </div>
                 <Cpu className="absolute bottom-8 right-8 w-20 h-20 text-violet-500/30" />
               </div>
            </div>

            {/* Visual State 3: Execute */}
            <div className="visual-state absolute inset-0 opacity-0 flex items-center justify-center">
              <div className="relative w-72 h-72 flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-500/5 rounded-full" />
                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 border border-emerald-500/50 rounded-full" />
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <CheckCircle2 className="w-32 h-32 text-emerald-400 drop-shadow-[0_0_25px_rgba(16,185,129,0.6)]" />
                </motion.div>
                <div className="absolute -bottom-4 bg-emerald-500 text-black font-black px-6 py-3 rounded-full text-sm tracking-widest shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
                  PICK LOGGED
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

// ─────────────────────────────────────────────
// BENTO BOX WIDGETS
// ─────────────────────────────────────────────
const BentoGridSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".bento-item", {
        y: 60,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 75%",
        }
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-32 px-4 md:px-8 bg-[#050508] relative border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-16">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">The Anatomy of an Agent.</h2>
          <p className="text-xl text-gray-400 max-w-3xl leading-relaxed">
            A modular dashboard giving you complete, transparent control. It’s not a black box—it’s a finely tuned mathematical instrument that you configure, oversee, and optimize.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[280px]">
          
          {/* Bento Item 1: Personality Engine (Large Square) */}
          <div className="bento-item md:col-span-2 lg:col-span-2 md:row-span-2 bg-[#0A0D14] border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-violet-500/50 transition-colors shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 mb-6">
              <SlidersHorizontal className="w-7 h-7 text-violet-400" />
              <h3 className="text-2xl font-bold text-white">Personality Engine</h3>
            </div>
            <p className="text-sm text-gray-400 mb-8 max-w-sm">Dictate precisely how your agent values underdogs, momentum, and public sentiment. 50+ granular sliders.</p>
            
            <div className="space-y-6 relative z-10">
              {[
                { label: "Fade Public Money", val: 85, color: "bg-violet-500", glow: "shadow-[0_0_10px_#8b5cf6]" },
                { label: "Underdog Bias", val: 60, color: "bg-fuchsia-500", glow: "shadow-[0_0_10px_#d946ef]" },
                { label: "Model Reliance", val: 95, color: "bg-blue-500", glow: "shadow-[0_0_10px_#3b82f6]" },
                { label: "Risk Tolerance", val: 40, color: "bg-emerald-500", glow: "shadow-[0_0_10px_#10b981]" },
              ].map((slider, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                    <span>{slider.label}</span>
                    <span>{slider.val}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className={`h-full ${slider.color} ${slider.glow}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${slider.val}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, delay: i * 0.2, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] group-hover:bg-violet-500/20 transition-colors" />
          </div>

          {/* Bento Item 2: Market Divergence (Rectangle) */}
          <div className="bento-item md:col-span-2 lg:col-span-2 md:row-span-1 bg-[#0A0D14] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/50 transition-colors shadow-2xl">
            <div className="flex justify-between items-start mb-2 relative z-10">
              <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Market Divergence</h3>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded font-bold">LIVE SCANNING</span>
            </div>
            <p className="text-xs text-gray-400 mb-2 relative z-10 max-w-sm">Detecting precisely when sportsbooks misprice lines compared to intrinsic models.</p>
            
            <div className="h-[100px] w-full mt-4 relative">
              <svg viewBox="0 0 400 120" className="w-full h-full overflow-visible">
                {/* Vegas Line */}
                <path d="M0,80 L100,75 L200,85 L300,70 L400,65" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 4" />
                {/* Model Line */}
                <motion.path 
                  d="M0,80 L100,70 L200,50 L300,30 L400,20" 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.6))" }}
                />
              </svg>
              <motion.div 
                className="absolute right-8 top-0 bg-emerald-500 text-black text-xs font-black px-3 py-1.5 rounded shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 2, type: "spring" }}
              >
                +4.5 EDGE DETECTED
              </motion.div>
            </div>
          </div>

          {/* Bento Item 3: Source Verification (Small Square) */}
          <div className="bento-item md:col-span-1 lg:col-span-1 md:row-span-1 bg-[#0A0D14] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-colors shadow-2xl flex flex-col">
            <Shield className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Verified Integrity</h3>
            <p className="text-xs text-gray-400 mb-6 flex-1">Predictions are strictly grounded in mathematically sound, auditable feeds. No hallucinations.</p>
            <div className="space-y-2">
              {['ESPN Live API', 'Weather.gov DB', 'TheOdds Market'].map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-gray-300 font-mono bg-white/5 border border-white/10 p-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" /> {s}
                </div>
              ))}
            </div>
          </div>

          {/* Bento Item 4: Agent Radar (Small Square) */}
          <div className="bento-item md:col-span-1 lg:col-span-1 md:row-span-1 bg-[#0A0D14] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-fuchsia-500/50 transition-colors shadow-2xl flex flex-col items-center justify-center">
            <h3 className="text-sm font-bold text-gray-400 absolute top-6 left-6 uppercase tracking-widest">Swarm Sync</h3>
            <div className="relative w-36 h-36 rounded-full border border-white/10 flex items-center justify-center mt-6 bg-[#030305]">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border-t-2 border-fuchsia-500 drop-shadow-[0_0_8px_#d946ef]" />
              <Network className="w-10 h-10 text-fuchsia-400" />
              <motion.div className="absolute w-2.5 h-2.5 bg-fuchsia-400 rounded-full top-4 right-6 shadow-[0_0_15px_#d946ef]" animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
              <motion.div className="absolute w-2.5 h-2.5 bg-fuchsia-400 rounded-full bottom-6 left-6 shadow-[0_0_15px_#d946ef]" animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1 }} />
              <motion.div className="absolute w-2.5 h-2.5 bg-fuchsia-400 rounded-full top-1/2 -right-2 shadow-[0_0_15px_#d946ef]" animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.5 }} />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────
// MASSIVE FOOTER CTA
// ─────────────────────────────────────────────
const FinalCTA = () => {
  return (
    <section className="relative py-40 overflow-hidden bg-[#030305] flex items-center justify-center text-center px-4 border-t border-white/5">
      {/* Central Glow */}
      <div className="absolute w-[800px] h-[800px] bg-violet-600/20 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative z-10 max-w-4xl mx-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <Bot className="w-24 h-24 text-white mx-auto mb-8 drop-shadow-[0_0_40px_rgba(255,255,255,0.6)]" />
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-tight">
            Stop Betting. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">Start Deploying.</span>
          </h2>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Your first agent is ready to be configured. The equivalent of a professional data analytics team, available instantly, at a fraction of the cost.
          </p>
          
          <Link to="/account">
            <MagneticButton className="px-12 py-5 bg-white text-black rounded-full font-black text-xl shadow-[0_0_60px_rgba(255,255,255,0.2)] hover:shadow-[0_0_80px_rgba(255,255,255,0.4)] transition-shadow flex items-center gap-3 mx-auto">
              Initialize Free Agent <ArrowRight className="w-6 h-6" />
            </MagneticButton>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────
const AgentLanding = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen bg-[#030305] text-white selection:bg-violet-500/30 font-sans">
      <SEO
        title="AI Betting Agents - WagerProof"
        description="Deploy customized AI sports betting agents. Build your autonomous workforce to find betting value 24/7."
      />
      <LandingNavBar />
      
      <HeroSection />
      <HeroPipelineWidget />
      <TickerMarquee />
      <PinnedScrollSection />
      <BentoGridSection />
      <FinalCTA />
      
      <Footer />
      <FloatingThemeToggle />
    </div>
  );
};

export default AgentLanding;