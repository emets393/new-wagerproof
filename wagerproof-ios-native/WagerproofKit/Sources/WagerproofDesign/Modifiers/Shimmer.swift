import SwiftUI

/// A modern, GPU-cheap shimmer for skeleton placeholders.
///
/// Apply `.shimmering()` to a group of skeleton shapes (`SkeletonBlock`,
/// `SkeletonCircle`, `SkeletonCapsule`, or any redacted content). A soft
/// diagonal highlight band sweeps across the *masked alpha* of the content, so
/// only the placeholder silhouettes light up — never the gaps between them.
///
/// This is the single shimmer vocabulary used by every list skeleton in the
/// app, so loading states feel consistent everywhere.
///
/// Implementation is the well-worn `AnimatableModifier` + gradient-mask
/// technique: animate one `phase` value and let SwiftUI interpolate the mask
/// stops, which is far cheaper than a per-frame `TimelineView` driving dozens
/// of placeholder cells.
public struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let duration: Double
    private let bounce: Bool
    private let active: Bool

    public init(duration: Double = 1.4, bounce: Bool = false, active: Bool = true) {
        self.duration = duration
        self.bounce = bounce
        self.active = active
    }

    public func body(content: Content) -> some View {
        // Reduce-motion users get the static skeleton silhouette — no sweep.
        if active && !reduceMotion {
            content
                .modifier(AnimatedMask(phase: phase))
                .animation(
                    .linear(duration: duration).repeatForever(autoreverses: bounce),
                    value: phase
                )
                .onAppear { phase = 0.8 }
        } else {
            content
        }
    }

    /// Masks the content's alpha with a moving gradient band. `animatableData`
    /// drives `phase`, so SwiftUI tweens the band across every frame.
    private struct AnimatedMask: AnimatableModifier {
        var phase: CGFloat = 0
        var animatableData: CGFloat {
            get { phase }
            set { phase = newValue }
        }
        func body(content: Content) -> some View {
            content.mask(GradientMask(phase: phase).scaleEffect(3))
        }
    }

    /// Three-stop diagonal gradient. The edge alpha dips so the band reads as a
    /// travelling glint; `scaleEffect(3)` on the parent guarantees the band
    /// fully clears the content at both ends of the sweep.
    private struct GradientMask: View {
        let phase: CGFloat
        var body: some View {
            LinearGradient(
                gradient: Gradient(stops: [
                    .init(color: .black.opacity(0.35), location: phase),
                    .init(color: .black, location: phase + 0.1),
                    .init(color: .black.opacity(0.35), location: phase + 0.2)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

public extension View {
    /// Sweep a shimmer highlight across skeleton placeholders. Apply to the
    /// *inner placeholder group* of a skeleton card (not its solid chrome) so
    /// only the content silhouettes shimmer. Pass `active: false` to freeze it.
    func shimmering(active: Bool = true) -> some View {
        modifier(Shimmer(active: active))
    }
}

// MARK: - Skeleton primitives

/// A single rounded placeholder block filled with the skeleton base color.
/// Compose these inside a card-shaped container that mirrors the real card's
/// chrome, then wrap the group in `.shimmering()`.
///
/// `width == nil` means "fill the available width" (left-aligned).
public struct SkeletonBlock: View {
    private let width: CGFloat?
    private let height: CGFloat
    private let cornerRadius: CGFloat

    public init(width: CGFloat? = nil, height: CGFloat, cornerRadius: CGFloat = 6) {
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Color.appSkeleton)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }
}

/// Circular skeleton placeholder — for avatars, logos, dots.
public struct SkeletonCircle: View {
    private let diameter: CGFloat
    public init(_ diameter: CGFloat) { self.diameter = diameter }
    public var body: some View {
        Circle()
            .fill(Color.appSkeleton)
            .frame(width: diameter, height: diameter)
    }
}

/// Pill/capsule skeleton placeholder — for chips, pills, tags.
/// `width == nil` fills the available width.
public struct SkeletonCapsule: View {
    private let width: CGFloat?
    private let height: CGFloat

    public init(width: CGFloat? = nil, height: CGFloat) {
        self.width = width
        self.height = height
    }

    public var body: some View {
        Capsule(style: .continuous)
            .fill(Color.appSkeleton)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }
}

#if DEBUG
#Preview("Shimmer") {
    VStack(alignment: .leading, spacing: 16) {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                SkeletonCircle(40)
                VStack(alignment: .leading, spacing: 6) {
                    SkeletonBlock(width: 140, height: 12)
                    SkeletonBlock(width: 90, height: 10)
                }
                Spacer()
                SkeletonCapsule(width: 60, height: 22)
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.appSurfaceElevated))
        .shimmering()
    }
    .padding()
    .background(Color.appSurface)
}
#endif
