import SwiftUI
import WagerproofDesign

/// Mirrors `wagerproof-mobile/components/learn-wagerproof/slides/Slide1_GameCards.tsx`.
///
/// Two mini game cards side-by-side showing the model-pick pills + confidence
/// badges, followed by a glassmorphic legend ("Green = strong pick", etc).
///
/// The mock data is intentionally hardcoded — this is a marketing walkthrough,
/// not the real Games feed. The actual game cards live in B04.
struct Slide1_GameCards: View {

    private struct MockGame: Identifiable {
        let id = UUID()
        let sport: String
        let awayAbbr: String
        let homeAbbr: String
        let awaySpread: Double
        let homeSpread: Double
        let overLine: Double
        let spreadConfidence: Int
        let ouConfidence: Int
        let spreadPick: SpreadPick
        let ouPick: OUPick
        let isFadeAlert: Bool

        enum SpreadPick { case away, home }
        enum OUPick { case over, under }
    }

    private let games: [MockGame] = [
        MockGame(
            sport: "NBA", awayAbbr: "LAL", homeAbbr: "BOS",
            awaySpread: 4.5, homeSpread: -4.5, overLine: 218.5,
            spreadConfidence: 72, ouConfidence: 65,
            spreadPick: .home, ouPick: .over, isFadeAlert: false
        ),
        MockGame(
            sport: "NFL", awayAbbr: "KC", homeAbbr: "BUF",
            awaySpread: -3.5, homeSpread: 3.5, overLine: 51.5,
            spreadConfidence: 82, ouConfidence: 58,
            spreadPick: .away, ouPick: .under, isFadeAlert: true
        ),
    ]

    var body: some View {
        VStack(spacing: Spacing.lg) {
            HStack(spacing: Spacing.md) {
                ForEach(games) { game in
                    miniCard(game)
                }
            }
            calloutsCard
        }
    }

    // MARK: - Card

    private func miniCard(_ game: MockGame) -> some View {
        VStack(spacing: 4) {
            // Sport badge (anchored top-right via overlay below)
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 4) {
                    teamRow(game: game)
                    ouLinePill(line: game.overLine)
                    pickHeader
                    spreadPill(game)
                    ouPill(game)
                }
                .padding(10)
                .padding(.top, 4)

                HStack(spacing: 0) {
                    Text(game.sport)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.appSurfaceMuted)
                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                }
                .padding(8)
            }
        }
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(alignment: .top) {
            // 3pt brand-green top accent bar.
            LinearGradient(
                colors: [Color.appPrimary, Color.appPrimaryStrong, Color.appPrimary],
                startPoint: .leading, endPoint: .trailing
            )
            .frame(height: 3)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .mask(
                VStack(spacing: 0) {
                    Rectangle().frame(height: 3)
                    Spacer()
                }
            )
        }
        .frame(maxWidth: .infinity)
        .shadow(color: .black.opacity(0.10), radius: 4, x: 0, y: 2)
    }

    private func teamRow(game: MockGame) -> some View {
        HStack(spacing: Spacing.sm) {
            teamCol(abbr: game.awayAbbr)
            Text("@")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
            teamCol(abbr: game.homeAbbr)
        }
        .padding(.top, 4)
        .padding(.bottom, 6)
    }

    private func teamCol(abbr: String) -> some View {
        VStack(spacing: 2) {
            // Generic placeholder avatar — real `TeamAvatar` is part of B04.
            ZStack {
                Circle().fill(Color.appSurfaceMuted)
                Text(String(abbr.prefix(1)))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            .frame(width: 28, height: 28)
            Text(abbr)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    private func ouLinePill(line: Double) -> some View {
        Text("O/U: \(String(format: "%.1f", line))")
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.appTextMuted.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }

    private var pickHeader: some View {
        HStack(spacing: 4) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Color.appWin)
            Text("MODEL PICKS")
                .font(.system(size: 8, weight: .bold))
                .tracking(0.3)
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func spreadPill(_ game: MockGame) -> some View {
        let abbr = game.spreadPick == .home ? game.homeAbbr : game.awayAbbr
        let value = game.spreadPick == .home ? game.homeSpread : game.awaySpread
        let color = confidenceColor(game.spreadConfidence)
        return HStack(spacing: 4) {
            ZStack {
                Circle().fill(Color.appSurfaceMuted)
                Text(String(abbr.prefix(1)))
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            .frame(width: 14, height: 14)

            Text(value > 0 ? "+\(String(format: "%.1f", value))" : String(format: "%.1f", value))
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            confidenceBadge(value: game.spreadConfidence, color: color)

            if game.isFadeAlert {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(color)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 5)
        .background(Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func ouPill(_ game: MockGame) -> some View {
        let color = confidenceColor(game.ouConfidence)
        let isOver = game.ouPick == .over
        return HStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(isOver ? Color.appWin : Color.appLoss)
                Image(systemName: isOver ? "arrow.up" : "arrow.down")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 14, height: 14)

            Text(isOver ? "Over" : "Under")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            confidenceBadge(value: game.ouConfidence, color: color)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 5)
        .background(Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func confidenceBadge(value: Int, color: Color) -> some View {
        Text("\(value)%")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .background(color.opacity(0.2))
            .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
    }

    private func confidenceColor(_ value: Int) -> Color {
        if value >= 80 { return Color(hex: 0x22C55E) }
        if value >= 70 { return Color(hex: 0x84CC16) }
        if value >= 60 { return Color(hex: 0xEAB308) }
        return Color(hex: 0xF97316)
    }

    // MARK: - Callouts

    private var calloutsCard: some View {
        VStack(spacing: Spacing.sm) {
            calloutRow(color: Color(hex: 0x22C55E), text: "Green = Strong pick (70%+)")
            calloutRow(color: Color(hex: 0xEAB308), text: "Yellow = Moderate confidence")
            HStack(spacing: 8) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appAccentAmber)
                Text("Fade Alert (82%+ confidence)")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
            }
        }
        .padding(Spacing.md)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
        )
    }

    private func calloutRow(color: Color, text: String) -> some View {
        HStack(spacing: 8) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(text)
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
            Spacer()
        }
    }
}
