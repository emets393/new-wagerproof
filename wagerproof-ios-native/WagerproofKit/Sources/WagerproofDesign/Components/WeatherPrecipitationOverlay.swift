import SwiftUI

/// Weather-driven full-screen precipitation. Used by sports detail sheets
/// when the hero condition is rain or snow, and by the Secret Settings
/// tester so the effect can be reviewed without a live game.
public enum WeatherPrecipitationKind: String, CaseIterable, Sendable {
    case rain
    case snow

    /// Maps free-text weather fields (`wxIcon`, `wxSummary`, MLB `sky`) onto
    /// an overlay kind. Indoor / dome games never precipitate.
    ///
    /// Snow is checked before rain so codes like `snow-showers-day` become
    /// snow instead of matching `shower`.
    public static func from(
        icon: String? = nil,
        summary: String? = nil,
        sky: String? = nil,
        isIndoor: Bool = false
    ) -> WeatherPrecipitationKind? {
        if isIndoor { return nil }
        let key = [icon, summary, sky]
            .compactMap { $0?.lowercased() }
            .joined(separator: " ")
        guard !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        if key.contains("indoor") || key.contains("dome") { return nil }
        if key.contains("snow") || key.contains("sleet") || key.contains("flurr") { return .snow }
        if key.contains("rain") || key.contains("shower")
            || key.contains("thunder") || key.contains("storm") {
            return .rain
        }
        return nil
    }
}

/// Full-screen rain or snow drawn in a single `Canvas`, same engine as
/// `PixelDotBackground`. Particles are deterministic functions of index +
/// time — no per-drop `@State` — so the overlay stays cheap on a 120 Hz
/// sheet and does not steal hits from chips or scrolling.
public struct WeatherPrecipitationOverlay: View {
    private let kind: WeatherPrecipitationKind
    private let isPaused: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    public init(kind: WeatherPrecipitationKind, isPaused: Bool = false) {
        self.kind = kind
        self.isPaused = isPaused
    }

