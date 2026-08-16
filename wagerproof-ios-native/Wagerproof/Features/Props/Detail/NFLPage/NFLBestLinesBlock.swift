import SwiftUI
import WagerproofModels
import WagerproofDesign
import WagerproofServices

/// Best Lines widget body — the cross-book board rows extracted from the
/// pre-redesign `NFLPropDetailView`. Live `nfl_player_props` boards win;
/// the loader's precomputed best-shop quotes are the fallback.
struct NFLBestLinesBlock: View {
    let market: NFLPropMarket
    let live: SportsbookPropMarketOdds?

    @AppStorage(SportsbookPreference.defaultsKey) private var preferredBookKeysRaw: String = ""

    var body: some View {
        VStack(spacing: 8) {
            if let live {
                if market.isYesNo {
                    liveBookRow(sideLabel: "Yes", quotes: live.over)
                } else {
                    liveBookRow(sideLabel: "Over", quotes: live.over)
                    liveBookRow(sideLabel: "Under", quotes: live.under)
                }
            } else if market.isYesNo {
                if !market.bestOver.isEmpty {
                    bestBookRow(sideLabel: "Yes", quote: market.bestOver, showLine: false)
                }
            } else {
                if !market.bestOver.isEmpty {
                    bestBookRow(sideLabel: "Over", quote: market.bestOver, showLine: true)
                }
                if !market.bestUnder.isEmpty {
                    bestBookRow(sideLabel: "Under", quote: market.bestUnder, showLine: true)
                }
            }
        }
    }

    @ViewBuilder
    private func liveBookRow(sideLabel: String, quotes: SportsbookMarketQuotes) -> some View {
        if quotes.best != nil {
            HStack(spacing: 10) {
                Text(sideLabel)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Spacer(minLength: 8)
                BestBookChip(
                    quotes: quotes,
                    selectedBookKeys: SportsbookPreference.decode(preferredBookKeysRaw),
                    marketTitle: market.label,
                    selectionTitle: "\(sideLabel) \(market.label)",
                    formatLine: { NFLPlayerProps.formatLine($0) }
                )
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.appBorder.opacity(0.45), lineWidth: 0.5)
            )
        }
    }

    private func bestBookRow(sideLabel: String, quote: NFLPropBestQuote, showLine: Bool) -> some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Text(sideLabel)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Text(bestBookLineValue(quote: quote, showLine: showLine))
                    .font(.system(size: 14, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.appPrimary)
            }

            Spacer(minLength: 8)

            HStack(spacing: 4) {
                Text("@")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                SportsbookLogoView(
                    logoURL: quote.bookLogoUrl,
                    bookKey: quote.bookKey,
                    bookName: quote.bookName,
                    style: .compact
                )
                Text(quote.bookName ?? quote.bookKey ?? "Book")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.appBorder.opacity(0.45), lineWidth: 0.5)
        )
    }

    private func bestBookLineValue(quote: NFLPropBestQuote, showLine: Bool) -> String {
        let odds = NFLPlayerProps.formatOdds(quote.price)
        guard showLine, let line = quote.line else { return odds }
        return "\(NFLPlayerProps.formatLine(line)) \(odds)"
    }
}
