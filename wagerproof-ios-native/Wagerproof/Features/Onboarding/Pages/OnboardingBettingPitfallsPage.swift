// OnboardingBettingPitfallsPage.swift
//
// Page 3: "Select Every Pitfall You've Hit" — 12 tinted pills DROP from
// above the screen and physically pile up under real UIKit Dynamics
// physics (gravity + collisions + tumble). Ported near-verbatim from
// Orbital Focus's mission-type picker (OnboardingSetupAct.swift's
// PillPhysicsField) — same physics constants, same drop/tumble feel, same
// Liquid Glass pill styling. Two differences from that source:
//   1. Multi-select, not single-select — every pill toggles independently
//      (Set<String>, not a replaced single value), since this page asks
//      "which of these have you experienced?" rather than "pick one."
//   2. Icons are plain SF Symbols (Orbital Focus's pixel-art satellite
//      sprites have no WagerProof equivalent), and `.prominentGlass()` is
//      gated behind iOS 26 availability (WagerProof's deployment target is
//      iOS 18, unlike Orbital Focus's iOS 26+ minimum) with a `.filled()`
//      fallback below that.
// Reduce Motion swaps the physics for a static wrapped grid of the same
// pills, reusing the existing `OnboardingChip` component. Sits right after
// "What kind of bettor are you?"; picking any is optional — Continue
// always works (`OnboardingStore.canAdvance(.bettingPitfalls)`).

import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofStores

struct OnboardingBettingPitfallsPage: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var selected: Set<String> { Set(store.survey.bettingPitfalls) }

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.top, 8)
                .padding(.bottom, reduceMotion ? 20 : 8)

            if reduceMotion {
                // Static pile — no drop, no tumble.
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(onboardingPitfalls) { pitfall in
                            OnboardingChip(
                                label: pitfall.label,
                                icon: pitfall.symbol,
                                isSelected: selected.contains(pitfall.label),
                                accent: Color(hex: pitfall.colorHex)
                            ) {
                                UISelectionFeedbackGenerator().selectionChanged()
                                store.toggleBettingPitfall(pitfall.label)
                            }
                        }
                    }
                    .padding(.horizontal, 22)
                    .padding(.bottom, 24)
                }
            } else {
                // The pills rain from above the field and pile up on its
                // floor — the field owns all the space between the header
                // and the shared chrome's Continue pill.
                PitfallPillPhysicsField(
                    pitfalls: onboardingPitfalls,
                    selected: selected,
                    onToggle: { label in
                        UISelectionFeedbackGenerator().selectionChanged()
                        store.toggleBettingPitfall(label)
                    })
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, 8)
                    .padding(.top, 8)
                    .padding(.bottom, 12)
            }
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Text("Select Every Pitfall You've Hit 🎯")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .pageEntrance(index: 0)
            Text("Tap everything that sounds familiar — it helps us tailor your agents.")
                .font(.system(size: 16))
                .foregroundStyle(Color.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .pageEntrance(index: 1)
        }
        .padding(.horizontal, 28)
    }
}

// MARK: - Pitfall model

private struct PitfallOption: Identifiable {
    let label: String
    let symbol: String
    let colorHex: Int
    var id: String { label }
}

private let onboardingPitfalls: [PitfallOption] = [
    .init(label: "Chasing Losses",    symbol: "arrow.triangle.2.circlepath", colorHex: 0x5EB0FF),
    .init(label: "Tilt Betting",      symbol: "flame.fill",                  colorHex: 0x5DDB8A),
    .init(label: "Too Many Parlays",  symbol: "link",                        colorHex: 0x4DD0E1),
    .init(label: "No Bankroll Plan",  symbol: "banknote.fill",               colorHex: 0x7986CB),
    .init(label: "FOMO Bets",         symbol: "bolt.fill",                   colorHex: 0xFFB24D),
    .init(label: "Team Bias",         symbol: "heart.fill",                  colorHex: 0xC792EA),
    .init(label: "Ignoring Odds",     symbol: "chart.line.downtrend.xyaxis", colorHex: 0xFFD54F),
    .init(label: "Overbetting",       symbol: "arrow.up.right.circle.fill",  colorHex: 0xF48FB1),
    .init(label: "Skipping Research", symbol: "magnifyingglass",             colorHex: 0x9FA8FF),
    .init(label: "Emotional Bets",    symbol: "heart.slash.fill",            colorHex: 0x80CBC4),
    .init(label: "Chalk Only",        symbol: "checkmark.seal.fill",         colorHex: 0xFF7043),
    .init(label: "Missed Injuries",   symbol: "cross.case.fill",             colorHex: 0xAED581),
]

