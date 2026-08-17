import Foundation
import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

/// Everything a spread pick needs in order to explain itself, derived from two
/// numbers: the pick team's line and the model's projected margin for them.
///
/// ## One unit, end to end: the final margin
/// Every number on this chart is a MARGIN — the points between the two teams
/// when the game ends. The break-even, the model's projection, the push, the
/// cover/lose conditions and the axis ticks all live in that single unit, so no
/// label can contradict another.
///
/// An earlier cut plotted pick-side *lines* on the axis while the captions kept
/// speaking margin, and those two conventions carry opposite signs. The same
/// projection printed as "+0.3" on the bar and "losing by 0.3" in the sentence
/// directly above it. The axis direction inverted too — a bigger line means the
/// market rates the team WORSE — so the covering half of the bar landed under
/// the *opponent's* abbreviation. Both bugs are unfixable while two units share
/// one axis, which is why there is now only one.
///
/// ## Half points can't happen, whole points can push
/// A final margin is always a whole number. So:
/// - **Half-point line** (+4.5): no margin lands on the threshold, so there is
///   no push. The bet is a clean win/lose at a boundary sitting between two
///   integers.
/// - **Whole-point line** (+4): a margin CAN land exactly on the threshold, and
///   that outcome is a push — the stake comes back.
///
/// Getting this wrong is not cosmetic. On a +3 dog, "covers unless they lose by
/// 4 or more" implies a 3-point loss wins; it actually pushes.
public struct SpreadCoverOutcome {

    /// The pick team's line from ITS OWN perspective: `+4.5` = receiving 4.5,
    /// `-10` = laying 10. This is `best_line ?? vegas_line` on an NFL dryrun
    /// pick row, which is already stored pick-side.
    public let line: Double

    /// The pick team's projected final margin — positive means the model has
    /// them winning. On a dryrun row this is `-model_line`, because `model_line`
    /// is the team's fair *spread*.
    public let modelMargin: Double

    public init(line: Double, modelMargin: Double) {
        self.line = line
        self.modelMargin = modelMargin
    }

    // MARK: - The three zones

    /// The margin the game has to beat for the bet to cover — the break-even,
    /// and the point the bar's colours change at.
    public var threshold: Double { -line }

    /// Smallest whole margin that COVERS.
    public var coverMin: Int { Int(floor(threshold)) + 1 }

    /// Largest whole margin that LOSES.
    public var loseMax: Int { Int(ceil(threshold)) - 1 }

    /// The one margin that pushes, or nil on a half-point line where no whole
    /// number can land on the threshold.
    public var pushMargin: Int? {
        threshold == threshold.rounded() ? Int(threshold.rounded()) : nil
    }

    public var hasPush: Bool { pushMargin != nil }

    /// How far the model's projection sits past the break-even — the points of
    /// margin for error the bet has if the model is right. Negative means the
    /// model does not think this pick covers at all.
    public var cushion: Double { modelMargin - threshold }

    public var covers: Bool { cushion > 0 }

    // MARK: - Copy
    //
    // All phrased as whole-number outcomes, because that's what a final score
    // can actually be.

    public var coverCondition: String {
        if coverMin > 0 { return "Win by \(coverMin)+" }
        if coverMin == 0 { return "Win or tie" }
        return "Lose by \(-coverMin) or less, tie, or win"
    }

    public var loseCondition: String {
        if loseMax < 0 { return "Lose by \(-loseMax)+" }
        if loseMax == 0 { return "Tie or lose" }
        return "Win by \(loseMax) or less, tie, or lose"
    }

    public var pushCondition: String? {
        guard let push = pushMargin else { return nil }
        if push > 0 { return "Win by exactly \(push)" }
        if push == 0 { return "Tie" }
        return "Lose by exactly \(-push)"
    }

