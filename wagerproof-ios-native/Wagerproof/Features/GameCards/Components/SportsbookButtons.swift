import SwiftUI
import WagerproofDesign

/// "Place Bet" CTA used inside game sheets + editor pick cards. Ports RN
/// `components/SportsbookButtons.tsx`: a single Place Bet button that opens a
/// sheet listing every sportsbook with an available betslip deep link. Tap a
/// row → `UIApplication.open(url:)` via SwiftUI `Environment(\.openURL)`.
///
/// `betslipLinks` is the raw `Record<string, string>` shape from the RN
/// `pick.betslip_links` JSON — keyed by lowercased sportsbook id (e.g.
/// `draftkings`, `fanduel`).
struct SportsbookButtons: View {
    let betslipLinks: [String: String]?
    var compact: Bool = false

    @State private var sheetVisible = false
    @Environment(\.openURL) private var openURL

    /// Top-tier US sportsbooks (matches RN `TOP_SPORTSBOOKS`). Anything not
    /// in this list still renders in the modal, just sorted after.
    private static let topSportsbooks: [(key: String, displayName: String)] = [
        ("draftkings", "DraftKings"),
        ("fanduel", "FanDuel"),
        ("betmgm", "BetMGM"),
        ("caesars", "Caesars"),
        ("pointsbetus", "PointsBet")
    ]

    private static let additionalSportsbooks: [(key: String, displayName: String)] = [
        ("bovada", "Bovada"),
        ("betrivers", "BetRivers"),
        ("wynnbet", "WynnBET"),
        ("unibet", "Unibet"),
        ("foxbet", "FOX Bet"),
        ("hardrockbet", "Hard Rock Bet")
    ]

    var body: some View {
        if let links = betslipLinks, !links.isEmpty {
            Button {
                sheetVisible = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "ticket.fill")
                        .font(.system(size: compact ? 12 : 14, weight: .bold))
                    Text("Place Bet")
                        .font(.system(size: compact ? 12 : 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: compact ? 32 : 44)
                .background(Color.appPrimary, in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.impact(weight: .light), trigger: sheetVisible)
            .sheet(isPresented: $sheetVisible) {
                sportsbookList(for: links)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    @ViewBuilder
    private func sportsbookList(for links: [String: String]) -> some View {
        let available = combinedSportsbooks(for: links)
        NavigationStack {
            List(available, id: \.key) { sb in
                Button {
                    if let urlStr = links[sb.key], let url = URL(string: urlStr) {
                        openURL(url)
                        sheetVisible = false
                    }
                } label: {
                    HStack {
                        Text(sb.displayName)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .contentShape(Rectangle())
                }
                .listRowBackground(Color.appSurface)
            }
            .listStyle(.plain)
            .navigationTitle("Select Sportsbook")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { sheetVisible = false }
                        .tint(Color.appPrimary)
                }
            }
        }
    }

    /// Merge top + additional + unknown keys (anything not preregistered)
    /// into a single ordered list. Mirrors RN's
    /// `[...topSportsbooks, ...additionalSportsbooks, ...unknownSportsbooks]`.
    private func combinedSportsbooks(for links: [String: String]) -> [(key: String, displayName: String)] {
        let availableKeys = Set(links.keys)
        let top = Self.topSportsbooks.filter { availableKeys.contains($0.key) }
        let additional = Self.additionalSportsbooks.filter { availableKeys.contains($0.key) }
        let knownKeys = Set((Self.topSportsbooks + Self.additionalSportsbooks).map { $0.key })
        let unknown = availableKeys.subtracting(knownKeys)
            .sorted()
            .map { (key: $0, displayName: $0.prefix(1).uppercased() + $0.dropFirst()) }
        return top + additional + unknown
    }
}

#Preview {
    SportsbookButtons(betslipLinks: [
        "draftkings": "https://draftkings.com/bet",
        "fanduel": "https://fanduel.com/bet"
    ])
    .padding()
    .background(Color.appSurface)
}
