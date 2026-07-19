// OnboardingTimeSummaryView.swift
//
// Step 23: the time-value payoff, ported from Orbital Focus's
// OnboardingScreenTimeSummary. Two beats in one view:
//
//   summary  — "WagerProof will get you back [N+ hours] every year" +
//              three value cards derived from the research-time bucket,
//              with a "Let's lock it in with a fist bump" line above the
//              "👊 Let's Do It" CTA.
//   fistBump — the CTA's payoff: the fist flies in, winds up, PUNCHES,
//              and bursts into sport/betting emoji with a haptic pop,
//              then auto-completes onboarding. RootView sees `isComplete`
//              flip and presents the paywall, so the fist bump lands the
//              user directly on the ask while the high is fresh.
//
// All figures derive from the persisted research-time bucket.

import SwiftUI
import WagerproofDesign
import WagerproofStores
#if canImport(UIKit)
import UIKit
#endif

struct OnboardingTimeSummaryView: View {
    var accent: Color = .appPrimary

    @Environment(OnboardingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Beat { case summary, fistBump }
    @State private var beat: Beat = .summary

    private var estimates: ResearchTimeEstimates {
        ResearchTimeEstimates(rawBucket: store.survey.researchTimeBucket)
    }

    var body: some View {
        Group {
            switch beat {
            case .summary:
                summaryScreen
                    .transition(.opacity)
            case .fistBump:
                WagerFistBumpExplosion(reduceMotion: reduceMotion) {
                    // Cache-first completion. RootView watches `isComplete`,
                    // flips to `.ready`, and covers with the paywall.
                    store.markComplete()
                }
                .transition(.opacity)
            }
        }
        .animation(reduceMotion ? .linear(duration: 0.001) : .appStandard, value: beat)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Summary

    private var summaryScreen: some View {
        VStack(spacing: 0) {
            (Text("WagerProof will get you back ")
                + Text("\(estimates.reclaimYearLowDisplay)+ hours")
                    .foregroundStyle(
                        LinearGradient(colors: [accent, accent.opacity(0.65)],
                                       startPoint: .leading, endPoint: .trailing)
                    )
                    .bold()
                + Text(" every year"))
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
                .padding(.top, 72)
                .pageEntrance(index: 0)

            VStack(spacing: 26) {
                valueCard(
                    icon: "clock.badge.checkmark",
                    title: "\(uppercasedFirst(estimates.weeklyRangeText)) back every week",
                    detail: "Your agents run the line checks, model reads, and trend scans for you."
                )
                .pageEntrance(index: 1)
                valueCard(
                    icon: "bolt.fill",
                    title: "Decide, don't grind",
                    detail: "Start every slate from a screened shortlist with the reasoning attached."
                )
                .pageEntrance(index: 2)
                valueCard(
                    icon: "calendar.badge.clock",
                    title: "\(estimates.reclaimYearLowDisplay)+ hours a year",
                    detail: "Time that goes back to watching games, not grinding spreadsheets."
                )
                .pageEntrance(index: 3)
            }
            .padding(.horizontal, 26)
            .padding(.top, 40)

            Spacer(minLength: 0)

            Text("Let's lock it in with a fist bump")
                .font(.system(size: 15))
                .foregroundStyle(Color.white.opacity(0.55))
                .padding(.bottom, 12)
                .pageEntrance(index: 4)

            ContinueCTAButton(
                label: "👊  Let's Do It",
                tint: .white,
                foreground: .black,
                surfaceOpacity: 0.92
            ) {
                beat = .fistBump
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
            .pageEntrance(index: 5)
        }
    }

    private func valueCard(icon: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 26))
                .foregroundStyle(accent)
                .frame(width: 34)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                Text(detail)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private func uppercasedFirst(_ text: String) -> String {
        guard let first = text.first else { return text }
        return first.uppercased() + text.dropFirst()
    }
}

// MARK: - Fist-bump explosion (ported from Orbital Focus)

/// The fist flies in, winds up, then PUNCHES. On the punch the particles
/// burst OUT OF THE FIST itself: each starts tiny at the fist's centre and
/// shoots outward (fast then decelerating), growing to full size, spinning,
/// and fading at the end. The fist stays put (with a punch pulse) as the
/// visible source. Reduce Motion shows a quick still pop and moves on.
///
/// The burst is driven off a start time via a TimelineView so each
/// particle's whole flight (emerge, fly + spin out, fade) is computed
/// per-frame from one eased progress value — a single spring can't do
/// emerge-then-fade. Particles are sport/betting emoji (Orbital used its
/// rocket sprites; our pixel avatars are sprite SHEETS, so emoji keeps the
/// burst crisp without a cropping pass).
private struct WagerFistBumpExplosion: View {
    let reduceMotion: Bool
    let onFinished: () -> Void

    @State private var fistScale: CGFloat = 0.35
    @State private var wiggle = false
    @State private var punch: CGFloat = 1.0
    @State private var burstStart: Date? = nil
    @State private var particles: [Particle] = []

    private let flightDuration: Double = 1.6

    var body: some View {
        // Everything is CENTRED in the ZStack and offset outward from there,
        // so the burst is guaranteed symmetric around the middle.
        ZStack {
            TimelineView(.animation(paused: burstStart == nil)) { ctx in
                let t = burstProgress(now: ctx.date)
                let reach = 1 - pow(1 - t, 2.4)          // easeOut: fast out, then slow
                ZStack {
                    ForEach(particles) { p in
                        Text(p.emoji)
                            .font(.system(size: 30))
                            .scaleEffect(scale(p, t))     // tiny at the fist, grows out
                            .rotationEffect(.degrees(reach * p.spin))
                            .opacity(opacity(t))
                            .offset(x: p.dx * CGFloat(reach),
                                    y: p.dy * CGFloat(reach))
                    }
                }
            }

            // The fist — the source of the burst; stays put with a punch pulse.
            Text("👊")
                .font(.system(size: 96))
                .scaleEffect(fistScale * punch)
                .rotationEffect(.degrees(wiggle ? 8 : -8))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task { await run() }
    }

    private func burstProgress(now: Date) -> Double {
        guard let s = burstStart else { return 0 }
        return min(1, max(0, now.timeIntervalSince(s) / flightDuration))
    }

    /// Pop out small from the fist, grow to full size over the first third.
    private func scale(_ p: Particle, _ t: Double) -> CGFloat {
        p.scale * CGFloat(0.15 + 0.85 * min(1, t * 3))
    }

    /// Fully opaque during the flight, fading away toward the end.
    private func opacity(_ t: Double) -> Double {
        t < 0.6 ? 1 : max(0, 1 - (t - 0.6) / 0.4)
    }

    private func run() async {
        particles = Self.makeParticles()

        guard !reduceMotion else {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { fistScale = 1 }
            burstStart = Date()
            Haptic.success()
            try? await Task.sleep(for: .seconds(1.4))
            onFinished(); return
        }

        // 1) Fly in / grow to centre.
        withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) { fistScale = 1.0 }
        Haptic.light()
        try? await Task.sleep(for: .seconds(0.42))

        // 2) Wind-up wiggle.
        withAnimation(.easeInOut(duration: 0.11).repeatCount(4, autoreverses: true)) { wiggle = true }
        Haptic.medium()
        try? await Task.sleep(for: .seconds(0.5))

        // 3) PUNCH + BURST — particles emerge from the fist, haptic pop + shower.
        burstStart = Date()
        Haptic.success()
        Haptic.heavy()
        withAnimation(.easeOut(duration: 0.09)) { punch = 1.42 }
        try? await Task.sleep(for: .seconds(0.09))
        withAnimation(.spring(response: 0.4, dampingFraction: 0.5)) { punch = 1.0 }
        for _ in 0..<5 {                            // rapid tick shower with the burst
            Haptic.rigid()
            try? await Task.sleep(for: .seconds(0.05))
        }

        try? await Task.sleep(for: .seconds(flightDuration - 0.35))
        onFinished()
    }

    // MARK: Particle model

    private struct Particle: Identifiable {
        let id: Int
        let dx: CGFloat
        let dy: CGFloat
        let spin: Double
        let scale: CGFloat
        let emoji: String
    }

    /// A scatter that ALWAYS bursts radially out of the fist: angles are
    /// spread evenly around the full circle (+ jitter), so it can never
    /// collapse into a single direction.
    private static func makeParticles() -> [Particle] {
        let pool = ["🏈", "🏀", "⚾️", "🏒", "⚽️", "💵", "💰", "🎟️", "📈", "🎯"]
        let count = 52
        return (0..<count).map { i in
            // Even angular spacing + jitter → a full 360° burst every time.
            let angle = Double(i) / Double(count) * 2 * .pi + Double.random(in: -0.18...0.18)
            let dist = CGFloat.random(in: 240...560)   // fly all the way out to the edges
            return Particle(id: i,
                            dx: cos(angle) * dist,
                            dy: sin(angle) * dist,
                            spin: Double.random(in: -260...260),
                            scale: CGFloat.random(in: 0.7...1.5),
                            emoji: pool[i % pool.count])
        }
    }

    /// Imperative haptics for the scripted choreography (declarative
    /// `.sensoryFeedback` can't follow a hand-timed Task sequence).
    private enum Haptic {
        static func light()   { impact(.light, 0.6) }
        static func medium()  { impact(.medium, 0.8) }
        static func heavy()   { impact(.heavy, 1.0) }
        static func rigid()   { impact(.rigid, 0.7) }
        static func success() {
            #if canImport(UIKit)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
        }
        private static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle, _ intensity: CGFloat) {
            #if canImport(UIKit)
            UIImpactFeedbackGenerator(style: style).impactOccurred(intensity: intensity)
            #endif
        }
    }
}