    /// What the model thinks the final margin is, in the same win/lose language
    /// as the zone captions.
    public var modelCondition: String {
        let magnitude = Self.format(abs(modelMargin))
        if modelMargin > 0 { return "Win by \(magnitude)" }
        if modelMargin < 0 { return "Lose by \(magnitude)" }
        return "Dead even"
    }

    /// The model's fair LINE for the pick team — same units as `line`.
    /// `−modelMargin`: a projected lose-by-7.4 becomes `+7.4`. Kept for the
    /// market-versus-fair-number row; it is deliberately NOT plotted, because a
    /// line and a margin cannot share an axis.
    public var modelFairLine: Double { -modelMargin }

    /// Signed fair line for line-space copy (`+7.4`, `−3.5`).
    public var signedModelFairLine: String {
        let magnitude = Self.format(abs(modelFairLine))
        if modelFairLine == 0 { return "PK" }
        return modelFairLine > 0 ? "+\(magnitude)" : "−\(magnitude)"
    }

    /// One sentence saying exactly what has to happen, then where the model
    /// lands, then how much room that leaves.
    public func headline(team: String) -> String {
        let requirement: String = {
            if coverMin > 0 { return "\(team) need to win by \(coverMin)+" }
            if coverMin == 0 { return "\(team) need to win or tie" }
            return "\(team) cover unless they lose by \(-loseMax)+"
        }()

        // Mandatory on whole-number lines: without it the requirement above
        // reads as if the push outcome were a win.
        let push = pushCondition.map { " (\($0.lowercased()) pushes)" } ?? ""

        let projection: String = {
            let magnitude = Self.format(abs(modelMargin))
            if modelMargin > 0 { return "model has them winning by \(magnitude)" }
            if modelMargin < 0 { return "model has them losing by \(magnitude)" }
            return "model has the game dead even"
        }()

        let room: String = {
            let magnitude = Self.format(abs(cushion))
            let unit = abs(cushion) == 1 ? "point" : "points"
            if cushion <= 0 { return "\(magnitude) \(unit) the wrong side of the number" }
            // Losing but still covering is the case people misread most, so name it.
            if modelMargin < 0 { return "still \(magnitude) \(unit) inside the number" }
            return "\(magnitude) \(unit) of cushion"
        }()

        return "\(requirement)\(push). \(projection.prefix(1).capitalized)\(projection.dropFirst()) — \(room)."
    }

    static func format(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    /// The line as a signed line (not a margin) — half values are legitimate
    /// here, which is why the market chip uses this and the axis never does.
    public var signedLine: String {
        let magnitude = Self.format(abs(line))
        if line == 0 { return "PK" }
        return line > 0 ? "+\(magnitude)" : "−\(magnitude)"
    }

    /// A margin spoken as a lead: whose, and by how much. Used by the
    /// break-even / model captions (`LA by 3.5`), not the axis ticks.
    public static func marginLabel(
        _ margin: Double,
        pick: String?,
        opponent: String?,
        verbose: Bool = false
    ) -> String {
        if margin == 0 { return verbose ? "Tie" : "TIE" }
        let magnitude = format(abs(margin))
        let team = margin > 0 ? pick : opponent
        guard let team, !team.isEmpty else {
            return margin > 0 ? "+\(magnitude)" : "−\(magnitude)"
        }
        return verbose ? "\(team) by \(magnitude)" : "\(team) \(magnitude)"
    }

    /// Axis tick: the pick team's line at that score. Winning by 4 is `LA −4`;
    /// losing by 4 is `LA +4`. Same team on every tick so the sign is the
    /// thing that moves, matching how a betting line is written.
    public static func spreadTickLabel(_ margin: Double, pick: String?) -> String {
        if margin == 0 { return "TIE" }
        let line = -margin
        let magnitude = format(abs(line))
        let signed = line > 0 ? "+\(magnitude)" : "−\(magnitude)"
        guard let pick, !pick.isEmpty else { return signed }
        return "\(pick) \(signed)"
    }
}

/// Auto-fit window for the MARGIN axis: the break-even, the model's projection,
/// and a tie when one is close enough to be worth anchoring to.
///
/// The window is deliberately narrow. A ±21-point college axis for a 2-point
/// lean spends all its width on scores nobody is arguing about and squeezes the
/// only two numbers that matter into a few pixels.
public struct SpreadMarginAxisDomain: Sendable, Equatable {
    public let min: Double
    public let max: Double
    public let ticks: [Double]