// MARK: - Pill physics field

/// Real physics for the pitfall pile: pills spawn ABOVE the field at
/// staggered heights, fall under UIKit Dynamics gravity, collide with the
/// walls/floor and EACH OTHER, and tumble to rest as a pile — the staggered
/// spawn heights give the independent, one-by-one landing feel. Multi-select:
/// tapping a pill toggles it, restyling only that pill (a settled pile never
/// re-lays-out). SwiftUI owns the selection state; this view is presentation
/// + input.
private struct PitfallPillPhysicsField: UIViewRepresentable {
    let pitfalls: [PitfallOption]
    let selected: Set<String>
    let onToggle: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onToggle: onToggle) }

    func makeUIView(context: Context) -> FieldView {
        let field = FieldView()
        field.backgroundColor = .clear
        field.clipsToBounds = true   // pills "enter" through the top edge
        context.coordinator.build(pitfalls: pitfalls, selected: selected, in: field)
        return field
    }

    func updateUIView(_ field: FieldView, context: Context) {
        context.coordinator.onToggle = onToggle
        context.coordinator.apply(selected: selected)
    }

    static func dismantleUIView(_ field: FieldView, coordinator: Coordinator) {
        coordinator.teardown()
    }

    /// Container that kicks off the drop once it has real bounds — the
    /// animator needs the final floor/wall geometry before any item falls.
    final class FieldView: UIView {
        var onFirstLayout: ((CGRect) -> Void)?
        private var started = false
        override func layoutSubviews() {
            super.layoutSubviews()
            if !started, bounds.width > 10, bounds.height > 10 {
                started = true
                onFirstLayout?(bounds)
            }
        }
    }

    @MainActor
    final class Coordinator: NSObject {
        var onToggle: (String) -> Void
        private var animator: UIDynamicAnimator?
        private var pills: [PhysicsPitfallPillView] = []

        init(onToggle: @escaping (String) -> Void) { self.onToggle = onToggle }

        func build(pitfalls: [PitfallOption], selected: Set<String>, in field: FieldView) {
            pills = pitfalls.map { pitfall in
                let pill = PhysicsPitfallPillView(pitfall: pitfall)
                pill.setSelected(selected.contains(pitfall.label))
                pill.addTarget(self, action: #selector(tapped(_:)), for: .touchUpInside)
                return pill
            }
            field.onFirstLayout = { [weak self, weak field] bounds in
                guard let self, let field else { return }
                self.drop(in: field, bounds: bounds)
            }
        }

        func apply(selected: Set<String>) {
            for pill in pills { pill.setSelected(selected.contains(pill.pitfallLabel)) }
        }

        func teardown() {
            animator?.removeAllBehaviors()
            animator = nil
            pills.removeAll()
        }

        @objc private func tapped(_ sender: PhysicsPitfallPillView) {
            onToggle(sender.pitfallLabel)
        }

        private func drop(in field: UIView, bounds: CGRect) {
            let animator = UIDynamicAnimator(referenceView: field)
            self.animator = animator

            // Gentle gravity so even the highest spawns don't hit the floor
            // fast enough to tunnel through the boundary.
            let gravity = UIGravityBehavior()
            gravity.magnitude = 1.5

            // Floor + tall side walls; the top stays OPEN so pills rain in
            // from above the field.
            let collision = UICollisionBehavior()
            let wallTop: CGFloat = -1800
            collision.addBoundary(withIdentifier: "floor" as NSString,
                                  from: CGPoint(x: -2, y: bounds.height),
                                  to: CGPoint(x: bounds.width + 2, y: bounds.height))
            collision.addBoundary(withIdentifier: "left" as NSString,
                                  from: CGPoint(x: 0, y: wallTop),
                                  to: CGPoint(x: 0, y: bounds.height))
            collision.addBoundary(withIdentifier: "right" as NSString,
                                  from: CGPoint(x: bounds.width, y: wallTop),
                                  to: CGPoint(x: bounds.width, y: bounds.height))

            let properties = UIDynamicItemBehavior()
            properties.elasticity = 0.25      // a small, satisfying bounce
            properties.friction = 0.9         // pills grip, the pile holds
            properties.resistance = 0.3
            properties.angularResistance = 1.4
            properties.allowsRotation = true  // the tumble is the charm

            animator.addBehavior(gravity)
            animator.addBehavior(collision)
            animator.addBehavior(properties)

            // Deterministic scatter — the same pleasing rain every run.
            var rng = SeededRandom(seed: 7)
            for (i, pill) in pills.enumerated() {
                let usable = max(bounds.width - pill.bounds.width - 16, 1)
                let x = 8 + pill.bounds.width / 2 + CGFloat(rng.next()) * usable
                // Staggered spawn heights = staggered, independent arrivals —
                // pure physics, no timers to race the animator.
                let y = -50 - CGFloat(i) * 70 - CGFloat(rng.next()) * 36
                pill.center = CGPoint(x: x, y: y)
                pill.transform = CGAffineTransform(rotationAngle: CGFloat(rng.next() - 0.5) * 0.6)
                field.addSubview(pill)
                gravity.addItem(pill)
                collision.addItem(pill)
                properties.addItem(pill)
                properties.addAngularVelocity(CGFloat(rng.next() - 0.5) * 2.6, for: pill)
            }
        }
    }
}

