import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact CFB prediction summary card used inside the CFB game bottom
/// sheet. Mirrors RN `components/CFBPredictionCard.tsx` — renders the
/// predicted home/away scores, edge percentages, and confidence pills.
///
/// Standalone view so a single card can render against any
/// `CFBPrediction` shape without needing the full bottom-sheet context.
struct CFBPredictionCard: View {
    let game: CFBPrediction

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "brain.head.profile")
                    .foregroundStyle(Color.appPrimary)
                Text("Model Projection")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
            }

            if let awayScore = game.predAwayScore, let homeScore = game.predHomeScore {
                HStack(spacing: 12) {
                    scoreColumn(label: game.awayTeam, value: awayScore)
                    Text("-")
                        .font(.system(size: 24, weight: .light))
                        .foregroundStyle(Color.appTextMuted)
                    scoreColumn(label: game.homeTeam, value: homeScore)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 12))
            }

            if let spreadEdge = game.homeSpreadDiff {
                edgeRow(label: "Spread Edge", value: spreadEdge)
            }
            if let totalEdge = game.overLineDiff {
                edgeRow(label: "Total Edge", value: totalEdge)
            }
        }
    }

    @ViewBuilder
    private func scoreColumn(label: String, value: Double) -> some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
                .multilineTextAlignment(.center)
            Text(String(format: "%.1f", value))
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func edgeRow(label: String, value: Double) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
            Spacer()
            Text(value >= 0 ? "+\(String(format: "%.1f", value))" : String(format: "%.1f", value))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(edgeColor(abs(value)))
        }
    }

    private func edgeColor(_ edge: Double) -> Color {
        switch edge {
        case 5...: return Color(red: 0.13, green: 0.77, blue: 0.37)
        case 3..<5: return Color(red: 0.52, green: 0.80, blue: 0.09)
        case 2..<3: return Color(red: 0.92, green: 0.70, blue: 0.03)
        default: return Color(red: 0.98, green: 0.45, blue: 0.09)
        }
    }
}
