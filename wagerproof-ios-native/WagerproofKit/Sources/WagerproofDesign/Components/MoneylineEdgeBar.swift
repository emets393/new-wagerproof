import SwiftUI

/// What a moneyline price needs to be true, versus what the model thinks is
/// true.
///
/// ## The framing
/// A price IS a required win rate. `+180` needs the bet to land 35.7% of the
/// time to break even; `-198` needs 66.4%. So a moneyline card asks the same
/// question as a spread card — "what has to happen, and where does the model
/// land" — just measured in win probability instead of points.
///
/// That's why this reads as a sibling of `SpreadCoverBar` rather than its own
/// thing: threshold, model marker, highlighted gap.
///
/// ## No de-vigging, deliberately
/// The break-even rate at a price is exactly that price's RAW implied
/// probability. De-vigging would produce a number that answers a different
/// question ("what does the market think") and would no longer be the bar this
/// bet has to clear. It would also reintroduce the reconciliation problem
/// `WIDGET_DESIGN.md` rule 10 warns about, where a marginally more "correct"
/// figure visibly contradicts the headline above it.
public struct MoneylineOutcome {

    /// Whether the price on offer is one you can actually bet.
    public enum PriceKind: Sendable {
        /// A real book price, with vig. Break-even is a bar you must clear to
        /// profit, so "value" is a meaningful verdict.
        case book
        /// A de-vigged / synthetic fair price — the two sides mirror exactly,
        /// which no real market does. You CANNOT bet this number, so framing it
        /// as break-even would state something false. The chart keeps showing
        /// the disagreement but stops calling it value.
        ///
        /// `ncaab_predictions.vegas_{home,away}_moneyline` is this: 200/200
        /// sampled rows had `|home| == |away|`.
        case fairNoVig
    }

    /// American odds for the side being bet.
    public let price: Int
    /// The model's win probability for that side, 0...1.
    public let modelProbability: Double

    public let priceKind: PriceKind
    private let scale: EdgeScale

    public init(
        price: Int,
        modelProbability: Double,
        scale: EdgeScale = .nfl,
        priceKind: PriceKind = .book
    ) {
        self.price = price
        self.modelProbability = modelProbability
        self.scale = scale
        self.priceKind = priceKind
    }

    public var isBookPrice: Bool { priceKind == .book }

    /// What the centre marker actually is. On a fair line it is not a bar to
    /// clear, it is the market's own opinion.
    public var thresholdCaption: String { isBookPrice ? "BREAK-EVEN" : "MARKET FAIR" }

    /// The win rate this price has to clear to be profitable, as a percentage.
    ///
    /// Negative odds: risk `|price|` to win 100. Positive: risk 100 to win
    /// `price`. Both reduce to stake / (stake + profit).
    public var breakEvenPercent: Double {
        price < 0
            ? Double(-price) / Double(-price + 100) * 100
            : 100 / (Double(price) + 100) * 100
    }

    public var modelPercent: Double { modelProbability * 100 }

    /// Percentage points of edge. Positive = the model says this price is worth
    /// taking.
    public var edge: Double { modelPercent - breakEvenPercent }

    public var isPositiveValue: Bool { edge > 0 }

    /// 0 = strongly negative … 2 = no edge … 4 = strong value.
    public var zoneIndex: Int {
        let magnitude = abs(edge)
        if magnitude < scale.moneylineLean { return 2 }
        let strong = magnitude >= scale.moneylineStrong
        if edge < 0 { return strong ? 0 : 1 }
        return strong ? 4 : 3
    }

    public var zoneTitle: String {
        isBookPrice
            ? ["Strong Fade", "Slight Overlay", "No Edge", "Value", "Strong Value"][zoneIndex]
            : ["Model Well Under", "Model Under", "Agrees", "Model Over", "Model Well Over"][zoneIndex]
    }

