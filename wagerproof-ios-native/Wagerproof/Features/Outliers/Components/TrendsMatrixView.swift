import SwiftUI
import WagerproofDesign

// Shared, sport-agnostic situational-trends matrix renderer. All three
// betting-trends surfaces (MLB 7-pair, NBA/NCAAB 5-pair) feed this view
// through small per-sport adapters (see `*TrendsMatrixAdapter.swift`) so
// the layout, color thresholds, and consensus badges never drift apart.

/// Which side of the matchup a team avatar/cell belongs to.
enum TrendsTeamSide {
    case away, home
}

/// Per-situation consensus chip (ML/ATS leader or O/U direction). Computed
/// by the adapters using the same thresholds as the RN list-sort formulas.
struct TrendsConsensusBadge: Identifiable, Hashable {
    let text: String
    let systemImage: String
    let colorHex: Int

    var id: String { text }
    var color: Color { Color(hex: colorHex) }
}

/// One metric row inside a situation section (WIN% / OVER% for MLB,
/// ATS / O/U for NBA+NCAAB).
struct TrendsMatrixMetricRow: Identifiable {
    /// Cell payloads mirror the three RN cell shapes exactly.
    enum Cell {
        /// Percentage-only badge (MLB — the today view has no records).
        case pct(Double?)
        /// "W-L-P" record over a colored cover-% badge (ATS).
        case recordPct(record: String, pct: Double?)
        /// "O-U-P" record over the "x%O / y%U" split line.
        case recordOU(record: String, over: Double?, under: Double?)
    }

    let id: String
    let label: String
    let away: Cell
    let home: Cell
}

/// One situational pair (e.g. "Last Game Situation") with per-team labels,
/// metric rows, and pre-computed consensus badges.
struct TrendsMatrixSection: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let tooltip: String?
    let awayLabel: String
    let homeLabel: String
    let rows: [TrendsMatrixMetricRow]
    let badges: [TrendsConsensusBadge]
    let hasData: Bool
}

/// RN `getPctColor` / `getATSColor` thresholds — shared by every cell.
func trendsPctColor(_ pct: Double?) -> Color {
    guard let pct else { return Color(hex: 0x9CA3AF) }
    if pct >= 55 { return Color(hex: 0x22C55E) }
    if pct >= 45 { return Color(hex: 0xEAB308) }
    return Color(hex: 0xEF4444)
}

/// Renders a list of situation sections — the full detail-sheet treatment
/// (glass cards, 40pt avatars, tooltips). The old `.compact` game-sheet
/// variant retired in favor of `BettingTrendsInsightWidget`.
struct TrendsMatrixView: View {
    let sections: [TrendsMatrixSection]
    let accent: Color
    var avatar: ((TrendsTeamSide, CGFloat) -> AnyView)? = nil

    var body: some View {
        VStack(spacing: 12) {
            ForEach(sections) { section in
                TrendsMatrixSectionView(
                    section: section,
                    accent: accent,
                    avatar: avatar
                )
            }
        }
    }
}

/// Single section renderer — the RN bottom-sheet card treatment. (The compact
/// game-sheet variant retired with the insight-widget redesign.)
struct TrendsMatrixSectionView: View {
    let section: TrendsMatrixSection
    let accent: Color
    var awayAbbr: String = ""
    var homeAbbr: String = ""
    var avatar: ((TrendsTeamSide, CGFloat) -> AnyView)? = nil

