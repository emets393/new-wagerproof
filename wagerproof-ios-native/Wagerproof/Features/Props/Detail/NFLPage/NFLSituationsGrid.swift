import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Situations widget body — the native `SituationsDrawer`: the market's
/// recent record by game setting (home/away/division/primetime…), one
/// preferred window per bucket ("5" ?? "7" ?? "3"), heat-tinted.
struct NFLSituationsGrid: View {
    /// bucket → window → record, from `trends.splits[marketKey]`.
    let buckets: [String: [String: NFLPropSituationRecord]]
    let marketKey: String

    private static let bucketOrder = ["overall", "home", "away", "division", "non_division", "primetime", "regular"]

    private static let bucketLabels: [String: String] = [
        "overall": "overall", "home": "home", "away": "away",
        "division": "division", "non_division": "non-division",
        "primetime": "primetime", "regular": "regular",
    ]

    private static let bucketIcons: [String: String] = [
        "overall": "chart.line.uptrend.xyaxis", "home": "house.fill", "away": "airplane",
        "division": "person.2.fill", "non_division": "globe",
        "primetime": "moon.stars.fill", "regular": "circle",
    ]

    private struct Row: Identifiable {
        let bucket: String
        let record: NFLPropSituationRecord
        var id: String { bucket }
    }

    private var rows: [Row] {
        Self.bucketOrder.compactMap { bucket in
            guard let windows = buckets[bucket],
                  let record = NFLPropTrendsDetail.preferredWindow(windows) else { return nil }
            return Row(bucket: bucket, record: record)
        }
    }

    var body: some View {
        let rows = rows
        if rows.isEmpty {
            Text("No situational records yet")
                .font(.system(size: 13))
                .italic()
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            let action = marketKey == "player_anytime_td" ? "Scored" : "Cleared the line"
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible())], spacing: 10) {
                ForEach(rows) { row in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: Self.bucketIcons[row.bucket] ?? "circle")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(heatColor(row.record.pct) ?? Color.appTextMuted)
                            .frame(width: 16)
                        Text("\(action) in \(row.record.h) of \(row.record.n) \(Self.bucketLabels[row.bucket] ?? row.bucket) \(row.record.n == 1 ? "game" : "games")")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 2)
                        Text("\(Int((row.record.pct * 100).rounded()))%")
                            .font(.system(size: 12, weight: .black, design: .monospaced))
                            .foregroundStyle(heatColor(row.record.pct) ?? Color.appTextMuted)
                    }
                }
            }
        }
    }

    /// Web heat scale: > 0.75 emerald, ≥ 0.6 amber, else muted.
    private func heatColor(_ pct: Double) -> Color? {
        if pct > 0.75 { return Color.appWin }
        if pct >= 0.6 { return Color(hex: 0xF59E0B) }
        return nil
    }
}
