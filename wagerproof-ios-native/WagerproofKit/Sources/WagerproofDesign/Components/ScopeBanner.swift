// ScopeBanner.swift
//
// Reusable "active filter" pill banner. Renders a Liquid Glass capsule with a
// leading SF Symbol, a title, and a trailing dismiss button — pinned via
// `safeAreaInset(.top)` or inline under the nav bar to surface the currently
// applied scope (sport = MLB, scope = Hot Streaks, etc.).
//
// Generalized from Honeydew's per-page `scopeBanner` private View
// (`MainAllRecipesView.swift:807-835`). The Wagerproof version is a public
// reusable view so every main tab consumes the same pill, with the caller
// supplying the icon, title, and clear-action.
//
// Usage:
//
//     ScopeBanner(
//         systemImage: "flame.fill",
//         title: "Hot Streaks",
//         onClear: { filter.clearScope() }
//     )
//
// See `.claude/plans/i-want-to-rebuild-scalable-pearl.md` (pattern #2 /
// "Reusable helpers to port"). Pair with `safeAreaInset(edge: .top)` so the
// banner pins under the large-title nav bar instead of scrolling with content.

import SwiftUI

public struct ScopeBanner: View {
    private let systemImage: String
    private let title: String
    private let onClear: () -> Void

    public init(systemImage: String, title: String, onClear: @escaping () -> Void) {
        self.systemImage = systemImage
        self.title = title
        self.onClear = onClear
    }

    public var body: some View {
        HStack(spacing: 8) {
            // Leading scope glyph in brand green so the banner reads as an
            // "active filter" affordance rather than a passive label.
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appPrimary)

            // White title because the Liquid Glass capsule renders against
            // the page's photo/dark gradient regions — white reads cleanly
            // in both light and dark mode on top of the glass material.
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .truncationMode(.tail)

            Spacer(minLength: 0)

            // Trailing dismiss control. Plain button style so the tap target
            // is the glyph itself (no implicit border / background) — keeps
            // the pill chrome quiet and lets the glass material carry the
            // visual weight.
            Button(action: onClear) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Clear filter")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .modifier(LiquidGlassCapsule())
    }
}

#Preview("Scope banner") {
    VStack(spacing: 12) {
        ScopeBanner(systemImage: "flame.fill", title: "Hot Streaks", onClear: {})
        ScopeBanner(systemImage: "sportscourt.fill", title: "MLB", onClear: {})
    }
    .padding()
    .background(Color.appSurface)
}
