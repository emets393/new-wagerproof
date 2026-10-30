import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Team avatar circle used by the NFL/CFB game cards + bottom sheets.
/// Mirrors RN `components/TeamAvatar.tsx`: a circle filled with the team's
/// primary color (with a secondary-color stroke) and a real team logo when
/// one is available — NFL resolves `nfl_teams.logo_espn` via `NFLTeamAssets`;
/// other sports (and any load failure) show centered initials.
///
/// FIDELITY-WAIVER #008: Real per-team color tables port with the
/// sport-specific batches. B04 uses a neutral palette so the avatar still
/// renders shape-correctly while reviewers compare side-by-side parity
/// screenshots. See tickets/008-team-colors.md.
struct GameCardTeamAvatar: View {
    let teamName: String
    let sport: String
    let size: CGFloat
    var colors: TeamColorPair?
    /// ESPN (or other) logo for sports that don't have a name-keyed asset
    /// table. College basketball passes the URL joined from `ncaab_team_mapping`.
    var logoURL: String? = nil

    var body: some View {
        let pair = colors ?? defaultColors
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [pair.primary, pair.secondary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    Circle().strokeBorder(pair.secondary, lineWidth: 2)
                )
                .shadow(color: .black.opacity(0.15), radius: 2, x: 0, y: 1)
            if let logo = resolvedLogo, let url = URL(string: logo) {
                CachedAsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable()
                            .scaledToFit()
                            .padding(size * 0.12)
                    } else {
                        initialsText
                    }
                }
            } else {
                initialsText
            }
        }
        .frame(width: size, height: size)
    }

    private var initialsText: some View {
        Text(TeamInitials.from(teamName))
            .font(.system(size: size * 0.36, weight: .bold))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
    }

    /// An explicit URL wins. Otherwise NFL / CFB / MLB logos come from their
    /// sport reference tables, cached before the Games slate renders.
    private var resolvedLogo: String? {
        if let logoURL, !logoURL.isEmpty { return logoURL }
        switch sport.lowercased() {
        case "nfl":
            return NFLTeamAssets.logo(for: teamName)
        case "cfb", "ncaaf":
            return CFBTeamAssets.logo(for: teamName)
        case "mlb":
            return MLBTeams.logoUrl(for: teamName)
        case "nba":
            return NBATeams.logoURL(for: teamName)
        case "ncaab":
            return NCAABTeamAssets.logo(for: teamName)
        default:
            return nil
        }
    }

    private var defaultColors: TeamColorPair {
        switch sport.lowercased() {
        case "nfl":
            return NFLTeamColors.colorPair(for: teamName)
        case "cfb", "ncaaf":
            return CFBTeamColors.colorPair(for: teamName)
        case "mlb":
            let pair = MLBTeams.colors(for: teamName)
            return TeamColorPair(
                primary: Color(hex: Int(pair.primary)),
                secondary: Color(hex: Int(pair.secondary))
            )
        case "ncaab": return .neutralNCAAB
        case "nba": return .neutralNBA
        default: return .neutralNFL
        }
    }
}

#Preview {
    HStack(spacing: 8) {
        GameCardTeamAvatar(teamName: "Dallas Cowboys", sport: "nfl", size: 42)
        GameCardTeamAvatar(teamName: "Philadelphia Eagles", sport: "nfl", size: 42)
        GameCardTeamAvatar(teamName: "Alabama Crimson Tide", sport: "cfb", size: 42)
    }
    .padding()
    .background(Color.appSurface)
}
