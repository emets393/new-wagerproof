// OfflineToolbarIcon.swift
// Compact offline indicator that occupies the same trailing-toolbar slot the
// WagerBot launcher / AI-chat icon normally takes. Rendered by per-tab toolbars
// when the network monitor reports offline so the user gets a quiet, in-place
// signal that they're working from cache.
//
// Why slot-replace instead of a top banner:
//   A persistent top banner spans the full width and pushes every screen's
//   content down. That's overkill for an indicator that's mostly informational
//   — and it conflicts with the iOS 26 large-title navigation transition.
//   Swapping the trailing toolbar icon keeps the affordance local to the
//   nav-bar chrome, in a spot the user already scans, without reflowing the
//   layout. Matches the dimensions of the WagerBot Lottie footprint so the
//   toolbar group doesn't jitter on connectivity transitions.
//
// Ported from Honeydew's HoneydewDesign/OfflineToolbarIcon.swift on
// 2026-05-24 as part of the WagerProof main-tab chrome refactor.

import SwiftUI

public struct OfflineToolbarIcon: View {
    public init() {}

    public var body: some View {
        // Non-interactive — tapping it shouldn't navigate, since the only
        // useful action ("turn the network back on") lives in iOS Settings,
        // not inside our app. A static icon also avoids competing with the
        // adjacent settings gear / WagerBot button for the user's tap target.
        Image(systemName: "wifi.slash")
            .font(.system(size: 17, weight: .regular))
            // Error red so the indicator is unmissable. Wagerproof's `appAccentRed`
            // is the loss/error token used by `appLoss` and inline error chrome,
            // so the color already reads as "something is wrong" to anyone who's
            // seen a graded loss.
            .foregroundStyle(Color.appAccentRed)
            // Match the WagerBot icon footprint so the toolbar group keeps the
            // same overall width when we swap one for the other. Without this
            // the trailing items shuffle 10-15pt on every offline/online flip.
            .frame(width: 42, height: 42)
            .accessibilityLabel(Text("Offline"))
            .accessibilityAddTraits(.isStaticText)
    }
}

#Preview("Offline toolbar icon") {
    HStack(spacing: 0) {
        OfflineToolbarIcon()
        Image(systemName: "gearshape")
            .frame(width: 42, height: 42)
    }
    .padding()
    .background(Color.appSurface)
}
