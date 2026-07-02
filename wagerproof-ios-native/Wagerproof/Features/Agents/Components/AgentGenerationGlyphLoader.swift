import SwiftUI
import WagerproofDesign
import WagerproofServices

/// Shared "action" orange for the polling verbs + elapsed timer (independent of
/// the agent's accent tint).
private let kGenerationOrange = Color(hex: 0xFF9F0A)

/// The Today's Picks generation card — ONE view that owns the whole
/// research → polling morph so the transition animates in place instead of
/// swapping views. Driven by `isGenerating` (flipped by the parent when a run
/// starts) plus the live Trigger.dev run metadata:
///
///   • **Research (idle):** the agent's pixel character seated at a laptop
///     (`WorkingDeskAvatar`) over a slow accent `GlyphMatrix3x3` + "Research in
///     Progress" shimmer, with the `SwipeToGeneratePill` to kick off a run.
///   • **Polling (running):** the card avatar is dropped (the HEADER hero avatar
///     switches to laptop-working mode instead), the glyph+text row stays put
///     (glyph turns orange, text becomes live action verbs), the swipe pill hands
///     off to a plain `GenerationLoadingBar` (turn / maxTurns), and mini
///     `ToolActivityStack` ticket scaffolds stack in below — one per cumulative
///     tool call. A right→left pixel pulse-wave plays behind it all.
///
/// After a run that finds no picks, the two green console lines render at the top
/// of the card (`conclusion`) instead of a separate terminal panel.
struct AgentGenerationCard: View {
    /// Stable pixel-character index for this agent (`Agent.spriteIndex`).
    let spriteIndex: Int
    var accent: Color
    /// Live run metadata while a generation is in flight (nil in the idle state).
    var state: TriggerV3RunStatus?
    /// Drives the research → polling morph. Flipped by the parent when a run starts.
    var isGenerating: Bool
    /// Idle-only: whether the swipe pill is armed, and its locked copy.
    var canGenerate: Bool
    var lockedLabel: String
    /// When the last run finished with no picks, the slate note to show as the
    /// second green console line above the avatar. Nil normally.
    var conclusion: String? = nil
    var onGenerate: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var meta: TriggerV3RunMetadata? { state?.metadata }
    /// The card is in the live polling state whenever a run is in flight. Derived
    /// directly from `isGenerating` (no `@State` gate) so the polling visuals — the
    /// pixel bar + tool stack — appear the instant the run starts and update on
    /// every metadata poll. The morph is animated via `.animation(value:)` below.
    private var polling: Bool { isGenerating }
    /// The polling-state glyph color — a hot orange that reads as "working hard".
    private let pollingGlyph = Color(hex: 0xFF8A00)
    private let successGreen = Color(hex: 0x00E676)

    // Explicit init so the public API stays exactly these params (the `@Environment`
    // property would make the synthesized memberwise init awkward).
    init(
        spriteIndex: Int,
        accent: Color,
        state: TriggerV3RunStatus?,
        isGenerating: Bool,
        canGenerate: Bool,
        lockedLabel: String,
        conclusion: String? = nil,
        onGenerate: @escaping () -> Void
    ) {
        self.spriteIndex = spriteIndex
        self.accent = accent
        self.state = state
        self.isGenerating = isGenerating
        self.canGenerate = canGenerate
        self.lockedLabel = lockedLabel
        self.conclusion = conclusion
        self.onGenerate = onGenerate
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // The no-picks conclusion sits ABOVE the pixel guy (replaces the old
            // separate terminal card).
            if let conclusion, !polling {
                conclusionLines(conclusion).transition(.opacity)
            }
            topRow
            // Tickets stack ABOVE the status line so the glyph + Research/verb
            // row stays pinned directly above the bar (never relocates).
            if polling {
                ToolActivityStack(count: toolCalls, accent: accent)
                    .transition(.opacity)
            }
            statusLine
            bottomBar
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(cardBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(accent.opacity(0.16), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        // Animate the research ↔ polling morph off `isGenerating` directly (avatar
        // shrink, bar/stack insert-transitions, text swap). Metadata changes drive
        // the bar/stack live without triggering this spring.
        .animation(.spring(response: 0.6, dampingFraction: 0.85), value: isGenerating)
    }

    // MARK: Conclusion (two green console lines)

    private func conclusionLines(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            consoleLine("Analysis complete: no high-confidence picks found.", tint: successGreen)
            consoleLine(text, tint: successGreen.opacity(0.72))
        }
        .font(.system(size: 12, design: .monospaced))
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func consoleLine(_ text: String, tint: Color) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("›").foregroundStyle(successGreen)
            Text(text).foregroundStyle(tint)
        }
    }

