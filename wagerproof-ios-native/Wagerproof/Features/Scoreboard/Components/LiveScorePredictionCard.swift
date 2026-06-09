import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Expanded full-width live-score card. Renders the same score header as the
/// compact card plus an "AI MODEL PREDICTIONS" section listing moneyline,
/// spread, and over/under with hitting/miss badges and confidence pills.
/// Mirrors `wagerproof-mobile/components/LiveScorePredictionCard.tsx` 1:1.
///
/// Surfaced when the user taps "Expand" in the scoreboard's header.
struct LiveScorePredictionCard: View {
    let game: LiveGame

    private var hasPredictions: Bool {
        guard let p = game.predictions else { return false }
        return p.moneyline != nil || p.spread != nil || p.overUnder != nil
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            if hasPredictions {
                predictionsSection
            } else {
                Text("No predictions available for this game")
                    .font(AppFont.body)
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(Spacing.lg)
            }
        }
        .background(Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.appBorder, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    @ViewBuilder
    private var header: some View {
        HStack {
            TeamCircleView(
                teamName: game.awayTeam,
                abbr: game.awayAbbr,
                league: game.league,
                size: 48,
                fontSize: 18
            )
            Spacer()
            VStack(spacing: 4) {
                HStack(spacing: 8) {
                    Text("\(game.awayScore)")
                        .font(.system(size: 28, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Color.appTextPrimary)
                        .contentTransition(.numericText())
                    Text("-")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                    Text("\(game.homeScore)")
                        .font(.system(size: 28, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Color.appTextPrimary)
                        .contentTransition(.numericText())
                }
                HStack(spacing: 4) {
                    Text(game.quarter)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    if !game.timeRemaining.isEmpty {
                        Text(game.timeRemaining)
                            .font(.system(size: 12))
                            .monospacedDigit()
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
            Spacer()
            TeamCircleView(
                teamName: game.homeTeam,
                abbr: game.homeAbbr,
                league: game.league,
                size: 48,
                fontSize: 18
            )
        }
        .padding(Spacing.lg)
        .background(Color.appSurfaceElevated)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.appBorder)
                .frame(height: 1)
        }
    }

    @ViewBuilder
    private var predictionsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("AI MODEL PREDICTIONS")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)

            VStack(spacing: Spacing.sm) {
                if let ml = game.predictions?.moneyline {
                    predictionRow(
                        label: "Moneyline",
                        prediction: ml,
                        detail: "\(ml.predicted.rawValue) to win"
                    )
                }
                if let spread = game.predictions?.spread {
                    predictionRow(
                        label: "Spread",
                        prediction: spread,
                        detail: "\(spread.predicted.rawValue) \(formatLine(spread.line))"
                    )
                }
                if let ou = game.predictions?.overUnder {
                    predictionRow(
                        label: "Over/Under",
                        prediction: ou,
                        detail: "\(ou.predicted.rawValue) \(formatLineUnsigned(ou.line))"
                    )
                }
            }
        }
        .padding(Spacing.lg)
    }

    @ViewBuilder
    private func predictionRow(label: String, prediction: PredictionStatus, detail: String) -> some View {
        let hit = prediction.isHitting
        let statusColor = hit ? Color(hex: 0x22D35F) : Color(hex: 0xEF4444)
        let bgColor = hit ? Color(hex: 0x22D35F, opacity: 0.1) : Color(hex: 0xEF4444, opacity: 0.1)
        let borderColor = hit ? Color(hex: 0x22D35F, opacity: 0.3) : Color(hex: 0xEF4444, opacity: 0.3)

        HStack(alignment: .center, spacing: Spacing.sm) {
            Image(systemName: hit ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(statusColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(detail)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: hit ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 12))
                        .foregroundStyle(statusColor)
                    Text(hit ? "Hitting" : "Not Hitting")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(statusColor)
                }
                Text("\(Int(prediction.probability * 100))% Conf.")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(10)
        .background(bgColor)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(borderColor, lineWidth: 1)
        )
    }

    private func formatLine(_ value: Double?) -> String {
        guard let v = value else { return "" }
        if v == v.rounded() {
            let intVal = Int(v)
            return intVal > 0 ? "+\(intVal)" : "\(intVal)"
        }
        return v > 0 ? "+\(v)" : "\(v)"
    }

    private func formatLineUnsigned(_ value: Double?) -> String {
        guard let v = value else { return "" }
        if v == v.rounded() {
            return String(format: "%.0f", v)
        }
        return String(format: "%.1f", v)
    }
}

/// Gradient circle showing a team's initials/abbreviation. Used by both the
/// expanded prediction card and the detail modal.
///
// FIDELITY-WAIVER #008: RN pulls real team colors from `utils/teamColors.ts`
// per league. That utility ports with the sport-specific batches (B09–B12)
// so we don't duplicate the 500-line lookup table here. Fallback gradient
// uses brand-green; initials still match RN exactly. See tickets/008-team-colors.md.
struct TeamCircleView: View {
    let teamName: String
    let abbr: String?
    let league: String
    var size: CGFloat = 56
    var fontSize: CGFloat = 20

    private var initials: String {
        if let abbr, !abbr.isEmpty { return abbr }
        let words = teamName.split(separator: " ")
        if words.count >= 2 {
            return String(words.prefix(2).map { $0.first ?? "?" })
        }
        return String(teamName.prefix(3)).uppercased()
    }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.appPrimary, Color.appPrimaryStrong],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 2)
                Text(initials)
                    .font(.system(size: fontSize, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: size, height: size)
            Text(teamName)
                .font(.system(size: size > 50 ? 12 : 11))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
                .frame(maxWidth: size * 1.5)
        }
    }
}
