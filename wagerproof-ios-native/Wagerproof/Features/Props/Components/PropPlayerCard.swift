import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Player-specific prop card, styled to match the MLB game card
/// (`GameRowCard`) — same rounded surface, avatar-with-team-color-glow, and
/// right-edge trend sparkline — but on a slightly lifted dark card surface.
///
/// Layout:
///   - Main row: player headshot · player name · centered Over/Under pills ·
///     labeled trend chart.
///   - Bottom info row: BEST (the player's best market) · WHAT'S NEXT (the
///     opponent) · a Liquid Glass game-time pill in the bottom-right.
/// Tapping pushes `PlayerPropDetailView`.
struct PropPlayerCard: View {
    let item: PlayerPropFeedItem
    let namespace: Namespace.ID
    let onSelect: (PlayerPropSelection) -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var sel: PlayerPropSelection { item.selection }
    private var computed: MLBPropComputedAtLine { item.headline.computed }
    private var row: MLBPlayerPropRow { item.headline.row }

    private var primary: Color { Color(hex: Int(item.teamPrimaryHex)).teamVisible(in: colorScheme) }
    private var secondary: Color { Color(hex: Int(item.teamSecondaryHex)).teamVisible(in: colorScheme) }

    /// Lifted card surface — matches the MLB dark cards but a touch lighter so
    /// the cards read clearly above the near-black feed background.
    private var cardFill: Color { Color(light: 0xFFFFFF, dark: 0x202024) }

    var body: some View {
        Button {
            onSelect(sel)
        } label: {
            content
        }
        .buttonStyle(.plain)
        .matchedTransitionSource(id: sel.transitionID, in: namespace)
        .sensoryFeedback(.impact(weight: .light), trigger: sel.id)
    }

    private var content: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        return VStack(alignment: .leading, spacing: 8) {
            mainRow
            Divider().background(Color.appBorder.opacity(0.5))
            bottomInfoRow
        }
        .padding(.leading, 12)
        // Extra right padding so the trend chart sits in from the edge.
        .padding(.trailing, 14)
        .padding(.vertical, 9)
        .background {
            ZStack {
                // Matches AgentRowCard's glass treatment: ultraThinMaterial
                // thinned in dark mode so more of the page shows through.
                shape.fill(.ultraThinMaterial)
                    .opacity(colorScheme == .dark ? 0.55 : 1)
                shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
            }
        }
        .clipShape(shape)
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    // MARK: - Main row

    private var mainRow: some View {
        HStack(alignment: .center, spacing: 10) {
            avatar
            identity
            Spacer(minLength: 8)
            overUnderBlock
            Spacer(minLength: 8)
            trendBlock
        }
    }

    // MARK: - Identity (name + vs opponent underneath)

    private var identity: some View {
        // Player name (no leading lineup number — that's a web artifact) with
        // the opponent matchup directly beneath it.
        VStack(alignment: .leading, spacing: 2) {
            Text(sel.playerName)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            if !sel.opponentAbbr.isEmpty {
                Text("vs \(sel.opponentAbbr)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
            }
        }
    }

    // MARK: - Avatar (player headshot + team logo badge + glow)

    private var avatar: some View {
        // The headshot disc and the team-logo badge are two close glass discs;
        // the container liquid-merges them where they overlap (iOS 26). The
        // disc carries the team-color glass tint, the badge a clear glass chip
        // so the team logo on top still reads. Pre-26 both fall back to the
        // gradient/solid discs they had before.
        LiquidGlassMergeContainer(spacing: 14) {
            ZStack(alignment: .bottomTrailing) {
                PlayerHeadshot(playerId: sel.playerId, size: 40)
                    .frame(width: 44, height: 44)
                    .teamGlassDisc(primary: primary, secondary: secondary, fallbackStroke: cardFill)
                    // One soft team halo for depth; light so it doesn't muddy
                    // the glass or the merge seam.
                    .shadow(color: primary.opacity(0.22), radius: 5, x: 0, y: 1)

                if let logo = sel.teamLogoUrl, let url = URL(string: logo) {
                    AsyncImage(url: url) { phase in
                        if case .success(let img) = phase {
                            img.resizable().scaledToFit()
                        } else {
                            Color.clear
                        }
                    }
                    .frame(width: 16, height: 16)
                    .padding(2)
                    .liquidGlassBackground(in: Circle())
                    .offset(x: 2, y: 2)
                }
            }
            .frame(width: 44, height: 44)
        }
    }

    // MARK: - Over / Under pills (centered in the empty space)

    private var overUnderBlock: some View {
        VStack(spacing: 4) {
            ouPill(prefix: "O", value: MLBPlayerProps.formatOdds(computed.overOdds), tint: Color.appPrimary)
            ouPill(prefix: "U", value: MLBPlayerProps.formatOdds(computed.underOdds), tint: Color.appTextSecondary)
        }
        .fixedSize()
    }

    private func ouPill(prefix: String, value: String, tint: Color) -> some View {
        HStack(spacing: 4) {
            Text("\(prefix) \(MLBPlayerProps.formatLine(computed.line))")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(tint)
        }
        .lineLimit(1)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.appSurfaceMuted.opacity(0.55), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }

    // MARK: - Trend chart (labeled, slightly larger)

    private var trendBlock: some View {
        VStack(alignment: .trailing, spacing: 3) {
            Text("L10 TREND")
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            RecentFormStrip(strip: computed.miniStrip, line: computed.line)
                .frame(width: 74, height: 46)
        }
    }

    // MARK: - Bottom info row (Best · What's next · time)

    private var bottomInfoRow: some View {
        HStack(alignment: .center, spacing: 16) {
            infoItem(label: item.metricLabel, value: MLBPlayerProps.marketLabel(row.market), valueColor: Color.appPrimary)
            // Summary stats for that market: last-10 over rate + hit rate.
            infoItem(label: "L10", value: "\(computed.l10.fractionLabel) Over", valueColor: Color.appTextPrimary)
            infoItem(label: "HIT", value: computed.l10.pctLabel, valueColor: hitColor)
            Spacer(minLength: 0)
            timePill
        }
    }

    private var hitColor: Color {
        guard let pct = computed.l10.pct else { return Color.appTextMuted }
        if pct >= 70 { return Color.appPrimary }
        if pct >= 55 { return Color(hex: 0xEAB308) }
        return Color.appTextSecondary
    }

    private func infoItem(label: String, value: String, valueColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(valueColor)
                .lineLimit(1)
        }
    }

    // MARK: - Time pill (bottom-right)

    private var timePill: some View {
        Text(MLBFormatting.gameTime(sel.gameTimeEt))
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .liquidGlassBackground(in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
    }
}

/// Compact last-10 over/under bar strip — the prop analog of the game card's
/// Polymarket sparkline. Green = cleared the line, red = missed. Bar height
/// scales with the actual value.
struct RecentFormStrip: View {
    let strip: [(cleared: Bool, value: Double)]
    let line: Double

    var body: some View {
        let maxVal = max(line * 1.5, (strip.map(\.value).max() ?? 1), 1)
        GeometryReader { geo in
            let n = max(strip.count, 1)
            let gap: CGFloat = 2
            let barW = max(2, (geo.size.width - gap * CGFloat(n - 1)) / CGFloat(n))
            HStack(alignment: .bottom, spacing: gap) {
                ForEach(Array(strip.enumerated()), id: \.offset) { _, bar in
                    let h = max(3, CGFloat(bar.value / maxVal) * geo.size.height)
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(bar.cleared ? Color.appPrimary : Color.appLoss.opacity(0.7))
                        .frame(width: barW, height: h)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .bottom)
        }
    }
}
