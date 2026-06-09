// LiquidGlassBackground.swift
//
// Reusable view modifier that applies an iOS 26 Liquid Glass background —
// with an `.ultraThinMaterial` fallback for older OS versions — to any view.
//
// Use for small chrome controls (corner buttons on cards, action chips on
// toolbars, pill CTAs) where the system glass material is preferred over a
// hand-rolled translucent fill.
//
// Usage:
//
//     HStack { Image(...); Text(...) }
//         .padding(...)
//         .liquidGlassBackground(in: Capsule())
//
// Why a wrapper:
//   `.glassEffect(_:in:)` is iOS 26-only. Each call site needs an availability
//   check + a graceful fallback to `.background(.ultraThinMaterial, in: ...)`
//   on iOS 17-25. Centralizing that pattern here keeps call sites readable and
//   ensures the fallback is consistent across the app.
//
// Ported from Honeydew's HoneydewDesign/Modifiers/LiquidGlassBackground.swift
// on 2026-05-23 as part of the iOS 26 Liquid Glass onboarding refresh.

import SwiftUI

public extension View {
    /// Apply a Liquid Glass (iOS 26+) background, falling back to a system
    /// `.ultraThinMaterial` material on iOS < 26.
    ///
    /// `shape` defines the clipping mask for the glass surface. Pass a
    /// `Capsule()` for pill chrome, a `RoundedRectangle` for cards, or a
    /// `Circle()` for corner buttons.
    @ViewBuilder
    func liquidGlassBackground<S: InsettableShape>(in shape: S) -> some View {
        if #available(iOS 26.0, *) {
            // True Liquid Glass — the system handles refraction, specular
            // highlights, and dynamic tint based on the underlying content.
            self.glassEffect(.regular, in: shape)
        } else {
            // Pre-iOS 26 fallback: ultraThinMaterial behind the same shape.
            // Reads as a translucent blurred chip in both light and dark mode.
            self.background(.ultraThinMaterial, in: shape)
        }
    }

    /// Tinted variant — the glass blends the supplied color into its surface.
    /// Use for stateful chrome (e.g. an active "Hide" toggle that pulses the
    /// user's theme accent through the glass).
    @ViewBuilder
    func liquidGlassBackground<S: InsettableShape>(in shape: S, tint: Color) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular.tint(tint), in: shape)
        } else {
            self.background(
                ZStack {
                    shape.fill(.ultraThinMaterial)
                    shape.fill(tint.opacity(0.18))
                }
            )
        }
    }

    /// Interactive variant — the glass refracts and highlights in response
    /// to touches and drags inside the shape. Use for tappable surfaces
    /// (text input containers, button-like cards) so the user gets the
    /// signature Liquid Glass touch feedback when they engage with it.
    ///
    /// On iOS < 26 falls back to the same `ultraThinMaterial` chip the
    /// non-interactive variant uses — the OS just can't replicate the
    /// touch-driven refraction without the iOS 26 effect graph.
    @ViewBuilder
    func liquidGlassBackground<S: InsettableShape>(
        in shape: S,
        interactive: Bool
    ) -> some View {
        if #available(iOS 26.0, *) {
            if interactive {
                // `.interactive()` enables the touch-response refraction —
                // tap-to-focus on a TextField wrapped in this surface
                // produces the signature Liquid Glass "wobble".
                self.glassEffect(.regular.interactive(), in: shape)
            } else {
                self.glassEffect(.regular, in: shape)
            }
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }

    /// Tinted + interactive variant — combines the brand-tinted glass surface
    /// of `liquidGlassBackground(in:tint:)` with the touch-response refraction
    /// of `liquidGlassBackground(in:interactive:)`. Use for primary CTAs that
    /// should both carry a brand color (onboarding "Continue" pill, paywall
    /// purchase button) AND react to taps with the Liquid Glass wobble.
    ///
    /// On iOS < 26 falls back to the static tinted-material treatment (no
    /// touch refraction available without the iOS 26 effect graph).
    @ViewBuilder
    func liquidGlassBackground<S: InsettableShape>(
        in shape: S,
        tint: Color,
        interactive: Bool
    ) -> some View {
        if #available(iOS 26.0, *) {
            if interactive {
                self.glassEffect(.regular.tint(tint).interactive(), in: shape)
            } else {
                self.glassEffect(.regular.tint(tint), in: shape)
            }
        } else {
            self.background(
                ZStack {
                    shape.fill(.ultraThinMaterial)
                    shape.fill(tint.opacity(0.18))
                }
            )
        }
    }
}
