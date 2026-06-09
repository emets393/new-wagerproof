import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact matchup row used in the MLB Betting Trends list screen. Mirrors
/// `wagerproof-mobile/components/mlb/MLBBettingTrendsMatchupCard.tsx`. Tap
/// routes to the existing `MLBBettingTrendsBottomSheet` via the parent's
/// store binding.
///
/// MLB uses a separate team palette (real team colors live in `MLBTeams`)
/// but until #008 ships per-team for all sports we use a neutral stripe so
/// the card is shape-correct without faking color data.
struct MLBBettingTrendsMatchupCardView: View {
    let game: MLBGameTrends
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                stripe
                HStack(alignment: .center, spacing: 12) {
                    teamColumn(team: game.awayTeam)

                    VStack(spacing: 6) {
                        Text("@")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary.opacity(0.5))
                        Text(formatGameTime(game.gameTimeEt))
                            .font(.system(size: 11, weight: .semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity)

                    teamColumn(team: game.homeTeam)

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .padding(.vertical, 16)
                .padding(.horizontal, 12)
            }
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: game.gamePk)
    }

    /// 4-stop team stripe using real MLB colors via `MLBTeams.colors(for:)`
    /// when available. Falls back to a neutral gradient if the lookup fails
    /// (e.g. expansion team not yet in the table).
    @ViewBuilder
    private var stripe: some View {
        let aw = MLBTeams.colors(for: game.awayTeam.teamName)
        let hm = MLBTeams.colors(for: game.homeTeam.teamName)
        LinearGradient(
            colors: [
                Color(hex: Int(aw.primary)),
                Color(hex: Int(aw.secondary)),
                Color(hex: Int(hm.primary)),
                Color(hex: Int(hm.secondary))
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 4)
    }

    @ViewBuilder
    private func teamColumn(team: MLBSituationalTrendRow) -> some View {
        // RN resolves team_id → abbrev first, falling back to a last-word
        // trimmed nickname when the team_id isn't in the brand map. Mirrors
        // `resolveTeamDisplay` in `MLBBettingTrendsMatchupCard.tsx`.
        let display = MLBTeams.displayById(team.teamId)
        let abbr = display?.abbrev ?? Self.fallbackAbbrev(team.teamName)
        VStack(spacing: 6) {
            GameCardTeamAvatar(teamName: team.teamName, sport: "mlb", size: 48)
            Text(abbr)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }

    private static func fallbackAbbrev(_ name: String) -> String {
        let words = name.split(separator: " ")
        guard let last = words.last else { return "—" }
        return String(last.prefix(3)).uppercased()
    }

    /// `game_time_et` is an ISO timestamp (mirrors `mlb_games_today.game_time_et`).
    /// We delegate to the shared formatter for the EST display string.
    private func formatGameTime(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "TBD" }
        return GameCardFormatting.convertTimeToEST(raw)
    }
}