    // MARK: Background

    /// Solid black in research; right→left pixel pulse-waves once polling.
    @ViewBuilder private var cardBackground: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color.black)
            if polling {
                PixelPulseWaves(accent: accent)
                    .transition(.opacity)
            }
        }
    }

    // MARK: Top row (avatar + polling picks chip)

    /// RESEARCH: the big seated-at-laptop avatar, centered. POLLING: no avatar in
    /// the card — the working state moves to the HEADER hero avatar (which switches
    /// to laptop-working mode while `isGenerating`). Only the picks chip rides the
    /// top-right while polling.
    private var topRow: some View {
        HStack(alignment: .top, spacing: 12) {
            if !polling {
                WorkingDeskAvatar(spriteIndex: spriteIndex, accent: accent, charHeight: 120)
                    .padding(.top, 22)
                    .frame(maxWidth: .infinity)   // centered in research
                    .transition(.opacity)
            } else if picksFound > 0 {
                Spacer(minLength: 0)
                picksChip.transition(.scale.combined(with: .opacity))
            }
        }
    }

    // MARK: Status line (glyph + text — stays together, in place)

    /// The 3×3 glyph and its label stay TOGETHER in the same centered slot across
    /// the whole run. Only the glyph's color + speed and the text (shimmer ↔ live
    /// action verbs) change — the row itself never relocates. The glyph is one
    /// persistent view so its color eases from accent → orange.
    private var statusLine: some View {
        HStack(spacing: 10) {
            // Same steady cadence in both states — only the color changes
            // (accent → orange) when polling; no speed-up.
            GlyphMatrix3x3(accent: polling ? pollingGlyph : accent, cycleSeconds: 1.0)
            statusText
            if polling {
                // Elapsed run timer, right beside the verbs (native numeric roll).
                ElapsedTimerText(color: kGenerationOrange)
                    .transition(.opacity)
            }
        }
        // Left-aligned + inset to line up with the progress pill (bottomBar) below.
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
    }

    @ViewBuilder private var statusText: some View {
        if polling {
            ThinkingVerbs(accent: accent, label: currentToolLabel)
                .transition(.opacity)
        } else {
            ResearchShimmerText("Research in Progress")
                .transition(.opacity)
        }
    }

    // MARK: Bottom bar (swipe pill ↔ pixel-filled pill)

    @ViewBuilder private var bottomBar: some View {
        if polling {
            // A small native linear progress bar (thin, not a pill).
            GenerationLoadingBar(fraction: fraction, accent: accent)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .transition(.opacity)
        } else {
            SwipeToGeneratePill(
                title: canGenerate ? "Swipe to get picks" : lockedLabel,
                accent: accent,
                isEnabled: canGenerate,
                onCommit: onGenerate
            )
            .padding(.horizontal, 14)
            .padding(.bottom, 6)
            .transition(.opacity)
        }
    }

    private var picksChip: some View {
        HStack(spacing: 4) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 10, weight: .bold))
            Text("\(picksFound) found")
                .font(.system(size: 11, weight: .heavy))
                .contentTransition(.numericText())
                .monospacedDigit()
        }
        .foregroundStyle(accent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Capsule().fill(accent.opacity(0.18)))
    }

    // MARK: Metadata-derived

    /// turn/maxTurns, capped below 1 until terminal; an indeterminate sliver
    /// before the first turn lands so the fill still reads as alive.
    private var fraction: CGFloat {
        if let s = state, s.isTerminal { return 1 }
        let turn = meta?.turn ?? 0
        let maxTurns = meta?.maxTurns ?? 0
        if maxTurns > 0 { return min(0.96, CGFloat(turn) / CGFloat(maxTurns)) }
        return turn > 0 ? 0.12 : 0.05
    }

    private var toolCalls: Int { meta?.toolCalls ?? 0 }
    private var picksFound: Int { meta?.picksAccepted ?? 0 }

    /// The live action-verb label — the humanized current tool (server-side) plus
    /// its detail. Nil before the first tool lands, so `ThinkingVerbs` falls back
    /// to its cosmetic cycle.
    private var currentToolLabel: String? {
        guard let tool = meta?.currentTool, !tool.isEmpty else { return nil }
        if let detail = meta?.currentToolDetail, !detail.isEmpty { return "\(tool) · \(detail)" }
        return tool
    }
}

// MARK: - 3×3 glyph matrix