    public var body: some View {
        let frozen = isPaused || reduceMotion
        TimelineView(.animation(paused: frozen)) { timeline in
            Canvas(opaque: false, rendersAsynchronously: false) { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                switch kind {
                case .rain:
                    drawRain(into: &context, size: size, time: t)
                case .snow:
                    drawSnow(into: &context, size: size, time: t)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: - Rain

    /// Long faded streaks (bright head, transparent tail) so drops read as
    /// motion-blurred rain instead of short solid dashes.
    private func drawRain(into context: inout GraphicsContext, size: CGSize, time t: Double) {
        guard size.width > 0, size.height > 0 else { return }
        let tint = colorScheme == .dark
            ? Color(hex: 0xD6E8F5)
            : Color(hex: 0x4B6F94)
        // Distant sheet — denser, shorter, quieter.
        drawRainLayer(
            into: &context,
            size: size,
            time: t,
            count: 160,
            seed: 11,
            speedRange: 1.55...2.35,
            lengthRange: 28...52,
            widthRange: 0.55...0.95,
            opacityRange: 0.10...0.22,
            angle: 0.34,
            tint: tint
        )
        // Near sheet — fewer, longer, brighter heads.
        drawRainLayer(
            into: &context,
            size: size,
            time: t,
            count: 70,
            seed: 29,
            speedRange: 1.85...2.80,
            lengthRange: 46...78,
            widthRange: 0.85...1.35,
            opacityRange: 0.22...0.42,
            angle: 0.38,
            tint: tint
        )
    }

    private func drawRainLayer(
        into context: inout GraphicsContext,
        size: CGSize,
        time t: Double,
        count: Int,
        seed: Int,
        speedRange: ClosedRange<Double>,
        lengthRange: ClosedRange<CGFloat>,
        widthRange: ClosedRange<CGFloat>,
        opacityRange: ClosedRange<Double>,
        angle: CGFloat,
        tint: Color
    ) {
        // Extra travel so a streak fully enters and exits the screen.
        let travel = size.height + 160
        // Drops travel down-right. Spawn lanes far enough left that the
        // lower-left of the screen still has rain (otherwise the slant
        // leaves a clipped empty band on the leading edge).
        let slantPad = size.height * tan(angle + 0.10) + 80
        for i in 0..<count {
            let h1 = WeatherMath.hash01(i &* 2_654_435_761 &+ seed)
            let h2 = WeatherMath.hash01(i &* 1_597_334_677 &+ seed &+ 17)
            let h3 = WeatherMath.hash01(i &* 2_246_822_507 &+ seed &+ 41)
            let dropAngle = angle + CGFloat(h2 - 0.5) * 0.08
            let speed = speedRange.lowerBound + h2 * (speedRange.upperBound - speedRange.lowerBound)
            let progress = WeatherMath.fract(t * speed + h1)
            let y = CGFloat(progress) * travel - 80
            let lane = CGFloat(h3) * (size.width + slantPad * 2) - slantPad
            let x = lane + y * tan(dropAngle)
            let length = lengthRange.lowerBound + CGFloat(h1) * (lengthRange.upperBound - lengthRange.lowerBound)
            let width = widthRange.lowerBound + CGFloat(h2) * (widthRange.upperBound - widthRange.lowerBound)
            let opacity = opacityRange.lowerBound + h3 * (opacityRange.upperBound - opacityRange.lowerBound)

            let dx = sin(dropAngle) * length
            let dy = cos(dropAngle) * length
            var path = Path()
            path.move(to: CGPoint(x: x, y: y))
            path.addLine(to: CGPoint(x: x + dx, y: y + dy))
            context.stroke(
                path,
                with: .linearGradient(
                    Gradient(stops: [
                        .init(color: tint.opacity(0), location: 0),
                        .init(color: tint.opacity(opacity * 0.35), location: 0.55),
                        .init(color: tint.opacity(opacity), location: 1)
                    ]),
                    startPoint: CGPoint(x: x, y: y),
                    endPoint: CGPoint(x: x + dx, y: y + dy)
                ),
                style: StrokeStyle(lineWidth: width, lineCap: .round)
            )
        }
    }

    // MARK: - Snow

    private func drawSnow(into context: inout GraphicsContext, size: CGSize, time t: Double) {
        guard size.width > 0, size.height > 0 else { return }
        let tint = colorScheme == .dark
            ? Color.white
            : Color(hex: 0x94A3B8)
        drawSnowLayer(
            into: &context,
            size: size,
            time: t,
            count: 36,
            seed: 7,
            speedRange: 0.06...0.12,
            radiusRange: 1.4...2.8,
            opacityRange: 0.28...0.50,
            drift: 10,
            tint: tint
        )
        drawSnowLayer(
            into: &context,
            size: size,
            time: t,
            count: 28,
            seed: 53,
            speedRange: 0.09...0.18,
            radiusRange: 2.2...5.2,
            opacityRange: 0.40...0.78,
            drift: 22,
            tint: tint
        )
    }

    private func drawSnowLayer(
        into context: inout GraphicsContext,
        size: CGSize,
        time t: Double,
        count: Int,
        seed: Int,
        speedRange: ClosedRange<Double>,
        radiusRange: ClosedRange<CGFloat>,
        opacityRange: ClosedRange<Double>,
        drift: CGFloat,
        tint: Color
    ) {
        let travel = size.height + 50
        for i in 0..<count {
            let h1 = WeatherMath.hash01(i &* 2_654_435_761 &+ seed)
            let h2 = WeatherMath.hash01(i &* 1_597_334_677 &+ seed &+ 19)
            let h3 = WeatherMath.hash01(i &* 2_246_822_507 &+ seed &+ 47)
            let speed = speedRange.lowerBound + h2 * (speedRange.upperBound - speedRange.lowerBound)
            let progress = WeatherMath.fract(t * speed + h1)
            let y = CGFloat(progress) * travel - 24
            let x0 = CGFloat(h3) * size.width
            let wobble = sin(t * (0.55 + h2 * 0.7) + h1 * 6.2831853) * Double(drift)
            let x = x0 + CGFloat(wobble)
            let radius = radiusRange.lowerBound + CGFloat(h1) * (radiusRange.upperBound - radiusRange.lowerBound)
            let opacity = opacityRange.lowerBound + h3 * (opacityRange.upperBound - opacityRange.lowerBound)
            let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
            context.fill(Path(ellipseIn: rect), with: .color(tint.opacity(opacity)))
        }
    }
}

public extension View {
    /// Overlays full-screen rain or snow. `nil` is a no-op so callers can
    /// pass the mapped weather kind without branching.
    func weatherPrecipitation(_ kind: WeatherPrecipitationKind?) -> some View {
        overlay {
            if let kind {
                WeatherPrecipitationOverlay(kind: kind)
                    .ignoresSafeArea()
            }
        }
    }
}

private enum WeatherMath {
    static func fract(_ x: Double) -> Double {
        x - floor(x)
    }

    static func hash01(_ n: Int) -> Double {
        let x = sin(Double(n) * 12.9898) * 43_758.5453
        return x - floor(x)
    }
}

#Preview("Rain") {
    ZStack {
        Color.appSurface.ignoresSafeArea()
        WeatherPrecipitationOverlay(kind: .rain)
            .ignoresSafeArea()
        Text("Rain")
            .font(.system(size: 28, weight: .bold, design: .rounded))
            .foregroundStyle(Color.appTextPrimary)
    }
}

#Preview("Snow") {
    ZStack {
        Color.appSurface.ignoresSafeArea()
        WeatherPrecipitationOverlay(kind: .snow)
            .ignoresSafeArea()
        Text("Snow")
            .font(.system(size: 28, weight: .bold, design: .rounded))
            .foregroundStyle(Color.appTextPrimary)
    }
}