    /// - Parameter spreadWindow: `EdgeScale.spreadWindow` — the sport's sense of
    ///   how big a margin is. Runs are not points, so MLB's floor has to be an
    ///   order tighter than the NFL's.
    public init(threshold: Double, modelMargin: Double, spreadWindow: Double) {
        let minPad = Swift.max(spreadWindow * 0.15, 0.5)
        let low = Swift.min(threshold, modelMargin)
        let high = Swift.max(threshold, modelMargin)
        let gap = high - low
        let pad = Swift.max(gap * 0.55, minPad)
        var lo = low - pad
        var hi = high + pad

        // TIE is the cheapest orientation anchor on the chart, so reach for it
        // when it is already just off an edge — but never drag the window
        // across a blowout line to go get it.
        if lo > 0, lo <= pad { lo = -minPad * 0.2 }
        if hi < 0, -hi <= pad { hi = minPad * 0.2 }

        // Two markers a tenth of a point apart on a six-point window are one
        // marker. Tighten the window until the gap is a readable share of it.
        let minMarkerFraction = 0.2
        let span = hi - lo
        if span > 0, gap / span < minMarkerFraction {
            let target = Swift.max(gap / minMarkerFraction, minPad * 2)
            if target < span {
                let mid = (threshold + modelMargin) / 2
                lo = mid - target / 2
                hi = mid + target / 2
            }
        }

        self.min = lo
        self.max = hi
        self.ticks = Self.ticks(lo: lo, hi: hi)
    }

    /// Gradations on a round step, sized to the window rather than to the
    /// sport. Fixed tick lists cannot work here: the window auto-fits, so a
    /// 3/7/10 set leaves a zoomed-in chart with no labels at all and nothing to
    /// orient by.
    private static func ticks(lo: Double, hi: Double) -> [Double] {
        let span = hi - lo
        guard span > 0 else { return [] }
        let step = niceStep(span / 4)
        // Keep a tick a comfortable distance inside the window so its label is
        // not half off the end of the bar.
        let inset = step * 0.15
        let first = (((lo + inset) / step).rounded(.up)) * step

        var ticks: [Double] = []
        for i in 0..<12 {
            let value = first + Double(i) * step
            if value > hi - inset { break }
            ticks.append(abs(value) < 1e-9 ? 0 : value)
        }
        return ticks
    }

    /// 1, 2, 2.5, 5 or 10 times a power of ten — the smallest that clears `raw`.
    private static func niceStep(_ raw: Double) -> Double {
        let magnitude = pow(10, floor(log10(Swift.max(raw, 1e-6))))
        for multiple in [1.0, 2.0, 2.5, 5.0] where magnitude * multiple >= raw {
            return magnitude * multiple
        }
        return magnitude * 10
    }
}

/// The spread pick drawn on a **margin axis** — what happens on the scoreboard.
///
/// ## Left is the opponent, right is the pick
/// The axis runs from the opponent winning big, through TIE, to the pick team
/// winning big. Axis ticks write the pick team's line at that score (`LA −4`
/// when they lead by 4, `LA +4` when they trail by 4).
///
/// ## The colours are the bet
/// The break-even sits where the market's number puts it. Everything to its
/// right covers, everything to its left loses, and on a whole-number line the
/// single margin that pushes gets its own amber sliver between them. The
/// cover/lose captions underneath are the same sentences, in the same unit,
/// under the same halves.
public struct SpreadCoverBar: View {

    private let outcome: SpreadCoverOutcome
    private let domain: SpreadMarginAxisDomain
    private let pickAbbrev: String?
    private let opponentAbbrev: String?

