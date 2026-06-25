import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `wagerproof-mobile/components/nfl/PublicBettingBars.tsx`.
///
/// Renders the NFL "Public Lean" widget — three stacked sections (Moneyline,
/// Spread, Total) where each row shows the % of bets and % of money on each
/// side via a 5-segment speedometer gauge. The CFB variant lives at
/// `Features/CFB/Components/PublicBettingBars.swift` and is simpler because
/// CFB only carries the human-readable `*_splits_label` strings — NFL carries
/// raw decimal percentages alongside the labels.
///
/// The gauge draws as 5 colored arc segments plus a needle pinned to the
/// exact percentage. Mirrors RN's `SemiGauge` SVG implementation pixel-for-pixel.
struct NFLPublicBettingBars: View {
    // ML
    let homeMlBets: String?
    let awayMlBets: String?
    let homeMlHandle: String?
    let awayMlHandle: String?
    let mlSplitsLabel: String?
    // Spread
    let homeSpreadBets: String?
    let awaySpreadBets: String?
    let homeSpreadHandle: String?
    let awaySpreadHandle: String?
    let spreadSplitsLabel: String?
    // Total
    let overBets: String?
    let underBets: String?
    let overHandle: String?
    let underHandle: String?
    let totalSplitsLabel: String?

    let homeTeam: String
    let awayTeam: String

    /// Build from an `NFLPrediction` so callers don't need to spell out all
    /// 14 split fields. Most embed sites will use this initializer.
    init(prediction: NFLPrediction) {
        self.init(
            homeMlBets: prediction.homeMlBets, awayMlBets: prediction.awayMlBets,
            homeMlHandle: prediction.homeMlHandle, awayMlHandle: prediction.awayMlHandle,
            mlSplitsLabel: prediction.mlSplitsLabel,
            homeSpreadBets: prediction.homeSpreadBets, awaySpreadBets: prediction.awaySpreadBets,
            homeSpreadHandle: prediction.homeSpreadHandle, awaySpreadHandle: prediction.awaySpreadHandle,
            spreadSplitsLabel: prediction.spreadSplitsLabel,
            overBets: prediction.overBets, underBets: prediction.underBets,
            overHandle: prediction.overHandle, underHandle: prediction.underHandle,
            totalSplitsLabel: prediction.totalSplitsLabel,
            homeTeam: prediction.homeTeam, awayTeam: prediction.awayTeam
        )
    }

    init(
        homeMlBets: String? = nil, awayMlBets: String? = nil,
        homeMlHandle: String? = nil, awayMlHandle: String? = nil,
        mlSplitsLabel: String? = nil,
        homeSpreadBets: String? = nil, awaySpreadBets: String? = nil,
        homeSpreadHandle: String? = nil, awaySpreadHandle: String? = nil,
        spreadSplitsLabel: String? = nil,
        overBets: String? = nil, underBets: String? = nil,
        overHandle: String? = nil, underHandle: String? = nil,
        totalSplitsLabel: String? = nil,
        homeTeam: String, awayTeam: String
    ) {
        self.homeMlBets = homeMlBets; self.awayMlBets = awayMlBets
        self.homeMlHandle = homeMlHandle; self.awayMlHandle = awayMlHandle
        self.mlSplitsLabel = mlSplitsLabel
        self.homeSpreadBets = homeSpreadBets; self.awaySpreadBets = awaySpreadBets
        self.homeSpreadHandle = homeSpreadHandle; self.awaySpreadHandle = awaySpreadHandle
        self.spreadSplitsLabel = spreadSplitsLabel
        self.overBets = overBets; self.underBets = underBets
        self.overHandle = overHandle; self.underHandle = underHandle
        self.totalSplitsLabel = totalSplitsLabel
        self.homeTeam = homeTeam; self.awayTeam = awayTeam
    }

