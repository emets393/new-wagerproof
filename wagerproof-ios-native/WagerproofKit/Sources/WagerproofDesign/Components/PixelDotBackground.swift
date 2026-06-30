import SwiftUI

/// A library of programmed, time-driven brightness fields for
/// `PixelDotBackground`. Each case is a pure function of a normalized cell
/// coordinate `(u, v)` in `0...1` plus elapsed `time`, returning an intensity
/// in `0...1`. The engine maps that intensity onto every dot's opacity, scale,
/// and brand-color bloom — so adding a new animation is just adding a case here.
public enum PixelDotAnimation: String, CaseIterable, Sendable {
    /// Slow, large-scale plasma drift. Calm and premium — the default for the
    /// auth gate. Reads as a field of pixels gently breathing in and out.
    case aurora
    /// A bright diagonal ridge that travels across the grid on repeat.
    case wave
    /// Concentric rings expanding from the center, fading with distance.
    case ripple
    /// Per-column "data rain" — bright heads fall with a trailing comet tail.
    case rain
    /// Sparse per-dot shimmer — pixels flicker on their own random phase.
    case twinkle
    /// Layered-sine plasma — denser, faster interference than `aurora`.
    case flow
    /// A single glowing horizontal bar that sweeps top to bottom.
    case scan

    /// Intensity (0...1) for the cell at normalized position `(u, v)` at the
    /// given `time` (seconds, already scaled by the engine's `speed`). `index`
    /// is the cell's flat grid index, used by the stochastic animations
    /// (`rain`, `twinkle`) to give each dot/column a stable random phase.
    func intensity(u: Double, v: Double, index: Int, time t: Double) -> Double {
        switch self {
        case .aurora:
            // Three low-frequency waves on different axes, averaged then
            // contrast-curved. Low frequencies = big soft blobs that drift.
            let a = sin(u * 2.6 + t * 0.16)
            let b = cos(v * 2.1 - t * 0.12)
            let c = sin((u + v) * 1.7 + t * 0.20)
            let n = (a + b + c) / 3.0          // -1...1
            return PixelMath.smoothstep(0.05, 0.9, n * 0.5 + 0.5)

        case .wave:
            // A traveling diagonal ridge. The dot product (u,v)·(0.7,0.3)
            // tilts the wavefront; subtracting t scrolls it.
            let phase = (u * 0.72 + v * 0.28) * 7.0 - t * 1.5
            return PixelMath.smoothstep(0.45, 1.0, sin(phase))

        case .ripple:
            let d = hypot(u - 0.5, v - 0.5)
            let ring = sin(d * 26.0 - t * 2.4)
            // Fade rings out toward the corners so it reads as emanating.
            return PixelMath.smoothstep(0.35, 1.0, ring) * (1.0 - PixelMath.smoothstep(0.0, 0.75, d))

        case .rain:
            // Each column gets a stable random fall speed + phase. The lit
            // segment is the head plus a tail above it (smaller v).
            let col = Double(index &* 2_654_435_761 & 0xFFFF)
            let seed = PixelMath.hash01(Int(col))
            let head = PixelMath.fract(t * (0.10 + seed * 0.22) + seed)
            let tail = 0.26
            let behind = head - v                 // >0 when the dot is above the head
            if behind >= -0.015 && behind <= tail {
                return max(0.0, 1.0 - behind / tail)
            }
            return 0.0

        case .twinkle:
            let phase = PixelMath.hash01(index &* 97 &+ 13) * 6.2831853
            let s = 0.5 + 0.5 * sin(t * 1.7 + phase)
            return pow(s, 3.0)                     // sharpen so most dots stay dim

        case .flow:
            let p = sin(u * 7.0 + t * 0.6)
                + sin(v * 6.0 - t * 0.5)
                + sin((u + v) * 5.0 + t * 0.45)
                + sin(hypot(u - 0.5, v - 0.5) * 12.0 - t * 0.8)
            return PixelMath.smoothstep(0.15, 0.95, p / 4.0 * 0.5 + 0.5)

        case .scan:
            let pos = PixelMath.fract(t * 0.11)
            let d = abs(v - pos)
            return max(0.0, 1.0 - d * 8.0)
        }
    }
}