    public init(
        line: Double,
        modelMargin: Double,
        scale: EdgeScale = .nfl,
        pickAbbrev: String? = nil,
        opponentAbbrev: String? = nil
    ) {
        let outcome = SpreadCoverOutcome(line: line, modelMargin: modelMargin)
        self.outcome = outcome
        self.domain = SpreadMarginAxisDomain(
            threshold: outcome.threshold,
            modelMargin: modelMargin,
            spreadWindow: scale.spreadWindow
        )
        self.pickAbbrev = pickAbbrev
        self.opponentAbbrev = opponentAbbrev
    }

    private let barHeight: CGFloat = 14
    private let captionWidth: CGFloat = 92
    private let captionStackLift: CGFloat = 22

    @State private var barWidth: CGFloat = 0

    // MARK: - Geometry (MARGIN space, pick team positive)

    private func fraction(margin: Double) -> CGFloat {
        let span = domain.max - domain.min
        guard span > 0 else { return 0.5 }
        return CGFloat(Swift.min(Swift.max((margin - domain.min) / span, 0.008), 0.992))
    }

    private func x(margin: Double) -> CGFloat { barWidth * fraction(margin: margin) }

    /// On a whole-number line the push owns a half-point either side of the
    /// threshold, so cover starts above it and loss ends below it.
    private var coverStartMargin: Double {
        outcome.threshold + (outcome.hasPush ? 0.5 : 0)
    }

    private var loseEndMargin: Double {
        outcome.threshold - (outcome.hasPush ? 0.5 : 0)
    }

    private var marketX: CGFloat { x(margin: outcome.threshold) }
    private var modelX: CGFloat { x(margin: outcome.modelMargin) }
    private var tone: Color { outcome.covers ? .appWin : .appLoss }

    private func marginLabel(_ margin: Double, verbose: Bool = false) -> String {
        SpreadCoverOutcome.marginLabel(
            margin,
            pick: pickAbbrev,
            opponent: opponentAbbrev,
            verbose: verbose
        )
    }

