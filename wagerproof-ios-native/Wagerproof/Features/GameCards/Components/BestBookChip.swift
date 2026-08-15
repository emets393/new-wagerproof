import SwiftUI
import WagerproofDesign
import WagerproofModels

/// The sportsbook a card is quoting, as a Liquid Glass pill that opens the full
/// board on tap.
///
/// Sits in the slot the conviction pill used to occupy. A card's job is to say
/// what the bet is and where to get it; "High Conviction" is still shown, but
/// inline with the pick rather than competing with the price for the corner.
///
/// The chip and the board it opens read from the SAME `SportsbookMarketQuotes`,
/// so the number on the pill is always the first row of the list behind it.
struct BestBookChip: View {
    let quotes: SportsbookMarketQuotes
    /// The books the user holds. Empty = no filter, lead with the best number
    /// anywhere.
    let selectedBookKeys: Set<String>
    /// e.g. "Spread" — titles the board.
    let marketTitle: String
    /// e.g. "Patriots +4.5" — what the user is actually being quoted.
    let selectionTitle: String
    /// Renders a spread/total number in the card's own convention so the pill
    /// can't disagree with the bar above it.
    let formatLine: (Double) -> String

    @State private var showingBoard = false

    private var shown: SportsbookQuote? { quotes.preferred(selectedBookKeys) }
    /// False when the user HAS books but none of them price this market, so the
    /// chip is showing the fallback. The label changes to say so.
    private var isFromSelection: Bool { quotes.isFromSelection(selectedBookKeys) }

    var body: some View {
        if let shown {
            Button {
                showingBoard = true
            } label: {
                HStack(spacing: 7) {
                    SportsbookLogoView(
                        logoURL: nil,
                        bookKey: shown.bookKey,
                        bookName: shown.bookName,
                        style: .compact
                    )
                    VStack(alignment: .leading, spacing: 1) {
                        Text(chipLabel)
                            .font(.system(size: 8, weight: .black))
                            .tracking(0.5)
                            .foregroundStyle(Color.appTextMuted)
                        Text(priceLabel(shown))
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                            .foregroundStyle(Color.appTextPrimary)
                    }
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(Color.appTextMuted)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .modifier(LiquidGlassCapsule())
            }
            .buttonStyle(.plain)
            .sheet(isPresented: $showingBoard) {
                SportsbookLinesSheet(
                    quotes: quotes,
                    selectedBookKeys: selectedBookKeys,
                    marketTitle: marketTitle,
                    selectionTitle: selectionTitle,
                    formatLine: formatLine
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
        }
    }

    /// "YOUR BOOK(S)" only when the number really came from the user's set —
    /// otherwise the chip would credit a book they don't hold.
    private var chipLabel: String {
        guard !selectedBookKeys.isEmpty else { return "BEST LINE" }
        if isFromSelection { return selectedBookKeys.count == 1 ? "YOUR BOOK" : "YOUR BOOKS" }
        return "NOT AT YOUR BOOKS"
    }

    private func priceLabel(_ quote: SportsbookQuote) -> String {
        let line = quote.line.map(formatLine)
        let price = quote.price.map { GameCardFormatting.formatMoneyline($0) }
        return [line, price].compactMap { $0 }.joined(separator: "  ")
    }
}

/// Every book's number on one market, best-first, with the user's own book
/// pinned to the top when they've set one.
struct SportsbookLinesSheet: View {
    let quotes: SportsbookMarketQuotes
    let selectedBookKeys: Set<String>
    let marketTitle: String
    let selectionTitle: String
    let formatLine: (Double) -> String

    @Environment(\.dismiss) private var dismiss

    /// The user's own books lead, still ordered best-first among themselves;
    /// everyone else follows in the same order. A better number elsewhere is
    /// never hidden — just demoted.
    private var mine: [SportsbookQuote] {
        quotes.quotes.filter { selectedBookKeys.contains($0.bookKey) }
    }

    private var others: [SportsbookQuote] {
        quotes.quotes.filter { !selectedBookKeys.contains($0.bookKey) }
    }

    var body: some View {
        NavigationStack {
            List {
                if !mine.isEmpty {
                    Section {
                        ForEach(mine) { quote in row(quote) }
                    } header: {
                        Text("Your books")
                    }
                }
                Section {
                    ForEach(others) { quote in row(quote) }
                } header: {
                    Text(mine.isEmpty ? selectionTitle : "Everywhere else")
                } footer: {
                    if let capturedAt = quotes.capturedAt {
                        // Stated plainly: the capture pauses out of season, and a
                        // board that looks live but is weeks old is worse than one
                        // that admits its age.
                        Text("Lines captured \(capturedAt.formatted(.relative(presentation: .named))). Confirm at the book before betting.")
                    } else {
                        Text("Confirm the number at the book before betting.")
                    }
                }
            }
            .navigationTitle(marketTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func row(_ quote: SportsbookQuote) -> some View {
        let isBest = quote.bookKey == quotes.best?.bookKey
        let isPinned = selectedBookKeys.contains(quote.bookKey)

        return HStack(spacing: 12) {
            SportsbookLogoView(
                logoURL: nil,
                bookKey: quote.bookKey,
                bookName: quote.bookName,
                style: .compact
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(quote.bookName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                if isPinned || isBest {
                    HStack(spacing: 5) {
                        if isPinned { tag("YOURS", tint: .appAccentBlue) }
                        if isBest { tag("BEST", tint: .appPrimary) }
                    }
                }
            }
            Spacer()
            HStack(spacing: 8) {
                if let line = quote.line {
                    Text(formatLine(line))
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .foregroundStyle(isBest ? Color.appPrimary : Color.appTextPrimary)
                }
                if let price = quote.price {
                    Text(GameCardFormatting.formatMoneyline(price))
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func tag(_ text: String, tint: Color) -> some View {
        Text(text)
            .font(.system(size: 8, weight: .black))
            .tracking(0.4)
            .foregroundStyle(tint)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(tint.opacity(0.14), in: Capsule())
    }
}