    var body: some View {
        // RN renders nothing if no section has data — preserve that early-exit.
        if !hasAnyData {
            EmptyView()
        } else {
            // Title + card chrome now live in the hosting `WidgetSection`
            // ("Public Lean") so this widget renders chromeless and pins
            // cleanly under its handed-off header (iOS Weather pattern).
            VStack(alignment: .leading, spacing: 0) {
                VStack(spacing: 16) {
                    if hasMlData {
                        section(
                            title: "Moneyline",
                            icon: "chart.line.uptrend.xyaxis",
                            iconColor: Color(hex: 0x3B82F6),
                            label: parseLabelForRow(mlSplitsLabel)
                        ) {
                            teamRow(team: awayTeam, betsPercent: percent(awayMlBets), handlePercent: percent(awayMlHandle))
                            teamRow(team: homeTeam, betsPercent: percent(homeMlBets), handlePercent: percent(homeMlHandle))
                        }
                    }
                    if hasSpreadData {
                        section(
                            title: "Spread",
                            icon: "target",
                            iconColor: Color(hex: 0x22C55E),
                            label: parseLabelForRow(spreadSplitsLabel)
                        ) {
                            teamRow(team: awayTeam, betsPercent: percent(awaySpreadBets), handlePercent: percent(awaySpreadHandle))
                            teamRow(team: homeTeam, betsPercent: percent(homeSpreadBets), handlePercent: percent(homeSpreadHandle))
                        }
                    }
                    if hasTotalData {
                        section(
                            title: "Total",
                            icon: "chart.bar.fill",
                            iconColor: Color(hex: 0xF97316),
                            label: parseLabelForRow(totalSplitsLabel)
                        ) {
                            totalRow(side: .over, betsPercent: percent(overBets), handlePercent: percent(overHandle))
                            totalRow(side: .under, betsPercent: percent(underBets), handlePercent: percent(underHandle))
                        }
                    }
                }

                explanationSection
                    .padding(.top, 16)
            }
        }
    }

    // MARK: - Section / row builders

