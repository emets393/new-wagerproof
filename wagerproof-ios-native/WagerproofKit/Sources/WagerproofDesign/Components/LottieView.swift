// LottieView.swift
//
// SwiftUI wrapper around `LottieAnimationView` from `airbnb/lottie-ios`. The
// RN app uses `lottie-react-native` with `.json` files committed under
// `wagerproof-mobile/assets/`. We ship the same JSONs as bundle resources
// inside `WagerproofDesign/Resources/Lotties/` so feature code can address
// them by base name (e.g. `LottieView(name: "Leaderboard")`).
//
// Bundle lookup uses `Bundle.module` so the resources resolve through the
// SPM-generated accessor; callers never need to import Lottie directly.

import SwiftUI
import Lottie

public struct LottieView: UIViewRepresentable {
    private let name: String
    private let loopMode: LottieLoopMode
    private let speed: CGFloat
    private let autoplay: Bool

    public init(
        name: String,
        loopMode: LottieLoopMode = .loop,
        speed: CGFloat = 1.0,
        autoplay: Bool = true
    ) {
        self.name = name
        self.loopMode = loopMode
        self.speed = speed
        self.autoplay = autoplay
    }

    public func makeUIView(context: Context) -> UIView {
        // Container view lets us pin the animation with constraints; the
        // animation view itself doesn't always respect SwiftUI sizing on its
        // own when fed by `UIViewRepresentable`.
        let container = UIView(frame: .zero)
        container.backgroundColor = .clear

        let animationView = LottieAnimationView(name: name, bundle: .module)
        animationView.translatesAutoresizingMaskIntoConstraints = false
        animationView.contentMode = .scaleAspectFit
        animationView.loopMode = loopMode
        animationView.animationSpeed = speed
        animationView.backgroundBehavior = .pauseAndRestore

        container.addSubview(animationView)
        NSLayoutConstraint.activate([
            animationView.topAnchor.constraint(equalTo: container.topAnchor),
            animationView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            animationView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            animationView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])

        if autoplay {
            animationView.play()
        }

        return container
    }

    public func updateUIView(_ uiView: UIView, context: Context) {
        // The animation view is the only subview we add; cheaply locate it
        // and reapply playback state if SwiftUI re-renders with new params.
        guard let animationView = uiView.subviews.first as? LottieAnimationView else { return }
        animationView.loopMode = loopMode
        animationView.animationSpeed = speed
        if autoplay, !animationView.isAnimationPlaying {
            animationView.play()
        }
    }
}
