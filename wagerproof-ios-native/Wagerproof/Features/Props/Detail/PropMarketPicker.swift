import SwiftUI
import WagerproofDesign

/// Compact icon + abbreviation market switcher. Full market names truncate in
/// a segmented control once a player has more than three posted markets; these
/// chips stay readable and scroll horizontally if they overflow.
struct PropMarketPicker: View {
    struct Chip: Identifiable, Hashable {
        var id: String { market }
        let market: String
        let icon: String
        let abbr: String
    }

    let chips: [Chip]
    @Binding var selection: String

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(chips) { chip in
                        chipButton(chip)
                            .id(chip.market)
                    }
                }
            }
            .onAppear { scrollToSelection(proxy) }
            .onChange(of: selection) { _, _ in
                scrollToSelection(proxy)
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }

    private func chipButton(_ chip: Chip) -> some View {
        let selected = chip.market == selection
        return Button {
            selection = chip.market
        } label: {
            HStack(spacing: 4) {
                Text(chip.icon)
                    .font(.system(size: 12))
                Text(chip.abbr)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(selected ? Color.appTextPrimary : Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(selected ? Color.appSurfaceElevated.opacity(0.95) : Color.appSurfaceMuted.opacity(0.45))
            )
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(selected ? Color.appPrimary.opacity(0.55) : Color.appBorder.opacity(0.45), lineWidth: 0.8)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(chip.abbr)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func scrollToSelection(_ proxy: ScrollViewProxy) {
        withAnimation(.snappy(duration: 0.25)) {
            proxy.scrollTo(selection, anchor: .center)
        }
    }
}
