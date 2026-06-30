import SwiftUI

/// An observable command channel for spawning tap-style ripples in a
/// `PixelGlyphField` from OUTSIDE the field. The field installs its own tap
/// gesture for ambient ripples; this lets a foreground view inject one
/// programmatically — e.g. tapping the agent avatar ripples the background
/// pixels behind it (an easter egg on the agent detail hero).
///
/// `point` is in the field's OWN coordinate space. A screen-anchored field
/// (`PixelWaveBackground(screenAnchored:)`) draws at global (0,0) sized to the
/// full screen, so a GLOBAL screen point maps 1:1 — pass the tapped view's
/// global center (`frame(in: .global)` midpoint).
@MainActor
@Observable
public final class GlyphRippleEmitter {
    public struct Pulse: Equatable {
        public var point: CGPoint
        /// Monotonic id so two ripples at the same point still read as distinct
        /// events (a plain point wouldn't trip `.onChange` on a repeat tap).
        public var token: Int
    }

    public private(set) var pulse = Pulse(point: .zero, token: 0)

    public init() {}

    /// Spawn a ripple centered on `point` (field-local / screen-anchored-global).
    public func emit(at point: CGPoint) {
        pulse = Pulse(point: point, token: pulse.token + 1)
    }
}

/// A stepped, organic field of small pixel "glyphs" that bloom and dissipate
/// like bacteria colonies or cloud poofs.
///
/// How it differs from `PixelDotBackground`: that engine is a *stateless* field
/// — each frame is a pure function of time, so it drifts smoothly forever. A
/// spreading/decaying colony instead needs *state that evolves in discrete
/// steps*. This view runs a small reaction-diffusion cellular automaton over the
/// dot grid. Designed seed "glyphs" are periodically stamped onto the grid; the
/// automaton grows them outward a little, hollows out saturated cores, and
/// erodes them with ambient decay — so each glyph stays small and focused, then
/// poofs away.
///
/// Cadence: the step interval cycles through `intervals` (a single, consistent
/// 150ms step by default; pass multiple values for an irregular heartbeat). The
/// display eases previous→current across the full gap to the next step, so
/// motion is continuous and smooth — no hold or pause between refreshes.
///
/// Only lit cells are drawn — the empty grid is never rendered, so the field
/// reads as a few scattered clusters on black rather than a full dot matrix.
public struct PixelGlyphField: View {
    private let intervals: [TimeInterval]
    private let baseColor: Color
    private let accentColor: Color?
    private let spacing: CGFloat
    private let dotSize: CGFloat
    private let peakOpacity: Double
    /// Optional external trigger so another view can ripple this field (see
    /// `GlyphRippleEmitter`). Nil for fields that only ripple on direct taps.
    private let rippleEmitter: GlyphRippleEmitter?

    @State private var sim = GlyphAutomaton()
    /// Reference time of the most recent simulation step — drives the brief
    /// previous→current "pop" so each tick eases in.
    @State private var lastStep: Date = .distantPast
    /// Duration of the gap until the next step. The crossfade spans this whole
    /// window so motion stays continuous — no hold or pause between steps.
    @State private var stepGap: TimeInterval = 0.3
    /// Active tap ripples — transient expanding rings of brightness layered on
    /// top of the automaton when the user taps the field.
    @State private var ripples: [Ripple] = []

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Ripple {
        let origin: CGPoint
        let start: Date
    }

    // Tap-ripple tuning.
    private let rippleDuration: TimeInterval = 1.5
    private let rippleSpeed: Double = 430          // ring expansion, points / second
    private let rippleRingWidth: Double = 26       // ring softness, points
    private let ripplePeakOpacity: Double = 0.72   // ripple cells out-shine ambient

    /// `intervals` is the cadence pattern, cycled in order. A single value (the
    /// default 0.15s) gives a steady beat; multiple values vary it.
    public init(
        intervals: [TimeInterval] = [0.15],
        baseColor: Color = .white,
        accentColor: Color? = .appPrimary,
        spacing: CGFloat = 26,
        dotSize: CGFloat = 5.5,
        peakOpacity: Double = 0.45,
        rippleEmitter: GlyphRippleEmitter? = nil
    ) {
        self.intervals = intervals.isEmpty ? [0.3] : intervals
        self.baseColor = baseColor
        self.accentColor = accentColor
        self.spacing = spacing
        self.dotSize = dotSize
        self.peakOpacity = peakOpacity
        self.rippleEmitter = rippleEmitter
    }