    /// One sentence: the bar, where the model lands, and the gap.
    public func headline(team: String) -> String {
        let need = String(format: "%.1f%%", breakEvenPercent)
        let has = String(format: "%.1f%%", modelPercent)
        let gap = String(format: "%.1f", abs(edge))
        let priceText = price > 0 ? "+\(price)" : "\(price)"

        // A fair line can't be bet, so no claim is made about profit.
        guard isBookPrice else {
            let direction = isPositiveValue ? "higher" : "lower"
            return "The market's fair price on \(team) is \(need). "
                + "Model has them at \(has) — \(gap) points \(direction)."
        }

        if isPositiveValue {
            return "\(team) need to win \(need) of the time to break even at \(priceText). "
                + "Model has them at \(has) — \(gap) points of value."
        }
        return "\(team) need to win \(need) of the time to break even at \(priceText), "
            + "but the model only has them at \(has) — \(gap) points short."
    }
}

/// Break-even win rate against the model's win rate on a 0–100% axis, with a
/// coin-flip reference at the centre.
///
/// Anchored at 50% for the same reason `SpreadCoverBar` anchors at a tie: the
/// axis needs a real-world reference a reader already understands, not a
/// betting abstraction. Everything right of the break-even marker is +EV.
public struct MoneylineEdgeBar: View {

    private let outcome: MoneylineOutcome
    private let teamAbbrev: String?

    public init(
        price: Int,
        modelProbability: Double,
        scale: EdgeScale = .nfl,
        teamAbbrev: String? = nil,
        priceKind: MoneylineOutcome.PriceKind = .book
    ) {
        self.outcome = MoneylineOutcome(
            price: price, modelProbability: modelProbability, scale: scale, priceKind: priceKind
        )
        self.teamAbbrev = teamAbbrev
    }

    private let barHeight: CGFloat = 14
    private let captionWidth: CGFloat = 84
    private let gradations: [Double] = [25, 50, 75]

    @State private var barWidth: CGFloat = 0

    // MARK: - Geometry

    private func fraction(_ percent: Double) -> CGFloat {
        CGFloat(Swift.min(Swift.max(percent / 100, 0.008), 0.992))
    }

    private func x(_ percent: Double) -> CGFloat { barWidth * fraction(percent) }

    private var breakEvenX: CGFloat { x(outcome.breakEvenPercent) }
    private var modelX: CGFloat { x(outcome.modelPercent) }
    private var tone: Color { outcome.isPositiveValue ? .appWin : .appLoss }

    private var captionPositions: (breakEven: CGFloat, model: CGFloat) {
        guard barWidth > captionWidth else { return (breakEvenX, modelX) }
        let minimumSeparation = captionWidth + 8
        let lower = captionWidth / 2
        let upper = Swift.max(barWidth - captionWidth / 2, lower)
        let usable = upper - lower

        let firstIsLeft = breakEvenX <= modelX
        var left = firstIsLeft ? breakEvenX : modelX
        var right = firstIsLeft ? modelX : breakEvenX

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
        return firstIsLeft ? (left, right) : (right, left)
    }