/// Deterministic tiny RNG so the pill scatter/rotation is the same pleasing
/// drop every time the page mounts.
private struct SeededRandom {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> Double {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Double(state >> 11) / Double(UInt64.max >> 11)
    }
}

/// A real `UIButton` (UIDynamics animates any UIView, buttons included)
/// using native Liquid Glass on iOS 26+ — the same reactive, tinted-capsule
/// look as the SwiftUI `OnboardingChip`/`liquidGlassBackground` pills, minus
/// the hand-rolled approximation. Its frame is fixed at creation: the
/// physics engine reads bounds when the item is added, and a selection
/// restyle must never resize a pill mid-pile.
private final class PhysicsPitfallPillView: UIButton {
    let pitfallLabel: String
    private let tint: UIColor

    init(pitfall: PitfallOption) {
        self.pitfallLabel = pitfall.label
        self.tint = UIColor(Color(hex: pitfall.colorHex))
        super.init(frame: .zero)

        // `.prominentGlass()` is iOS 26+ only — WagerProof's deployment
        // target is iOS 18, so pre-26 devices fall back to a solid filled
        // capsule (still tinted/restyled identically below).
        var config: UIButton.Configuration
        if #available(iOS 26.0, *) {
            config = .prominentGlass()
        } else {
            config = .filled()
        }
        config.image = UIImage(systemName: pitfall.symbol)
        config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold)
        config.imagePadding = 7
        config.title = pitfall.label
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            let descriptor = UIFont.systemFont(ofSize: 16, weight: .semibold).fontDescriptor
            outgoing.font = UIFont(descriptor: descriptor.withDesign(.rounded) ?? descriptor, size: 16)
            return outgoing
        }
        config.cornerStyle = .capsule
        config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 17, bottom: 12, trailing: 17)
        configuration = config

        // Idle: tint-at-0.42-alpha. Selected: tint-at-0.95 + a white ring +
        // white label/icon — restyled live off the button's own state.
        configurationUpdateHandler = { [tint] button in
            guard var config = button.configuration else { return }
            let selected = button.isSelected
            config.baseBackgroundColor = tint.withAlphaComponent(selected ? 0.95 : 0.42)
            config.baseForegroundColor = selected ? .white : tint
            config.background.strokeColor = selected ? .white.withAlphaComponent(0.9) : .clear
            config.background.strokeWidth = 1.5
            button.configuration = config
        }

        isAccessibilityElement = true
        accessibilityLabel = pitfall.label
        setSelected(false)

        // Freeze the frame now (see type comment).
        let size = systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
        frame = CGRect(origin: .zero, size: size)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// Only restyles the configuration (background tint, ring, foreground)
    /// — never touches `.transform`, which UIKit Dynamics owns for the
    /// settled tumble rotation; overwriting it here would un-rotate the pill.
    func setSelected(_ selected: Bool) {
        accessibilityTraits = selected ? [.button, .selected] : .button
        UIView.animate(withDuration: 0.3, delay: 0,
                        usingSpringWithDamping: 0.7, initialSpringVelocity: 0.5,
                        options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.isSelected = selected   // triggers configurationUpdateHandler
        }
    }
}

#if DEBUG
#Preview("Onboarding — Betting Pitfalls") {
    ZStack {
        Color.black.ignoresSafeArea()
        OnboardingBettingPitfallsPage()
    }
    .environment(OnboardingStore())
    .preferredColorScheme(.dark)
}
#endif