    @ViewBuilder
    private func section<RowsContent: View>(
        title: String,
        icon: String,
        iconColor: Color,
        label: LabelRowInfo?,
        @ViewBuilder rows: () -> RowsContent
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(iconColor)
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            HStack(spacing: 0) {
                VStack(spacing: 0) {
                    headerRow
                    rows()
                }
                .frame(maxWidth: .infinity)

                if let label {
                    indicator(label: label)
                        .frame(width: 100)
                        .overlay(
                            Rectangle()
                                .fill(Color(hex: 0x64748B, opacity: 0.15))
                                .frame(width: 1),
                            alignment: .leading
                        )
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(hex: 0x64748B, opacity: 0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color(hex: 0x64748B, opacity: 0.20), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var headerRow: some View {
        HStack(spacing: 0) {
            Text("Team")
                .modifier(NFLHeaderText())
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 10)
            Text("Bets")
                .modifier(NFLHeaderText())
                .frame(maxWidth: .infinity)
            Text("Money")
                .modifier(NFLHeaderText())
                .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 8)
        .padding(.trailing, 10)
        .overlay(
            Rectangle()
                .fill(Color(hex: 0x64748B, opacity: 0.15))
                .frame(height: 1),
            alignment: .bottom
        )
    }

    @ViewBuilder
    private func teamRow(team: String, betsPercent: Int?, handlePercent: Int?) -> some View {
        let colors = NFLTeamColors.colors(for: team)
        HStack(spacing: 6) {
            LinearGradient(
                colors: [colors.primary, colors.secondary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .frame(width: 26, height: 26)
            .clipShape(Circle())
            .overlay(
                Text(NFLTeamColors.initials(for: team))
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(NFLTeamColors.contrastingTextColor(primary: colors.primary, secondary: colors.secondary))
            )
            .padding(.leading, 10)
            .frame(maxWidth: .infinity, alignment: .leading)

            SemiGauge(percent: betsPercent)
                .frame(maxWidth: .infinity)

            SemiGauge(percent: handlePercent)
                .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func totalRow(side: TotalSide, betsPercent: Int?, handlePercent: Int?) -> some View {
        let isOver = side == .over
        let iconColor = isOver ? Color(hex: 0xF97316) : Color(hex: 0x3B82F6)
        let bgColor = isOver
            ? Color(hex: 0xF97316, opacity: 0.15)
            : Color(hex: 0x3B82F6, opacity: 0.15)
        HStack(spacing: 6) {
            ZStack {
                Circle().fill(bgColor).frame(width: 26, height: 26)
                Image(systemName: isOver ? "chevron.up" : "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(iconColor)
            }
            .padding(.leading, 10)
            Text(side == .over ? "Over" : "Under")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            SemiGauge(percent: betsPercent)
                .frame(maxWidth: .infinity)

            SemiGauge(percent: handlePercent)
                .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func indicator(label: LabelRowInfo) -> some View {
        // Indicator badge — uses the same color RN uses (`#22C55E`), with the
        // amber/blue alternates only used by the explanation legend below.
        VStack(spacing: 4) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color(hex: 0x22C55E))
            Text(label.labelText)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color(hex: 0x22C55E))
                .multilineTextAlignment(.center)
                .lineSpacing(2)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color(hex: 0x22C55E, opacity: 0.15))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Color(hex: 0x22C55E, opacity: 0.30), lineWidth: 1)
        )
        .padding(8)
    }

    // MARK: - Explanation legend

    private var explanationSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                Text("HOW TO READ")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.3)
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(.bottom, 4)

            explanationItem(label: "Bets", text: "% of total bets placed on each side")
            explanationItem(label: "Money", text: "% of total dollars wagered on each side")

            Rectangle()
                .fill(Color(hex: 0x64748B, opacity: 0.15))
                .frame(height: 1)
                .padding(.vertical, 8)

            Text("Indicators:")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .padding(.bottom, 4)

            indicatorItem(label: "Consensus", color: Color(hex: 0x22C55E),
                          text: "Both bets and money heavily favor one side")
            indicatorItem(label: "Sharp", color: Color(hex: 0x3B82F6),
                          text: "Public bets one way, but smart money goes the other — follow the money")
            indicatorItem(label: "Public", color: Color(hex: 0xF97316),
                          text: "Money is split evenly, but casual bettors lean heavily one way")
        }
        .padding(.top, 16)
        .overlay(
            Rectangle()
                .fill(Color(hex: 0x64748B, opacity: 0.20))
                .frame(height: 1),
            alignment: .top
        )
    }

    @ViewBuilder
    private func explanationItem(label: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    @ViewBuilder
    private func indicatorItem(label: String, color: Color, text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(color)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    // MARK: - Helpers

    private var hasMlData: Bool {
        anyNonEmpty(homeMlBets, awayMlBets, homeMlHandle, awayMlHandle, mlSplitsLabel)
    }
    private var hasSpreadData: Bool {
        anyNonEmpty(homeSpreadBets, awaySpreadBets, homeSpreadHandle, awaySpreadHandle, spreadSplitsLabel)
    }
    private var hasTotalData: Bool {
        anyNonEmpty(overBets, underBets, overHandle, underHandle, totalSplitsLabel)
    }
    private var hasAnyData: Bool { hasMlData || hasSpreadData || hasTotalData }

    private func anyNonEmpty(_ values: String?...) -> Bool {
        values.contains { ($0?.isEmpty == false) }
    }

    /// "0.61" → 61. Returns nil for missing or unparseable. Mirrors RN's
    /// `toPercent` helper.
    private func percent(_ raw: String?) -> Int? {
        guard let raw, let n = Double(raw) else { return nil }
        return Int((n * 100).rounded())
    }

    private enum TotalSide { case over, under }

    // MARK: - Label-row parsing

    /// `LabelRowInfo` mirrors RN's `parseLabelForRow` return shape — we only
    /// surface `labelText` for now since indicator placement (which row gets
    /// the badge) was simplified in this batch to "indicator spans both rows
    /// to the right". The full per-row positioning is deferred.
    struct LabelRowInfo: Hashable {
        let labelText: String
        let isSharp: Bool
    }

    private func parseLabelForRow(_ label: String?) -> LabelRowInfo? {
        guard let label, !label.isEmpty else { return nil }
        let lower = label.lowercased()
        return LabelRowInfo(labelText: label, isSharp: lower.contains("sharp"))
    }
}

private struct NFLHeaderText: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.3)
            .foregroundStyle(Color.appTextSecondary)
            .textCase(.uppercase)
            .multilineTextAlignment(.center)
    }
}

// MARK: - Semi-gauge speedometer

/// 5-segment colored arc + a needle pointing at the exact percentage.
/// Direct port of RN's `SemiGauge` SVG component. SwiftUI `Canvas` was
/// preferred over `Path` views because the per-frame stroke + opacity logic
/// is purely numeric and Canvas avoids a stack of overlapping `Path` views.
private struct SemiGauge: View {
    let percent: Int?

