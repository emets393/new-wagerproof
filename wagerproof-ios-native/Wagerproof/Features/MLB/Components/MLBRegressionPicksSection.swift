import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Regression-report picks rendered inside `MLBGameBottomSheet`. Mirrors RN
/// `components/mlb/MLBRegressionPicksSection.tsx`. The parent passes a
/// pre-filtered list keyed off the current game's `game_pk` (the filter
/// lives in `MLBRegressionReportStore.suggestedPicks(for:)`).
///
/// FIDELITY-WAIVER #110: model-alignment detection (`Aligns with model` /
/// `Contradicts model`) is intentionally simplified — the brief explicitly
/// scopes the structural port. Full RN-parity needle matching ships when
/// the picks generation pipeline is wired up downstream.
struct MLBRegressionPicksSection: View {
    let picks: [MLBSuggestedPick]

    var body: some View {
        // Title + card chrome now live in the hosting `WidgetSection`
        // ("Regression Picks").
        if !picks.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(picks.enumerated()), id: \.offset) { _, pick in
                    pickCard(pick)
                }
            }
        }
    }

    @ViewBuilder
    private func pickCard(_ pick: MLBSuggestedPick) -> some View {
        let confColor: Color = pick.confidenceAtSuggestion == "high"
            ? Color.appPrimary : Color(hex: 0xF59E0B)
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(betTypeLabel(pick.betType).uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                Text(pick.confidenceAtSuggestion.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.4)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(confColor.opacity(0.13), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(confColor, lineWidth: 1))
                    .foregroundStyle(confColor)
            }
            Text(pick.pick)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(2)
            HStack(spacing: 8) {
                statCell(label: "Edge", value: edgeText(pick))
                statCell(label: "Bucket", value: bucketText(pick.edgeBucket))
                statCell(label: "Bucket W%", value: String(format: "%.0f%%", pick.bucketWinPct), color: winPctColor(pick.bucketWinPct))
            }
            if let reasoning = pick.reasoning, !reasoning.isEmpty {
                Text(reasoning)
                    .font(.system(size: 12))
                    .italic()
                    .lineSpacing(3)
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(12)
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder, lineWidth: 1))
    }

    @ViewBuilder
    private func statCell(label: String, value: String, color: Color = Color.appTextPrimary) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(color)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    private func betTypeLabel(_ bt: String) -> String {
        switch bt {
        case "full_ml": return "Full Game · Moneyline"
        case "full_ou": return "Full Game · Total"
        case "f5_ml": return "1st 5 · Moneyline"
        case "f5_ou": return "1st 5 · Total"
        default: return bt
        }
    }

    private func edgeText(_ pick: MLBSuggestedPick) -> String {
        let sign = pick.edgeAtSuggestion > 0 ? "+" : ""
        let suffix = pick.betType.contains("ml") ? "%" : ""
        return "\(sign)\(String(format: "%g", pick.edgeAtSuggestion))\(suffix)"
    }

    private func bucketText(_ bucket: String) -> String {
        bucket == "perfect_storm" ? "Perfect\nStorm" : bucket
    }

    /// Mirrors RN `winColor(pct)`.
    private func winPctColor(_ pct: Double) -> Color {
        if pct >= 65 { return Color.appPrimary }
        if pct >= 55 { return Color(hex: 0xEAB308) }
        if pct >= 50 { return Color(hex: 0xF97316) }
        return Color.appAccentRed
    }
}
