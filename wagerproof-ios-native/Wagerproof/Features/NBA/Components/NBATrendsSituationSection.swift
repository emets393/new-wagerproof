import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One situational-trends card inside `NBABettingTrendsBottomSheet`. Mirrors
/// RN `components/nba/TrendsSituationSection.tsx`. Renders an ATS row + an
/// O/U row keyed by `SituationType`. Records that fail to decode show the
/// "No data available" state.
enum NBATrendsSituationType {
    case lastGame
    case favDog
    case sideFavDog
    case restBucket
    case restComp
}

struct NBATrendsSituationSection: View {
    let title: String
    let icon: String
    let awayTeam: NBASituationalTrendRow
    let homeTeam: NBASituationalTrendRow
    let situationType: NBATrendsSituationType
    var tooltip: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if hasData {
                content
                if let tooltip {
                    tooltipRow(tooltip)
                }
            } else {
                Text("No data available")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(16)
            }
        }
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(Color.appAccentBlue)
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
        }
        .padding(.horizontal, 12)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var content: some View {
        let awayATS = atsData(awayTeam)
        let homeATS = atsData(homeTeam)
        let awayOU = ouData(awayTeam)
        let homeOU = ouData(homeTeam)
        VStack(spacing: 12) {
            HStack(alignment: .top) {
                Color.clear.frame(width: 40)
                teamHeader(team: awayTeam, label: awayATS.label)
                teamHeader(team: homeTeam, label: homeATS.label)
            }
            recordRow(label: "ATS", awayRec: awayATS.record, awayPct: awayATS.pct, homeRec: homeATS.record, homePct: homeATS.pct)
            recordRow(label: "O/U",
                      awayRec: awayOU.record,
                      awayOverUnder: (awayOU.overPct, awayOU.underPct),
                      homeRec: homeOU.record,
                      homeOverUnder: (homeOU.overPct, homeOU.underPct))
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func tooltipRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "info.circle")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            Text(text)
                .font(.system(size: 11))
                .italic()
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func teamHeader(team: NBASituationalTrendRow, label: String) -> some View {
        VStack(spacing: 6) {
            GameCardTeamAvatar(teamName: team.teamName, sport: "nba", size: 40)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(maxWidth: 100)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func recordRow(label: String, awayRec: String, awayPct: Double?, homeRec: String, homePct: Double?) -> some View {
        HStack(alignment: .center) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: 40, alignment: .leading)
            recordCell(record: awayRec, pct: awayPct)
            recordCell(record: homeRec, pct: homePct)
        }
        .padding(.vertical, 8)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.appTextMuted.opacity(0.1)), alignment: .top)
    }

    @ViewBuilder
    private func recordRow(label: String,
                           awayRec: String,
                           awayOverUnder: (Double?, Double?),
                           homeRec: String,
                           homeOverUnder: (Double?, Double?)) -> some View {
        HStack(alignment: .center) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: 40, alignment: .leading)
            ouCell(record: awayRec, overUnder: awayOverUnder)
            ouCell(record: homeRec, overUnder: homeOverUnder)
        }
        .padding(.vertical, 8)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.appTextMuted.opacity(0.1)), alignment: .top)
    }

    @ViewBuilder
    private func recordCell(record: String, pct: Double?) -> some View {
        VStack(spacing: 4) {
            Text(record)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text(formatPct(pct))
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(atsColor(pct))
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(atsColor(pct).opacity(0.15), in: RoundedRectangle(cornerRadius: 6))
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func ouCell(record: String, overUnder: (Double?, Double?)) -> some View {
        VStack(spacing: 4) {
            Text(record)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            if let over = overUnder.0, let under = overUnder.1 {
                Text("\(Int(over.rounded()))%O / \(Int(under.rounded()))%U")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
            } else {
                Text("-")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Helpers (mirror RN getATSData / getOUData)

    private struct ATSData { let record: String; let pct: Double?; let label: String }
    private struct OUData { let record: String; let overPct: Double?; let underPct: Double? }

    private func atsData(_ row: NBASituationalTrendRow) -> ATSData {
        switch situationType {
        case .lastGame:
            return ATSData(record: row.atsLastGameRecord ?? "-", pct: row.atsLastGameCoverPct,
                           label: formatNBASituation(row.lastGameSituation))
        case .favDog:
            return ATSData(record: row.atsFavDogRecord ?? "-", pct: row.atsFavDogCoverPct,
                           label: formatNBASituation(row.favDogSituation))
        case .sideFavDog:
            return ATSData(record: row.atsSideFavDogRecord ?? "-", pct: row.atsSideFavDogCoverPct,
                           label: formatNBASituation(row.sideSpreadSituation))
        case .restBucket:
            return ATSData(record: row.atsRestBucketRecord ?? "-", pct: row.atsRestBucketCoverPct,
                           label: formatNBASituation(row.restBucket))
        case .restComp:
            return ATSData(record: row.atsRestCompRecord ?? "-", pct: row.atsRestCompCoverPct,
                           label: formatNBASituation(row.restComp))
        }
    }

    private func ouData(_ row: NBASituationalTrendRow) -> OUData {
        switch situationType {
        case .lastGame:
            return OUData(record: row.ouLastGameRecord ?? "-", overPct: row.ouLastGameOverPct, underPct: row.ouLastGameUnderPct)
        case .favDog:
            return OUData(record: row.ouFavDogRecord ?? "-", overPct: row.ouFavDogOverPct, underPct: row.ouFavDogUnderPct)
        case .sideFavDog:
            return OUData(record: row.ouSideFavDogRecord ?? "-", overPct: row.ouSideFavDogOverPct, underPct: row.ouSideFavDogUnderPct)
        case .restBucket:
            return OUData(record: row.ouRestBucketRecord ?? "-", overPct: row.ouRestBucketOverPct, underPct: row.ouRestBucketUnderPct)
        case .restComp:
            return OUData(record: row.ouRestCompRecord ?? "-", overPct: row.ouRestCompOverPct, underPct: row.ouRestCompUnderPct)
        }
    }

    private var hasData: Bool {
        atsData(awayTeam).record != "-" || atsData(homeTeam).record != "-"
    }

    private func formatPct(_ pct: Double?) -> String {
        guard let pct else { return "-" }
        return "\(Int(pct.rounded()))%"
    }

    private func atsColor(_ pct: Double?) -> Color {
        guard let pct else { return Color.appTextMuted }
        if pct >= 55 { return Color.appPrimary }
        if pct >= 45 { return Color.appAccentAmber }
        return Color.appAccentRed
    }
}
