import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Contextual hit-rate tiles under the chart: L10 (always), day/night split,
/// and (batters only) the vs-archetype split. Mirrors the RN `tiles` block in
/// `PlayerPropDetail`. Low-confidence splits (< 5 games) dim to 0.75 opacity.
struct PropContextTiles: View {
    let row: MLBPlayerPropRow
    let computed: MLBPropComputedAtLine

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            tile(label: "L10", split: computed.l10, subtitle: "Over")

            if let dn = computed.contextualDayNight {
                tile(
                    label: row.gameIsDay ? "☀️ Day" : "🌙 Night",
                    split: dn,
                    subtitle: "Over"
                )
            }

            if let arch = computed.contextualArchetype, let archName = row.oppArchetypeToday {
                tile(
                    label: "vs \(archName) SP",
                    split: arch,
                    subtitle: "Starters"
                )
            }
        }
    }

    private func tile(label: String, split: MLBPropHitSplit, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .textCase(.uppercase)
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(split.fractionLabel)
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Color.appPrimary)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.3), value: split.fractionLabel)
            Text("\(subtitle) · \(split.pctLabel)")
                .font(.system(size: 10))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.3), value: split.pctLabel)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.appSurfaceMuted.opacity(0.6))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color.appBorder, lineWidth: 1)
        )
        .opacity(split.lowConfidence ? 0.75 : 1)
    }
}
