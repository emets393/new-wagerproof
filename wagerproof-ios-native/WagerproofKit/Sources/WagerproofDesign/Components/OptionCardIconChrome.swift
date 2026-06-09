import SwiftUI

/// Drifting SF Symbol chrome that sits behind Honeydew-style option card
/// content. Verbatim port of Honeydew's
/// `Honeydew/Features/RecipeImport/AddRecipeBottomSheet.swift:1265-1338`.
///
/// Motion model:
///   • Even phase spacing inside one cycle period — freezing the loop at
///     any moment yields a uniformly-spaced ladder of icons.
///   • Travel from `cycleStart = 1.05` to `cycleEnd = 0.45` (right ~55% of
///     the card).
///   • Dual fade: 0.50–0.60 left ("pieces break off and dissolve"),
///     0.94–1.00 right ("materialize inside the card edge").
///   • Per-card `seed`, `speedFactor`, `yJitter` so multiple cards in the
///     same view never animate in lockstep.
///
/// Icons render in `primaryColor` at lane-specific opacity so they read as
/// deeper-toned silhouettes against the pale trailing-gradient stop. The
/// same-hue fade overlay drawn by the parent card sits on top of this view
/// and absorbs anything past x ≈ 0.50.
///
/// Takes only primitives — no `@Environment`, no captured `self`. iOS 26's
/// view graph crashes if a per-frame TimelineView reads an env value whose
/// host has gone away (Honeydew hit this on sheet → push transitions), so
/// staying primitives-only keeps the chrome safe during teardown.
public struct OptionCardIconChrome: View {
    public let primaryColor: Color
    public let symbols: [String]
    public let seed: Double
    public let speedFactor: Double
    public let yJitter: CGFloat
    public let motionEnabled: Bool

    public init(
        primaryColor: Color,
        symbols: [String],
        seed: Double,
        speedFactor: Double,
        yJitter: CGFloat,
        motionEnabled: Bool
    ) {
        self.primaryColor = primaryColor
        self.symbols = symbols
        self.seed = seed
        self.speedFactor = speedFactor
        self.yJitter = yJitter
        self.motionEnabled = motionEnabled
    }

    public var body: some View {
        Group {
            if motionEnabled {
                // 30Hz is enough for slow drift and roughly halves the
                // per-frame cost vs. the default ~60Hz.
                TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
                    iconLayer(at: context.date.timeIntervalSinceReferenceDate)
                }
            } else {
                // Motion disabled (Reduce Motion ON). Render the same math
                // at a fixed time so the card still has its evenly-spaced
                // icon ladder, just frozen.
                iconLayer(at: 0)
            }
        }
        .allowsHitTesting(false)
    }

    @ViewBuilder
    private func iconLayer(at t: Double) -> some View {
        // (yBase, bob, bobSpeed, rotation, size, baseOpacity)
        let lanes: [(yBase: CGFloat, bob: CGFloat, bobSpeed: Double,
                     rotation: Double, size: CGFloat, baseOpacity: Double)] = [
            (0.16, 0.04, 0.60, -14, 18, 0.72),
            (0.78, 0.05, 0.45,  22, 23, 0.78),
            (0.32, 0.03, 0.72,  -8, 21, 0.76),
            (0.92, 0.04, 0.55,   6, 16, 0.74),
            (0.20, 0.05, 0.80,  18, 25, 0.82),
            (0.62, 0.03, 0.50, -26, 18, 0.80),
            (0.38, 0.04, 0.68,  10, 21, 0.80),
            (0.85, 0.05, 0.88, -14, 23, 0.85),
            (0.50, 0.03, 0.78,   4, 16, 0.75),
            (0.55, 0.04, 0.62, -32, 14, 0.70),
        ]
        let cycleStart: CGFloat = 1.05
        let cycleEnd: CGFloat = 0.45
        let baseSpeed: Double = 0.040

        GeometryReader { proxy in
            ForEach(0..<min(lanes.count, symbols.count), id: \.self) { i in
                let lane = lanes[i]
                let effectiveSpeed = baseSpeed * speedFactor
                let lanePhase = Double(i) / Double(lanes.count) + seed
                let cycle = ((t * effectiveSpeed) + lanePhase)
                    .truncatingRemainder(dividingBy: 1.0)
                let x = cycleStart - CGFloat(cycle) * (cycleStart - cycleEnd)
                let yBob = lane.bob * CGFloat(sin(t * lane.bobSpeed + lanePhase * .pi * 2))
                let yUnclamped = lane.yBase + yJitter + yBob
                let y = min(max(yUnclamped, 0.08), 0.92)
                let xd = Double(x)
                let leftFade = max(0.0, min(1.0, (xd - 0.50) / 0.10))
                let rightFade = max(0.0, min(1.0, (1.00 - xd) / 0.06))
                let opacity = lane.baseOpacity * leftFade * rightFade

                Image(systemName: symbols[i])
                    .font(.system(size: lane.size, weight: .semibold))
                    .foregroundStyle(primaryColor.opacity(opacity))
                    .rotationEffect(.degrees(lane.rotation))
                    .position(
                        x: proxy.size.width * x,
                        y: proxy.size.height * y
                    )
            }
        }
    }
}
