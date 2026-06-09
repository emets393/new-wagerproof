import SwiftUI
import WagerproofDesign

/// Team avatar circle used by the NFL/CFB game cards + bottom sheets.
/// Mirrors RN `components/TeamAvatar.tsx`: a circle filled with the team's
/// primary color (with a secondary-color stroke), centered initials, and
/// an optional remote logo image overlay when wired up later.
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
            Text(TeamInitials.from(teamName))
                .font(.system(size: size * 0.36, weight: .bold))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
        }
        .frame(width: size, height: size)
    }

    private var defaultColors: TeamColorPair {
        switch sport.lowercased() {
        case "cfb", "ncaaf": return .neutralCFB
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