    public var body: some View {
        let frozen = reduceMotion

        GeometryReader { proxy in
            TimelineView(.animation(paused: frozen)) { timeline in
                Canvas(opaque: false, rendersAsynchronously: false) { context, size in
                    draw(into: &context, size: size, now: timeline.date)
                }
            }
            // Build (or rebuild) the grid whenever the available size changes —
            // `initial: true` seeds it on first appear.
            .onChange(of: proxy.size, initial: true) { _, newSize in
                let cols = max(2, Int((newSize.width / spacing).rounded()))
                let rows = max(2, Int((newSize.height / spacing).rounded()))
                sim.configure(cols: cols, rows: rows)
                lastStep = .now
            }
            // Stepping loop. Alternates slow/fast intervals for the irregular
            // cadence. Restarts if Reduce Motion toggles (id: frozen); when
            // frozen it returns immediately and the field holds its last state.
            .task(id: frozen) {
                guard !frozen else { return }
                var idx = 0
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(intervals[idx]))
                    if Task.isCancelled { return }
                    sim.step()
                    lastStep = .now
                    idx = (idx + 1) % intervals.count
                    // Crossfade window = time until the NEXT step, so the ease
                    // fills the whole gap and the field never sits still.
                    stepGap = intervals[idx]
                }
            }
        }
        // Capture taps anywhere in the field to spawn a ripple. The field sits
        // behind the foreground content, so buttons/links still receive their
        // taps first; only taps that fall through to empty areas ripple.
        .contentShape(Rectangle())
        .onTapGesture { location in
            addRipple(at: location)
        }
        // External ripples (e.g. tapping the agent avatar). Bypasses hit testing,
        // so it still fires when the field itself is inert (`allowsHitTesting`
        // off behind a scroll). The pulse point is in this field's space.
        .onChange(of: rippleEmitter?.pulse) { _, newPulse in
            if let p = newPulse, p.token > 0 { addRipple(at: p.point) }
        }
    }

    /// Spawn a ripple at `location`, pruning any that have already faded out.
    private func addRipple(at location: CGPoint) {
        guard !reduceMotion else { return }
        let cutoff = Date(timeIntervalSinceNow: -rippleDuration)
        var active = ripples.filter { $0.start > cutoff }
        active.append(Ripple(origin: location, start: .now))
        if active.count > 8 { active.removeFirst(active.count - 8) }
        ripples = active
    }

    /// Combined brightness (0...1) from all active ripples for a cell at
    /// (px, py): each ripple is a soft expanding ring that fades with age.
    private func rippleLevel(px: CGFloat, py: CGFloat, now: Date) -> Double {
        if ripples.isEmpty { return 0 }
        var level = 0.0
        for ripple in ripples {
            let age = ripple.start.distance(to: now)
            if age < 0 || age > rippleDuration { continue }
            let radius = age * rippleSpeed
            let dx = Double(px - ripple.origin.x)
            let dy = Double(py - ripple.origin.y)
            let delta = (dx * dx + dy * dy).squareRoot() - radius
            let ring = exp(-(delta * delta) / (2 * rippleRingWidth * rippleRingWidth))
            let fade = 1 - age / rippleDuration
            level = max(level, ring * fade)
        }
        return level
    }

    private func draw(into context: inout GraphicsContext, size: CGSize, now: Date) {
        guard size.width > 0, size.height > 0, sim.cols > 0, sim.rows > 0 else { return }

        let cols = sim.cols
        let rows = sim.rows
        // Edge-to-edge: tile the full bounds and center each dot in its cell, so
        // dots span corner to corner with no dummy border gutter.
        let cellW = size.width / CGFloat(cols)
        let cellH = size.height / CGFloat(rows)
        let hasAccent = accentColor != nil

        // Crossfade spans the FULL gap to the next step (no hold), so the field
        // animates continuously. smoothstep has zero velocity at both ends, so
        // consecutive steps meet seamlessly with no visible snap.
        let window = max(0.0001, stepGap)
        let elapsed = lastStep.distance(to: now)
        let raw = min(1.0, max(0.0, elapsed / window))
        let fraction = raw * raw * (3 - 2 * raw)   // smoothstep ease

        for y in 0..<rows {
            let py = (CGFloat(y) + 0.5) * cellH
            for x in 0..<cols {
                let i = y * cols + x
                let px = (CGFloat(x) + 0.5) * cellW
                let auto = sim.value(at: i, fraction: fraction)
                let rip = rippleLevel(px: px, py: py, now: now)
                let intensity = max(auto, rip)
                // Only lit cells are drawn. Ripple cells out-shine the ambient
                // field so the user's tap reads clearly.
                let opacity = max(peakOpacity * auto, ripplePeakOpacity * rip)
                if opacity < 0.012 { continue }

                let s = dotSize * (0.82 + 0.4 * intensity)
                let rect = CGRect(x: px - s / 2, y: py - s / 2, width: s, height: s)
                let path = Path(roundedRect: rect, cornerRadius: s * 0.32, style: .continuous)

                let fill: Color
                if hasAccent, let accent = accentColor {
                    fill = baseColor.mix(with: accent, by: min(1.0, intensity * intensity * 1.2))
                } else {
                    fill = baseColor
                }
                context.fill(path, with: .color(fill.opacity(opacity)))
            }
        }
    }
}

