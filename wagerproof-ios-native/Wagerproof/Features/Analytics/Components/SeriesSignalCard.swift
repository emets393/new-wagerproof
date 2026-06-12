import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One series-position signal (G2/G3 carryover). ★ BACK for positive,
/// ⚠ FADE for negative — message sits in a tinted, accent-edged box.
struct SeriesSignalCard: View {
    let signal: MLBSeriesSignal

    var body: some View {
        let accent = signal.isPositive ? Regression.winGreen : Regression.lossRed
        RegressionAccentRow(color: accent) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 8) {
                    Text(signal.matchup)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(2)
                    Spacer(minLength: 0)
                    RegressionPill(text: signal.isPositive ? "★ BACK" : "⚠ FADE", color: accent)
                }

                Text(signal.message)
                    .font(.system(size: 13))
                    .lineSpacing(3)
                    .foregroundStyle(Color.appTextPrimary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(accent.opacity(0.1))
                    .overlay(alignment: .leading) {
                        Rectangle().fill(accent).frame(width: 3)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
