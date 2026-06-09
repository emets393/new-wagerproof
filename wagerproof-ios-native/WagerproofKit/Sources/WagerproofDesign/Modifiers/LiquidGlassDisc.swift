// LiquidGlassDisc.swift
//
// Liquid Glass treatment for circular team/player avatars: a team-tinted glass
// disc, plus a container that liquid-merges nearby discs.
//
// Two pieces work together:
//   - `LiquidGlassMergeContainer` wraps a cluster of glass discs in an iOS 26
//     `GlassEffectContainer`, so discs within `spacing` of each other fuse into
//     one fluid blob (the signature Liquid Glass "liquid combining").
//   - `.teamGlassDisc(primary:secondary:)` paints a single disc as real Liquid
//     Glass tinted with the team's color, with a gradient-disc fallback on
//     iOS < 26.
//
// Used by the overlapping team logos on `GameRowCard` and the headshot +
// team-logo badge on `PropPlayerCard`.

import SwiftUI

/// Groups a cluster of `.teamGlassDisc` views so iOS 26 fuses any that sit
/// within `spacing` points of one another. Passthrough on iOS < 26 (the discs
/// just render independently with their gradient-disc fallback).
public struct LiquidGlassMergeContainer<Content: View>: View {
    private let spacing: CGFloat
    private let content: () -> Content

    /// - Parameter spacing: proximity threshold for the merge. Discs closer
    ///   than this fuse together; the overlap on a typical avatar pair sits well
    ///   inside the default.
    public init(spacing: CGFloat = 16, @ViewBuilder content: @escaping () -> Content) {
        self.spacing = spacing
        self.content = content
    }

    public var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content() }
        } else {
            content()
        }
    }
}

public extension View {
    /// Paints a circular Liquid Glass disc behind this view (iOS 26), slightly
    /// tinted with the team's primary color. Place inside a
    /// `LiquidGlassMergeContainer` so adjacent discs liquid-merge.
    ///
    /// On iOS < 26 falls back to the prior neutral-base + team-tint gradient
    /// disc so the avatar still reads as team-colored.
    ///
    /// - Parameters:
    ///   - primary: team primary color — drives the glass tint and the
    ///     fallback gradient's leading stop.
    ///   - secondary: team secondary color — the fallback gradient's trailing
    ///     stop (unused by the iOS 26 glass path).
    ///   - tint: how strongly `primary` bleeds into the glass. Low by default so
    ///     the disc reads as a slight team wash, not a solid fill.
    ///   - fallbackStroke: thin ring color on the iOS < 26 gradient disc,
    ///     usually the surrounding card surface so the disc reads as separate.
    @ViewBuilder
    func teamGlassDisc(
        primary: Color,
        secondary: Color,
        tint: Double = 0.5,
        fallbackStroke: Color = .appSurfaceElevated
    ) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular.tint(primary.opacity(tint)), in: Circle())
        } else {
            background(
                Circle()
                    .fill(Color.appSurfaceElevated)
                    .overlay(
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [primary, secondary],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .opacity(0.45)
                    )
                    .overlay(Circle().strokeBorder(fallbackStroke, lineWidth: 1.5))
            )
        }
    }
}
