import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact matchup row used in the NBA Betting Trends list screen. Mirrors
/// `wagerproof-mobile/components/nba/BettingTrendsMatchupCard.tsx` — a
/// rounded card with a 4-color gradient stripe at the top, two team avatars,
/// a centered tipoff time badge, and a trailing chevron that opens the
/// `NBABettingTrendsBottomSheet`.
///
/// Tapping the card invokes `onTap`, which the parent screen wires to
/// `NBABettingTrendsStore.openTrendsSheet(_:)`. This keeps the per-card view
/// free of store references so previews/snapshots stay deterministic.
struct NBABettingTrendsMatchupCardView: View {
    let game: NBAGameTrendsData
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                // Neutral 4-stop gradient stripe stand-in until the real team
                // colors port lands (#008). Keeps the visual rhythm of the RN
                // card without the per-team palette.
                LinearGradient(
                    colors: [
                        TeamColorPair.neutralNBA.primary,
                        TeamColorPair.neutralNBA.secondary,
                        TeamColorPair.neutralNBA.primary.opacity(0.85),
                        TeamColorPair.neutralNBA.secondary.opacity(0.85)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(height: 4)

                HStack(alignment: .center, spacing: 12) {
                    teamColumn(name: game.awayTeam.teamName, abbr: game.awayTeam.teamAbbr)

                    VStack(spacing: 6) {
                        Text("@")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary.opacity(0.5))
                        Text(formatTipoff(game.tipoffTime))
                            .font(.system(size: 11, weight: .semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity)

                    teamColumn(name: game.homeTeam.teamName, abbr: game.homeTeam.teamAbbr)

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
        // Match the haptic from RN — light impact on press.
        .sensoryFeedback(.impact(weight: .light), trigger: game.gameId)
    }

    @ViewBuilder
    private func teamColumn(name: String, abbr: String) -> some View {
        VStack(spacing: 6) {
            GameCardTeamAvatar(teamName: name, sport: "nba", size: 48)
            Text(abbr)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }

    /// Convert UTC tipoff timestamp to a `h:mm a ET` display string. Falls
    /// back to "TBD" when the source is missing or unparseable — RN parity.
    private func formatTipoff(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "TBD" }
        return GameCardFormatting.convertTimeToEST(raw)
    }
}