/// A tiny 3×3 dot matrix that cycles through three "glyphing" animations —
/// a diagonal sweep, a horizontal sweep, and a spin around the ring. Each form
/// runs a full `cyclesPerForm` (4) sweeps before the next takes over, so the
/// animation TYPE never changes mid-cycle. Rendered in a `Canvas` so the dots
/// stay crisp. SLOW + accent while researching, FAST + orange while polling
/// (`cycleSeconds` + `accent`).
struct GlyphMatrix3x3: View {
    var accent: Color
    /// Duration of ONE sweep. The form only switches after `cyclesPerForm` of
    /// these, so each type always completes 4 full runs first.
    var cycleSeconds: Double = 1.0
    var dot: CGFloat = 4.5
    var gap: CGFloat = 5

    /// Cycles a single form runs before the next type takes over.
    private let cyclesPerForm = 4

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var side: CGFloat { 3 * dot + 2 * gap }

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                let formDuration = cycleSeconds * Double(cyclesPerForm)
                let mode = Int((t / formDuration).truncatingRemainder(dividingBy: 3))
                // Repeats 0→1 every cycle, so a form sweeps `cyclesPerForm` times.
                let local = (t.truncatingRemainder(dividingBy: cycleSeconds)) / cycleSeconds
                let cell = size.width / 3
                for r in 0..<3 {
                    for c in 0..<3 {
                        let b = brightness(mode: mode, r: r, c: c, local: local)
                        let cx = (CGFloat(c) + 0.5) * cell
                        let cy = (CGFloat(r) + 0.5) * cell
                        let s = dot * (0.7 + 0.7 * b)
                        let rect = CGRect(x: cx - s / 2, y: cy - s / 2, width: s, height: s)
                        let path = Path(roundedRect: rect, cornerRadius: s * 0.3, style: .continuous)
                        ctx.fill(path, with: .color(accent.opacity(0.16 + 0.84 * b)))
                    }
                }
            }
            .frame(width: side, height: side)
        }
        .frame(width: side, height: side)
    }

    /// Per-dot brightness (0…1) for the current animation mode.
    private func brightness(mode: Int, r: Int, c: Int, local: Double) -> Double {
        switch mode {
        case 0:
            // Diagonal band travelling top-left → bottom-right (5 diagonals).
            let phase = Double(r + c) / 4.0
            return gauss(phase - local, 0.18)
        case 1:
            // Vertical band travelling left → right across the columns.
            let phase = Double(c) / 2.0
            return gauss(phase - local, 0.16)
        default:
            // Spin: a pointer rotates around the 8 outer dots; centre pulses.
            if r == 1 && c == 1 { return 0.35 + 0.35 * sin(local * 2 * .pi) }
            let angle = atan2(Double(r) - 1, Double(c) - 1)          // -π…π
            let pointer = local * 2 * .pi - .pi                       // -π…π
            var d = abs(angle - pointer)
            if d > .pi { d = 2 * .pi - d }                            // wrap
            return gauss(d / .pi, 0.16)
        }
    }

    private func gauss(_ x: Double, _ sigma: Double) -> Double {
        exp(-(x * x) / (2 * sigma * sigma))
    }
}

// MARK: - Thinking verbs

/// The status-line text for the polling state. Each verb holds for ~two shimmer
/// cycles (`dwellSeconds`) before switching, so the line reads calmly. When a live
/// `label` is supplied (the humanized current tool from the run metadata) it shows
/// that (throttled to the same dwell so rapid tool changes don't flicker); with no
/// label it falls back to a curated cosmetic verb cycle.
struct ThinkingVerbs: View {
    var accent: Color
    /// The live tool label; nil → cycle the cosmetic verbs below.
    var label: String? = nil

    private static let verbs = [
        "Reading the slate",
        "Scanning the lines",
        "Crunching the model",
        "Weighing the edges",
        "Checking the public",
        "Pricing the value",
        "Cross-referencing odds",
        "Stress-testing picks",
        "Reasoning it through",
        "Locking it in"
    ]
    /// ~2 shimmer cycles (the shimmer runs a 1.4s linear loop).
    private static let dwellSeconds: Double = 2.8

