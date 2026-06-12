import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact player-prop card for the Outliers hub's Props carousel. Surfaces a
/// standout L10 streak (headshot + name + market line + hit-rate badge); tap
/// pushes the full `PlayerPropDetailView`. The prop analog of
/// `OutlierInsightCard` — same thumbnail footprint in the horizontal rail.
struct OutlierPropCard: View {
    let item: PlayerPropFeedItem
    let onTap: (PlayerPropSelection) -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var sel: PlayerPropSelection { item.selection }
    private var computed: MLBPropComputedAtLine { item.headline.computed }
    private var row: MLBPlayerPropRow { item.headline.row }
    private let cardWidth: CGFloat = 168

    private var primary: Color { Color(hex: Int(item.teamPrimaryHex)).teamVisible(in: colorScheme) }
    private var secondary: Color { Color(hex: Int(item.teamSecondaryHex)).teamVisible(in: colorScheme) }

    /// L10 over% drives the badge hue: ≥70 green (riding the streak), ≤30 red
    /// (fade), otherwise neutral. Matches the prop-widget hit-strip thresholds.
    private var hitColor: Color {
        guard let pct = computed.l10.pct else { return Color.appTextSecondary }
        if pct >= 70 { return Color(hex: 0x22C55E) }
        if pct <= 30 { return Color(hex: 0xEF4444) }
        return Color.appTextSecondary
    }

    var body: some View {
        Button { onTap(sel) } label: { content }
            .buttonStyle(.plain)
    }

    private var content: some View {
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                PlayerHeadshot(playerId: sel.playerId, size: 30)
                    .frame(width: 34, height: 34)
                    .teamGlassDisc(primary: primary, secondary: secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(sel.playerName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    if !sel.opponentAbbr.isEmpty {
                        Text("vs \(sel.opponentAbbr)")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            Text("\(MLBPlayerProps.marketLabel(row.market)) o\(MLBPlayerProps.formatLine(computed.line))")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            HStack(spacing: 6) {
                Text(computed.l10.pctLabel)
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(hitColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(hitColor.opacity(0.16), in: Capsule())
                Text("\(computed.l10.fractionLabel) L10")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(12)
        .frame(width: cardWidth, alignment: .leading)
        .background {
            ZStack {
                shape.fill(.ultraThinMaterial).opacity(colorScheme == .dark ? 0.8 : 1)
                shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
            }
        }
        .clipShape(shape)
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }
}
