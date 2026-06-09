import SwiftUI

/// Wagerproof motion vocabulary. Mirrors Honeydew's 09-motion-and-haptics.md.
public extension Animation {
    static let appQuick: Animation = .spring(response: 0.25, dampingFraction: 0.85)
    static let appStandard: Animation = .spring(response: 0.4, dampingFraction: 0.8)
    static let appBouncy: Animation = .spring(response: 0.5, dampingFraction: 0.65)
    /// Carousel slide transition — softer-than-`appBouncy` (no overshoot) for
    /// auto-rotating page carousels. Used by LoginView's onboarding pager.
    static let appCarousel: Animation = .spring(response: 0.5, dampingFraction: 0.85)
    static let appSlow: Animation = .easeInOut(duration: 0.6)
    static let appLinear: Animation = .linear(duration: 0.15)
    static let appShimmer: Animation = .linear(duration: 1.5).repeatForever(autoreverses: false)
}

public extension AnyTransition {
    static let fadeIn: AnyTransition = .opacity
    static let scaleIn: AnyTransition = .scale(scale: 0.85).combined(with: .opacity)
    static let slideFromLeading: AnyTransition = .move(edge: .leading).combined(with: .opacity)
    static let slideFromTrailing: AnyTransition = .move(edge: .trailing).combined(with: .opacity)
    static let slideFromTop: AnyTransition = .move(edge: .top).combined(with: .opacity)
    static let slideFromBottom: AnyTransition = .move(edge: .bottom).combined(with: .opacity)
    static let cardLift: AnyTransition = .scale(scale: 0.95).combined(with: .opacity)
}
