import SwiftUI
import WagerproofDesign
import WagerproofServices

/// The container-less "agent is generating" treatment that replaces the old
/// terminal panel + `ThinkingAnimation`. Three signals layer up, none of them
/// boxed in a glass card:
///
///   1. A **dense pixel fill** behind everything (`DensePixelFill`) that floods
///      left→right as the run progresses — the pixels live in the BACKGROUND
///      now, not inside a thin bar.
///   2. A **3×3 glyph matrix** (`GlyphMatrix3x3`) of tiny dots that cycles
///      through diagonal / horizontal / spin animations, sitting to the left of…
///   3. …the **thinking verbs** (`ThinkingVerbs`) — a curated series that flips
///      in and out with a shimmer glint sweeping across each one.
///
///   Under the verbs sits a plain, real progress bar (`GenerationProgressBar`).
///
/// Progress comes from the Trigger.dev run metadata (`turn / maxTurns`), capped
/// below full until the run is terminal so it never reads "done" early.
struct AgentGeneratingView: View {
    let state: TriggerV3RunStatus?
    let accent: Color

    private var meta: TriggerV3RunMetadata? { state?.metadata }

    var body: some View {
        ZStack {
            DensePixelFill(fraction: fraction, accent: accent)

            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .center, spacing: 12) {
                    GlyphMatrix3x3(accent: accent)
                    ThinkingVerbs(accent: accent)
                    Spacer(minLength: 0)
                    if picksFound > 0 { picksChip }
                }
                GenerationProgressBar(fraction: fraction, accent: accent)
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(accent.opacity(0.18), lineWidth: 1)
        )
    }

    private var picksChip: some View {
        HStack(spacing: 4) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 10, weight: .bold))
            Text("\(picksFound) found").font(.system(size: 11, weight: .heavy))
        }
        .foregroundStyle(accent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Capsule().fill(accent.opacity(0.18)))
    }

    /// turn/maxTurns, capped below 1 until terminal; an indeterminate sliver
    /// before the first turn lands so the fill still reads as alive.
    private var fraction: CGFloat {
        if let s = state, s.isTerminal { return 1 }
        let turn = meta?.turn ?? 0
        let maxTurns = meta?.maxTurns ?? 0
        if maxTurns > 0 { return min(0.96, CGFloat(turn) / CGFloat(maxTurns)) }
        return turn > 0 ? 0.12 : 0.05
    }

    private var picksFound: Int { meta?.picksAccepted ?? 0 }
}

// MARK: - 3×3 glyph matrix

/// A tiny 3×3 dot matrix that cycles through three "glyphing" animations —
/// a diagonal sweep, a horizontal sweep, and a spin around the ring — each for
/// ~1.6s, looping. Rendered in a `Canvas` so the dots stay crisp at this size.
/// Used to the left of the thinking verbs as a living "the agent is working"
/// motif (a vector cousin of the pixelwave background's glyph field).
struct GlyphMatrix3x3: View {
    var accent: Color
    var dot: CGFloat = 4.5
    var gap: CGFloat = 5

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let modeDuration: Double = 1.6
    private var side: CGFloat { 3 * dot + 2 * gap }

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                let mode = Int((t / modeDuration).truncatingRemainder(dividingBy: 3))
                let local = (t.truncatingRemainder(dividingBy: modeDuration)) / modeDuration
                let cell = size.width / 3
                for r in 0..<3 {
                    for c in 0..<3 {
                        let b = brightness(mode: mode, r: r, c: c, local: local, t: t)
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
    private func brightness(mode: Int, r: Int, c: Int, local: Double, t: Double) -> Double {
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
            if r == 1 && c == 1 { return 0.35 + 0.35 * sin(t * 6) }
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

/// A curated series of "thinking" verbs that flips through one at a time, each
/// sliding in / out, with a shimmer glint sweeping across the active word. The
/// series is cosmetic (independent of the raw turn/tool counters users don't
/// care about) so it always animates smoothly even when run metadata is sparse.
struct ThinkingVerbs: View {
    var accent: Color

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

    @State private var index = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .leading) {
            verbView(Self.verbs[index % Self.verbs.count])
                .id(index)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .offset(y: 8)),
                    removal: .opacity.combined(with: .offset(y: -8))
                ))
        }
        .frame(height: 20, alignment: .leading)
        .clipped()
        .task {
            guard !reduceMotion else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_700_000_000)
                if Task.isCancelled { return }
                withAnimation(.easeInOut(duration: 0.42)) { index += 1 }
            }
        }
    }

    private func verbView(_ word: String) -> some View {
        ZStack(alignment: .leading) {
            Text(word)
                .foregroundStyle(Color.appTextPrimary)
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

// MARK: - Real progress bar

/// A plain, determinate progress bar (no pixels — those moved to the
/// background). Sits under the verbs / glyph matrix.
struct GenerationProgressBar: View {
    var fraction: CGFloat
    var accent: Color
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            let full = max(1, geo.size.width)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.10))
                Capsule()
                    .fill(accent)
                    .frame(width: max(height, full * fraction))
                    .overlay(alignment: .trailing) {
                        Capsule()
                            .fill(.white.opacity(0.5))
                            .frame(width: 2)
                            .blur(radius: 1)
                    }
                    .shadow(color: accent.opacity(0.6), radius: 4, x: 0, y: 0)
            }
            .animation(.easeInOut(duration: 0.5), value: fraction)
        }
        .frame(height: height)
    }
}

// MARK: - Dense pixel fill (background)

/// The background of the generating treatment: a DENSE grid of small pixels
/// that floods left→right as `fraction` grows, twinkling so it reads as alive.
/// Cells past the fill front render as faint ghosts, so the whole region looks
/// like a pixel-dense progress bar filling up behind the content.
struct DensePixelFill: View {
    var fraction: CGFloat
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
                let fillX = size.width * fraction
                for y in 0..<rows {
                    let py = (CGFloat(y) + 0.5) * cellH
                    for x in 0..<cols {
                        let px = (CGFloat(x) + 0.5) * cellW
                        let op = cellOpacity(x: x, y: y, px: px, fillX: fillX, t: t)
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

    /// Per-cell opacity, pulled out of the `Canvas` closure: inline, the mixed
    /// CGFloat/Double arithmetic blows past the SwiftUI type-checker's budget
    /// ("unable to type-check in reasonable time"). All math is in `Double`.
    private func cellOpacity(x: Int, y: Int, px: CGFloat, fillX: CGFloat, t: Double) -> Double {
        let twinkle = 0.5 + 0.5 * sin(t * 2.2 + Double(x) * 0.55 + Double(y) * 0.9)
        var op = 0.10 + 0.18 * twinkle
        // Soft brighten right at the advancing fill front.
        let edge = max(0.0, 1.0 - Double(abs(px - fillX)) / 24.0)
        op += 0.5 * edge
        // Unfilled cells past the front are faint ghosts.
        if px > fillX { op *= 0.12 }
        return min(0.95, op)
    }
}
