import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Tap-to-detail modal presented from the compact scoreboard grid. Mirrors
/// `wagerproof-mobile/components/LiveScoreDetailModal.tsx`. The container is
/// a native `.sheet(item:)` instead of RN's transparent `Modal` overlay —
/// gives us native blur, drag-to-dismiss, and proper iOS sheet ergonomics.
///
/// Spec: docs/wagerproof-migration/08-screen-native-spec.md §2.
struct LiveScoreDetailModal: View {
    let game: LiveGame
    /// Called when the "View Full Scoreboard" footer button is tapped. The
    /// parent toggles expand-mode and dismisses. Mirrors RN's
    /// `onViewFullScoreboard` callback.
    var onViewFullScoreboard: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var hasPredictions: Bool {
        guard let p = game.predictions else { return false }
        return p.moneyline != nil || p.spread != nil || p.overUnder != nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    scoreHeader
                    if hasPredictions {
                        predictionsSection
                    } else {
                        noPredictions
                    }
                }
            }
            .background(Color.appSurface)
            .navigationTitle("Live Game")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    leagueBadge
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .accessibilityLabel("Close")
                }
            }
            .safeAreaInset(edge: .bottom) {
                fullScoreboardFooter
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private var leagueBadge: some View {
        Text(game.league)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(Color.appPrimary)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.appPrimarySubtle.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    @ViewBuilder
    private var scoreHeader: some View {
        HStack(alignment: .center) {
            TeamCircleView(
                teamName: game.awayTeam,
                abbr: game.awayAbbr,
                league: game.league,
                size: 56,
                fontSize: 20
            )
            Spacer()
            VStack(spacing: 6) {
                HStack(spacing: 12) {
                    Text("\(game.awayScore)")
                        .font(.system(size: 36, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Color.appTextPrimary)
                        .contentTransition(.numericText())
                    Text("-")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                    Text("\(game.homeScore)")
                        .font(.system(size: 36, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Color.appTextPrimary)
                        .contentTransition(.numericText())
                }
                HStack(spacing: 6) {
                    Text(game.quarter.isEmpty ? (game.period ?? "") : game.quarter)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    if !game.timeRemaining.isEmpty {
                        Text(game.timeRemaining)
                            .font(.system(size: 14))
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
                size: 56,
                fontSize: 20
            )
        }
        .padding(Spacing.xl)
        .background(Color.appSurfaceElevated)
    }

    @ViewBuilder
    private var predictionsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("AI MODEL PREDICTIONS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
                .padding(.top, Spacing.sm)

            VStack(spacing: 10) {
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
        .padding(.horizontal, Spacing.lg)
        .padding(.bottom, Spacing.lg)
    }

    @ViewBuilder
    private func predictionRow(label: String, prediction: PredictionStatus, detail: String) -> some View {
        let hit = prediction.isHitting
        let statusColor = hit ? Color(hex: 0x22D35F) : Color(hex: 0xEF4444)
        let bgColor = hit ? Color(hex: 0x22D35F, opacity: 0.1) : Color(hex: 0xEF4444, opacity: 0.1)
        let borderColor = hit ? Color(hex: 0x22D35F, opacity: 0.3) : Color(hex: 0xEF4444, opacity: 0.3)

        HStack(alignment: .center, spacing: 10) {
            Image(systemName: hit ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 18))
                .foregroundStyle(statusColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(detail)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                HStack(spacing: 4) {
                    Image(systemName: hit ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 14))
                        .foregroundStyle(statusColor)
                    Text(hit ? "Hitting" : "Not Hitting")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(statusColor)
                }
                Text("\(Int(prediction.probability * 100))% Conf.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(12)
        .background(bgColor)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(borderColor, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var noPredictions: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 40))
                .foregroundStyle(Color.appTextSecondary)
            Text("No predictions available for this game")
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.xxl)
    }

    @ViewBuilder
    private var fullScoreboardFooter: some View {
        Button {
            onViewFullScoreboard()
            dismiss()
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "sportscourt.fill")
                    .font(.system(size: 16, weight: .semibold))
                Text("View Full Scoreboard")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.appPrimary)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.md)
        .background(Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.appBorder)
                .frame(height: 1)
        }
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
