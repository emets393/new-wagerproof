import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `wagerproof-mobile/components/ModelAccuracyWidget.tsx`.
///
/// Renders a compact 3-row "model accuracy" table for one matchup — Spread,
/// Moneyline, O/U — where each row shows the model's pick, the edge over
/// Vegas, and the historical accuracy bucket for the same edge size.
///
/// Accepts either `NBAModelAccuracyData` or `NCAABModelAccuracyGame` — the
/// two share the same shape post-merge so the widget treats them as a single
/// flattened DTO (see `ModelAccuracyBucket`).
struct ModelAccuracyWidget: View {
    let awayAbbr: String
    let homeAbbr: String
    let data: ModelAccuracyBucket
    var isLoading: Bool = false

    /// Convenience initializer for NBA accuracy rows.
    init(awayAbbr: String, homeAbbr: String, nba: NBAModelAccuracyData, isLoading: Bool = false) {
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.data = ModelAccuracyBucket(nba: nba)
        self.isLoading = isLoading
    }

    /// Convenience initializer for NCAAB accuracy rows.
    init(awayAbbr: String, homeAbbr: String, ncaab: NCAABModelAccuracyGame, isLoading: Bool = false) {
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.data = ModelAccuracyBucket(ncaab: ncaab)
        self.isLoading = isLoading
    }

    // Title + card chrome now live in the hosting `WidgetSection`
    // ("Model Accuracy") so this widget renders chromeless and pins cleanly
    // under its handed-off header (iOS Weather pattern).
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isLoading {
                ProgressView().controlSize(.small)
            } else {
                tableContent
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var tableContent: some View {
        VStack(spacing: 0) {
            // Header row
            HStack(spacing: 0) {
                Text("Type")
                    .modifier(AccHeaderText())
                    .frame(width: 52, alignment: .leading)
                Text("Pick").modifier(AccHeaderText()).frame(maxWidth: .infinity)
                Text("Edge").modifier(AccHeaderText()).frame(maxWidth: .infinity)
                Text("Accuracy").modifier(AccHeaderText()).frame(maxWidth: .infinity)
            }
            .padding(.vertical, 4)

            Rectangle().fill(Color.white.opacity(0.1)).frame(height: 1)
                .padding(.vertical, 4)

            row(label: "Spread", pick: spreadPick, edge: spreadEdge, accuracy: data.spreadAccuracy)
            row(label: "ML", pick: mlPick, edge: mlEdge, accuracy: data.mlAccuracy)
            row(label: "O/U", pick: ouPick, edge: ouEdge, accuracy: data.ouAccuracy)
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.white.opacity(0.05))
        )
    }

    @ViewBuilder
    private func row(label: String, pick: String, edge: String, accuracy: ModelAccuracyBucket.Accuracy?) -> some View {
        HStack(spacing: 0) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: 52, alignment: .leading)

            Text(pick)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            // RN uses pure blue (#3B82F6) for the edge value regardless of
            // direction — replicate so the color encodes "this is the edge,
            // not the result".
            Text(edge)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color(hex: 0x3B82F6))
                .frame(maxWidth: .infinity)

            HStack(spacing: 3) {
                if let acc = accuracy {
                    let color = accuracyColor(acc.accuracyPct)
                    Text("\(Int(acc.accuracyPct.rounded()))%")
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundStyle(color)
                    Text("(\(acc.games)g)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                } else {
                    Text("-")
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundStyle(Color(hex: 0x9CA3AF))
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 4)
    }

    private func accuracyColor(_ pct: Double) -> Color {
        if pct >= 60 { return Color(hex: 0x22C55E) }
        if pct >= 50 { return Color(hex: 0xEAB308) }
        return Color(hex: 0xEF4444)
    }

    // MARK: - Derived row values

    /// Spread pick = team with the bigger Vegas-vs-model spread differential.
    /// `homeSpreadDiff > 0` ⇒ model thinks home is over-spread by Vegas, so
    /// the value is on home. Mirrors RN's
    /// `homeSpreadDiff > 0 ? homeAbbr : awayAbbr`.
    private var spreadPick: String {
        guard let diff = data.homeSpreadDiff else { return "-" }
        return diff > 0 ? homeAbbr : awayAbbr
    }
    private var spreadEdge: String {
        guard let diff = data.homeSpreadDiff else { return "-" }
        return String(format: "%.1f pts", abs(diff))
    }

    private var mlPick: String {
        guard let isHome = data.mlPickIsHome else { return "-" }
        return isHome ? homeAbbr : awayAbbr
    }
    private var mlEdge: String {
        guard let isHome = data.mlPickIsHome else { return "-" }
        let prob = isHome ? (data.homeWinProb ?? 0) : (data.awayWinProb ?? 0)
        return "\(Int((prob * 100).rounded()))%"
    }

    private var ouPick: String {
        guard let diff = data.overLineDiff else { return "-" }
        return diff > 0 ? "Over" : "Under"
    }
    private var ouEdge: String {
        guard let diff = data.overLineDiff else { return "-" }
        return String(format: "%.1f pts", abs(diff))
    }
}

private struct AccHeaderText: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 11, weight: .heavy))
            .foregroundStyle(Color.appTextSecondary)
            .multilineTextAlignment(.center)
    }
}

/// Flattened DTO that both NBA and NCAAB accuracy structs collapse into.
/// Lets the widget have one rendering path instead of two near-identical
/// branches.
struct ModelAccuracyBucket: Hashable {
    /// Local mirror of either `NBAAccuracyBucket` or `NCAABAccuracyBucket`
    /// — both upstream types expose the same fields, this collapses them
    /// so the widget doesn't depend on either name.
    struct Accuracy: Hashable {
        let games: Int
        let accuracyPct: Double
    }

    let homeSpreadDiff: Double?
    let spreadAccuracy: Accuracy?

    let homeWinProb: Double?
    let awayWinProb: Double?
    let mlPickIsHome: Bool?
    let mlAccuracy: Accuracy?

    let overLineDiff: Double?
    let ouAccuracy: Accuracy?

    init(nba: NBAModelAccuracyData) {
        self.homeSpreadDiff = nba.homeSpreadDiff
        self.spreadAccuracy = nba.spreadAccuracy.map { Accuracy(games: $0.games, accuracyPct: $0.accuracyPct) }
        self.homeWinProb = nba.homeWinProb
        self.awayWinProb = nba.awayWinProb
        self.mlPickIsHome = nba.mlPickIsHome
        self.mlAccuracy = nba.mlAccuracy.map { Accuracy(games: $0.games, accuracyPct: $0.accuracyPct) }
        self.overLineDiff = nba.overLineDiff
        self.ouAccuracy = nba.ouAccuracy.map { Accuracy(games: $0.games, accuracyPct: $0.accuracyPct) }
    }

    init(ncaab: NCAABModelAccuracyGame) {
        self.homeSpreadDiff = ncaab.homeSpreadDiff
        self.spreadAccuracy = ncaab.spreadAccuracy.map { Accuracy(games: $0.games, accuracyPct: $0.accuracyPct) }
        self.homeWinProb = ncaab.homeWinProb
        self.awayWinProb = ncaab.awayWinProb
        self.mlPickIsHome = ncaab.mlPickIsHome
        self.mlAccuracy = ncaab.mlAccuracy.map { Accuracy(games: $0.games, accuracyPct: $0.accuracyPct) }
        self.overLineDiff = ncaab.overLineDiff
        self.ouAccuracy = ncaab.ouAccuracy.map { Accuracy(games: $0.games, accuracyPct: $0.accuracyPct) }
    }
}
