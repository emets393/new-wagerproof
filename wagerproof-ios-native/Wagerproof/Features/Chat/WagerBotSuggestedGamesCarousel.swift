import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Horizontal carousel of game cards surfaced by a `present_analysis`
/// tool call. WagerProof's analogue of Honeydew's
/// `ChatV3SuggestedRecipesCarousel` — same layout (horizontal scroll,
/// fixed card width, snappy spring expand on first appear) but
/// renders compact sport-specific game tiles instead of recipe tiles.
///
/// The carousel is held back while the turn is streaming so 6 large
/// cards don't slam into view mid-stream. The parent (`WagerBotChatBubble`)
/// gates this by filtering `chatWidgets` blocks out of the body slot
/// during streaming.
struct WagerBotSuggestedGamesCarousel: View {
    let cards: [WagerBotChatGameCard]
    let ui: WagerBotUiTokens
    var onTap: ((WagerBotChatGameCard) -> Void)?

    private let cardWidth: CGFloat = 260

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(Array(cards.enumerated()), id: \.offset) { _, card in
                    Button {
                        onTap?(card)
                    } label: {
                        miniCard(card)
                    }
                    .buttonStyle(.plain)
                    .frame(width: cardWidth)
                }
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private func miniCard(_ card: WagerBotChatGameCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Top row: sport badge + game time
            HStack(spacing: 6) {
                Text(card.sport.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(ui.accent)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(ui.accent.opacity(0.15))
                    .clipShape(Capsule())
                Spacer()
                Text(card.gameTime)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(ui.mutedText)
            }

            // Matchup
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(card.awayAbbr)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(ui.primaryText)
                    Spacer()
                    if let spread = card.awaySpread {
                        Text(spread > 0 ? "+\(formatNumber(spread))" : formatNumber(spread))
                            .font(.system(size: 13, weight: .semibold).monospacedDigit())
                            .foregroundStyle(ui.mutedText)
                    }
                }
                HStack {
                    Text(card.homeAbbr)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(ui.primaryText)
                    Spacer()
                    if let spread = card.homeSpread {
                        Text(spread > 0 ? "+\(formatNumber(spread))" : formatNumber(spread))
                            .font(.system(size: 13, weight: .semibold).monospacedDigit())
                            .foregroundStyle(ui.mutedText)
                    }
                }
            }

            // Model pick row, when present
            if let pick = card.spreadPick, !pick.isEmpty {
                HStack(spacing: 6) {
                    WagerBotIcon(size: 12)
                        .foregroundStyle(ui.accent)
                    Text("Model: \(pick)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(ui.mutedText)
                        .lineLimit(1)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ui.hintChipBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(ui.borderColor, lineWidth: 1)
        )
    }

    private func formatNumber(_ value: Double) -> String {
        // Spreads come through with one decimal place — match The Odds
        // API's standard formatting so the carousel reads consistently
        // with the rest of the app's odds displays.
        if value.truncatingRemainder(dividingBy: 1) == 0 {
            return String(format: "%.0f", value)
        }
        return String(format: "%.1f", value)
    }
}
