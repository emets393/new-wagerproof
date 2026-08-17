import SwiftUI

/// One centred rail that answers "which way does our model disagree with the
/// market, and by how much" before a single number is read.
///
/// The market number is ALWAYS the centre reference point. The model rides at an
/// offset whose direction is the lean and whose distance is the magnitude, and
/// only the span *between* the two markers is coloured — everything outside it
/// stays muted, so the eye lands on the disagreement rather than on the rail.
///
/// Replaces the two-box "Best Line → Model" grid (`metricGrid`), which printed
/// both numbers but left the reader to subtract them and to judge whether the
/// answer was a lot.
///
/// ## The gap is derived, never passed in
/// The edge shown in the header is `model − market` computed from the two values
/// this view is already rendering, so the three figures on screen cannot
/// disagree with each other. Callers that hold a separately-stored `edge` column
/// should not pass it — a marginally more "correct" number that contradicts the
/// bar under it is worse than a consistent one.
///
/// ## Zone widths are equal, not proportional to points
/// The five zones render at equal width so their labels stay legible at 8pt, and
/// the gap → x mapping is piecewise-linear across them. A marker therefore always
/// lands inside the zone its label names, but pixel distance is only comparable
/// *within* a zone. That's an acceptable trade because the exact number is
/// printed twice (header + under the marker); nothing here asks you to measure
/// the bar.
///
/// ## Mirroring
/// Under and Over are symmetric: the band grows leftward with a blue accent for
/// a low lean and rightward with green for a high one, per the Over/Under colour
/// rule (green + up for OVER, blue + down for UNDER).
public struct ModelEdgeRail: View {

    // MARK: - Inputs

    private let market: Double
    private let model: Double
    private let lowWord: String
    private let highWord: String
    private let marketCaption: String
    private let modelCaption: String
    private let leanThreshold: Double
    private let strongThreshold: Double
    private let railCap: Double
    private let format: (Double) -> String

    /// - Parameters:
    ///   - market: The book's number. Pinned to the centre of the rail.
    ///   - model: WagerProof's projection for the same market.
    ///   - lowWord: Word for a model-below-market lean ("Under", or a team abbrev
    ///     once this is reused for spreads).
    ///   - highWord: Word for a model-above-market lean ("Over").
    ///   - marketCaption: Caption under the centre marker.
    ///   - modelCaption: Caption under the model marker.
    ///   - scale: Per-sport thresholds. MUST match the sport — an NFL scale on
    ///     MLB runs reads `STRONG OVER` on every game. See `EdgeScale`.
    ///   - format: Renders both values. Defaults to one decimal with a trailing
    ///     `.0` dropped.
    public init(
        market: Double,
        model: Double,
        lowWord: String = "Under",
        highWord: String = "Over",
        marketCaption: String = "Market",
        modelCaption: String = "Model",
        scale: EdgeScale = .nfl,
        format: @escaping (Double) -> String = ModelEdgeRail.defaultFormat
    ) {
        let leanThreshold = scale.totalLean
        let strongThreshold = scale.totalStrong
        let railCap = scale.totalCap
        self.market = market
        self.model = model
        self.lowWord = lowWord
        self.highWord = highWord
        self.marketCaption = marketCaption
        self.modelCaption = modelCaption
        // Clamp in ascending order so a caller can't invert the bands and
        // produce a rail whose zones read backwards or divide by zero.
        let lean = Swift.max(leanThreshold, 0.1)
        let strong = Swift.max(strongThreshold, lean + 0.1)
        self.leanThreshold = lean
        self.strongThreshold = strong
        self.railCap = Swift.max(railCap, strong + 0.1)
        self.format = format
    }