/// A reusable, animated field of pixel-style dots driven by a programmable
/// brightness function (see `PixelDotAnimation`).
///
/// Why `Canvas` + `TimelineView` rather than per-dot SwiftUI `View`s: the old
/// implementation animated a handful of hardcoded `RoundedRectangle` views as
/// three globally-wobbling layers, which looked coarse and couldn't scale to a
/// real grid. A single `Canvas` redrawn each frame against a continuous time
/// source renders hundreds of dots smoothly on the GPU, and lets every dot's
/// brightness/scale/color be computed independently — which is what makes the
/// programmed animations possible.
public struct PixelDotBackground: View {
    private let animation: PixelDotAnimation
    private let baseColor: Color
    /// Color that the brightest dots bloom toward. `nil` = monochrome field.
    private let accentColor: Color?
    private let spacing: CGFloat
    private let dotSize: CGFloat
    private let baseOpacity: Double
    private let peakOpacity: Double
    private let speed: Double
    private let edgeFade: Bool
    private let isPaused: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        animation: PixelDotAnimation = .aurora,
        baseColor: Color = .white,
        accentColor: Color? = .appPrimary,
        spacing: CGFloat = 26,
        dotSize: CGFloat = 5.5,
        baseOpacity: Double = 0.05,
        peakOpacity: Double = 0.5,
        speed: Double = 1.0,
        edgeFade: Bool = true,
        isPaused: Bool = false
    ) {
        self.animation = animation
        self.baseColor = baseColor
        self.accentColor = accentColor
        self.spacing = spacing
        self.dotSize = dotSize
        self.baseOpacity = baseOpacity
        self.peakOpacity = peakOpacity
        self.speed = speed
        self.edgeFade = edgeFade
        self.isPaused = isPaused
    }

    public var body: some View {
        // Reduce Motion (or an explicit pause) freezes the field: TimelineView
        // still renders one static frame, so the pixel pattern stays visible —
        // it just stops drifting.
        let frozen = isPaused || reduceMotion

        TimelineView(.animation(paused: frozen)) { timeline in
            Canvas(opaque: false, rendersAsynchronously: false) { context, size in
                // Absolute reference-date time keeps the phase continuous across
                // redraws without tracking a start date in @State.
                let t = timeline.date.timeIntervalSinceReferenceDate * speed
                draw(into: &context, size: size, time: t)
            }
        }
        .allowsHitTesting(false)
        .drawingGroup(opaque: false)
    }

    private func draw(into context: inout GraphicsContext, size: CGSize, time t: Double) {
        guard size.width > 0, size.height > 0, spacing > 0 else { return }

        // +1 so the grid covers the full bounds; centered so edge gutters match.
        let cols = max(1, Int(size.width / spacing) + 1)
        let rows = max(1, Int(size.height / spacing) + 1)
        let originX = (size.width - CGFloat(cols - 1) * spacing) / 2
        let originY = (size.height - CGFloat(rows - 1) * spacing) / 2

        let colsDenom = Double(max(1, cols - 1))
        let rowsDenom = Double(max(1, rows - 1))
        let hasAccent = accentColor != nil

        var index = 0
        for r in 0..<rows {
            let v = Double(r) / rowsDenom
            let y = originY + CGFloat(r) * spacing
            for c in 0..<cols {
                let u = Double(c) / colsDenom
                let x = originX + CGFloat(c) * spacing

                var intensity = animation.intensity(u: u, v: v, index: index, time: t)
                index += 1
                if edgeFade { intensity *= edgeFalloff(u: u, v: v) }

                let opacity = baseOpacity + (peakOpacity - baseOpacity) * intensity
                if opacity < 0.012 { continue }   // skip imperceptible dots

                // Brighter dots grow slightly — gives the field depth/pop.
                let s = dotSize * (0.82 + 0.34 * intensity)
                let rect = CGRect(x: x - s / 2, y: y - s / 2, width: s, height: s)
                let path = Path(roundedRect: rect, cornerRadius: s * 0.32, style: .continuous)

                // Only the hottest dots take on the brand accent (intensity²
                // keeps the field mostly neutral with green just at the peaks).
                let fill: Color
                if hasAccent, let accent = accentColor {
                    fill = baseColor.mix(with: accent, by: min(1.0, intensity * intensity * 1.3))
                } else {
                    fill = baseColor
                }
                context.fill(path, with: .color(fill.opacity(opacity)))
            }
        }
    }

    /// Smooth four-edge vignette so the grid fades out at the bounds instead of
    /// terminating on a hard rectangular cut.
    private func edgeFalloff(u: Double, v: Double) -> Double {
        let fx = PixelMath.smoothstep(0, 0.12, u) * PixelMath.smoothstep(0, 0.12, 1 - u)
        let fy = PixelMath.smoothstep(0, 0.10, v) * PixelMath.smoothstep(0, 0.10, 1 - v)
        return fx * fy
    }
}

/// Small math helpers shared by the animation functions. Kept free of state so
/// they stay trivially testable and `Sendable`.
private enum PixelMath {
    /// Hermite smoothstep — eases `x` from 0 to 1 across `[a, b]`.
    static func smoothstep(_ a: Double, _ b: Double, _ x: Double) -> Double {
        guard b != a else { return x < a ? 0 : 1 }
        let t = min(1, max(0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    }

    /// Fractional part, always in `0..<1` (handles negatives).
    static func fract(_ x: Double) -> Double {
        x - floor(x)
    }

    /// Deterministic pseudo-random hash in `0..<1` from an integer seed.
    static func hash01(_ n: Int) -> Double {
        let x = sin(Double(n) * 12.9898) * 43_758.5453
        return x - floor(x)
    }
}

#Preview("Animations") {
    struct Showcase: View {
        @State private var animation: PixelDotAnimation = .aurora
        var body: some View {
            ZStack {
                Color(hex: 0x111111).ignoresSafeArea()
                PixelDotBackground(animation: animation)
                    .ignoresSafeArea()
                VStack {
                    Spacer()
                    Picker("Animation", selection: $animation) {
                        ForEach(PixelDotAnimation.allCases, id: \.self) { a in
                            Text(a.rawValue.capitalized).tag(a)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding()
                }
            }
            .preferredColorScheme(.dark)
        }
    }
    return Showcase()
}