    private let size: CGFloat = 36
    private let strokeWidth: CGFloat = 5

    var body: some View {
        // RN renders the gauge at 36×(18+6)=24pt tall. Match that bounding
        // box to keep alignment within the row.
        Canvas { context, _ in
            let radius = (size - strokeWidth) / 2
            let centerX = size / 2
            let centerY = size / 2 + 2
            let segmentColors: [Color] = [
                Color(hex: 0xEF4444), Color(hex: 0xF97316), Color(hex: 0xEAB308),
                Color(hex: 0x84CC16), Color(hex: 0x22C55E)
            ]

            // 5 segment boundary angles along π → 0 (left → right of half-disk).
            let segAngles: [Double] = [.pi, .pi * 0.8, .pi * 0.6, .pi * 0.4, .pi * 0.2, 0]
            let position = gaugePosition

            for seg in 0..<5 {
                let start = segAngles[seg]
                let end = segAngles[seg + 1]
                let p1 = CGPoint(x: centerX + radius * cos(start), y: centerY - radius * sin(start))
                let p2 = CGPoint(x: centerX + radius * cos(end), y: centerY - radius * sin(end))
                var path = Path()
                path.move(to: p1)
                // SVG `A rx ry 0 0 1 x y` = small-arc / sweep-clockwise. The
                // SwiftUI Path equivalent is `addArc(center:radius:start:end:clockwise:)`
                // — note SwiftUI's `clockwise` is opposite of the math convention.
                path.addArc(
                    center: CGPoint(x: centerX, y: centerY),
                    radius: radius,
                    startAngle: .radians(-start),
                    endAngle: .radians(-end),
                    clockwise: false
                )
                _ = p2 // silence warning; arc end is implicit from `endAngle`
                let opacity = (seg == position) ? 1.0 : 0.4
                context.stroke(
                    path,
                    with: .color(segmentColors[seg].opacity(opacity)),
                    style: StrokeStyle(lineWidth: strokeWidth, lineCap: .butt)
                )
            }

            // Needle — pinned to the exact percentage (0..100 → π..0).
            let actualPercent = Double(percent ?? 50)
            let needleAngle = Double.pi * (1 - actualPercent / 100)
            let needleLength = radius - 4
            let needleEnd = CGPoint(
                x: centerX + needleLength * cos(needleAngle),
                y: centerY - needleLength * sin(needleAngle)
            )
            let color = segmentColors[min(max(position, 0), 4)]
            var needle = Path()
            needle.move(to: CGPoint(x: centerX, y: centerY))
            needle.addLine(to: needleEnd)
            context.stroke(needle, with: .color(color), style: StrokeStyle(lineWidth: 2, lineCap: .round))

            // Center dot.
            let dot = Path(ellipseIn: CGRect(x: centerX - 3, y: centerY - 3, width: 6, height: 6))
            context.fill(dot, with: .color(color))
        }
        .frame(width: size, height: size / 2 + 6)
    }

    /// Map a 0–100% slot into one of 5 colored buckets. Matches RN's
    /// `getGaugePosition`.
    private var gaugePosition: Int {
        guard let percent else { return 2 }
        switch percent {
        case ...20: return 0
        case ...40: return 1
        case ...60: return 2
        case ...80: return 3
        default: return 4
        }
    }
}

// MARK: - NFL team colors

/// NFL team color + initial lookup. Direct port of RN's
/// `getNFLTeamColors`/`getTeamInitials` from `utils/teamColors.ts`. Used by
/// `NFLPublicBettingBars` and (soon) the per-team avatars in the NFL game
/// card. Lives next to the only consumer for now — moves to a shared util
/// when a second screen wants the same lookup.
enum NFLTeamColors {
    struct Pair: Hashable {
        let primary: Color
        let secondary: Color
    }