// MARK: - Automaton

/// The stateful reaction-diffusion grid behind `PixelGlyphField`. Held in
/// `@State` as a value type — `step()` recomputes the whole grid every tick,
/// which is trivial at this resolution (~700 cells × 8 neighbors at ≤4 Hz).
private struct GlyphAutomaton {
    private(set) var cols = 0
    private(set) var rows = 0

    /// Current grid (the step just computed) and the prior grid, kept so the
    /// view can pop previous→current within a tick.
    private var current: [Double] = []
    private var previous: [Double] = []
    private var rng = SeededGenerator(seed: 0x5EED_1234)

    // --- Reaction-diffusion tuning -----------------------------------------
    // Tuned so glyphs stay SMALL and FOCUSED: low spread + high ambient decay
    // means a stamped glyph bleeds out only a cell or two before poofing away,
    // rather than growing into a screen-filling colony.
    //   survival  — how much of a cell's own value carries to the next step
    //   spread    — gain pulled in from each lit neighbor (kept low → tight)
    //   crowd     — neighbor-sum above which a cell is "saturated"…
    //   coreDecay — …and gets suppressed, hollowing filled cores → poof
    //   ambient   — flat erosion each step (high → fast dissipation)
    private let survival = 0.5
    private let spread = 0.1
    private let crowd = 2.2
    private let coreDecay = 0.32
    private let ambient = 0.05
    /// How many fresh glyphs to stamp per step (kept low so the field stays a
    /// few scattered clusters, not a busy screen).
    private let stampsPerStep = 1
    /// Extra chance for a second glyph, for a little variation in density.
    private let secondStampChance = 0.4
    /// If total energy drops below this, force-seed so it never goes dark.
    private let lowEnergy = 2.5

    mutating func configure(cols: Int, rows: Int) {
        self.cols = max(1, cols)
        self.rows = max(1, rows)
        current = Array(repeating: 0, count: self.cols * self.rows)
        previous = current
        // Seed a few colonies and pre-warm a little so the field opens with a
        // handful of small clusters already mid-bloom.
        for _ in 0..<4 { stampRandomGlyph() }
        for _ in 0..<3 { step(allowStamp: false) }
    }

    /// Eased value for cell `i`, interpolating previous→current by `fraction`.
    func value(at i: Int, fraction: Double) -> Double {
        guard i >= 0, i < current.count else { return 0 }
        let p = i < previous.count ? previous[i] : 0
        return p + (current[i] - p) * fraction
    }

