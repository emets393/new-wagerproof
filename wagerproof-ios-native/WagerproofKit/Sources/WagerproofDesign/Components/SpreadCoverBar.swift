import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

/// Everything a spread pick needs in order to explain itself, derived from two
/// numbers: the pick team's line and the model's projected margin for them.
///
/// ## Why this exists
/// A spread card used to show "+4.5" beside "−2.1" and leave the reader to
/// reconcile them. They look like they straddle zero and therefore contradict
/// each other; they don't, because one is a *line* and the other is a *margin*
/// and the sign convention flips between the two. Everything here works in
/// MARGIN — "the pick team's final points minus their opponent's" — so nothing
/// is ever the negative of a negative.
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

    /// The margin the game has to beat for the bet to cover. Sits at the centre
    /// of the bar, the way the market number does on `ModelEdgeRail`.
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

    /// One sentence saying exactly what has to happen, then where the model
    /// lands, then how much room that leaves. Replaces the old
    /// "model makes NE -2.1 versus +4.5 at the market" phrasing, which stated
    /// both numbers and explained neither.
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
    /// here, which is why the break-even caption uses this rather than claiming
    /// a 4.5-point defeat is a thing that can happen.
    public var signedLine: String {
        let magnitude = Self.format(abs(line))
        return line >= 0 ? "+\(magnitude)" : "−\(magnitude)"
    }
}

/// The spread pick drawn on a **score-differential axis anchored at a tie**.
///
/// ## Why zero is the centre, not the break-even
/// The first cut centred the bar on the betting threshold. That put an
/// abstraction at the anchor point and left a tied game — the one number every
/// reader already understands — off the chart entirely. Worse, it hid the fact
/// this widget exists to teach: on a dog, **the cover zone starts on the losing
/// side of zero**. You can lose and still cash. With TIE at the centre and the
/// green beginning to its left, that reads without a caption.
///
/// It also separates two situations that looked identical before: "model has
/// them winning by 2" and "model has them losing by 3 but still covering" now
/// sit on opposite sides of the tie mark.
///
/// ## The cushion bracket measures something
/// The span between break-even and the model's projection is drawn as a bracket
/// anchored to those two ticks and nothing else, above a labelled scale. Its
/// length IS the number printed on it. (The first cut ran a full-width rule
/// under the bar, which claimed the entire axis was 6.6 points.)
///
/// ## No number on the break-even tick
/// On a half-point line the threshold sits between two whole margins, so there
/// is no outcome to name — the zone captions above carry it ("Lose by 4 or
/// less" / "Lose by 5+"). Printing the LINE there (`+4.5`) is what the whole
/// component was built to avoid: a spread number on a margin axis. On a
/// whole-point line the tick becomes the push, which IS a real outcome, and
/// gets named.
public struct SpreadCoverBar: View {

    private let outcome: SpreadCoverOutcome
    private let pickAbbrev: String?
    private let opponentAbbrev: String?

    public init(
        line: Double,
        modelMargin: Double,
        scale: EdgeScale = .nfl,
        pickAbbrev: String? = nil,
        opponentAbbrev: String? = nil
    ) {
        self.outcome = SpreadCoverOutcome(line: line, modelMargin: modelMargin)
        self.window = scale.spreadWindow
        self.pickAbbrev = pickAbbrev
        self.opponentAbbrev = opponentAbbrev
    }

    /// Margin points visible either side of a tie, from the sport's `EdgeScale`.
    /// Past it a marker pins and the exact size stops changing the read.
    private let window: Double

    /// Labelled gradations. Football-meaningful numbers rather than a uniform
    /// grid — 3 is a field goal, 7 a touchdown, 10 the two combined.
    private let labelledTicks: [Double] = [3, 7, 10]

    private let barHeight: CGFloat = 14
    private let captionWidth: CGFloat = 84

    @State private var barWidth: CGFloat = 0

    // MARK: - Geometry

    /// Margin → 0…1 across the bar, with a tie at dead centre.
    private func fraction(margin: Double) -> CGFloat {
        CGFloat(Swift.min(Swift.max(margin / (window * 2) + 0.5, 0.008), 0.992))
    }

    private func x(margin: Double) -> CGFloat { barWidth * fraction(margin: margin) }

    /// A pushing margin is one whole number, so on a continuous axis it occupies
    /// the half-point either side of itself. On a half-point line the two zones
    /// meet at a hairline instead — nothing can land there.
    private var loseEnd: CGFloat {
        fraction(margin: outcome.threshold - (outcome.hasPush ? 0.5 : 0))
    }

    private var coverStart: CGFloat {
        fraction(margin: outcome.threshold + (outcome.hasPush ? 0.5 : 0))
    }

    private var breakEvenX: CGFloat { x(margin: outcome.threshold) }
    private var modelX: CGFloat { x(margin: outcome.modelMargin) }
    private var tone: Color { outcome.covers ? .appWin : .appLoss }

    /// Nudged apart only when the two markers nearly coincide, so the captions
    /// never stack. The ticks stay truthful; only the labels move.
    private var captionPositions: (breakEven: CGFloat, model: CGFloat) {
        guard barWidth > captionWidth else { return (breakEvenX, modelX) }
        var left = breakEvenX
        var right = modelX
        let minimumSeparation = captionWidth + 6
        let separation = abs(right - left)
        if separation < minimumSeparation {
            let shove = (minimumSeparation - separation) / 2
            let direction: CGFloat = right >= left ? 1 : -1
            left -= direction * shove
            right += direction * shove
        }
        let lower = captionWidth / 2
        let upper = barWidth - captionWidth / 2
        return (
            Swift.min(Swift.max(left, lower), upper),
            Swift.min(Swift.max(right, lower), upper)
        )
    }

