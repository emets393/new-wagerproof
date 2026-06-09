import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One row in the situational trends sheet. Mirrors RN
/// `components/ncaab/TrendsSituationSection.tsx`. Each instance compares
/// the away and home team across one situation type (last game, fav/dog,
/// side+fav/dog, rest bucket, rest comparison) and surfaces:
///
///   - Per-team ATS record + cover %
///   - Per-team O/U record + over% / under%
///   - The encoded situation label decoded via `formatNCAABSituation`
///
/// All math is local — record strings come straight from the
/// `NCAABSituationalTrendRow` payload built by `NCAABBettingTrendsStore`.
struct NCAABTrendsSituationSection: View {
    enum SituationType {
        case lastGame, favDog, sideFavDog, restBucket, restComp
    }

    let title: String
    let icon: String
    let awayTeam: NCAABSituationalTrendRow
    let homeTeam: NCAABSituationalTrendRow
    let situationType: SituationType
    let tooltip: String?

    var body: some View {
        let awayATS = atsData(for: awayTeam)
        let homeATS = atsData(for: homeTeam)
        let awayOU = ouData(for: awayTeam)
        let homeOU = ouData(for: homeTeam)
        let hasData = awayATS.record != "-" || homeATS.record != "-"

        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(Color.appAccentBlue)
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            if !hasData {
                // No-data state — RN renders a centered "No data available"
                // pill inside the same card chrome.
                VStack {
                    Text("No data available")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(16)
                .background(Color.appTextMuted.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            } else {
                content(
                    awayATS: awayATS,
                    homeATS: homeATS,
                    awayOU: awayOU,
                    homeOU: homeOU
                )
            }

            if let tooltip {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                    Text(tooltip)
                        .font(.system(size: 11))
                        .italic()
                        .foregroundStyle(Color.appTextSecondary)
                        .lineSpacing(2)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
        }
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    // MARK: - Content

    @ViewBuilder
    private func content(
        awayATS: SituationStat,
        homeATS: SituationStat,
        awayOU: OUStat,
        homeOU: OUStat
    ) -> some View {
        VStack(spacing: 0) {
            // Team header row — labels + situation
            HStack(alignment: .top, spacing: 0) {
                Color.clear.frame(width: 40)
                teamColumnHeader(team: awayTeam, label: awayATS.label)
                teamColumnHeader(team: homeTeam, label: homeATS.label)
            }
            .padding(.bottom, 12)

            // ATS row
            HStack(spacing: 0) {
                Text("ATS")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(width: 40, alignment: .leading)
                recordCell(record: awayATS.record, pct: awayATS.pct)
                recordCell(record: homeATS.record, pct: homeATS.pct)
            }
            .padding(.vertical, 8)
            .overlay(
                Rectangle()
                    .fill(Color.appTextMuted.opacity(0.05))
                    .frame(height: 1),
                alignment: .top
            )

            // O/U row
            HStack(spacing: 0) {
                Text("O/U")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(width: 40, alignment: .leading)
                ouCell(record: awayOU.record, overPct: awayOU.overPct, underPct: awayOU.underPct)
                ouCell(record: homeOU.record, overPct: homeOU.overPct, underPct: homeOU.underPct)
            }
            .padding(.vertical, 8)
            .overlay(
                Rectangle()
                    .fill(Color.appTextMuted.opacity(0.05))
                    .frame(height: 1),
                alignment: .top
            )
        }
        .padding(12)
        .background(Color.appTextMuted.opacity(0.03), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func teamColumnHeader(team: NCAABSituationalTrendRow, label: String) -> some View {
        VStack(spacing: 6) {
            GameCardTeamAvatar(teamName: team.teamName, sport: "ncaab", size: 40)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: 100)
        }
        .frame(maxWidth: .infinity)
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
                .background(atsColor(pct).opacity(0.125), in: RoundedRectangle(cornerRadius: 6))
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func ouCell(record: String, overPct: Double?, underPct: Double?) -> some View {
        VStack(spacing: 4) {
            Text(record)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text(ouSubtext(over: overPct, under: underPct))
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func ouSubtext(over: Double?, under: Double?) -> String {
        guard let over, let under else { return "-" }
        return "\(Int(over.rounded()))%O / \(Int(under.rounded()))%U"
    }

    private func formatPct(_ pct: Double?) -> String {
        guard let pct else { return "-" }
        return "\(Int(pct.rounded()))%"
    }

    /// Mirrors RN `getATSColor`: green ≥55, yellow 45–54, red <45.
    private func atsColor(_ percentage: Double?) -> Color {
        guard let percentage else { return Color.appTextMuted }
        if percentage >= 55 { return Color(red: 0.13, green: 0.77, blue: 0.37) }
        if percentage >= 45 { return Color(red: 0.92, green: 0.70, blue: 0.03) }
        return Color(red: 0.94, green: 0.27, blue: 0.27)
    }

    // MARK: - Per-situation extractors

    private func atsData(for team: NCAABSituationalTrendRow) -> SituationStat {
        switch situationType {
        case .lastGame:
            return SituationStat(
                record: team.atsLastGameRecord ?? "-",
                pct: team.atsLastGameCoverPct,
                label: formatNCAABSituation(team.lastGameSituation)
            )
        case .favDog:
            return SituationStat(
                record: team.atsFavDogRecord ?? "-",
                pct: team.atsFavDogCoverPct,
                label: formatNCAABSituation(team.favDogSituation)
            )
        case .sideFavDog:
            return SituationStat(
                record: team.atsSideFavDogRecord ?? "-",
                pct: team.atsSideFavDogCoverPct,
                label: formatNCAABSituation(team.sideSpreadSituation)
            )
        case .restBucket:
            return SituationStat(
                record: team.atsRestBucketRecord ?? "-",
                pct: team.atsRestBucketCoverPct,
                label: formatNCAABSituation(team.restBucket)
            )
        case .restComp:
            return SituationStat(
                record: team.atsRestCompRecord ?? "-",
                pct: team.atsRestCompCoverPct,
                label: formatNCAABSituation(team.restComp)
            )
        }
    }

    private func ouData(for team: NCAABSituationalTrendRow) -> OUStat {
        switch situationType {
        case .lastGame:
            return OUStat(
                record: team.ouLastGameRecord ?? "-",
                overPct: team.ouLastGameOverPct,
                underPct: team.ouLastGameUnderPct
            )
        case .favDog:
            return OUStat(
                record: team.ouFavDogRecord ?? "-",
                overPct: team.ouFavDogOverPct,
                underPct: team.ouFavDogUnderPct
            )
        case .sideFavDog:
            return OUStat(
                record: team.ouSideFavDogRecord ?? "-",
                overPct: team.ouSideFavDogOverPct,
                underPct: team.ouSideFavDogUnderPct
            )
        case .restBucket:
            return OUStat(
                record: team.ouRestBucketRecord ?? "-",
                overPct: team.ouRestBucketOverPct,
                underPct: team.ouRestBucketUnderPct
            )
        case .restComp:
            return OUStat(
                record: team.ouRestCompRecord ?? "-",
                overPct: team.ouRestCompOverPct,
                underPct: team.ouRestCompUnderPct
            )
        }
    }

    private struct SituationStat {
        let record: String
        let pct: Double?
        let label: String
    }

    private struct OUStat {
        let record: String
        let overPct: Double?
        let underPct: Double?
    }
}
