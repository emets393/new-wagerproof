import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact pill summarizing the games an assistant message touched.
/// Mirrors Honeydew's `ChatV3RecipeReferencesPill` — overlapping
/// thumbnail circles + "3 games" trailing label — but renders sport
/// glyphs instead of recipe images.
///
/// The pill sits in the bubble between the body and the follow-ups (or
/// is omitted if the message has no game cards / widgets). Tapping a
/// thumbnail opens that game's sheet via the parent's tap handler.
struct WagerBotGameReferencesPill: View {
    let references: [Reference]
    var onTap: ((Reference) -> Void)?

    struct Reference: Identifiable, Hashable {
        let id: String
        let sport: String
        let awayAbbr: String
        let homeAbbr: String
    }

    private let avatarDiameter: CGFloat = 26
    private let overlap: CGFloat = 10
    private let maxVisibleAvatars: Int = 4

    var body: some View {
        if references.isEmpty {
            EmptyView()
        } else {
            content
        }
    }

    private var content: some View {
        HStack(spacing: 10) {
            stackedAvatars
            Text(countLabel)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Image(systemName: "chevron.right")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextSecondary.opacity(0.6))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.appPrimary.opacity(0.08))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Color.appPrimary.opacity(0.18), lineWidth: 1))
    }

    private var stackedAvatars: some View {
        let visible = Array(references.prefix(maxVisibleAvatars))
        return HStack(spacing: -overlap) {
            ForEach(Array(visible.enumerated()), id: \.offset) { idx, ref in
                avatar(for: ref)
                    .zIndex(Double(visible.count - idx))
                    .onTapGesture { onTap?(ref) }
            }
        }
    }

    @ViewBuilder
    private func avatar(for ref: Reference) -> some View {
        ZStack {
            Circle()
                .fill(sportColor(ref.sport).opacity(0.20))
            Image(systemName: sportIcon(ref.sport))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(sportColor(ref.sport))
        }
        .frame(width: avatarDiameter, height: avatarDiameter)
        .overlay(Circle().stroke(Color.appSurface, lineWidth: 2))
    }

    private var countLabel: String {
        let n = references.count
        return n == 1 ? "1 game" : "\(n) games"
    }

    private func sportIcon(_ sport: String) -> String {
        switch sport.lowercased() {
        case "nba", "ncaab": return "basketball.fill"
        case "nfl", "cfb":   return "football.fill"
        case "mlb":          return "baseball.fill"
        default:             return "sportscourt.fill"
        }
    }

    private func sportColor(_ sport: String) -> Color {
        switch sport.lowercased() {
        case "nba":   return Color.appAccentAmber
        case "nfl":   return Color.appAccentBlue
        case "cfb":   return Color.appAccentPurple
        case "ncaab": return Color.appAccentRed
        case "mlb":   return Color.appAccentBlue
        default:      return Color.appPrimary
        }
    }
}

#Preview {
    WagerBotGameReferencesPill(references: [
        .init(id: "1", sport: "nba", awayAbbr: "LAL", homeAbbr: "BOS"),
        .init(id: "2", sport: "mlb", awayAbbr: "NYY", homeAbbr: "BOS"),
        .init(id: "3", sport: "nfl", awayAbbr: "KC", homeAbbr: "BUF"),
    ])
    .padding()
}
