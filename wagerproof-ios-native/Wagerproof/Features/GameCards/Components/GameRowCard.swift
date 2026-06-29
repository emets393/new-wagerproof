import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// Horizontal game row card used across every sport feed.
///
/// Composition:
///   - Top row: overlapping team avatars + each team's abbreviation /
///     moneyline below, compact spread + O/U pills, dual-line Polymarket
///     sparkline.
///   - Bottom row: model ML edge + O/U delta / edge implied.
///   - Game start time is nested in a small pill in the upper-right corner.
///
/// Container is a translucent Liquid Glass surface tinted with a
/// horizontal gradient of the two teams' primary colors (away on the
/// left, home on the right). The parent `GamesView` groups rows under
/// per-day sticky headers, so the row itself no longer carries a date.
struct GameRowCard: View {
    let model: Model
    var onPress: () -> Void = {}

    // Team palettes include very dark navies/blacks that vanish against the
    // dark card surface; we lift their brightness in dark mode (see
    // `Color.teamVisible(in:)`).
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: onPress) {
            content
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: model.id)
    }

    private var content: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        let isBreakdown = model.oddsBreakdown != nil
        let mammothTint = Color(hex: 0xF97316)
        return ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 8) {
                if let breakdown = model.oddsBreakdown {
                    breakdownScanRegion(breakdown)
                } else {
                    mainRow
                }
                Divider()
                    .background(Color.appBorder.opacity(0.5))
                extraInfoRow
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .clipped()
            // Breakdown cards use leading/top = cornerRadius − logoRadius so
            // the away logo lands pixel-concentric inside the rounded corner
            // (see `diagonalLogos`); trailing is tight so Pred Mkt hugs the
            // right edge. Other sports keep their roomier insets.
            .padding(.leading, isBreakdown ? BD.contentInset : 12)
            .padding(.trailing, isBreakdown ? 16 : 6)
            .padding(.top, isBreakdown ? BD.contentInset : 9)
            .padding(.bottom, 9)

            // When the breakdown table occupies the main row we relocate
            // the time pill to the bottom info row, so only sports without
            // a breakdown keep the upper-right time pill.
            if model.oddsBreakdown == nil {
                timePill
                    .padding(.top, 8)
                    .padding(.trailing, 10)
            }
        }
        .background {
            shape.fill(.ultraThinMaterial)
                .opacity(colorScheme == .dark ? 0.78 : 1)
        }
        .overlay {
            if model.isMammoth {
                shape.fill(
                    LinearGradient(
                        colors: [
                            mammothTint.opacity(colorScheme == .dark ? 0.20 : 0.12),
                            mammothTint.opacity(colorScheme == .dark ? 0.08 : 0.04),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .allowsHitTesting(false)
            }
        }
        .compositingGroup()
        .clipShape(shape)
        .overlay {
            shape.strokeBorder(
                model.isMammoth
                    ? mammothTint.opacity(0.55)
                    : Color.appBorder.opacity(0.4),
                lineWidth: model.isMammoth ? 1.2 : 0.5
            )
        }
        .overlay {
            if model.isMammoth {
                MammothElectricBorder(shape: shape, tint: mammothTint)
            }
        }
        .shadow(
            color: model.isMammoth ? mammothTint.opacity(0.32) : .black.opacity(0.06),
            radius: model.isMammoth ? 10 : 4,
            x: 0,
            y: model.isMammoth ? 5 : 2
        )
    }

    // MARK: - Main row

    /// Standard (non-breakdown) main row: overlapping team logos + lines
    /// pills + Polymarket sparkline. Breakdown cards (MLB) use
    /// `breakdownScanRegion` instead.
    @ViewBuilder
    private var mainRow: some View {
        HStack(alignment: .center, spacing: 10) {
            teamsBlock
            Spacer(minLength: 0)
            linesBlock
            sparklineBlock
        }
    }

    // MARK: - Time pill (upper right)

    @ViewBuilder
    private var timePill: some View {
        Text(model.timeLabel)
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .liquidGlassBackground(in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }

    // MARK: - Teams (overlapping circles + ML below each)

    @ViewBuilder
    private var teamsBlock: some View {
        VStack(spacing: 4) {
            // Wrap the two overlapping discs in a glass container so iOS 26
            // liquid-merges them where they touch (see `avatar`).
            LiquidGlassMergeContainer(spacing: BD.glassMerge) {
                HStack(spacing: -10) {
                    avatar(for: model.away, isLeading: true)
                    avatar(for: model.home, isLeading: false)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                teamLine(abbr: model.away.abbr, ml: model.away.moneyline)
                // "away @ home" separator, sitting between the two
                // abbreviations on the abbreviation baseline.
                Text("@")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                teamLine(abbr: model.home.abbr, ml: model.home.moneyline)
            }
        }
        .frame(width: 96)
    }

    /// Two team logos on a diagonal, symmetric about the block's center:
    /// away upper-left, home lower-right, their centers exactly `rowPitch`
    /// apart vertically so each lines up with its stat row. The block is the
    /// tallest thing in the scan HStack, so HStack centering makes the away
    /// logo's center land at (contentInset + logoRadius) = the corner-arc
    /// center → pixel-concentric with the rounded corner.
    @ViewBuilder
    private var diagonalLogos: some View {
        LiquidGlassMergeContainer(spacing: BD.glassMerge) {
            ZStack {
                avatar(for: model.away, isLeading: true, size: BD.logoSize)
                    .offset(x: -BD.logoXOff / 2, y: -BD.rowPitch / 2)
                avatar(for: model.home, isLeading: false, size: BD.logoSize)
                    .offset(x: BD.logoXOff / 2, y: BD.rowPitch / 2)
            }
        }
        .frame(width: BD.logoColW, height: BD.logoSize + BD.rowPitch)
    }

    @ViewBuilder
    private func avatar(for side: TeamSide, isLeading: Bool, size: CGFloat = 34) -> some View {
        let primary = side.colors.primary.teamVisible(in: colorScheme)
        let secondary = side.colors.secondary.teamVisible(in: colorScheme)
        // Logos are usually the team's primary color, so a primary-tinted disc
        // makes a same-color logo vanish (navy NY on navy, red C on red). When
        // the primary would blend with the disc, drop a contrasting plate right
        // behind the logo so it always reads.
        let plate = logoContrastPlate(for: primary)
        // The disc itself is now real Liquid Glass (iOS 26), slightly tinted
        // with the team's primary color, applied via `AvatarGlassDisc` below so
        // it sits behind the logo and can liquid-merge with its neighbor inside
        // the enclosing GlassEffectContainer. Pre-26 falls back to the old
        // neutral-base + team-tint gradient disc.
        ZStack {
            if let logoURL = side.logoURL, let url = URL(string: logoURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        ZStack {
                            // Contrast plate sits just inside the team-tint ring;
                            // padding insets the logo so the ring still reads as
                            // the team color around the contrasting chip.
                            if let plate {
                                Circle().fill(plate)
                            }
                            img.resizable().scaledToFit()
                                .padding(plate != nil ? size * 0.07 : 0)
                        }
                    default:
                        // No plate behind initials — the white text needs the
                        // darker team disc to stay legible.
                        Text(side.initials)
                            .font(.system(size: size * 0.32, weight: .bold))
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.25), radius: 1, x: 0, y: 1)
                    }
                }
                .frame(width: size * 0.82, height: size * 0.82)
                .clipShape(Circle())
            } else {
                Text(side.initials)
                    .font(.system(size: size * 0.35, weight: .bold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.25), radius: 1, x: 0, y: 1)
            }
        }
        .frame(width: size, height: size)
        // Liquid Glass disc behind the logo (iOS 26), tinted with the team
        // color; gradient-disc fallback on older OSes.
        .teamGlassDisc(primary: primary, secondary: secondary, tint: BD.glassTint)
        // One soft team-colored halo for depth. Kept light so it doesn't muddy
        // the glass or the merge seam between the two discs.
        .shadow(color: primary.opacity(0.22), radius: 5, x: 0, y: 1)
        .zIndex(isLeading ? 0 : 1)
    }

    /// A contrasting plate to drop behind a same-color logo. Logos are usually
    /// the team's primary color, so we compare that primary's luminance against
    /// the disc it sits on (dark `appSurfaceElevated` in dark mode, light in
    /// light mode). When they'd blend, return an opposite-luminance plate;
    /// otherwise `nil` (logo already reads, leave the soft team wash alone).
    private func logoContrastPlate(for primary: Color) -> Color? {
        let lum = primary.relativeLuminance
        switch colorScheme {
        case .dark:
            // Dark logo on the dark disc → very faint light wash. Just enough
            // to separate the logo from the dark surface while keeping most of
            // the team color visible (not a chip).
            return lum < 0.45 ? Color(white: 0.78).opacity(0.15) : nil
        default:
            // Light logo on the light disc → dark plate.
            return lum > 0.6 ? Color.black.opacity(0.55) : nil
        }
    }


    @ViewBuilder
    private func teamLine(abbr: String, ml: Int?) -> some View {
        VStack(spacing: 1) {
            Text(abbr)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(GameCardFormatting.formatMoneyline(ml))
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(moneylineColor(ml))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
    }

    private func moneylineColor(_ ml: Int?) -> Color {
        guard let ml else { return Color.appTextMuted }
        return ml < 0 ? Color.appAccentBlue : Color.appPrimary
    }

    // MARK: - Spread + O/U pills

    @ViewBuilder
    private var linesBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            spreadPill
            linePill(label: "O/U", value: ouText)
        }
    }

    /// Spread pill — surfaces the favorite team's abbreviation alongside
    /// the line so the user can read it as "BAL -1.5" rather than just
    /// "SPRD -1.5".
    @ViewBuilder
    private var spreadPill: some View {
        let info = spreadInfo
        linePill(label: info.label, value: info.value)
    }

    private var spreadInfo: (label: String, value: String) {
        let hs = model.home.spread
        let as_ = model.away.spread
        if let hs, let as_ {
            if hs < as_ {
                return (model.home.abbr, GameCardFormatting.formatSpread(hs))
            } else if as_ < hs {
                return (model.away.abbr, GameCardFormatting.formatSpread(as_))
            } else {
                return ("SPRD", GameCardFormatting.formatSpread(hs))
            }
        }
        if let hs {
            return (hs <= 0 ? model.home.abbr : model.away.abbr,
                    GameCardFormatting.formatSpread(hs <= 0 ? hs : -hs))
        }
        if let as_ {
            return (as_ <= 0 ? model.away.abbr : model.home.abbr,
                    GameCardFormatting.formatSpread(as_ <= 0 ? as_ : -as_))
        }
        return ("SPRD", "—")
    }

    private var ouText: String {
        GameCardFormatting.roundToNearestHalf(model.overLine)
    }

    @ViewBuilder
    private func linePill(label: String, value: String) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appTextPrimary)
        }
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }

    // MARK: - Polymarket sparkline

    private func polymarketChart(height: CGFloat) -> some View {
        PolymarketMoneylineSparkline(
            league: model.league,
            awayTeam: model.awayTeamFullName,
            homeTeam: model.homeTeamFullName,
            awayAbbr: model.away.abbr,
            homeAbbr: model.home.abbr,
            // Thin chart lines need more lift than the chunkier avatars, so the
            // dark team colors we detect get a higher brightness floor here (the
            // already-bright colors pass through teamVisible unchanged).
            awayColor: model.away.colors.primary.teamVisible(in: colorScheme, minBrightness: 0.72),
            homeColor: model.home.colors.primary.teamVisible(in: colorScheme, minBrightness: 0.72)
        )
        .frame(width: BD.sparkW, height: height)
    }

    @ViewBuilder
    private var sparklineBlock: some View {
        polymarketChart(height: 38)
    }

    // MARK: - Extra info row (model ML edge + O/U delta)

    @ViewBuilder
    private var extraInfoRow: some View {
        if let slatePicks = model.slatePicks {
            HStack(alignment: .bottom, spacing: 8) {
                VStack(alignment: .leading, spacing: 7) {
                    HStack(spacing: 8) {
                        slateTotalPill(slatePicks.total)
                        slateSpreadPill(slatePicks.spread)
                    }
                    if !slatePicks.badges.isEmpty {
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 7) {
                                ForEach(slatePicks.badges) { badge in
                                    slateBadgePill(badge)
                                }
                            }
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(slatePicks.badges) { badge in
                                    slateBadgePill(badge)
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Spacer(minLength: 0)
                if model.oddsBreakdown != nil {
                    timePill
                }
            }
        } else {
            HStack(spacing: 6) {
                ouEdgeBlock
                mlEdgeBlock
                Spacer(minLength: 0)
                // Time relocates here when the breakdown table takes over the
                // main row's upper-right corner.
                if model.oddsBreakdown != nil {
                    timePill
                }
            }
        }
    }

    /// Wrap edge content in the shared muted-capsule pill chrome used by the
    /// spread / O/U pills above, so the model-prediction pills sit
    /// left-aligned in the bottom row with a consistent look.
    @ViewBuilder
    private func edgePill<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: 4) {
            content()
        }
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }

    /// Model moneyline lean — which team the model favors and by how many
    /// percentage points of edge over the market.
    @ViewBuilder
    private var mlEdgeBlock: some View {
        edgePill {
            Text("ML")
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            if let edge = model.mlEdge {
                Text(edge.abbr)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(edge.formattedEdge)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(edge.color)
            } else {
                Text("—")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
    }

    /// Model total lean — whether it leans over or under, and the
    /// fair-total delta against the market line in points.
    @ViewBuilder
    private var ouEdgeBlock: some View {
        edgePill {
            Text("O/U")
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            if let edge = model.ouEdge {
                Text(edge.isOver ? "OVER" : "UNDER")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(edge.color)
                if let deltaText = edge.formattedDelta {
                    Text(deltaText)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(edge.color)
                }
                if let prob = edge.probabilityText {
                    Text(prob)
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                }
            } else {
                Text("—")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
    }

    /// Pill chrome for dry-run spread / total picks (NFL + CFB slates).
    @ViewBuilder
    private func slatePickPill<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: SlatePickMetrics.contentSpacing) {
            content()
        }
        .lineLimit(1)
        .padding(.horizontal, SlatePickMetrics.hPadding)
        .padding(.vertical, SlatePickMetrics.vPadding)
        .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }

    @ViewBuilder
    private func slateTotalPill(_ pick: SlateTotalPick?) -> some View {
        slatePickPill {
            Text("O/U")
                .font(.system(size: SlatePickMetrics.labelSize, weight: .black))
                .tracking(0.3)
                .foregroundStyle(Color.appTextMuted)
            if let pick {
                Text(pick.direction)
                    .font(.system(size: SlatePickMetrics.valueSize, weight: .black))
                    .foregroundStyle(pick.color)
                    .minimumScaleFactor(0.85)
                Text(pick.line)
                    .font(.system(size: SlatePickMetrics.valueSize, weight: .black, design: .monospaced))
                    .foregroundStyle(pick.color)
                    .minimumScaleFactor(0.85)
            } else {
                Text("—")
                    .font(.system(size: SlatePickMetrics.valueSize, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
    }

    @ViewBuilder
    private func slateSpreadPill(_ pick: SlateSpreadPick?) -> some View {
        slatePickPill {
            Text("Spread")
                .font(.system(size: SlatePickMetrics.labelSize, weight: .black))
                .tracking(0.3)
                .foregroundStyle(Color.appTextMuted)
            if let pick {
                avatar(
                    for: TeamSide(abbr: pick.abbr, initials: pick.abbr, moneyline: nil, spread: nil, logoURL: pick.logoURL, colors: pick.colors),
                    isLeading: true,
                    size: SlatePickMetrics.logoSize
                )
                Text(pick.line)
                    .font(.system(size: SlatePickMetrics.valueSize, weight: .black, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .minimumScaleFactor(0.85)
            } else {
                Text("—")
                    .font(.system(size: SlatePickMetrics.valueSize, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
            }
        }
    }

    @ViewBuilder
    private func slateBadgePill(_ badge: SlateBadge) -> some View {
        let content = HStack(spacing: 4) {
            Image(systemName: badge.systemImage)
                .font(.system(size: 10, weight: .black))
            Text(badge.text)
                .font(.system(size: 10, weight: .black))
                .tracking(badge.isMammothPlay ? 0.6 : 0)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)

        if badge.isMammothPlay {
            content
                .foregroundStyle(Color.appSurface)
                .background(
                    LinearGradient(
                        colors: [Color(hex: 0xF97316), Color(hex: 0xFACC15)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    in: Capsule()
                )
                .overlay(Capsule().stroke(Color.white.opacity(0.35), lineWidth: 0.5))
                .shadow(color: Color(hex: 0xF97316).opacity(0.45), radius: 6, x: 0, y: 2)
        } else {
            content
                .foregroundStyle(badge.tint)
                .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
                .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
        }
    }

    private enum SlatePickMetrics {
        static let labelSize: CGFloat = 10
        static let valueSize: CGFloat = 13
        static let logoSize: CGFloat = 22
        static let hPadding: CGFloat = 10
        static let vPadding: CGFloat = 6
        static let contentSpacing: CGFloat = 5
    }

    // MARK: - Spread / Money / Total breakdown (scan-line layout)

    /// Breakdown card top region. Two horizontal scan lines (away, home),
    /// each aligning its logo center · abbreviation · SPRD/ML/TOT cells on a
    /// single row, with the Pred Mkt chart spanning both on the right. The
    /// column labels sit BELOW the widgets so the rows can ride at the logo
    /// centers (see `diagonalLogos`).
    /// Column-major so spacing is even across every column: the logos,
    /// abbreviation, SPRD / ML / TOT cells, and the Pred Mkt chart are all
    /// siblings separated by equal `Spacer`s. Each column is a VStack with
    /// the away value on the top scan line and the home value on the bottom,
    /// and the labels row beneath mirrors the same columns + spacers.
    @ViewBuilder
    private func breakdownScanRegion(_ breakdown: OddsBreakdown) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // alignment .center: the logo block is the tallest child, so
            // every column centers on its vertical midline → away row aligns
            // with the away logo center, home row with the home logo center.
            // The six-pack is its own tightly-spaced group; equal outer
            // spacers keep the gaps logos↔group and group↔chart even.
            HStack(alignment: .center, spacing: 0) {
                diagonalLogos
                Spacer(minLength: BD.colSpacing)
                sixPackGroup(breakdown)
                Spacer(minLength: BD.colSpacing)
                polymarketChart(height: BD.chartH)
            }
            // Pull the labels up into the centering whitespace beneath the
            // value rows so they sit tight under their columns (the tall
            // logo block otherwise leaves a gap below the shorter rows).
            breakdownLabelsRow
                .padding(.top, -6)
        }
    }

    /// The tightly-spaced abbr + SPRD/ML/TOT columns.
    @ViewBuilder
    private func sixPackGroup(_ breakdown: OddsBreakdown) -> some View {
        HStack(spacing: BD.innerGap) {
            abbrColumn(away: breakdown.away.abbr, home: breakdown.home.abbr)
            valueColumn(away: breakdown.away.spread, home: breakdown.home.spread)
            valueColumn(away: breakdown.away.moneyline, home: breakdown.home.moneyline)
            valueColumn(away: breakdown.away.total, home: breakdown.home.total)
        }
    }

    @ViewBuilder
    private func abbrColumn(away: String, home: String) -> some View {
        VStack(spacing: 0) {
            abbrCell(away)
            abbrCell(home)
        }
        .frame(width: BD.abbrW)
    }

    @ViewBuilder
    private func abbrCell(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.appTextSecondary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: BD.rowPitch)
    }

    @ViewBuilder
    private func valueColumn(away: String, home: String) -> some View {
        // spacing 0 + each cell == rowPitch tall keeps the two row centers
        // exactly `rowPitch` apart, matching the logo centers' vertical gap.
        VStack(spacing: 0) {
            breakdownCell(away)
            breakdownCell(home)
        }
    }

    @ViewBuilder
    private func breakdownCell(_ value: String) -> some View {
        Text(value)
            .font(.system(size: 13, weight: .bold, design: .monospaced))
            .foregroundStyle(Color.appTextPrimary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(width: BD.cellW)
            .padding(.vertical, 3)
            .background(Color.appSurfaceMuted.opacity(0.6), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5)
            )
            .frame(height: BD.rowPitch)
    }

    /// Column labels beneath the widgets. Same widths + same grouping as the
    /// scan region, so SPRD/ML/TOT/PRED MKT sit under their values.
    @ViewBuilder
    private var breakdownLabelsRow: some View {
        HStack(spacing: 0) {
            Color.clear.frame(width: BD.logoColW, height: 1)
            Spacer(minLength: BD.colSpacing)
            HStack(spacing: BD.innerGap) {
                Color.clear.frame(width: BD.abbrW, height: 1)
                breakdownHeader("Spread", width: BD.cellW)
                breakdownHeader("ML", width: BD.cellW)
                breakdownHeader("TOT", width: BD.cellW)
            }
            Spacer(minLength: BD.colSpacing)
            breakdownHeader("PRED MKT", width: BD.sparkW)
        }
    }

    @ViewBuilder
    private func breakdownHeader(_ title: String, width: CGFloat) -> some View {
        Text(title)
            .font(.system(size: 8, weight: .bold))
            .tracking(0.4)
            .foregroundStyle(Color.appTextMuted)
            .frame(width: width)
    }

    /// Geometry for the breakdown scan-line layout. `contentInset` =
    /// cornerRadius − logoRadius so the away logo nests concentrically in
    /// the rounded corner.
    private enum BD {
        static let logoSize: CGFloat = 38
        static let logoXOff: CGFloat = 19   // horizontal diagonal offset
        static let rowPitch: CGFloat = 22   // vertical gap between scan lines
        static let logoColW: CGFloat = logoSize + logoXOff   // 57
        static let abbrW: CGFloat = 33
        static let cellW: CGFloat = 44
        static let innerGap: CGFloat = 4    // tight spacing inside the six-pack
        static let colSpacing: CGFloat = 6  // gap between logos / six-pack / chart
        static let sparkW: CGFloat = 98
        static let chartH: CGFloat = 52
        static let cornerRadius: CGFloat = 26
        static let contentInset: CGFloat = cornerRadius - logoSize / 2   // 7

        // Liquid Glass avatar discs (iOS 26+). `glassTint` is how strongly the
        // team's primary color bleeds into the glass — kept low so the disc
        // reads as a slight team wash, not a solid fill. `glassMerge` is the
        // GlassEffectContainer proximity threshold: the two overlapping avatars
        // (HStack spacing -10) sit well within it, so the system fuses them into
        // one fluid blob with a color transition where the two tints meet.
        static let glassTint: Double = 0.5
        static let glassMerge: CGFloat = 16
    }
}

extension GameRowCard {
    /// Normalized payload shared across every sport. Each sport-specific
    /// `*GameCard` adapts its model into this shape.
    struct Model: Identifiable {
        let id: String
        let league: String
        let dateLabel: String
        let timeLabel: String
        let away: TeamSide
        let home: TeamSide
        let overLine: Double?
        let mlEdge: MLEdgeInfo?
        let ouEdge: OUEdgeInfo?
        let awayTeamFullName: String
        let homeTeamFullName: String
        let slatePicks: SlatePicks?
        /// Optional Spread / Money / Total breakdown table rendered below
        /// the edge row. Only MLB populates this today; other sports leave
        /// it nil and the card falls back to the compact pills.
        let oddsBreakdown: OddsBreakdown?
        /// Rare mammoth play — lights the card orange on the games slate.
        let isMammoth: Bool

        init(
            id: String,
            league: String,
            dateLabel: String,
            timeLabel: String,
            away: TeamSide,
            home: TeamSide,
            overLine: Double?,
            mlEdge: MLEdgeInfo?,
            ouEdge: OUEdgeInfo?,
            awayTeamFullName: String,
            homeTeamFullName: String,
            slatePicks: SlatePicks? = nil,
            oddsBreakdown: OddsBreakdown? = nil,
            isMammoth: Bool = false
        ) {
            self.id = id
            self.league = league
            self.dateLabel = dateLabel
            self.timeLabel = timeLabel
            self.away = away
            self.home = home
            self.overLine = overLine
            self.mlEdge = mlEdge
            self.ouEdge = ouEdge
            self.awayTeamFullName = awayTeamFullName
            self.homeTeamFullName = homeTeamFullName
            self.slatePicks = slatePicks
            self.oddsBreakdown = oddsBreakdown
            self.isMammoth = isMammoth
        }
    }

    /// Mammoth trumps high conviction; signals badge is unchanged.
    static func convictionBadges(
        hasMammoth: Bool,
        highCount: Int,
        signalCount: Int
    ) -> [SlateBadge] {
        let orange = Color(hex: 0xF97316)
        var badges: [SlateBadge] = []
        if hasMammoth {
            badges.append(SlateBadge(
                id: "mammoth",
                text: "MAMMOTH PLAY",
                systemImage: "flame.fill",
                tint: orange,
                isMammothPlay: true
            ))
        } else if highCount > 0 {
            badges.append(SlateBadge(
                id: "high-conviction",
                text: "\(highCount) High Conviction",
                systemImage: "flame.fill",
                tint: orange
            ))
        }
        if signalCount > 0 {
            badges.append(SlateBadge(
                id: "signals",
                text: "\(signalCount) Signal\(signalCount == 1 ? "" : "s")",
                systemImage: "bolt.fill",
                tint: Color.appTextSecondary
            ))
        }
        return badges
    }

    struct SlatePicks {
        let total: SlateTotalPick?
        let spread: SlateSpreadPick?
        let badges: [SlateBadge]
    }

    struct SlateBadge: Identifiable {
        let id: String
        let text: String
        let systemImage: String
        let tint: Color
        var isMammothPlay: Bool = false
    }

    struct SlateTotalPick {
        let direction: String
        let line: String
        let color: Color
    }

    struct SlateSpreadPick {
        let abbr: String
        let logoURL: String?
        let line: String
        let colors: TeamColorPair
    }

    /// Spread / Money / Total breakdown — one row per team, three columns.
    /// Values are pre-formatted display strings so the table view stays
    /// presentation-only. The `total` convention is Over on the away row
    /// and Under on the home row, mirroring the web odds breakdown.
    struct OddsBreakdown {
        struct Row {
            let abbr: String
            let spread: String
            let moneyline: String
            let total: String
        }
        let away: Row
        let home: Row
    }

    struct TeamSide {
        let abbr: String
        let initials: String
        let moneyline: Int?
        let spread: Double?
        let logoURL: String?
        let colors: TeamColorPair
    }

    /// Model's edge on the moneyline vs the market — the side with the
    /// most positive `(modelProb - vegasImpliedProb)` and the magnitude
    /// of that delta in percentage points.
    struct MLEdgeInfo {
        let abbr: String
        let edgePoints: Double   // signed percentage points; we render `abs`
        let color: Color

        var formattedEdge: String {
            let magnitude = String(format: "%.1f", abs(edgePoints))
            return "+\(magnitude)%"
        }
    }

    /// Model's O/U signal. Carries direction (over/under), an optional
    /// fair-total delta vs the market line, and the optional probability
    /// the model assigns to that direction. Sports without a fair-total
    /// model (NFL) populate just the direction + probability.
    struct OUEdgeInfo {
        let isOver: Bool
        let delta: Double?         // model fair total − market line (signed)
        let probability: Double?   // 0…1 confidence on the chosen side
        let color: Color

        var formattedDelta: String? {
            guard let delta else { return nil }
            let sign = delta >= 0 ? "+" : ""
            return "\(sign)\(String(format: "%.1f", delta))"
        }

        var probabilityText: String? {
            guard let probability else { return nil }
            return "\(Int((probability * 100).rounded()))%"
        }
    }
}

// MARK: - Edge math helpers (shared across sport adapters)

enum GameEdgeMath {
    /// Vegas implied win probability from a US moneyline.
    static func impliedProb(_ ml: Int) -> Double {
        if ml < 0 {
            return Double(-ml) / Double(-ml + 100)
        } else {
            return 100.0 / Double(ml + 100)
        }
    }

    /// Compute the model ML edge using the home win probability the
    /// sport's predictions table publishes. Picks whichever side has the
    /// larger positive edge over Vegas.
    static func mlEdge(
        modelHomeProb: Double?,
        homeMl: Int?,
        awayMl: Int?,
        homeAbbr: String,
        awayAbbr: String
    ) -> GameRowCard.MLEdgeInfo? {
        guard let modelHomeProb else { return nil }
        let homeVegas = homeMl.map(impliedProb)
        let awayVegas = awayMl.map(impliedProb)
        // Edge in percentage points
        let homeEdge = (modelHomeProb - (homeVegas ?? (1 - modelHomeProb))) * 100
        let awayEdge = ((1 - modelHomeProb) - (awayVegas ?? modelHomeProb)) * 100
        if homeEdge >= awayEdge {
            guard homeEdge.isFinite else { return nil }
            return GameRowCard.MLEdgeInfo(
                abbr: homeAbbr, edgePoints: homeEdge, color: edgeColor(homeEdge)
            )
        } else {
            guard awayEdge.isFinite else { return nil }
            return GameRowCard.MLEdgeInfo(
                abbr: awayAbbr, edgePoints: awayEdge, color: edgeColor(awayEdge)
            )
        }
    }

    /// Build an O/U edge struct from a model fair-total + market line and
    /// the model's `ouResultProb`. Either can be nil; we surface whatever
    /// data the sport happens to publish.
    static func ouEdge(
        modelFairTotal: Double?,
        marketLine: Double?,
        ouResultProb: Double?
    ) -> GameRowCard.OUEdgeInfo? {
        // Direction comes from whichever signal we have. Prefer the
        // model probability (sport publishes it for free) and fall back
        // to the fair-vs-market delta.
        let isOver: Bool?
        if let p = ouResultProb {
            isOver = p >= 0.5
        } else if let mf = modelFairTotal, let ml = marketLine {
            isOver = mf >= ml
        } else {
            isOver = nil
        }
        guard let isOver else { return nil }

        let delta: Double?
        if let mf = modelFairTotal, let ml = marketLine {
            delta = mf - ml
        } else {
            delta = nil
        }

        let prob: Double? = ouResultProb.map { isOver ? $0 : (1 - $0) }

        // Color by the magnitude of whichever signal we have (delta in
        // total points, or the confidence above 50%).
        let magnitude: Double = {
            if let delta { return abs(delta) }
            if let p = prob { return (p - 0.5) * 20 } // scale 0.5→1.0 to 0→10
            return 0
        }()

        return GameRowCard.OUEdgeInfo(
            isOver: isOver,
            delta: delta,
            probability: prob,
            color: edgeColor(magnitude)
        )
    }

    /// Tier the magnitude (in pct points or total points) to one of four
    /// confidence colors. Mirrors the legacy `getEdgeColor` palette so
    /// the rest of the app still feels consistent.
    static func edgeColor(_ magnitude: Double) -> Color {
        let abs = Swift.abs(magnitude)
        if abs >= 5 { return Color(red: 0.13, green: 0.77, blue: 0.37) }
        if abs >= 3 { return Color(red: 0.52, green: 0.80, blue: 0.09) }
        if abs >= 2 { return Color(red: 0.92, green: 0.70, blue: 0.03) }
        return Color(red: 0.98, green: 0.45, blue: 0.09)
    }
}

/// Compact dual-line Polymarket moneyline sparkline.
struct PolymarketMoneylineSparkline: View {
    let league: String
    let awayTeam: String
    let homeTeam: String
    let awayAbbr: String
    let homeAbbr: String
    let awayColor: Color
    let homeColor: Color

    @State private var points: [PolymarketPricePoint] = []
    @State private var loaded: Bool = false

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            edgeBadge
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        .task(id: "\(league)|\(awayTeam)|\(homeTeam)") {
            let data = await PolymarketService.shared.markets(
                league: league,
                awayTeam: awayTeam,
                homeTeam: homeTeam
            )
            await MainActor.run {
                self.points = data?.moneyline?.priceHistory ?? []
                self.loaded = true
            }
        }
    }

    @ViewBuilder
    private var edgeBadge: some View {
        if let latest = points.last?.p {
            let awayPct = Int((latest * 100).rounded())
            let homePct = 100 - awayPct
            let leader = awayPct >= homePct
                ? (abbr: awayAbbr, pct: awayPct, color: awayColor)
                : (abbr: homeAbbr, pct: homePct, color: homeColor)
            HStack(spacing: 3) {
                Circle()
                    .fill(leader.color)
                    .frame(width: 5, height: 5)
                Text("\(leader.abbr) \(leader.pct)%")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(leader.color)
                    .lineLimit(1)
            }
        } else {
            Text("POLY ML")
                .font(.system(size: 7, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
        }
    }

    @ViewBuilder
    private var content: some View {
        if !loaded {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.appSurfaceMuted)
                .frame(height: 24)
                .redacted(reason: .placeholder)
        } else if points.count >= 2 {
            sparkline
        } else {
            emptyPlaceholder
        }
    }

    @ViewBuilder
    private var sparkline: some View {
        let series = Array(points.suffix(40))
        let awayValues = series.map { $0.p }
        let homeValues = series.map { 1 - $0.p }
        let leaderAway = (series.last?.p ?? 0.5) >= 0.5

        Canvas { ctx, size in
            drawCurve(
                ctx: ctx, size: size, values: awayValues,
                color: awayColor,
                width: leaderAway ? 1.8 : 1.0,
                alpha: leaderAway ? 1.0 : 0.55
            )
            drawCurve(
                ctx: ctx, size: size, values: homeValues,
                color: homeColor,
                width: leaderAway ? 1.0 : 1.8,
                alpha: leaderAway ? 0.55 : 1.0
            )
        }
        .frame(height: 24)
    }

    private func drawCurve(
        ctx: GraphicsContext, size: CGSize,
        values: [Double], color: Color, width: CGFloat, alpha: Double
    ) {
        guard values.count >= 2 else { return }
        let combined = values + values.map { 1 - $0 }
        let minVal = combined.min() ?? 0
        let maxVal = combined.max() ?? 1
        let range = max(0.001, maxVal - minVal)
        var path = Path()
        for (idx, val) in values.enumerated() {
            let x = CGFloat(idx) / CGFloat(values.count - 1) * size.width
            let normalized = (val - minVal) / range
            let y = size.height - CGFloat(normalized) * size.height
            if idx == 0 {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }
        ctx.stroke(
            path,
            with: .color(color.opacity(alpha)),
            style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)
        )
    }

    @ViewBuilder
    private var emptyPlaceholder: some View {
        HStack(spacing: 3) {
            Image(systemName: "chart.line.flattrend.xyaxis")
                .font(.system(size: 10))
            Text("—")
                .font(.system(size: 9, weight: .semibold))
        }
        .foregroundStyle(Color.appTextMuted.opacity(0.6))
        .frame(height: 24)
    }
}

// MARK: - Mammoth electric border

/// Animated orange energy ring for rare mammoth plays on the games slate.
private struct MammothElectricBorder: View {
    let shape: RoundedRectangle
    let tint: Color

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            let pulse = 0.55 + 0.45 * sin(t * 5.5)
            let spin = Angle.degrees(t * 95)
            ZStack {
                shape
                    .strokeBorder(
                        AngularGradient(
                            gradient: Gradient(colors: [
                                tint.opacity(0.05),
                                tint.opacity(0.95),
                                Color(hex: 0xFACC15).opacity(0.85),
                                tint.opacity(0.15),
                                tint.opacity(0.9),
                                tint.opacity(0.05),
                            ]),
                            center: .center,
                            angle: spin
                        ),
                        lineWidth: 2.5
                    )
                shape
                    .strokeBorder(tint.opacity(0.30 + 0.30 * pulse), lineWidth: 1)
            }
        }
        .allowsHitTesting(false)
    }
}

extension Color {
    /// Lift very dark team colors toward a visible minimum brightness in
    /// dark mode so navy/black palettes don't disappear against the dark
    /// card surface. No-op in light mode and for colors already bright
    /// enough. Hue/saturation are preserved (saturation eased slightly) so
    /// the team still reads as "its" color, just legibly.
    func teamVisible(in scheme: ColorScheme, minBrightness: CGFloat = 0.5) -> Color {
        guard scheme == .dark else { return self }
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard UIColor(self).getHue(&h, saturation: &s, brightness: &b, alpha: &a),
              b < minBrightness else { return self }
        return Color(hue: Double(h), saturation: Double(s) * 0.9, brightness: Double(minBrightness), opacity: Double(a))
    }

    /// WCAG relative luminance (0 = black … 1 = white). Used to decide whether a
    /// team-color logo would blend into the disc behind it and needs a
    /// contrasting plate.
    var relativeLuminance: Double {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        func lin(_ c: CGFloat) -> Double {
            let c = Double(c)
            return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
}
