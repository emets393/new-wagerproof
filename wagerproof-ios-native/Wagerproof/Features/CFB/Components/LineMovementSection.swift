import SwiftUI
import WagerproofDesign
import WagerproofModels

/// CFB line movement section embedded in the CFB game bottom sheet.
/// Mirrors RN `components/cfb/LineMovementSection.tsx` — a chart showing
/// the spread + total line drift from `cfb_line_movement` over the days
/// leading up to the game.
///
/// FIDELITY-WAIVER #033: Line movement chart data fetch + Victory-style
/// chart rendering port with the dedicated line-movement data store. B04
/// ships the section card shell + empty-state copy; the live chart wires
/// up in a later batch.
struct CFBLineMovementSection: View {
    let game: CFBPrediction
    var compact: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(Color.appAccentPurple)
                Text("Line Movement")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            HStack(spacing: 12) {
                if let opening = game.openingSpread {
                    metric(label: "Opening Spread", value: GameCardFormatting.formatSpread(opening))
                }
                if let opening = game.openingTotal {
                    metric(label: "Opening Total", value: GameCardFormatting.roundToNearestHalf(opening))
                }
                if let current = game.homeSpread {
                    metric(label: "Current Spread", value: GameCardFormatting.formatSpread(current))
                }
            }
            Text("Detailed line history will appear once cfb_line_movement wires up.")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .multilineTextAlignment(.leading)
        }
    }

    @ViewBuilder
    private func metric(label: String, value: String) -> some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appTextPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
    }
}
