import SwiftUI
import WagerproofDesign

/// Paged 6x10 emoji grid used in Screen 2 (Identity). Ports
/// `components/agents/inputs/SwipeableEmojiPicker.tsx`.
///
/// Uses SwiftUI's `TabView` with `.page` style for native horizontal paging
/// — RN uses ScrollView + pagingEnabled. Page indicator dots sit below the
/// pager.
struct SwipeableEmojiPicker: View {
    @Binding var selectedEmoji: String
    let selectedColor: Color

    private static let emojisPerPage = 10
    /// 60 emojis = 6 pages of 10 (5 per row x 2 rows). Source RN list is in
    /// `SwipeableEmojiPicker.tsx::AGENT_EMOJIS`.
    private static let emojis: [String] = [
        // Page 1 - Classic & Power
        "\u{1F916}", "\u{1F9E0}", "\u{1F3AF}", "\u{1F525}", "\u{1F48E}",
        "\u{1F985}", "\u{1F43A}", "\u{1F981}", "\u{26A1}", "\u{1F680}",
        // Page 2 - Animals
        "\u{1F432}", "\u{1F988}", "\u{1F40D}", "\u{1F989}", "\u{1F43B}",
        "\u{1F98D}", "\u{1F98A}", "\u{1F41D}", "\u{1F99C}", "\u{1F9A2}",
        // Page 3 - More Animals
        "\u{1F40E}", "\u{1F984}", "\u{1F9AD}", "\u{1F422}", "\u{1F98E}",
        "\u{1F99E}", "\u{1F47B}", "\u{1F480}", "\u{1F47D}", "\u{1F9B9}",
        // Page 4 - Power & Sports
        "\u{1F4A5}", "\u{1F3C6}", "\u{1F451}", "\u{1F31F}", "\u{1F52E}",
        "\u{1F3B0}", "\u{1F3B2}", "\u{265F}\u{FE0F}", "\u{1F3C0}", "\u{1F3C8}",
        // Page 5 - Sports & Objects
        "\u{26BD}", "\u{26BE}", "\u{1F3BE}", "\u{1F4A1}", "\u{1F4B0}",
        "\u{1F4B8}", "\u{1F6E1}\u{FE0F}", "\u{1F511}", "\u{1F3F9}", "\u{1F4AA}",
        // Page 6 - Nature & Misc
        "\u{1F30A}", "\u{1F30B}", "\u{1F329}\u{FE0F}", "\u{2744}\u{FE0F}", "\u{2604}\u{FE0F}",
        "\u{1F31E}", "\u{1F319}", "\u{1F30C}", "\u{1F9CA}", "\u{1F386}",
    ]

    private static var pageCount: Int {
        Int(ceil(Double(emojis.count) / Double(emojisPerPage)))
    }

    @State private var activePage: Int = 0

    var body: some View {
        VStack(spacing: 12) {
            TabView(selection: $activePage) {
                ForEach(0..<Self.pageCount, id: \.self) { pageIdx in
                    page(at: pageIdx)
                        .tag(pageIdx)
                        .padding(.horizontal, 4)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 132)
            .onAppear {
                // Seed activePage to whatever page the saved emoji lives on.
                if let idx = Self.emojis.firstIndex(of: selectedEmoji) {
                    activePage = idx / Self.emojisPerPage
                }
            }

            HStack(spacing: 6) {
                ForEach(0..<Self.pageCount, id: \.self) { idx in
                    Circle()
                        .fill(idx == activePage ? selectedColor : Color.appBorder.opacity(0.5))
                        .frame(width: idx == activePage ? 8 : 6, height: idx == activePage ? 8 : 6)
                }
            }
        }
    }

    @ViewBuilder
    private func page(at pageIdx: Int) -> some View {
        let start = pageIdx * Self.emojisPerPage
        let end = min(start + Self.emojisPerPage, Self.emojis.count)
        let pageEmojis = Array(Self.emojis[start..<end])
        let row1 = Array(pageEmojis.prefix(5))
        let row2 = Array(pageEmojis.dropFirst(5))

        VStack(spacing: 8) {
            emojiRow(row1)
            emojiRow(row2)
        }
    }

    private func emojiRow(_ row: [String]) -> some View {
        HStack(spacing: 8) {
            ForEach(row, id: \.self) { emoji in
                Button {
                    selectedEmoji = emoji
                } label: {
                    Text(emoji)
                        .font(.system(size: 22))
                        .frame(maxWidth: 52, maxHeight: 52)
                        .aspectRatio(1, contentMode: .fit)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(selectedEmoji == emoji ? selectedColor.opacity(0.2) : Color.appBorder.opacity(0.25))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(selectedEmoji == emoji ? selectedColor : Color.appBorder, lineWidth: selectedEmoji == emoji ? 2 : 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .sensoryFeedback(.selection, trigger: selectedEmoji)
    }
}
