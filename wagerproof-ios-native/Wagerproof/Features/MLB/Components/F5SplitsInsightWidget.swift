import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact First-5 digest for the MLB game sheet.
///
/// The card answers in order: what the matched splits say, which samples were
/// used, then the evidence. Percentage metrics use fixed 0...100 dashboard
/// dials, while run production uses independent linear gauges. The full 11-row
/// breakdown remains one tap away.
struct F5SplitsInsightWidget: View {
    let summary: F5InsightSummary
    let onExpand: () -> Void

    private static let accent = Color(hex: 0x0EA5E9)

    var body: some View {
        InsightWidgetSection(
            title: "First-5 Innings",
            systemImage: "baseball.diamond.bases",
            iconTint: Self.accent,
            badge: summary.badge,
            expandLabel: "Full F5 breakdown",
            onExpand: onExpand
        ) {
            VStack(alignment: .leading, spacing: 16) {
                Text(summary.headline)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("First-five summary: \(summary.headline)")

                Label(summary.qualifier, systemImage: "scope")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                F5EvidenceBoard(summary: summary)

                if let warning = summary.sampleWarning {
                    Label(warning, systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appAccentAmber)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            Color.appAccentAmber.opacity(0.10),
                            in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                        )
                }
            }
        }
    }
}

// MARK: - Evidence board

private struct F5EvidenceBoard: View {
    let summary: F5InsightSummary

    private let labelWidth: CGFloat = 104

    var body: some View {
        VStack(spacing: 0) {
            boardHeader

            ForEach(summary.rows) { row in
                Divider()
                    .overlay(Color.appBorder.opacity(0.45))
                evidenceRow(row)
            }
        }
        .padding(.horizontal, 12)
        .background(
            Color.appSurfaceMuted.opacity(0.30),
            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.45), lineWidth: 0.75)
        )
    }

    private var boardHeader: some View {
        HStack(spacing: 10) {
            Text("EVIDENCE")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.7)
                .foregroundStyle(Color.appTextMuted)
                .frame(width: labelWidth, alignment: .leading)

            teamHeader(summary.awayAbbr, sampleSize: summary.awaySampleSize)
            teamHeader(summary.homeAbbr, sampleSize: summary.homeSampleSize)
        }
        .padding(.vertical, 10)
    }

    private func teamHeader(_ abbreviation: String, sampleSize: Int?) -> some View {
        VStack(spacing: 1) {
            Text(abbreviation)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text(sampleSize.map { "\($0) games" } ?? "No sample")
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func evidenceRow(_ row: F5CompareRow) -> some View {
        switch row.metric {
        case .winPct:
            percentageRow(
                row,
                descriptor: "Won through 5",
                gaugeKind: .winRate
            )
        case .overPct:
            percentageRow(
                row,
                descriptor: "Cleared F5 total",
                gaugeKind: .overRate
            )
        case .runsScored:
            numberRow(row, descriptor: "1 run per segment")
        case .runsAllowed:
            numberRow(row, descriptor: "1/run · lower is better")
        }
    }

    private func percentageRow(
        _ row: F5CompareRow,
        descriptor: String,
        gaugeKind: F5GaugeKind
    ) -> some View {
        HStack(spacing: 10) {
            metricLabel(row.title, descriptor: descriptor)
            F5PercentageGaugeCell(
                value: row.awayValue,
                numeral: row.awayNumeral,
                kind: gaugeKind
            )
            F5PercentageGaugeCell(
                value: row.homeValue,
                numeral: row.homeNumeral,
                kind: gaugeKind
            )
        }
        .padding(.vertical, 11)
        .accessibilityElement(children: .combine)
    }

    private func numberRow(_ row: F5CompareRow, descriptor: String) -> some View {
        HStack(spacing: 10) {
            metricLabel(row.title, descriptor: descriptor)
            F5RunScaleCell(
                value: row.awayValue,
                referenceValue: row.awayReferenceValue,
                maximum: row.scaleMaximum,
                numeral: row.awayNumeral,
                delta: row.awayDelta,
                goodWhenNegative: row.goodWhenNegative,
                highlighted: row.advantage == .away
            )
            F5RunScaleCell(
                value: row.homeValue,
                referenceValue: row.homeReferenceValue,
                maximum: row.scaleMaximum,
                numeral: row.homeNumeral,
                delta: row.homeDelta,
                goodWhenNegative: row.goodWhenNegative,
                highlighted: row.advantage == .home
            )
        }
        .padding(.vertical, 11)
        .accessibilityElement(children: .combine)
    }

    private func metricLabel(_ title: String, descriptor: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.35)
                .foregroundStyle(Color.appTextSecondary)
            Text(descriptor)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(width: labelWidth, alignment: .leading)
    }
}

// MARK: - Percentage gauges

private enum F5GaugeKind {
    case winRate
    case overRate

    var lowColor: Color {
        switch self {
        case .winRate: return Color.appLoss
        case .overRate: return Color.appAccentBlue
        }
    }

    var middleColor: Color { Color.appAccentAmber }
    var highColor: Color { Color.appWin }

    func color(for value: Double) -> Color {
        if value < 45 { return lowColor }
        if value <= 55 { return middleColor }
        return highColor
    }
}

private struct F5PercentageGaugeCell: View {
    let value: Double?
    let numeral: String
    let kind: F5GaugeKind

    var body: some View {
        F5SemicircleGauge(value: value, numeral: numeral, kind: kind)
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(numeral == "—" ? "No data" : numeral)
    }
}