    public static func defaultFormat(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    // MARK: - Geometry state

    /// Measured rather than read from a GeometryReader: the reader would claim
    /// all the space in the enclosing VStack and collapse the caption row.
    @State private var railWidth: CGFloat = 0

    private let railHeight: CGFloat = 7
    private let captionWidth: CGFloat = 78

    // MARK: - Derived

    private var gap: Double { model - market }
    private var magnitude: Double { abs(gap) }

    /// 0 = strong low … 2 = no edge … 4 = strong high.
    private var zoneIndex: Int {
        if magnitude < leanThreshold { return 2 }
        let strong = magnitude >= strongThreshold
        if gap < 0 { return strong ? 0 : 1 }
        return strong ? 4 : 3
    }

    private var zoneTitles: [String] {
        [
            "Strong \(lowWord)",
            "\(lowWord) Lean",
            "No Edge",
            "\(highWord) Lean",
            "Strong \(highWord)",
        ]
    }

    private var accent: Color {
        switch zoneIndex {
        case 0, 1: return .appAccentBlue
        case 3, 4: return .appPrimary
        default: return .appTextMuted
        }
    }

    private var hasEdge: Bool { zoneIndex != 2 }

    /// Always signed, including inside "No Edge" — the direction is still real
    /// there, it just isn't big enough to act on, and an unsigned number would
    /// read as if the model and the market agreed exactly.
    private var signedGapText: String {
        let magnitudeText = String(format: "%.1f", magnitude)
        return gap < 0 ? "−\(magnitudeText)" : "+\(magnitudeText)"
    }

    /// Signed gap → 0…1 across the rail, piecewise-linear so each of the five
    /// equal-width zones spans exactly the point range its label claims.
    private var modelFraction: CGFloat {
        let m = Swift.min(magnitude, railCap)
        let half: Double
        if m <= leanThreshold {
            half = (m / leanThreshold) * 0.10
        } else if m <= strongThreshold {
            half = 0.10 + (m - leanThreshold) / (strongThreshold - leanThreshold) * 0.20
        } else {
            half = 0.30 + (m - strongThreshold) / (railCap - strongThreshold) * 0.20
        }
        // Keep a pinned marker inside the track instead of half-clipped by it.
        return CGFloat(Swift.min(Swift.max(0.5 + (gap < 0 ? -half : half), 0.015), 0.985))
    }

    private var marketX: CGFloat { railWidth * 0.5 }
    private var modelX: CGFloat { railWidth * modelFraction }

    /// Captions are pushed apart when their markers nearly coincide, otherwise a
    /// small edge renders "MARKET" and "MODEL" stacked on top of each other. The
    /// *markers* stay truthful; only the labels move, and the colour pairing
    /// (neutral market / accent model) keeps them attributable.
    private var captionPositions: (market: CGFloat, model: CGFloat) {
        guard railWidth > captionWidth else { return (marketX, modelX) }
        let minimumSeparation = captionWidth + 8
        let lower = captionWidth / 2
        let upper = Swift.max(railWidth - captionWidth / 2, lower)
        let usable = upper - lower

        let marketIsLeft = marketX <= modelX
        var left = marketIsLeft ? marketX : modelX
        var right = marketIsLeft ? modelX : marketX

        if right - left < minimumSeparation {
            let mid = (left + right) / 2
            left = mid - minimumSeparation / 2
            right = mid + minimumSeparation / 2
        }
        if minimumSeparation > usable {
            let mid = (lower + upper) / 2
            return (mid, mid)
        }
        if left < lower {
            let shift = lower - left
            left += shift
            right += shift
        }
        if right > upper {
            let shift = right - upper
            left -= shift
            right -= shift
        }
        return marketIsLeft ? (left, right) : (right, left)
    }

    // MARK: - Body

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            zoneLabels
            rail
            captions
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(zoneTitles[zoneIndex].uppercased())
                .font(.system(size: 11, weight: .black))
                .tracking(0.8)
                .foregroundStyle(accent)
            Spacer(minLength: 8)
            Text(signedGapText)
                .font(.system(size: 17, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(accent)
        }
    }

    private var zoneLabels: some View {
        HStack(spacing: 2) {
            ForEach(Array(zoneTitles.enumerated()), id: \.offset) { index, title in
                Text(title.uppercased())
                    .font(.system(size: 8, weight: index == zoneIndex ? .black : .heavy))
                    .tracking(0.4)
                    .lineLimit(1)
                    .minimumScaleFactor(0.62)
                    .foregroundStyle(index == zoneIndex ? accent : Color.appTextMuted.opacity(0.5))
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var rail: some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.appTextMuted.opacity(0.16))
                .frame(height: railHeight)

            // Zone boundaries, so the labels above are anchored to something.
            ForEach(1..<5, id: \.self) { boundary in
                Rectangle()
                    .fill(Color.appBorderStrong.opacity(0.55))
                    .frame(width: 1, height: railHeight)
                    .offset(x: railWidth * CGFloat(boundary) / 5 - 0.5)
            }

            // The answer: only the span between market and model is coloured.
            Capsule()
                .fill(
                    LinearGradient(
                        colors: gap >= 0
                            ? [accent.opacity(0.55), accent]
                            : [accent, accent.opacity(0.55)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: Swift.max(abs(modelX - marketX), 3), height: railHeight)
                .offset(x: Swift.min(marketX, modelX))
                .shadow(color: hasEdge ? accent.opacity(0.45) : .clear, radius: 5, y: 0)

            marker(at: marketX, width: 2.5, height: 17, color: .appTextSecondary)
            marker(at: modelX, width: 3.5, height: 23, color: accent)
                .shadow(color: hasEdge ? accent.opacity(0.5) : .clear, radius: 4)
        }
        .frame(height: 24)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { railWidth = $0 }
    }

    private func marker(at x: CGFloat, width: CGFloat, height: CGFloat, color: Color) -> some View {
        RoundedRectangle(cornerRadius: width / 2, style: .continuous)
            .fill(color)
            .frame(width: width, height: height)
            .offset(x: x - width / 2)
    }

    private var captions: some View {
        let positions = captionPositions
        return ZStack(alignment: .topLeading) {
            caption(marketCaption, format(market), color: .appTextPrimary)
                .frame(width: captionWidth)
                .offset(x: positions.market - captionWidth / 2)
            caption(modelCaption, format(model), color: accent)
                .frame(width: captionWidth)
                .offset(x: positions.model - captionWidth / 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func caption(_ label: String, _ value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 8, weight: .black))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 18, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }

    private var accessibilitySummary: String {
        let marketText = format(market)
        let modelText = format(model)
        guard hasEdge else {
            return "No edge. Market \(marketText), model \(modelText)."
        }
        let word = gap >= 0 ? highWord : lowWord
        return "\(zoneTitles[zoneIndex]). Market \(marketText), model \(modelText) — "
            + "\(String(format: "%.1f", magnitude)) toward the \(word)."
    }
}

#Preview("Model edge rail") {
    VStack(spacing: 28) {
        ModelEdgeRail(market: 43.5, model: 48.9)
        ModelEdgeRail(market: 47.5, model: 38.2)
        ModelEdgeRail(market: 44.5, model: 45.1)
        ModelEdgeRail(market: 41, model: 44.4)
    }
    .padding(20)
    .background(Color.appSurfaceElevated)
    .preferredColorScheme(.dark)
}