    // MARK: - Body

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            markerCaptions
            bar
            scale
            gapBracket
            zoneCaptions
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Break-even \(String(format: "%.1f", outcome.breakEvenPercent)) percent, "
            + "model \(String(format: "%.1f", outcome.modelPercent)) percent. "
            + outcome.zoneTitle + "."
        )
    }

    private var bar: some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.appLoss.opacity(0.20))
                .frame(height: barHeight)

            // Everything past the required win rate is profitable at this price.
            Capsule()
                .fill(Color.appWin.opacity(0.85))
                .frame(width: Swift.max(barWidth - breakEvenX, 0), height: barHeight)
                .offset(x: breakEvenX)

            ForEach(gradations, id: \.self) { mark in
                Rectangle()
                    .fill(Color.appTextPrimary.opacity(mark == 50 ? 0.45 : 0.16))
                    .frame(width: mark == 50 ? 1.5 : 1, height: barHeight)
                    .offset(x: x(mark) - 0.75)
            }

            tick(at: breakEvenX, width: 3, height: barHeight + 12, color: .appTextPrimary)
            tick(at: modelX, width: 3.5, height: barHeight + 16, color: tone)
                .shadow(color: tone.opacity(0.55), radius: 4)
        }
        .frame(height: barHeight + 18)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { barWidth = $0 }
    }

    private func tick(at position: CGFloat, width: CGFloat, height: CGFloat, color: Color) -> some View {
        RoundedRectangle(cornerRadius: width / 2, style: .continuous)
            .fill(color)
            .frame(width: width, height: height)
            .offset(x: position - width / 2)
    }

    private var scale: some View {
        ZStack(alignment: .leading) {
            ForEach(gradations, id: \.self) { mark in
                Text(mark == 50 ? "COIN FLIP" : "\(Int(mark))%")
                    .font(.system(size: 8, weight: mark == 50 ? .black : .heavy))
                    .tracking(mark == 50 ? 0.4 : 0)
                    .foregroundStyle(mark == 50 ? Color.appTextSecondary : Color.appTextMuted)
                    .frame(width: 54)
                    .offset(x: x(mark) - 27)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var gapBracket: some View {
        let start = Swift.min(breakEvenX, modelX)
        let end = Swift.max(breakEvenX, modelX)
        let span = Swift.max(end - start, 1)
        let labelWidth: CGFloat = 132
        let centre = Swift.min(
            Swift.max(start + span / 2, labelWidth / 2),
            Swift.max(barWidth - labelWidth / 2, labelWidth / 2)
        )
        let magnitude = String(format: "%.1f", abs(outcome.edge))

        return VStack(alignment: .leading, spacing: 3) {
            ZStack(alignment: .leading) {
                Rectangle().fill(tone.opacity(0.55)).frame(width: span, height: 1).offset(x: start)
                Rectangle().fill(tone.opacity(0.55)).frame(width: 1, height: 6).offset(x: start, y: 2.5)
                Rectangle().fill(tone.opacity(0.55)).frame(width: 1, height: 6).offset(x: end - 1, y: 2.5)
            }
            .frame(height: 7)

            ZStack(alignment: .leading) {
                Text(gapLabel(magnitude))
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.5)
                    .foregroundStyle(tone)
                    .lineLimit(1)
                    .frame(width: labelWidth)
                    .offset(x: centre - labelWidth / 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// A fair line can't be bet, so the gap is a disagreement, not value.
    private func gapLabel(_ magnitude: String) -> String {
        guard outcome.isBookPrice else { return "\(magnitude) PTS APART" }
        return outcome.isPositiveValue ? "\(magnitude) PTS OF VALUE" : "\(magnitude) PTS SHORT"
    }

    private var markerCaptions: some View {
        let positions = captionPositions
        return ZStack(alignment: .topLeading) {
            caption(outcome.thresholdCaption, String(format: "%.1f%%", outcome.breakEvenPercent), color: .appTextPrimary)
                .frame(width: captionWidth)
                .offset(x: positions.breakEven - captionWidth / 2)
            caption(teamAbbrev.map { "\($0) MODEL" } ?? "MODEL",
                    String(format: "%.1f%%", outcome.modelPercent), color: tone)
                .frame(width: captionWidth)
                .offset(x: positions.model - captionWidth / 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func caption(_ label: String, _ value: String, color: Color) -> some View {
        VStack(spacing: 1) {
            Text(label)
                .font(.system(size: 8, weight: .black))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 13, weight: .black, design: .rounded))
                .foregroundStyle(color)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }

    private var zoneCaptions: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Label(outcome.isBookPrice ? "LOSES LONG-TERM" : "MODEL BELOW MARKET", systemImage: "xmark")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Color.appLoss)
                Text("Wins under \(String(format: "%.1f%%", outcome.breakEvenPercent)) of the time")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Label(outcome.zoneTitle.uppercased(), systemImage: "checkmark")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Color.appWin)
                Text("Wins over \(String(format: "%.1f%%", outcome.breakEvenPercent)) of the time")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .multilineTextAlignment(.trailing)
            }
        }
        .lineLimit(2)
        .minimumScaleFactor(0.75)
    }
}

#Preview("Moneyline edge bar") {
    VStack(spacing: 30) {
        // NE +180 (BetRivers), model 55.9% — break-even 35.7%, +20.2 of value.
        MoneylineEdgeBar(price: 180, modelProbability: 0.559, teamAbbrev: "NE")
        // SEA -198, model 44.1% — break-even 66.4%, 22.3 short.
        MoneylineEdgeBar(price: -198, modelProbability: 0.441, teamAbbrev: "SEA")
        // Near the line.
        MoneylineEdgeBar(price: -110, modelProbability: 0.53, teamAbbrev: "KC")
    }
    .padding(20)
    .background(Color.appSurfaceElevated)
    .preferredColorScheme(.dark)
}
