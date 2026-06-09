import SwiftUI
import WagerproofDesign

/// Weather-app–style scroll container for the game detail sheets.
///
/// Children that are `WidgetSection`s get their header pinned to the top while
/// the body scrolls up underneath it; as the next section's header rises it
/// **pushes the previous one off** the top — the "collapse into the header,
/// then hand off to the next widget" effect from the iOS Weather app.
///
/// Implemented with a plain `List` (NOT `ScrollView` + `LazyVStack`): plain-style
/// `List` section headers float and push each other off one-at-a-time (the
/// Contacts A/B/C behavior). A `LazyVStack(pinnedViews:)` instead *accumulates*
/// pinned headers — they stack on top of each other and never collapse, which
/// is why this view can't be built that way. All of List's default row chrome
/// (insets, separators, row background, section spacing) is stripped so the
/// cards render edge-to-edge exactly like the old ScrollView did. iOS 18+.
///
/// Plain (non-`Section`) children — the matchup header, agent rationale — should
/// scroll away without pinning; wrap each with `.widgetPlainRow()` so it loses
/// List's default chrome too.
struct PinnedWidgetScroll<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        List {
            // Small top breathing room under the nav bar.
            Color.clear
                .frame(height: 8)
                .widgetPlainRow()

            content

            // Bottom breathing room so the last card clears the home indicator.
            Color.clear
                .frame(height: 40)
                .widgetPlainRow()
        }
        .listStyle(.plain)
        .listSectionSpacing(0)
        .scrollContentBackground(.hidden)
        .environment(\.defaultMinListRowHeight, 0)
    }
}

/// Shared geometry for the pinned widget cards. Header + body share these so a
/// section reads as one continuous rounded card when fully expanded.
enum WidgetCard {
    static let corner: CGFloat = 16
    /// Horizontal margin from the screen edge to the card.
    static let hInset: CGFloat = 16
    /// Vertical gap between one card and the next (lives on the body bottom).
    static let gap: CGFloat = 12
}

extension View {
    /// Strip `List`'s default row chrome so a plain (non-`WidgetSection`) child
    /// renders edge-to-edge like it did in the old ScrollView.
    func widgetPlainRow() -> some View {
        self
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
    }
}

/// Trailing accessory rendered on the right of a `WidgetSection` header.
enum WidgetHeaderAccessory: Equatable {
    case none
    /// `info.circle` + "Tap"/"Less" — for collapsible analysis widgets that
    /// reveal a "What This Means" explanation when expanded.
    case tapHint(expanded: Bool, expandedLabel: String = "Tap")
    /// A chevron that flips up when expanded — MLB's projection cards use this.
    case chevron(expanded: Bool)
}

/// A single pinning widget for `PinnedWidgetScroll`.
///
/// Renders a `Section` whose `header` is an opaque title bar (icon + title +
/// optional accessory) and whose `content` is the widget body. In the plain
/// `List` the header floats at the top and the body scrolls beneath it; the
/// header's opaque `appSurfaceElevated` fill masks the body sliding under it.
/// When `onHeaderTap` is set the whole header becomes a button (used for the
/// tap-to-expand analysis cards) — tapping a *pinned* header still toggles,
/// which feels natural.
struct WidgetSection<Content: View>: View {
    let title: String
    let systemImage: String
    var iconTint: Color = .appPrimary
    var accessory: WidgetHeaderAccessory = .none
    /// When non-nil the header is tappable (collapsible widgets).
    var onHeaderTap: (() -> Void)? = nil
    /// Inner padding around the body content. Most widgets want 16; pass 0 for
    /// content that already insets itself.
    var bodyPadding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        Section {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(bodyPadding)
                .background(
                    Color.appSurfaceElevated,
                    in: UnevenRoundedRectangle(
                        bottomLeadingRadius: WidgetCard.corner,
                        bottomTrailingRadius: WidgetCard.corner,
                        style: .continuous
                    )
                )
                .padding(.horizontal, WidgetCard.hInset)
                .padding(.bottom, WidgetCard.gap)
                .widgetPlainRow()
        } header: {
            headerBar
                .listRowInsets(EdgeInsets())
                .listRowSeparator(.hidden)
                // OPAQUE full-width platter (page background). The card-styled
                // header sits on top; this platter is what masks the body
                // sliding underneath the pinned header — without it the body
                // shows through the header's side margins + rounded-corner
                // notches as it scrolls (the "content visible behind the
                // header" bug). The body genuinely collapses into the header.
                .listRowBackground(Color.appSurface)
        }
    }

    @ViewBuilder
    private var headerBar: some View {
        if let onHeaderTap {
            Button {
                withAnimation(.appQuick) { onHeaderTap() }
            } label: {
                headerRow
            }
            .buttonStyle(.plain)
        } else {
            headerRow
        }
    }

    private var headerRow: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(iconTint)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Spacer(minLength: 8)
            accessoryView
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Opaque fill — masks the body content that scrolls under the pinned
        // header. Rounded top only so it sits flush on the body's flat top.
        .background(
            Color.appSurfaceElevated,
            in: UnevenRoundedRectangle(
                topLeadingRadius: WidgetCard.corner,
                topTrailingRadius: WidgetCard.corner,
                style: .continuous
            )
        )
        .padding(.horizontal, WidgetCard.hInset)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var accessoryView: some View {
        switch accessory {
        case .none:
            EmptyView()
        case let .tapHint(expanded, expandedLabel):
            HStack(spacing: 4) {
                Image(systemName: "info.circle")
                    .font(.system(size: 13))
                Text(expanded ? "Less" : expandedLabel)
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(Color.appTextSecondary)
        case let .chevron(expanded):
            Image(systemName: expanded ? "chevron.up" : "chevron.down")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
    }
}
