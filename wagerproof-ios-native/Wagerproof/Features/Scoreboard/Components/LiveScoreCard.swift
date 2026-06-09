import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact live-score tile rendered in the scoreboard's 2-column grid.
/// Mirrors `wagerproof-mobile/components/LiveScoreCard.tsx` row-for-row:
/// indicator dot, team-abbr/score row, optional prediction line at the bottom.
///
/// Visual rules ported from RN:
/// - Green pulsing glow + green border when `hasAnyHitting`.
/// - Red-tinted border when predictions exist but none are hitting.
/// - Default outline-variant border when no predictions exist yet.
/// - Score numbers use `.contentTransition(.numericText())` so polling updates
///   roll in instead of pop (HIG-native animation; replaces RN's static text).
struct LiveScoreCard: View {
    let game: LiveGame
    var onPress: (() -> Void)? = nil

    /// Drives the pulse animation on the green border / shadow.
    @State private var pulse: Bool = false

    private var hasPredictions: Bool {
        guard let p = game.predictions else { return false }
        return p.moneyline != nil || p.spread != nil || p.overUnder != nil
    }

    private var hasHitting: Bool {
        game.predictions?.hasAnyHitting ?? false
    }

    private var borderColor: Color {
        if hasPredictions && hasHitting { return Color(hex: 0x22D35F) }
        if hasPredictions { return Color(hex: 0xEF4444, opacity: 0.5) }
        return Color.appBorder
    }

    private var borderWidth: CGFloat {
        hasPredictions && hasHitting ? 1.5 : 1
    }

    var body: some View {
        Button {
            onPress?()
        } label: {
            cardBody
        }
        .buttonStyle(.plain)
        // Match Honeydew's tap-press behaviour: subtle scale + opacity.
        .accessibilityLabel("\(game.awayAbbr) \(game.awayScore), \(game.homeAbbr) \(game.homeScore)")
    }

    @ViewBuilder
    private var cardBody: some View {
        VStack(alignment: .leading, spacing: 4) {
            mainRow
            if hasPredictions {
                predictionsLine
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(borderColor, lineWidth: borderWidth)
        )
        // The pulsing glow only attaches when a prediction is hitting. Uses
        // .symbolEffect-equivalent via shadow modulation tied to a Bool.
        .shadow(
            color: hasPredictions && hasHitting
                ? Color(hex: 0x22D35F, opacity: pulse ? 0.9 : 0.4)
                : .clear,
            radius: pulse ? 14 : 6,
            x: 0,
            y: 0
        )
        .animation(
            hasPredictions && hasHitting
                ? .easeInOut(duration: 1.5).repeatForever(autoreverses: true)
                : .default,
            value: pulse
        )
        .task(id: hasHitting) {
            // Restart pulse when hitting state changes. Setting to false
            // first ensures the animation reseeds even after re-renders.
            if hasPredictions && hasHitting {
                pulse = false
                pulse = true
            }
        }
    }

    @ViewBuilder
    private var mainRow: some View {
        HStack(spacing: 8) {
            if hasPredictions {
                Circle()
                    .fill(hasHitting ? Color(hex: 0x22D35F) : Color(hex: 0xEF4444))
                    .frame(width: 8, height: 8)
            }

            HStack(spacing: 4) {
                Text(game.awayAbbr)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text("\(game.awayScore)")
                    .font(.system(size: 14, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.appTextPrimary)
                    .contentTransition(.numericText())
                Text("-")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
                Text("\(game.homeScore)")
                    .font(.system(size: 14, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.appTextPrimary)
                    .contentTransition(.numericText())
                Text(game.homeAbbr)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if !hasPredictions, game.isLive, !(game.period ?? "").isEmpty {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(game.period ?? game.quarter)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    if !game.timeRemaining.isEmpty {
                        Text(game.timeRemaining)
                            .font(.system(size: 8))
                            .monospacedDigit()
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var predictionsLine: some View {
        let spreadText = spreadDisplay
        let ouText = ouDisplay

        if spreadText != nil || ouText != nil {
            HStack(spacing: 6) {
                Spacer(minLength: 0)
                if let spread = spreadText {
                    Text(spread.text)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(spread.color)
                }
                if spreadText != nil && ouText != nil {
                    Text("•")
                        .font(.system(size: 8))
                        .foregroundStyle(Color.appTextSecondary)
                }
                if let ou = ouText {
                    Text(ou.text)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(ou.color)
                }
                Spacer(minLength: 0)
            }
            .padding(.top, 4)
        }
    }

    /// Returns `"BOS -9.5"` style display + hit/miss color. Mirrors RN's
    /// `getSpreadDisplay()`: line sign flips when the model picks Away.
    private var spreadDisplay: (text: String, color: Color)? {
        guard let spread = game.predictions?.spread else { return nil }
        let pickedTeam = spread.predicted == .home ? game.homeAbbr : game.awayAbbr
        var line = spread.line ?? 0
        if spread.predicted == .away, spread.line != nil {
            line = -(spread.line ?? 0)
        }
        let lineStr = spread.line == nil
            ? ""
            : (line > 0 ? "+\(formatLine(line))" : "\(formatLine(line))")
        let text = "\(pickedTeam) \(lineStr)"
        return (text, spread.isHitting ? Color(hex: 0x22D35F) : Color(hex: 0xEF4444))
    }

    /// Returns `"O 230.5"` / `"U 230.5"` style display + hit/miss color.
    /// Mirrors RN's `getOUDisplay()`.
    private var ouDisplay: (text: String, color: Color)? {
        guard let ou = game.predictions?.overUnder else { return nil }
        let prefix = ou.predicted == .over ? "O" : "U"
        let text = "\(prefix) \(formatLine(ou.line ?? 0))"
        return (text, ou.isHitting ? Color(hex: 0x22D35F) : Color(hex: 0xEF4444))
    }

    /// Strip trailing `.0` so 9.5 → 9.5 but 9.0 → 9. Mirrors JS number coercion.
    private func formatLine(_ value: Double) -> String {
        if value == value.rounded() {
            return String(format: "%.0f", value)
        }
        return String(format: "%.1f", value)
    }
}

#Preview {
    let hittingGame = LiveGame(
        id: "1",
        league: "NFL",
        homeTeam: "Boston",
        awayTeam: "New York",
        homeAbbr: "BOS",
        awayAbbr: "NYK",
        homeScore: 24,
        awayScore: 17,
        quarter: "Q3",
        period: "Q3",
        timeRemaining: "5:42",
        isLive: true,
        gameStatus: "live",
        lastUpdated: "2026-05-20T10:00:00Z",
        predictions: GamePredictions(
            hasAnyHitting: true,
            spread: PredictionStatus(
                predicted: .home,
                isHitting: true,
                probability: 0.65,
                line: -3.5,
                currentDifferential: 3.5
            ),
            overUnder: PredictionStatus(
                predicted: .over,
                isHitting: true,
                probability: 0.6,
                line: 38.5,
                currentDifferential: 2.5
            )
        )
    )
    return LiveScoreCard(game: hittingGame, onPress: {})
        .padding()
        .background(Color.appSurface)
}