    private static let fallback = Pair(primary: Color(hex: 0x6B7280), secondary: Color(hex: 0x9CA3AF))

    /// Lookup table mirrors RN exactly. Includes both city-only and full
    /// "city + mascot" keys because the backend uses both formats across
    /// different sources.
    private static let colorMap: [String: Pair] = [
        "Arizona": Pair(primary: Color(hex: 0x97233F), secondary: Color(hex: 0x000000)),
        "Atlanta": Pair(primary: Color(hex: 0xA71930), secondary: Color(hex: 0x000000)),
        "Baltimore": Pair(primary: Color(hex: 0x241773), secondary: Color(hex: 0x9E7C0C)),
        "Buffalo": Pair(primary: Color(hex: 0x00338D), secondary: Color(hex: 0xC60C30)),
        "Carolina": Pair(primary: Color(hex: 0x0085CA), secondary: Color(hex: 0x101820)),
        "Chicago": Pair(primary: Color(hex: 0x0B162A), secondary: Color(hex: 0xC83803)),
        "Cincinnati": Pair(primary: Color(hex: 0xFB4F14), secondary: Color(hex: 0x000000)),
        "Cleveland": Pair(primary: Color(hex: 0x311D00), secondary: Color(hex: 0xFF3C00)),
        "Dallas": Pair(primary: Color(hex: 0x003594), secondary: Color(hex: 0x869397)),
        "Denver": Pair(primary: Color(hex: 0xFB4F14), secondary: Color(hex: 0x002244)),
        "Detroit": Pair(primary: Color(hex: 0x0076B6), secondary: Color(hex: 0xB0B7BC)),
        "Green Bay": Pair(primary: Color(hex: 0x203731), secondary: Color(hex: 0xFFB612)),
        "Houston": Pair(primary: Color(hex: 0x03202F), secondary: Color(hex: 0xA71930)),
        "Indianapolis": Pair(primary: Color(hex: 0x002C5F), secondary: Color(hex: 0xA2AAAD)),
        "Jacksonville": Pair(primary: Color(hex: 0x101820), secondary: Color(hex: 0xD7A22A)),
        "Kansas City": Pair(primary: Color(hex: 0xE31837), secondary: Color(hex: 0xFFB81C)),
        "Las Vegas": Pair(primary: Color(hex: 0x000000), secondary: Color(hex: 0xA5ACAF)),
        "Los Angeles Chargers": Pair(primary: Color(hex: 0x0080C6), secondary: Color(hex: 0xFFC20E)),
        "Los Angeles Rams": Pair(primary: Color(hex: 0x003594), secondary: Color(hex: 0xFFA300)),
        "LA Chargers": Pair(primary: Color(hex: 0x0080C6), secondary: Color(hex: 0xFFC20E)),
        "LA Rams": Pair(primary: Color(hex: 0x003594), secondary: Color(hex: 0xFFA300)),
        "Miami": Pair(primary: Color(hex: 0x008E97), secondary: Color(hex: 0xFC4C02)),
        "Minnesota": Pair(primary: Color(hex: 0x4F2683), secondary: Color(hex: 0xFFC62F)),
        "New England": Pair(primary: Color(hex: 0x002244), secondary: Color(hex: 0xC60C30)),
        "New Orleans": Pair(primary: Color(hex: 0x101820), secondary: Color(hex: 0xD3BC8D)),
        "NY Giants": Pair(primary: Color(hex: 0x0B2265), secondary: Color(hex: 0xA71930)),
        "NY Jets": Pair(primary: Color(hex: 0x125740), secondary: Color(hex: 0x000000)),
        "Philadelphia": Pair(primary: Color(hex: 0x004C54), secondary: Color(hex: 0xA5ACAF)),
        "Pittsburgh": Pair(primary: Color(hex: 0xFFB612), secondary: Color(hex: 0x101820)),
        "San Francisco": Pair(primary: Color(hex: 0xAA0000), secondary: Color(hex: 0xB3995D)),
        "Seattle": Pair(primary: Color(hex: 0x002244), secondary: Color(hex: 0x69BE28)),
        "Tampa Bay": Pair(primary: Color(hex: 0xD50A0A), secondary: Color(hex: 0xFF7900)),
        "Tennessee": Pair(primary: Color(hex: 0x0C2340), secondary: Color(hex: 0x4B92DB)),
        "Washington": Pair(primary: Color(hex: 0x5A1414), secondary: Color(hex: 0xFFB612)),
        // Full team-name variants.
        "Arizona Cardinals": Pair(primary: Color(hex: 0x97233F), secondary: Color(hex: 0x000000)),
        "Atlanta Falcons": Pair(primary: Color(hex: 0xA71930), secondary: Color(hex: 0x000000)),
        "Baltimore Ravens": Pair(primary: Color(hex: 0x241773), secondary: Color(hex: 0x9E7C0C)),
        "Buffalo Bills": Pair(primary: Color(hex: 0x00338D), secondary: Color(hex: 0xC60C30)),
        "Carolina Panthers": Pair(primary: Color(hex: 0x0085CA), secondary: Color(hex: 0x101820)),
        "Chicago Bears": Pair(primary: Color(hex: 0x0B162A), secondary: Color(hex: 0xC83803)),
        "Cincinnati Bengals": Pair(primary: Color(hex: 0xFB4F14), secondary: Color(hex: 0x000000)),
        "Cleveland Browns": Pair(primary: Color(hex: 0x311D00), secondary: Color(hex: 0xFF3C00)),
        "Dallas Cowboys": Pair(primary: Color(hex: 0x003594), secondary: Color(hex: 0x869397)),
        "Denver Broncos": Pair(primary: Color(hex: 0xFB4F14), secondary: Color(hex: 0x002244)),
        "Detroit Lions": Pair(primary: Color(hex: 0x0076B6), secondary: Color(hex: 0xB0B7BC)),
        "Green Bay Packers": Pair(primary: Color(hex: 0x203731), secondary: Color(hex: 0xFFB612)),
        "Houston Texans": Pair(primary: Color(hex: 0x03202F), secondary: Color(hex: 0xA71930)),
        "Indianapolis Colts": Pair(primary: Color(hex: 0x002C5F), secondary: Color(hex: 0xA2AAAD)),
        "Jacksonville Jaguars": Pair(primary: Color(hex: 0x101820), secondary: Color(hex: 0xD7A22A)),
        "Kansas City Chiefs": Pair(primary: Color(hex: 0xE31837), secondary: Color(hex: 0xFFB81C)),
        "Las Vegas Raiders": Pair(primary: Color(hex: 0x000000), secondary: Color(hex: 0xA5ACAF)),
        "Miami Dolphins": Pair(primary: Color(hex: 0x008E97), secondary: Color(hex: 0xFC4C02)),
        "Minnesota Vikings": Pair(primary: Color(hex: 0x4F2683), secondary: Color(hex: 0xFFC62F)),
        "New England Patriots": Pair(primary: Color(hex: 0x002244), secondary: Color(hex: 0xC60C30)),
        "New Orleans Saints": Pair(primary: Color(hex: 0x101820), secondary: Color(hex: 0xD3BC8D)),
        "New York Giants": Pair(primary: Color(hex: 0x0B2265), secondary: Color(hex: 0xA71930)),
        "New York Jets": Pair(primary: Color(hex: 0x125740), secondary: Color(hex: 0x000000)),
        "Philadelphia Eagles": Pair(primary: Color(hex: 0x004C54), secondary: Color(hex: 0xA5ACAF)),
        "Pittsburgh Steelers": Pair(primary: Color(hex: 0xFFB612), secondary: Color(hex: 0x101820)),
        "San Francisco 49ers": Pair(primary: Color(hex: 0xAA0000), secondary: Color(hex: 0xB3995D)),
        "Seattle Seahawks": Pair(primary: Color(hex: 0x002244), secondary: Color(hex: 0x69BE28)),
        "Tampa Bay Buccaneers": Pair(primary: Color(hex: 0xD50A0A), secondary: Color(hex: 0xFF7900)),
        "Tennessee Titans": Pair(primary: Color(hex: 0x0C2340), secondary: Color(hex: 0x4B92DB)),
        "Washington Commanders": Pair(primary: Color(hex: 0x5A1414), secondary: Color(hex: 0xFFB612)),
        "Washington Football Team": Pair(primary: Color(hex: 0x5A1414), secondary: Color(hex: 0xFFB612))
    ]

