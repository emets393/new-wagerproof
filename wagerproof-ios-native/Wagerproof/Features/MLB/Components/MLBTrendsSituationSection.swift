import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One situation row inside the MLB betting trends sheet. Mirrors RN
/// `components/mlb/MLBTrendsSituationSection.tsx`. Unlike NCAAB (which
/// shows W-L records + cover%), MLB only carries Win% and Over% — no
/// records, no spread% — so each row is two rows: WIN% + OVER%.
struct MLBTrendsSituationSection: View {
    let title: String
    let icon: String
    let awayTeam: MLBSituationalTrendRow
    let homeTeam: MLBSituationalTrendRow
    let situation: MLBSituationType
    let tooltip: String?

    var body: some View {
        let awayWin = winData(for: awayTeam)
        let homeWin = winData(for: homeTeam)
        let awayOver = overData(for: awayTeam)
        let homeOver = overData(for: homeTeam)
        let hasData = awayWin.pct != nil || homeWin.pct != nil || awayOver != nil || homeOver != nil

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(Color.appPrimary)
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            if !hasData {
                Text("No data available")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(Color.appTextMuted.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 12)
                    .padding(.bottom, 12)
            } else {
                content(awayWin: awayWin, homeWin: homeWin, awayOver: awayOver, homeOver: homeOver)
            }

            if let tooltip {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 11))
                    Text(tooltip)
                        .font(.system(size: 11))
                        .italic()
                }
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
        }
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1))
    }

    @ViewBuilder
    private func content(awayWin: SituationStat, homeWin: SituationStat, awayOver: Double?, homeOver: Double?) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                Color.clear.frame(width: 48)
                teamColumnHeader(team: awayTeam, label: awayWin.label)
                teamColumnHeader(team: homeTeam, label: homeWin.label)
            }
            .padding(.bottom, 12)
            recordRow(label: "WIN%", away: awayWin.pct, home: homeWin.pct)
            recordRow(label: "OVER%", away: awayOver, home: homeOver)
        }
        .padding(12)
        .background(Color.appTextMuted.opacity(0.03), in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func teamColumnHeader(team: MLBSituationalTrendRow, label: String) -> some View {
        let display = MLBTeams.displayById(team.teamId)
        VStack(spacing: 6) {
            MLBTeamLogo(logoUrl: display?.logoUrl, abbrev: display?.abbrev ?? "MLB", name: team.teamName, size: 40)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: 100)
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func recordRow(label: String, away: Double?, home: Double?) -> some View {
        HStack(spacing: 0) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .frame(width: 48, alignment: .leading)
                .foregroundStyle(Color.appTextSecondary)
            percentBadge(pct: away)
            percentBadge(pct: home)
        }
        .padding(.vertical, 8)
        .overlay(
            Rectangle()
                .fill(Color.appTextMuted.opacity(0.05))
                .frame(height: 1),
            alignment: .top
        )
    }

    @ViewBuilder
    private func percentBadge(pct: Double?) -> some View {
        let color = pctColor(pct)
        VStack {
            Text(formatPct(pct))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(color)
                .padding(.horizontal, 10)
                .padding(.vertical, 3)
                .background(color.opacity(0.125), in: RoundedRectangle(cornerRadius: 6))
        }
        .frame(maxWidth: .infinity)
    }

    /// Mirrors RN `getPctColor`: ≥55 green, 45–54 yellow, <45 red.
    private func pctColor(_ pct: Double?) -> Color {
        guard let pct else { return Color.appTextMuted }
        if pct >= 55 { return Color.appPrimary }
        if pct >= 45 { return Color(hex: 0xEAB308) }
        return Color.appAccentRed
    }

    private func formatPct(_ pct: Double?) -> String {
        guard let pct else { return "—" }
        let normalized = pct > 0 && pct < 1 ? pct * 100 : pct
        return "\(Int(normalized.rounded()))%"
    }

    // MARK: - Per-situation extractors

    private struct SituationStat {
        let pct: Double?
        let label: String
    }

    private func winData(for team: MLBSituationalTrendRow) -> SituationStat {
        switch situation {
        case .lastGame: return SituationStat(pct: team.winPctLastGame, label: formatLabel(team.lastGameSituation))
        case .homeAway: return SituationStat(pct: team.winPctHomeAway, label: formatLabel(team.homeAwaySituation))
        case .favDog: return SituationStat(pct: team.winPctFavDog, label: formatLabel(team.favDogSituation))
        case .restBucket: return SituationStat(pct: team.winPctRestBucket, label: formatLabel(team.restBucket))
        case .restComp: return SituationStat(pct: team.winPctRestComp, label: formatLabel(team.restComp))
        case .league: return SituationStat(pct: team.winPctLeague, label: formatLabel(team.leagueSituation))
        case .division: return SituationStat(pct: team.winPctDivision, label: formatLabel(team.divisionSituation))
        }
    }

    private func overData(for team: MLBSituationalTrendRow) -> Double? {
        switch situation {
        case .lastGame: return team.overPctLastGame
        case .homeAway: return team.overPctHomeAway
        case .favDog: return team.overPctFavDog
        case .restBucket: return team.overPctRestBucket
        case .restComp: return team.overPctRestComp
        case .league: return team.overPctLeague
        case .division: return team.overPctDivision
        }
    }

    /// Mirrors RN `formatMLBSituation` — surface the raw label when set.
    private func formatLabel(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "—" }
        return raw.replacingOccurrences(of: "_", with: " ").capitalized
    }
}