    mutating func step(allowStamp: Bool = true) {
        guard cols > 0, rows > 0 else { return }
        previous = current
        var next = [Double](repeating: 0, count: current.count)

        for y in 0..<rows {
            for x in 0..<cols {
                let i = y * cols + x
                let v = current[i]

                // 8-neighbor (Moore) sum → rounder colonies than 4-neighbor.
                var n = 0.0
                for dy in -1...1 {
                    let ny = y + dy
                    if ny < 0 || ny >= rows { continue }
                    for dx in -1...1 where !(dx == 0 && dy == 0) {
                        let nx = x + dx
                        if nx < 0 || nx >= cols { continue }
                        n += current[ny * cols + nx]
                    }
                }

                var nv = v * survival + n * spread
                if n > crowd { nv *= coreDecay }   // saturated core → hollow out
                nv -= ambient
                next[i] = min(1.0, max(0.0, nv))
            }
        }
        current = next

        guard allowStamp else { return }
        for _ in 0..<stampsPerStep { stampRandomGlyph() }
        if Double.random(in: 0..<1, using: &rng) < secondStampChance {
            stampRandomGlyph()
        }
        if totalEnergy() < lowEnergy {
            stampRandomGlyph()
            stampRandomGlyph()
        }
    }

    private func totalEnergy() -> Double {
        current.reduce(0, +)
    }

    /// Stamp one randomly-chosen seed glyph at a random location, taking the max
    /// with whatever's already there (so it ignites a colony).
    private mutating func stampRandomGlyph() {
        guard cols > 1, rows > 1 else { return }
        let glyph = Self.glyphs.randomElement(using: &rng) ?? [(0, 0)]
        // Stamp anywhere across the full grid (edge to edge) — glyphs near the
        // edges are fine and wanted.
        let cx = Int.random(in: 0..<cols, using: &rng)
        let cy = Int.random(in: 0..<rows, using: &rng)
        for (dx, dy) in glyph {
            let x = cx + dx, y = cy + dy
            guard x >= 0, x < cols, y >= 0, y < rows else { continue }
            let i = y * cols + x
            current[i] = max(current[i], 1.0)
        }
    }

    /// The designed seed glyphs — small (≤3×3) so colonies stay focused. Each is
    /// a set of (dx, dy) offsets from a center cell; the automaton blooms each
    /// into a small organic cluster. Variety here keeps the shapes distinct.
    private static let glyphs: [[(Int, Int)]] = [
        // single spore
        [(0, 0)],
        // plus
        [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)],
        // hollow ring (3×3 minus center)
        [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)],
        // diagonal slash
        [(-1, -1), (0, 0), (1, 1)],
        // X
        [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
        // T
        [(-1, -1), (0, -1), (1, -1), (0, 0), (0, 1)],
        // 2×2 blob
        [(0, 0), (1, 0), (0, 1), (1, 1)],
        // little pair
        [(0, 0), (1, 0)],
        // L corner
        [(0, -1), (0, 0), (1, 0)],
        // diamond
        [(0, -1), (-1, 0), (1, 0), (0, 1)],
        // chevron up
        [(-1, 0), (0, -1), (1, 0)],
        // chevron down
        [(-1, 0), (0, 1), (1, 0)],
        // vertical bar
        [(0, -1), (0, 0), (0, 1)],
        // horizontal bar
        [(-1, 0), (0, 0), (1, 0)],
        // triangle
        [(0, -1), (-1, 1), (1, 1)],
        // twin verticals (gap)
        [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 0), (1, 1)],
        // staircase
        [(-1, 1), (0, 0), (1, -1), (0, 1)],
        // spaced trio
        [(-2, 0), (0, 0), (2, 0)],
        // arrowhead
        [(0, -1), (-1, 0), (1, 0), (0, 0), (0, 1)],
        // scattered cluster
        [(-1, -1), (1, 0), (0, 1), (2, 1)],
    ]
}

/// Deterministic PRNG so the field is reproducible and `Sendable`-clean.
/// xorshift64* — fast, decent distribution for visual seeding.
private struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed != 0 ? seed : 0x9E37_79B9_7F4A_7C15
    }

    mutating func next() -> UInt64 {
        state ^= state >> 12
        state ^= state << 25
        state ^= state >> 27
        return state &* 0x2545_F491_4F6C_DD1D
    }
}

#Preview("Glyph field") {
    ZStack {
        Color.black.ignoresSafeArea()
        PixelGlyphField()
            .ignoresSafeArea()
    }
    .preferredColorScheme(.dark)
}