    private static let mascots: [String] = [
        "Cardinals", "Falcons", "Ravens", "Bills", "Panthers", "Bears", "Bengals",
        "Browns", "Cowboys", "Broncos", "Lions", "Packers", "Texans", "Colts",
        "Jaguars", "Chiefs", "Raiders", "Chargers", "Rams", "Dolphins", "Vikings",
        "Patriots", "Saints", "Giants", "Jets", "Eagles", "Steelers", "49ers",
        "Seahawks", "Buccaneers", "Titans", "Commanders", "Football Team"
    ]

    /// Shared `TeamColorPair` flavor of `colors(for:)` — used by the game-detail
    /// hero/aura + card so the team-color glow and avatars pull real NFL colors.
    static func colorPair(for team: String) -> TeamColorPair {
        let p = colors(for: team)
        return TeamColorPair(primary: p.primary, secondary: p.secondary)
    }

    static func colors(for team: String) -> Pair {
        if team.isEmpty { return fallback }
        if let direct = colorMap[team] { return direct }
        if let full = NFLTeams.fullName(for: team), let hit = colorMap[full] { return hit }
        // Try stripping the trailing mascot to fall back on the city-only key.
        // E.g. "Kansas City Chiefs" → "Kansas City".
        for mascot in mascots {
            let suffix = " \(mascot)"
            if team.hasSuffix(suffix) {
                let city = String(team.dropLast(suffix.count))
                if let hit = colorMap[city] { return hit }
            }
        }
        return fallback
    }