    // MARK: - Body

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Markers name themselves ABOVE the bar so each label points down at
            // its own tick, then the scale and the span it measures sit under
            // it, and the bet's verdicts close the card.
            markerCaptions
            bar
            scale
            cushionBracket
            zoneCaptions
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

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
            // Flat fills, not gradients: every outcome inside a zone pays the
            // same, so brightening toward one end would imply a better win.
            Capsule()
                .fill(Color.appLoss.opacity(0.20))
                .frame(height: barHeight)

            Capsule()
                .fill(Color.appWin.opacity(0.85))
                .frame(width: Swift.max(barWidth * (1 - coverStart), 0), height: barHeight)
                .offset(x: barWidth * coverStart)

            if outcome.hasPush {
                Rectangle()
                    .fill(Color.appPush.opacity(0.9))
                    .frame(width: Swift.max(barWidth * (coverStart - loseEnd), 1.5), height: barHeight)
                    .offset(x: barWidth * loseEnd)
            }

            gradations

            // A tie is the reference the whole axis hangs off, so it reads as
            // part of the scale rather than as a third marker competing with
            // break-even and the model.
            Rectangle()
                .fill(Color.appTextPrimary.opacity(0.45))
                .frame(width: 1.5, height: barHeight)
                .offset(x: x(margin: 0) - 0.75)

            tick(at: breakEvenX, width: 3, height: barHeight + 12, color: .appTextPrimary)
            tick(at: modelX, width: 3.5, height: barHeight + 16, color: tone)
                .shadow(color: tone.opacity(0.55), radius: 4)
        }
        .frame(height: barHeight + 18)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { barWidth = $0 }
    }

    private var gradations: some View {
        ForEach(labelledTicks.flatMap { [-$0, $0] }, id: \.self) { margin in
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

    /// `OPP ← 10 7 3 TIE 3 7 10 → PICK`, so the bar has a ruler and the bracket
    /// below it measures against something.
    private var scale: some View {
        ZStack(alignment: .leading) {
            // Signed, because the axis is a margin: −7 is the pick team losing
            // by a touchdown, +7 is them winning by one. An unsigned "7" on both
            // sides would make the two halves look interchangeable.
            ForEach(labelledTicks.flatMap { [-$0, $0] }, id: \.self) { margin in
                Text("\(margin < 0 ? "−" : "+")\(SpreadCoverOutcome.format(abs(margin)))")
                    .font(.system(size: 8, weight: .heavy))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(width: 28)
                    .offset(x: x(margin: margin) - 14)
            }
            Text("TIE")
                .font(.system(size: 8, weight: .black))
                .tracking(0.4)
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: 30)
                .offset(x: x(margin: 0) - 15)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .leading) { edgeTeam(opponentAbbrev, trailing: false) }
        .overlay(alignment: .trailing) { edgeTeam(pickAbbrev, trailing: true) }
    }

    @ViewBuilder
    private func edgeTeam(_ abbrev: String?, trailing: Bool) -> some View {
        if let abbrev {
            Text(trailing ? "\(abbrev) →" : "← \(abbrev)")
                .font(.system(size: 8, weight: .black))
                .tracking(0.3)
                .foregroundStyle(Color.appTextMuted)
        }
    }

    /// Anchored to the two ticks and nothing else — its drawn length is the
    /// number printed under it, measurable against the scale above.
    private var cushionBracket: some View {
        let start = Swift.min(breakEvenX, modelX)
        let end = Swift.max(breakEvenX, modelX)
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

    private var markerCaptions: some View {
        let positions = captionPositions
        return ZStack(alignment: .topLeading) {
            caption(
                outcome.hasPush ? "PUSH" : "BREAK-EVEN",
                // Half-point line: no whole margin lands here, so there is no
                // outcome to name and the line number would be a category error.
                outcome.pushCondition,
                color: .appTextPrimary
            )
            .frame(width: captionWidth)
            .offset(x: positions.breakEven - captionWidth / 2)

            caption("MODEL", outcome.modelCondition, color: tone, badged: true)
                .frame(width: captionWidth)
                .offset(x: positions.model - captionWidth / 2)
        }
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

    /// Marks the projection as ours rather than the book's. `WagerproofLogo`
    /// lives in the APP's asset catalog, not this package's resources, so it's
    /// loaded from `.main` and skipped entirely when absent — that keeps the
    /// component usable from a package-only preview instead of drawing a
    /// missing-image placeholder.
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
        var parts = ["Covers if \(outcome.coverCondition). Loses if \(outcome.loseCondition)."]
        if let push = outcome.pushCondition { parts.append("\(push) pushes.") }
        parts.append("Model projects \(outcome.modelCondition.lowercased()),")
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
        // NE +4.5 — half point, no push, cover zone starts left of the tie.
        SpreadCoverBar(line: 4.5, modelMargin: 2.1, pickAbbrev: "NE", opponentAbbrev: "SEA")
        // ATL +3 — whole point, push band, model has them LOSING but covering.
        SpreadCoverBar(line: 3, modelMargin: -0.3, pickAbbrev: "ATL", opponentAbbrev: "PIT")
        // LAC -10 — favourite laying a whole number, cushion of exactly 1.
        SpreadCoverBar(line: -10, modelMargin: 11, pickAbbrev: "LAC", opponentAbbrev: "ARI")
        // LAR -3.5 — favourite, half point, thin cushion.
        SpreadCoverBar(line: -3.5, modelMargin: 4.4, pickAbbrev: "LAR", opponentAbbrev: "SF")
    }
    .padding(20)
    .background(Color.appSurfaceElevated)
    .preferredColorScheme(.dark)
}
