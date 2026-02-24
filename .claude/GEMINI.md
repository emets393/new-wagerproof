# WagerProof Landing Refactor Plan (Cinematic UX)

## Role & Execution Directive

Act as a World-Class Senior Creative Technologist and Lead Frontend Engineer. You build high-fidelity, cinematic "1:1 Pixel Perfect" landing pages. Every scroll must feel intentional, every animation weighted and professional. Eradicate all generic AI patterns.

This document serves as the master blueprint for refactoring the six-feature section in `MobileAppFeatures.tsx` from static iPhone mockups/basic layouts into **six highly interactive, functional micro-UIs (widgets)** that explain WagerProof's core value visually.

---

## 1. UX & Motion Architecture (MUST FOLLOW)

- **Eradicate Static Images:** Replace all screenshots with living, animated DOM elements (widgets).
- **Magnetic Micro-Interactions:** All buttons and interactive elements must use a subtle `scale(1.03)` on hover with `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
- **Global Visual Texture:** Maintain WagerProof's dark/light modes but ensure all widgets use a `rounded-[2rem]` to `rounded-[3rem]` radius system. No sharp corners. Include subtle inner borders (`border-white/10` in dark mode) and deep shadows (`shadow-2xl`).
- **Animation Lifecycle:**
  - Use `gsap.context()` for scroll-based entrances (`ScrollTrigger`). Return `ctx.revert()` in cleanup.
  - Use `framer-motion` (`AnimatePresence`, `layout`, spring physics) for the continuous internal loops of the widgets.
  - Default GSAP easing: `power3.out` for entrances.

---

## 2. The Six Functional Widgets

We are replacing the current rows with exactly six cinematic features. Each row must contain an animated widget that teaches the user *how* the product works within 3-6 seconds.

### Widget 1: The Edge Finder (Professional Analytics)
- **Concept:** A "Diagnostic Shuffler."
- **Visual:** 3 overlapping market cards (e.g., "Vegas: -3", "Model: -5.5", "Edge: 2.5"). They cycle vertically using `array.unshift(array.pop())` every 3 seconds with a fluid spring-bounce transition (`stiffness: 300, damping: 25`).
- **Copy Focus:** "See market vs. model numbers in one glance."

### Widget 2: The Telemetry Feed (Personal Betting Assistant)
- **Concept:** A monospace live-text feed.
- **Visual:** A terminal-like window that types out messages character-by-character (e.g., `> Analyzing NFL Week 4 Markets...\n> High value detected on Under 44.5...`), complete with a blinking accent-colored cursor and a pulsing "LIVE FEED" indicator.
- **Copy Focus:** "Get real-time, plain-language guidance driven by AI and live data."

### Widget 3: The Protocol Scheduler (Expert Picks)
- **Concept:** A timeline/grid interaction.
- **Visual:** A weekly grid where an animated SVG cursor enters, moves to a specific game cell, clicks (visual `scale(0.95)` press), highlights an "Expert Pick" badge in Emerald, and fades out.
- **Copy Focus:** "Track exactly when and why a pick qualifies."

### Widget 4: The Data Scanner (AI + Live Data Integrity)
- **Concept:** A continuous scanning laser over a data grid.
- **Visual:** A dark panel with a faint grid. An emerald-colored horizontal laser sweeps up and down over "incoming data packets" (represented as pulsing dots), with a "VERIFYING INTEGRITY" status bar.
- **Copy Focus:** "Predictions grounded in live sports data, not hallucinations."

### Widget 5: The Market Divergence Pulse (Value Alerts)
- **Concept:** Diverging progress bars.
- **Visual:** Two bars representing "Vegas Lines" vs "WagerProof Models". The Vegas bar slowly creeps up, and suddenly the WagerProof bar spikes past it, triggering a glowing "Value Detected" badge and market pulse wave.
- **Copy Focus:** "Find hidden edge opportunities as betting markets move."

### Widget 6: The Consensus Radar (Private Community)
- **Concept:** A social radar.
- **Visual:** A central avatar surrounded by concentric circles. "Signals" (small dots representing other bettors/experts) light up on the radar rings with expanding sonar ripples (using Framer Motion `scale: 2, opacity: 0` loops) connecting to the center.
- **Copy Focus:** "Validate your ideas alongside serious, data-driven bettors in our private community."

---

## 3. Structural Refactor Plan

1. **Decouple Data & UI:**
   Move the feature text, config, and widget references into a typed array at the top of the file.

2. **The `FeatureWidgetRow` Component:**
   Extract a highly reusable, alternating `FeatureRow` component.
   - Props: `title`, `description`, `WidgetComponent`, `isReversed`, `ctaLabel`.
   - Layout: 50% text (left/right) / 50% widget container.
   - The GSAP entrance animations (`y: 40`, `opacity: 0` to `1`) should trigger sequentially via ScrollTrigger as each row enters the viewport.

3. **Widget Component Isolation:**
   Build each of the 6 widgets as an isolated, purely functional visual component (e.g., `<DiagnosticShuffler />`, `<TelemetryTypewriter />`). They should require no external props to run their continuous loops, ensuring high performance.

4. **Performance & Cleanup:**
   - Honor accessibility: pause or reduce `framer-motion` loops if `useReducedMotion` is true.
   - Prevent memory leaks: Ensure all `setInterval` / `setTimeout` inside widgets are cleared on unmount.
   - Hardware Acceleration: Use `will-change: transform` and 3D transforms (`translateZ(0)`) to keep animations on the GPU.

---

## 4. Execution Directive

"Do not build a standard website section; build a digital instrument. Every interaction should feel like professional betting software. Build the six features explicitly as described. Eradicate all generic React components and replace them with these living functional artifacts."