    private static let initialsMap: [String: String] = [
        "Arizona": "ARI", "Atlanta": "ATL", "Baltimore": "BAL", "Buffalo": "BUF",
        "Carolina": "CAR", "Chicago": "CHI", "Cincinnati": "CIN", "Cleveland": "CLE",
        "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
        "Houston": "HOU", "Indianapolis": "IND", "Jacksonville": "JAX", "Kansas City": "KC",
        "Las Vegas": "LV", "Los Angeles Chargers": "LAC", "Los Angeles Rams": "LAR",
        "LA Chargers": "LAC", "LA Rams": "LAR", "Miami": "MIA", "Minnesota": "MIN",
        "New England": "NE", "New Orleans": "NO", "NY Giants": "NYG", "NY Jets": "NYJ",
        "New York Giants": "NYG", "New York Jets": "NYJ",
        "Philadelphia": "PHI", "Pittsburgh": "PIT", "San Francisco": "SF", "Seattle": "SEA",
        "Tampa Bay": "TB", "Tennessee": "TEN", "Washington": "WAS"
    ]

    static func initials(for team: String) -> String {
        if team.isEmpty { return "TBD" }
        if let direct = initialsMap[team] { return direct }
        for mascot in mascots {
            let suffix = " \(mascot)"
            if team.hasSuffix(suffix) {
                let city = String(team.dropLast(suffix.count))
                if let hit = initialsMap[city] { return hit }
            }
        }
        // Fallback: take first 3 chars of the first word.
        let first = team.split(separator: " ").first.map(String.init) ?? team
        return String(first.prefix(3)).uppercased()
    }

    /// Pick a foreground color that contrasts with both primary and
    /// secondary backgrounds — used inside the gradient-filled team circle.
    static func contrastingTextColor(primary: Color, secondary: Color) -> Color {
        // Heuristic: if either color reads as light (high luminance), use a
        // dark foreground. RN's `getContrastingTextColor` does the same.
        let lum = (luminance(primary) + luminance(secondary)) / 2
        return lum > 0.5 ? Color.black : Color.white
    }

    private static func luminance(_ color: Color) -> Double {
        #if canImport(UIKit)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        return Double(0.299 * r + 0.587 * g + 0.114 * b)
        #else
        return 0.5
        #endif
    }
}