    private let compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.horizontal, 12)
                    .padding(.top, 12)
                    .padding(.bottom, 8)
                if section.hasData {
                    matrix
                        .padding(12)
                        .background(Color.appTextMuted.opacity(0.03), in: RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 12)
                        .padding(.bottom, section.tooltip == nil ? 12 : 8)
                } else {
                    noData
                        .padding(.horizontal, 12)
                        .padding(.bottom, section.tooltip == nil ? 12 : 8)
                }
                if let tooltip = section.tooltip {
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "info.circle")
                            .font(.system(size: 11))
                        Text(tooltip)
                            .font(.system(size: 11))
                            .italic()
                            .lineSpacing(2)
                    }
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 12)
                }
            }
        .background(cardShape.fill(.ultraThinMaterial))
        .clipShape(cardShape)
        .overlay(cardShape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var cardShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
    }

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: section.systemImage)
                    .font(.system(size: compact ? 12 : 15, weight: .semibold))
                    .foregroundStyle(accent)
                Text(section.title)
                    .font(.system(size: compact ? 12 : 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer(minLength: 0)
                if compact {
                    badgesRow
                }
            }
            if !compact, !section.badges.isEmpty {
                badgesRow
            }
        }
    }

    @ViewBuilder
    private var badgesRow: some View {
        HStack(spacing: 6) {
            ForEach(section.badges) { badge in
                HStack(spacing: 3) {
                    Image(systemName: badge.systemImage)
                        .font(.system(size: 8, weight: .bold))
                    Text(badge.text)
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(badge.color)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(badge.color.opacity(0.14), in: Capsule())
            }
        }
    }

    @ViewBuilder
    private var noData: some View {
        Text("No data available")
            .font(.system(size: compact ? 12 : 13))
            .foregroundStyle(Color.appTextSecondary)
            .frame(maxWidth: .infinity)
            .padding(compact ? 8 : 16)
            .background(Color.appTextMuted.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }

    private var gutterWidth: CGFloat { compact ? 44 : 48 }

    @ViewBuilder
    private var matrix: some View {
        VStack(spacing: 0) {
            // Team header row — avatars (card) or abbrs (compact) + the
            // per-team situation label.
            HStack(alignment: .top, spacing: 0) {
                Color.clear.frame(width: gutterWidth, height: 1)
                teamHeader(side: .away, abbr: awayAbbr, label: section.awayLabel)
                teamHeader(side: .home, abbr: homeAbbr, label: section.homeLabel)
            }
            .padding(.bottom, compact ? 6 : 12)

            ForEach(section.rows) { row in
                metricRow(row)
            }
        }
    }

    @ViewBuilder
    private func teamHeader(side: TrendsTeamSide, abbr: String, label: String) -> some View {
        VStack(spacing: compact ? 2 : 6) {
            if !compact, let avatar {
                avatar(side, 40)
            } else {
                Text(abbr.isEmpty ? (side == .away ? "AWAY" : "HOME") : abbr)
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Text(label)
                .font(.system(size: compact ? 9 : 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: 110)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func metricRow(_ row: TrendsMatrixMetricRow) -> some View {
        HStack(alignment: .center, spacing: 0) {
            Text(row.label)
                .font(.system(size: compact ? 9 : 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: gutterWidth, alignment: .leading)
            cell(row.away)
            cell(row.home)
        }
        .padding(.vertical, compact ? 5 : 8)
        .overlay(
            Rectangle()
                .fill(Color.appTextMuted.opacity(0.08))
                .frame(height: 1),
            alignment: .top
        )
    }

    @ViewBuilder
    private func cell(_ cell: TrendsMatrixMetricRow.Cell) -> some View {
        Group {
            switch cell {
            case .pct(let pct):
                pctBadge(pct)
            case .recordPct(let record, let pct):
                VStack(spacing: 4) {
                    Text(record)
                        .font(.system(size: compact ? 13 : 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    pctBadge(pct)
                }
            case .recordOU(let record, let over, let under):
                VStack(spacing: 4) {
                    Text(record)
                        .font(.system(size: compact ? 13 : 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(ouSplit(over: over, under: under))
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func pctBadge(_ pct: Double?) -> some View {
        let color = trendsPctColor(pct)
        Text(formatPct(pct))
            .font(.system(size: compact ? 11 : 13, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, compact ? 8 : 10)
            .padding(.vertical, compact ? 2 : 3)
            .background(color.opacity(0.125), in: RoundedRectangle(cornerRadius: 6))
    }

    private func formatPct(_ pct: Double?) -> String {
        guard let pct else { return "—" }
        return "\(Int(pct.rounded()))%"
    }

    private func ouSplit(over: Double?, under: Double?) -> String {
        guard let over, let under else { return "-" }
        return "\(Int(over.rounded()))%O / \(Int(under.rounded()))%U"
    }
}
