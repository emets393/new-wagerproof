// LiquidGlassCapsule.swift
//
// Capsule-shaped Liquid Glass ViewModifier. Companion to
// `liquidGlassBackground(in:)` (which takes any `InsettableShape`); this
// modifier is the `Capsule()` specialization used by inline pill chrome
// — scope banners, search/sort pills, info chips that sit over scrolling
// content. Call as `.modifier(LiquidGlassCapsule())` so usage reads
// identically to Honeydew's main pages.
//
// Why a dedicated capsule wrapper alongside the generic background helper:
//   Honeydew's main views call `.modifier(LiquidGlassCapsule())` on dozens
//   of pill sites. Mirroring the same modifier name here keeps the port
//   1:1 with the reference snippets so the AI implementer agents porting
//   tabs can paste Honeydew code verbatim and have it compile.
//
// Ported from Honeydew's Features/Recipes/MainAllRecipesView.swift:1965-1988
// on 2026-05-24 as part of the WagerProof main-tab Liquid Glass refresh.
// See `.claude/plans/i-want-to-rebuild-scalable-pearl.md` (pattern #2).

import SwiftUI

/// Wraps content in a Liquid Glass capsule (iOS 26+) with an `.ultraThinMaterial`
/// fallback on iOS 17/18. Used by inline pills that sit over scrolling content
/// (scope banners, search/sort pills, info chips) so they all share identical
/// visuals — required for matched-geometry effects to look seamless.
public struct LiquidGlassCapsule: ViewModifier {
    public init() {}

    public func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            // Native Liquid Glass — the system handles vibrancy + legibility
            // shading per the underlying pixels, so white foreground text
            // remains readable over any photo.
            content.glassEffect(.regular, in: Capsule())
        } else {
            // Pre-iOS 26 fallback: the closest visual approximation is an
            // ultraThinMaterial capsule with a faint hairline stroke.
            content
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(
                    Capsule().stroke(Color.white.opacity(0.25), lineWidth: 0.5)
                )
        }
    }
}
