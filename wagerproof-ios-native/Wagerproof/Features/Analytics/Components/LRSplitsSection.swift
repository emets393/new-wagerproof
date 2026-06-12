import SwiftUI
import WagerproofDesign
import WagerproofModels

/// L/R Pitcher Splits: notable matchups (indigo accent) first, then all
/// other splits. Mirrors RN `LRSplitsBody`/`SplitRow`.
struct LRSplitsSection: View {
    let splits: [MLBLRSplitEntry]

    var body: some View {
        let notable = splits.filter { $0.isNotable }
        let rest = splits.filter { !$0.isNotable }

        VStack(alignment: .leading, spacing: 16) {
            if !notable.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    RegressionGroupLabel(
                        label: "NOTABLE MATCHUPS",
                        count: notable.count,
                        color: Regression.accentIndigo,
                        note: "Favorable or difficult splits worth flagging"
                    )
                    ForEach(Array(notable.enumerated()), id: \.offset) { _, split in
                        LRSplitRow(split: split, notable: true)
                    }
                }
            }
            if !rest.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    RegressionGroupLabel(label: "ALL OTHER SPLITS", count: rest.count)
                    ForEach(Array(rest.enumerated()), id: \.offset) { _, split in
                        LRSplitRow(split: split, notable: false)
                    }
                }
            }
        }
    }
}

private struct LRSplitRow: View {
    let split: MLBLRSplitEntry
    let notable: Bool

    var body: some View {
        let record = split.f5Ties > 0
            ? "F5 \(split.f5Wins)-\(split.f5Losses)-\(split.f5Ties)"
            : "F5 \(split.f5Wins)-\(split.f5Losses)"
        let winColor: Color = {
            guard let pct = split.f5WinPct else { return Color.appTextPrimary }
            if pct >= 60 { return Regression.winGreen }
            if pct <= 40 { return Regression.lossRed }
            return Color.appTextPrimary
        }()

        RegressionAccentRow(color: notable ? Regression.accentIndigo : .clear) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(split.teamName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text(split.facing)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    Text("vs \(split.opponentSp ?? split.opponent) (\(split.opponentSpHand)HP)")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(Regression.trimmed(split.avgF5Runs)) R/G")
                        .font(.system(size: 13, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.appTextPrimary)
                    Text(record + (split.f5WinPct.map { "  \(Regression.trimmed($0))%" } ?? ""))
                        .font(.system(size: 11, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(winColor)
                }
            }
        }
    }
}
