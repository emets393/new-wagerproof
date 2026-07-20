import SwiftUI
import WidgetKit
import WagerproofModels

struct TopOutliersWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TopOutliersEntry

    var body: some View {
        if let market = entry.market, !market.items.isEmpty {
            OutliersMarketView(
                market: market,
                rowLimit: family == .systemLarge ? 5 : 2
            )
        } else {
            EmptyOutliersMarketView(
                marketTitle: entry.selectedMarketTitle,
                hasSynced: entry.lastUpdated != nil
            )
        }
    }
}

private struct EmptyOutliersMarketView: View {
    let marketTitle: String
    let hasSynced: Bool

    var body: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(WidgetPalette.accent)
            Text(marketTitle)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(WidgetPalette.textPrimary)
            Text(hasSynced
                 ? "No qualifying streaks right now"
                 : "Open WagerProof to load market streaks")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(WidgetPalette.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WidgetPalette.background)
    }
}

private struct OutliersMarketView: View {
    let market: OutliersWidgetMarketData
    let rowLimit: Int

    private var visibleItems: [OutliersWidgetItem] {
        Array(market.items.prefix(rowLimit))
    }

    private var remainingMarketCount: Int {
        max(0, market.totalCount - visibleItems.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            VStack(spacing: 6) {
                ForEach(Array(visibleItems.enumerated()), id: \.element.id) { index, item in
                    OutliersMarketRow(item: item, rank: index + 1, isTop: index == 0)
                }
            }
            if rowLimit > 2 {
                footer
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background {
            ZStack {
                WidgetPalette.background
                OutliersGridBackdrop()
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: market.symbolName)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(.black)
                .frame(width: 26, height: 26)
                .background(WidgetPalette.accent, in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 0) {
                Text(market.title)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(WidgetPalette.textPrimary)
                    .lineLimit(1)
                Text("TOP STREAKS")
                    .font(.system(size: 8, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(WidgetPalette.textMuted)
            }

            Spacer(minLength: 4)

            Label("Edit", systemImage: "slider.horizontal.3")
                .labelStyle(.iconOnly)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(WidgetPalette.textMuted)
                .accessibilityLabel("Edit widget to change market")
        }
    }

    private var footer: some View {
        HStack(spacing: 5) {
            Image(systemName: "arrow.up.right")
                .font(.system(size: 9, weight: .bold))
            Text(remainingMarketCount > 0
                 ? "+\(remainingMarketCount) more in \(market.title)"
                 : "Showing every qualifying streak")
                .font(.system(size: 10, weight: .semibold))
                .lineLimit(1)
            Spacer(minLength: 0)
            Text("WAGERPROOF")
                .font(.system(size: 8, weight: .heavy))
                .tracking(0.7)
        }
        .foregroundStyle(WidgetPalette.textMuted)
        .padding(.top, 1)
    }
}

private struct OutliersMarketRow: View {
    let item: OutliersWidgetItem
    let rank: Int
    let isTop: Bool

    var body: some View {
        HStack(spacing: 8) {
            Text("\(rank)")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .foregroundStyle(isTop ? .black : WidgetPalette.textMuted)
                .frame(width: 20, height: 20)
                .background(isTop ? WidgetPalette.accent : WidgetPalette.card, in: Circle())

            Text(item.sport.uppercased())
                .font(.system(size: 8, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(.white)
                .frame(width: 31)
                .padding(.vertical, 3)
                .background(WidgetSportBadge.color(for: item.sport), in: RoundedRectangle(cornerRadius: 5))

            VStack(alignment: .leading, spacing: 1) {
                Text(item.subject)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(WidgetPalette.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(item.selection)
                        .foregroundStyle(WidgetPalette.textSecondary)
                    Text("·")
                    Text(item.matchup)
                        .foregroundStyle(WidgetPalette.textMuted)
                }
                .font(.system(size: 9, weight: .medium))
                .lineLimit(1)
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 1) {
                Text(item.fractionText)
                    .font(.system(size: 18, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(isTop ? WidgetPalette.accent : WidgetPalette.textPrimary)
                HStack(spacing: 4) {
                    if let odds = item.oddsText, !odds.isEmpty {
                        Text(odds)
                            .foregroundStyle(WidgetPalette.textSecondary)
                    }
                    if item.additionalTrendCount > 0 {
                        Text("+\(item.additionalTrendCount) more")
                            .foregroundStyle(WidgetPalette.accent)
                    }
                }
                .font(.system(size: 8, weight: .bold, design: .rounded))
                .monospacedDigit()
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            isTop ? WidgetPalette.accent.opacity(0.09) : WidgetPalette.card.opacity(0.94),
            in: RoundedRectangle(cornerRadius: 10)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .stroke(isTop ? WidgetPalette.accent.opacity(0.28) : Color.clear, lineWidth: 0.75)
        }
    }
}

/// A quiet analytical grid gives the card a market-terminal feel without
/// competing with the actual hit-rate numbers.
private struct OutliersGridBackdrop: View {
    var body: some View {
        Canvas { context, size in
            var path = Path()
            let step: CGFloat = 24
            var x: CGFloat = 0
            while x <= size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += step
            }
            var y: CGFloat = 0
            while y <= size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += step
            }
            context.stroke(path, with: .color(WidgetPalette.accent.opacity(0.025)), lineWidth: 0.5)
        }
        .allowsHitTesting(false)
    }
}

#Preview("Medium", as: .systemMedium) {
    TopOutliersWidget()
} timeline: {
    TopOutliersEntry(
        date: .now,
        market: WidgetSampleData.outlierMarkets[0],
        selectedMarketTitle: "Parlay God",
        lastUpdated: .now
    )
}

#Preview("Large", as: .systemLarge) {
    TopOutliersWidget()
} timeline: {
    TopOutliersEntry(
        date: .now,
        market: WidgetSampleData.outlierMarkets[0],
        selectedMarketTitle: "Parlay God",
        lastUpdated: .now
    )
}