    /// The word actually on screen; only advances on the dwell tick.
    @State private var displayed = ""
    /// Mirror of `label` in @State so the long-running task reads the LATEST value
    /// (a plain captured `var` would be stale across re-renders).
    @State private var liveLabel: String? = nil
    @State private var index = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .leading) {
            verbView(displayed)
                .id(displayed)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .offset(y: 8)),
                    removal: .opacity.combined(with: .offset(y: -8))
                ))
        }
        .frame(height: 20, alignment: .leading)
        .clipped()
        .animation(.easeInOut(duration: 0.42), value: displayed)
        .onAppear {
            liveLabel = label
            displayed = label ?? Self.verbs[0]
        }
        .onChange(of: label) { _, new in liveLabel = new }
        .task(id: reduceMotion) {
            guard !reduceMotion else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(Self.dwellSeconds * 1_000_000_000))
                if Task.isCancelled { return }
                if liveLabel == nil { index += 1 }
                displayed = liveLabel ?? Self.verbs[index % Self.verbs.count]
            }
        }
    }

    private func verbView(_ word: String) -> some View {
        ZStack(alignment: .leading) {
            Text(word)
                .foregroundStyle(kGenerationOrange)
            // White copy masked to the shimmer band = a glint sweeping the word.
            Text(word)
                .foregroundStyle(.white.opacity(0.55))
                .shimmering()
                .blendMode(.plusLighter)
                .allowsHitTesting(false)
        }
        .font(.system(size: 14, weight: .bold))
        .lineLimit(1)
    }
}

// MARK: - Elapsed timer

/// Elapsed-time counter for a live generation — counts up in `00.0s`. Plain
/// monospaced text updated on a slow tick (no `.numericText` content transition —
/// that re-renders + animates every digit change and is needless CPU for a
/// timer). Resets each time it appears (once per run).
private struct ElapsedTimerText: View {
    var color: Color

    @State private var start = Date()
    @State private var elapsed: Double = 0
    // 0.2s cadence: smooth enough for a tenths readout, ~5 updates/sec.
    private let tick = Timer.publish(every: 0.2, on: .main, in: .common).autoconnect()

    var body: some View {
        Text(String(format: "%04.1fs", elapsed))
            .font(.system(size: 13, weight: .heavy, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(color)
            .onAppear { start = Date(); elapsed = 0 }
            .onReceive(tick) { now in
                elapsed = now.timeIntervalSince(start)
            }
    }
}

// MARK: - Pixel pulse waves (polling background)

/// The polling background: a dense pixel grid whose brightness pulses in vertical
/// bands that travel RIGHT → LEFT, so the whole card reads as an energetic field
/// of "signal" washing across behind the content. Progress is shown by the pixel
/// loading bar now, so this is pure ambiance (no left→right fill).
struct PixelPulseWaves: View {
    var accent: Color

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let spacing: CGFloat = 9
    private let dot: CGFloat = 4

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                guard size.width > 0, size.height > 0 else { return }
                let cols = max(1, Int(size.width / spacing))
                let rows = max(1, Int(size.height / spacing))
                let cellW = size.width / CGFloat(cols)
                let cellH = size.height / CGFloat(rows)
                for y in 0..<rows {
                    let py = (CGFloat(y) + 0.5) * cellH
                    for x in 0..<cols {
                        let px = (CGFloat(x) + 0.5) * cellW
                        let op = cellOpacity(x: x, y: y, t: t)
                        if op < 0.012 { continue }
                        let rect = CGRect(x: px - dot / 2, y: py - dot / 2, width: dot, height: dot)
                        let path = Path(roundedRect: rect, cornerRadius: dot * 0.3, style: .continuous)
                        ctx.fill(path, with: .color(accent.opacity(op)))
                    }
                }
            }
        }
        .background(Color(hex: 0x070A0A).opacity(0.65))
        .allowsHitTesting(false)
    }

    /// Per-cell opacity — a leftward-travelling band (`+ t` phase moves the crest
    /// left) plus a small per-cell twinkle. Pulled out of the `Canvas` closure so
    /// the mixed CGFloat/Double math stays within the type-checker's budget.
    private func cellOpacity(x: Int, y: Int, t: Double) -> Double {
        // A wide band across the columns; adding `t` slides the crest right→left.
        let band = 0.5 + 0.5 * sin(Double(x) * 0.5 + Double(y) * 0.12 + t * 1.7)
        let twinkle = 0.5 + 0.5 * sin(t * 2.4 + Double(x) * 0.3 + Double(y) * 0.8)
        let op = 0.06 + 0.34 * (band * band) + 0.05 * twinkle
        return min(0.7, op)
    }
}

#if DEBUG
#Preview("Generation card") {
    struct Demo: View {
        @State private var generating = false
        var body: some View {
            ZStack {
                Color(hex: 0x0B1011).ignoresSafeArea()
                VStack(spacing: 16) {
                    AgentGenerationCard(
                        spriteIndex: 2,
                        accent: Color(hex: 0x6366F1),
                        state: nil,
                        isGenerating: generating,
                        canGenerate: true,
                        lockedLabel: "Daily limit reached",
                        onGenerate: { generating = true }
                    )
                    Button(generating ? "Reset" : "Start") { generating.toggle() }
                        .foregroundStyle(.white)
                }
                .padding(16)
            }
            .preferredColorScheme(.dark)
        }
    }
    return Demo()
}
#endif
