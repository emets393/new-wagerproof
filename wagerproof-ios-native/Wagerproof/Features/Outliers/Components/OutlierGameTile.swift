import SwiftUI
import WagerproofDesign

/// A merged-outlier list row in the same visual language as `GameRowCard`:
/// a rounded glass surface with overlapping team Liquid Glass discs, the
/// matchup, the start time, and a badge per fired signal. Tapping pushes the
/// per-game `OutlierMatchupDetailView`.
struct OutlierGameTile: View {
    let item: OutlierFeedItem
    @Environment(\.colorScheme) private var colorScheme

    private let discSize: CGFloat = 38

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
        HStack(spacing: 12) {
            discs
            VStack(alignment: .leading, spacing: 5) {
                Text("\(item.away.abbr) @ \(item.home.abbr)")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                if let time = timeLabel {
                    Text(time)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
                badges
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background {
            ZStack {
                shape.fill(.ultraThinMaterial)
                    .opacity(colorScheme == .dark ? 0.78 : 1)
                shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
            }
        }
        .clipShape(shape)
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    // Overlapping team glass discs — the same fused treatment as the game feed.
    private var discs: some View {
        LiquidGlassMergeContainer(spacing: 16) {
            HStack(spacing: -10) {
                disc(item.away, isLeading: true)
                disc(item.home, isLeading: false)
            }
        }
    }

    private func disc(_ team: OutlierFeedItem.Team, isLeading: Bool) -> some View {
        let primary = team.primary.teamVisible(in: colorScheme)
        let secondary = team.secondary.teamVisible(in: colorScheme)
        return ZStack {
            if let url = team.logoURL.flatMap(URL.init(string:)) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFit()
                    } else {
                        Text(team.abbr)
                            .font(.system(size: discSize * 0.3, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: discSize * 0.82, height: discSize * 0.82)
                .clipShape(Circle())
            } else {
                Text(team.abbr)
                    .font(.system(size: discSize * 0.3, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: discSize, height: discSize)
        .teamGlassDisc(primary: primary, secondary: secondary, tint: 0.5)
        .shadow(color: primary.opacity(0.22), radius: 5, x: 0, y: 1)
        .zIndex(isLeading ? 0 : 1)
    }

    private var badges: some View {
        HStack(spacing: 5) {
            ForEach(item.signals, id: \.self) { sig in
                Text(sig.badge)
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.4)
                    .foregroundStyle(sig.tint)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(sig.tint.opacity(0.15)))
                    .overlay(Capsule().strokeBorder(sig.tint.opacity(0.35), lineWidth: 0.5))
            }
        }
    }

    private var timeLabel: String? {
        item.gameTimeEt.map { MLBFormatting.gameTime($0) }
    }
}