private struct F5SemicircleGauge: View {
    let value: Double?
    let numeral: String
    let kind: F5GaugeKind

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let clamped = min(100, max(0, value ?? 50))
            let radius = max(0, width / 2 - 7)
            let center = CGPoint(x: width / 2, y: width / 2)
            let angle = Angle.degrees(180 + clamped * 1.8)
            let radians = angle.radians
            let marker = CGPoint(
                x: center.x + CGFloat(cos(radians)) * radius,
                y: center.y + CGFloat(sin(radians)) * radius
            )
            let activeColor = value.map(kind.color(for:)) ?? Color.appTextMuted

            ZStack {
                gaugeArc(from: 0, to: 0.5, color: Color.appBorder.opacity(0.20))
                gaugeArc(from: 0, to: 0.22, color: kind.lowColor.opacity(0.82))
                gaugeArc(from: 0.225, to: 0.275, color: kind.middleColor.opacity(0.88))
                gaugeArc(from: 0.28, to: 0.5, color: kind.highColor.opacity(0.82))

                if value != nil {
                    Capsule()
                        .fill(activeColor)
                        .frame(width: 3, height: 15)
                        .overlay(
                            Capsule()
                                .stroke(Color.appSurface, lineWidth: 1)
                        )
                        .rotationEffect(.degrees(angle.degrees - 270))
                        .position(marker)
                }

                Text(numeral)
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(activeColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .position(x: center.x, y: center.y - 17)
            }
            .frame(width: width, height: width)
        }
        .aspectRatio(1.75, contentMode: .fit)
        .frame(maxHeight: 68)
        .clipped()
        .accessibilityHidden(true)
    }

    private func gaugeArc(from: CGFloat, to: CGFloat, color: Color) -> some View {
        Circle()
            .trim(from: from, to: to)
            .stroke(
                color,
                style: StrokeStyle(lineWidth: 7, lineCap: .round)
            )
            .rotationEffect(.degrees(180))
            .padding(7)
    }
}

// MARK: - Segmented run scales

private struct F5RunScaleCell: View {
    let value: Double?
    let referenceValue: Double?
    let maximum: Double?
    let numeral: String
    let delta: Double?
    let goodWhenNegative: Bool
    let highlighted: Bool

    var body: some View {
        VStack(spacing: 5) {
            Text(numeral)
                .font(.system(size: 17, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(highlighted ? Color.appWin : Color.appTextPrimary)

            F5RunSegmentScale(
                value: value,
                referenceValue: referenceValue,
                maximum: maximum ?? 4,
                fill: highlighted
                    ? Color.appWin
                    : Color.appTextSecondary.opacity(0.65)
            )

            if let delta, delta.isFinite {
                let isGood = goodWhenNegative ? delta < 0 : delta > 0
                let isBad = goodWhenNegative ? delta > 0 : delta < 0
                let color: Color = isGood ? .appWin : (isBad ? .appLoss : .appTextMuted)

                HStack(spacing: 2) {
                    Image(systemName: delta > 0 ? "arrow.up" : (delta < 0 ? "arrow.down" : "minus"))
                        .font(.system(size: 7, weight: .bold))
                    Text("\(MLBF5.formatDiff(delta, digits: 1)) vs avg")
                        .font(.system(size: 8, weight: .semibold))
                        .monospacedDigit()
                }
                .foregroundStyle(color)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct F5RunSegmentScale: View {
    let value: Double?
    let referenceValue: Double?
    let maximum: Double
    let fill: Color

    private var chunkCount: Int {
        max(1, Int(ceil(maximum)))
    }

    var body: some View {
        VStack(spacing: 1) {
            GeometryReader { geometry in
                let gap: CGFloat = 2
                let totalGaps = gap * CGFloat(max(0, chunkCount - 1))
                let segmentWidth = max(1, (geometry.size.width - totalGaps) / CGFloat(chunkCount))
                let markerFraction = min(1, max(0, (referenceValue ?? 0) / Double(chunkCount)))
                let markerX = min(
                    geometry.size.width - 2,
                    max(0, geometry.size.width * markerFraction - 1)
                )

                ZStack(alignment: .leading) {
                    HStack(spacing: gap) {
                        ForEach(0..<chunkCount, id: \.self) { index in
                            let segmentFill = min(1, max(0, (value ?? 0) - Double(index)))

                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3, style: .continuous)
                                    .fill(Color.appBorder.opacity(0.28))

                                if value != nil, segmentFill > 0 {
                                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                                        .fill(fill)
                                        .frame(width: segmentWidth * segmentFill)
                                }
                            }
                            .frame(width: segmentWidth)
                            .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                        }
                    }

                    if referenceValue != nil {
                        Capsule()
                            .fill(Color.appAccentAmber)
                            .frame(width: 2, height: 16)
                            .shadow(color: Color.black.opacity(0.35), radius: 1)
                            .offset(x: markerX)
                    }
                }
            }
            .frame(height: 12)

            GeometryReader { geometry in
                ForEach(0...chunkCount, id: \.self) { tick in
                    Text("\(tick)")
                        .font(.system(size: 6, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Color.appTextMuted)
                        .position(
                            x: min(
                                geometry.size.width - 3,
                                max(3, geometry.size.width * CGFloat(tick) / CGFloat(chunkCount))
                            ),
                            y: 4
                        )
                }
            }
            .frame(height: 8)
        }
        .accessibilityHidden(true)
    }
}