    /// Nudged apart as a pair when markers nearly coincide. Edge clamping cannot
    /// collapse them; if both still cannot fit side-by-side, centres coincide and
    /// `stackCaptions` lifts one above the other.
    private var captionPositions: (market: CGFloat, model: CGFloat) {
        guard barWidth > captionWidth else { return (marketX, modelX) }
        let minimumSeparation = captionWidth + 8
        let lower = captionWidth / 2
        let upper = Swift.max(barWidth - captionWidth / 2, lower)
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

    private var stackCaptions: Bool {
        let positions = captionPositions
        return abs(positions.market - positions.model) < captionWidth * 0.9
    }

    // MARK: - Body

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            markerCaptions
            bar
            scale
            cushionBracket
            zoneCaptions
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    /// Loses on the left, covers on the right — under the halves they describe.
    private var zoneCaptions: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Label("LOSES", systemImage: "xmark")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Color.appLoss)
                Text(outcome.loseCondition)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Label("COVERS", systemImage: "checkmark")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Color.appWin)
                Text(outcome.coverCondition)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .multilineTextAlignment(.trailing)
            }
        }
        .lineLimit(2)
        .minimumScaleFactor(0.75)
    }

    private var bar: some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.appWin.opacity(0.20))
                .frame(height: barHeight)

            // Lose zone: left edge → the last margin that fails.
            Capsule()
                .fill(Color.appLoss.opacity(0.75))
                .frame(width: Swift.max(x(margin: loseEndMargin), 0), height: barHeight)

            // Cover zone: the first margin that cashes → right edge.
            Capsule()
                .fill(Color.appWin.opacity(0.85))
                .frame(
                    width: Swift.max(barWidth - x(margin: coverStartMargin), 0),
                    height: barHeight
                )
                .offset(x: x(margin: coverStartMargin))

            if outcome.hasPush {
                Rectangle()
                    .fill(Color.appPush.opacity(0.9))
                    .frame(
                        width: Swift.max(x(margin: coverStartMargin) - x(margin: loseEndMargin), 1.5),
                        height: barHeight
                    )
                    .offset(x: x(margin: loseEndMargin))
            }

            gradations

            if domain.ticks.contains(0) {
                Rectangle()
                    .fill(Color.appTextPrimary.opacity(0.45))
                    .frame(width: 1.5, height: barHeight)
                    .offset(x: x(margin: 0) - 0.75)
            }

            tick(at: marketX, width: 3, height: barHeight + 12, color: .appTextPrimary)
            tick(at: modelX, width: 3.5, height: barHeight + 16, color: tone)
                .shadow(color: tone.opacity(0.55), radius: 4)
        }
        .frame(height: barHeight + 18)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { barWidth = $0 }
    }

    private var gradations: some View {
        ForEach(domain.ticks.filter { $0 != 0 }, id: \.self) { margin in
            Rectangle()
                .fill(Color.appTextPrimary.opacity(0.16))
                .frame(width: 1, height: barHeight)
                .offset(x: x(margin: margin) - 0.5)
        }
    }

    private func tick(at position: CGFloat, width: CGFloat, height: CGFloat, color: Color) -> some View {
        RoundedRectangle(cornerRadius: width / 2, style: .continuous)
            .fill(color)
            .frame(width: width, height: height)
            .offset(x: position - width / 2)
    }

    /// Ticks are the pick team's line at that score (`LA −4`, `LA +4`).
    private var scale: some View {
        ZStack(alignment: .leading) {
            ForEach(domain.ticks, id: \.self) { margin in
                Text(SpreadCoverOutcome.spreadTickLabel(margin, pick: pickAbbrev))
                    .font(.system(size: 8, weight: .black))
                    .tracking(margin == 0 ? 0.5 : 0)
                    .foregroundStyle(margin == 0 ? Color.appTextSecondary : Color.appTextMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .frame(width: 52)
                    .offset(x: x(margin: margin) - 26)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 10, alignment: .leading)
    }

    private var cushionBracket: some View {
        let start = Swift.min(marketX, modelX)
        let end = Swift.max(marketX, modelX)
        let span = Swift.max(end - start, 1)
        let labelWidth: CGFloat = 128
        let labelCentre = Swift.min(
            Swift.max(start + span / 2, labelWidth / 2),
            Swift.max(barWidth - labelWidth / 2, labelWidth / 2)
        )
        let magnitude = SpreadCoverOutcome.format(abs(outcome.cushion))

        return VStack(alignment: .leading, spacing: 3) {
            ZStack(alignment: .leading) {
                Rectangle().fill(tone.opacity(0.55)).frame(width: span, height: 1)
                    .offset(x: start)
                Rectangle().fill(tone.opacity(0.55)).frame(width: 1, height: 6)
                    .offset(x: start, y: 2.5)
                Rectangle().fill(tone.opacity(0.55)).frame(width: 1, height: 6)
                    .offset(x: end - 1, y: 2.5)
            }
            .frame(height: 7)

            ZStack(alignment: .leading) {
                Text(outcome.covers ? "\(magnitude) PTS OF ROOM" : "\(magnitude) PTS SHORT")
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.5)
                    .foregroundStyle(tone)
                    .lineLimit(1)
                    .frame(width: labelWidth)
                    .offset(x: labelCentre - labelWidth / 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The break-even caption names the score that decides the bet, not the
    /// line that produced it — the line is already on the chip above.
    private var markerCaptions: some View {
        let positions = captionPositions
        let stack = stackCaptions
        let marketOnTop = !stack || positions.market <= positions.model
        return ZStack(alignment: .topLeading) {
            caption(
                outcome.hasPush ? "PUSH" : "BREAK-EVEN",
                marginLabel(outcome.threshold, verbose: true),
                color: .appTextPrimary
            )
            .frame(width: captionWidth)
            .offset(
                x: positions.market - captionWidth / 2,
                y: stack ? (marketOnTop ? 0 : captionStackLift) : 0
            )

            caption(
                "MODEL",
                marginLabel(outcome.modelMargin, verbose: true),
                color: tone,
                badged: true
            )
            .frame(width: captionWidth)
            .offset(
                x: positions.model - captionWidth / 2,
                y: stack ? (marketOnTop ? captionStackLift : 0) : 0
            )
        }
        .frame(height: stack ? 52 : 30, alignment: .top)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func caption(
        _ label: String,
        _ value: String?,
        color: Color,
        badged: Bool = false
    ) -> some View {
        VStack(spacing: 1) {
            HStack(spacing: 3) {
                if badged { wagerproofMark }
                Text(label)
                    .font(.system(size: 8, weight: .black))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextMuted)
            }
            if let value {
                Text(value)
                    .font(.system(size: 12, weight: .black, design: .rounded))
                    .foregroundStyle(color)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }

    @ViewBuilder
    private var wagerproofMark: some View {
        #if canImport(UIKit)
        if let logo = UIImage(named: "WagerproofLogo", in: .main, compatibleWith: nil) {
            Image(uiImage: logo)
                .resizable()
                .scaledToFit()
                .frame(width: 10, height: 10)
        }
        #endif
    }

    private var accessibilitySummary: String {
        var parts = [
            "Break-even at \(marginLabel(outcome.threshold, verbose: true)).",
            "Model projects \(marginLabel(outcome.modelMargin, verbose: true)).",
            "Covers if \(outcome.coverCondition). Loses if \(outcome.loseCondition).",
        ]
        if let push = outcome.pushCondition { parts.append("\(push) pushes.") }
        parts.append(
            outcome.covers
                ? "\(SpreadCoverOutcome.format(abs(outcome.cushion))) points of room."
                : "\(SpreadCoverOutcome.format(abs(outcome.cushion))) points short."
        )
        return parts.joined(separator: " ")
    }
}

#Preview("Spread cover bar") {
    VStack(spacing: 30) {
        // UNC +8.5 — dog covering while losing, break-even at TCU by 8.5.
        SpreadCoverBar(line: 8.5, modelMargin: -7.4, scale: .cfb, pickAbbrev: "UNC", opponentAbbrev: "TCU")
        // NE +4.5 — half point dog, model has them winning outright.
        SpreadCoverBar(line: 4.5, modelMargin: 2.1, pickAbbrev: "NE", opponentAbbrev: "SEA")
        // ATL +3 — whole point, push band, model has them LOSING but covering.
        SpreadCoverBar(line: 3, modelMargin: -0.3, pickAbbrev: "ATL", opponentAbbrev: "PIT")
        // LAC -10 — favourite laying a whole number; TIE is far off screen.
        SpreadCoverBar(line: -10, modelMargin: 11, pickAbbrev: "LAC", opponentAbbrev: "ARI")
        // LAR -3.5 — favourite, half point, thin cushion.
        SpreadCoverBar(line: -3.5, modelMargin: 4.4, pickAbbrev: "LAR", opponentAbbrev: "SF")
        // NCSU +5.5 with the model on them outright — break-even and model
        // straddle TIE.
        SpreadCoverBar(line: 5.5, modelMargin: 1.4, scale: .cfb, pickAbbrev: "NCSU", opponentAbbrev: "UVA")
        // Model on the wrong side of the number entirely.
        SpreadCoverBar(line: -7, modelMargin: 3, pickAbbrev: "BUF", opponentAbbrev: "MIA")
        // Near-identical break-even and model — captions must not overlap.
        SpreadCoverBar(line: 3.5, modelMargin: -3.0, pickAbbrev: "NE", opponentAbbrev: "NYJ")
    }
    .padding(20)
    .background(Color.appSurfaceElevated)
    .preferredColorScheme(.dark)
}
