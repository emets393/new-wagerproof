// LoginView.swift
//
// Auto-advancing onboarding carousel + Apple/Google/email sign-in.
// 1:1 SwiftUI port of `wagerproof-mobile/app/(auth)/login.tsx`.
//
// Wired to the real `AuthStore`:
//   - Apple via `SignInWithAppleButton` → `authStore.signInWithApple(idToken:nonce:)`
//   - Google via `authStore.signInWithGoogle()` (handles GIDSignIn under the hood)
//   - "Other Sign In" pushes `.emailLogin` on the AuthRouter NavigationStack.
//
// Visual elements ported from RN:
//   - 6-segment progress bar at the top, active segment fills over slide duration
//   - Background gradient (teal → black) layered over the looping video / placeholder
//   - Per-slide floating widget (StatsCard, LineMovementCard, AIModelCard, etc.)
//   - Bottom-anchored error snackbar (5s auto-dismiss).
//
// See docs/wagerproof-migration/08-screen-native-spec.md §1 for spec.

import SwiftUI
import AuthenticationServices
import AVKit
import CryptoKit
import WagerproofDesign
import WagerproofStores

struct LoginView: View {
    @Environment(AuthStore.self) private var authStore

    @State private var currentIndex: Int = 0
    @State private var slideStart: Date = Date()
    @State private var isPaused: Bool = false
    @State private var googleLoading: Bool = false
    @State private var appleLoading: Bool = false
    @State private var snackbarMessage: String?
    @State private var snackbarVisible: Bool = false
    @State private var snackbarDismissTask: Task<Void, Never>?
    @State private var currentNonce: String?
    @State private var signInTapCount: Int = 0

    // AVPlayer kept as state so we can toggle .rate without recreating it.
    @State private var videoPlayer: AVPlayer? = makeVideoPlayer()

    private let slides = OnboardingSlideKind.allCases

    var body: some View {
        ZStack(alignment: .top) {
            // Layer 1: looping video / placeholder background
            backgroundLayer
                .ignoresSafeArea()

            // Layer 2: teal-tint + bottom-fade gradients
            gradientLayer
                .ignoresSafeArea()

            // Layer 3: progress segments
            SegmentedProgressBar(
                total: slides.count,
                current: currentIndex,
                paused: isPaused,
                duration: slides[currentIndex].duration,
                slideStart: slideStart
            ) { index in
                jump(to: index)
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)

            // Layer 4: tap zones (left/right thirds advance; hold pauses)
            tapZones
                .ignoresSafeArea()

            // Layer 5: content
            VStack(spacing: 0) {
                // Visual carousel — TabView page style per 08-spec §1.
                // User swipe is suppressed because the carousel is auto-driven
                // (the tap zones in Layer 4 + the segmented progress bar in
                // Layer 3 are the only valid input surfaces).
                TabView(selection: $currentIndex) {
                    ForEach(Array(slides.enumerated()), id: \.offset) { index, kind in
                        OnboardingSlide(kind: kind, isActive: index == currentIndex)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .indexViewStyle(.page(backgroundDisplayMode: .never))
                .animation(.appCarousel, value: currentIndex)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .allowsHitTesting(false)

                // Title + subtitle + auth CTAs
                VStack(alignment: .leading, spacing: 12) {
                    Text(slides[currentIndex].title)
                        .font(.system(size: 42, weight: .heavy))
                        .foregroundStyle(.white)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineSpacing(2)
                        .id("title-\(currentIndex)")
                        .transition(.opacity)
                    Text(slides[currentIndex].subtitle)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineSpacing(4)
                        .id("subtitle-\(currentIndex)")
                        .transition(.opacity)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
                .animation(.easeInOut(duration: 0.35), value: currentIndex)

                authButtons
                    .padding(.horizontal, 24)
                    .padding(.bottom, 20)
            }

            // Layer 6: snackbar overlay (above everything)
            if snackbarVisible, let message = snackbarMessage {
                snackbar(message: message)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .preferredColorScheme(.dark)
        .toolbar(.hidden, for: .navigationBar)
        .statusBarHidden(false)
        .sensoryFeedback(.selection, trigger: currentIndex)
        .sensoryFeedback(.impact(weight: .medium), trigger: signInTapCount)
        .sensoryFeedback(.success, trigger: authStore.lastSuccessAt)
        .sensoryFeedback(.error, trigger: snackbarMessage)
        // Auto-advance timer
        .task(id: "\(currentIndex)-\(isPaused)") {
            if isPaused { return }
            let duration = slides[currentIndex].duration
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            if !Task.isCancelled, !isPaused {
                advance(forward: true)
            }
        }
        .onChange(of: authStore.lastError) { _, newError in
            guard let error = newError, !error.isEmpty else { return }
            showSnackbar(message: error)
        }
        .onChange(of: isPaused) { _, paused in
            videoPlayer?.rate = paused ? 0 : 1
        }
        .onAppear {
            videoPlayer?.play()
        }
    }

    // MARK: - Background layers

    @ViewBuilder
    private var backgroundLayer: some View {
        if slides[currentIndex].hasVideoBackground, let player = videoPlayer {
            VideoBackground(player: player)
        } else {
            // Solid teal placeholder for image slides (visual cards in front)
            Color(hex: 0x00BFA5)
        }
    }

    private var gradientLayer: some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: Color(hex: 0x00BFA5).opacity(0.6), location: 0),
                    .init(color: Color(hex: 0x00BFA5).opacity(0.85), location: 0.5),
                    .init(color: Color(hex: 0x00BFA5), location: 1)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            // Bottom fade to black (last 50% of screen)
            VStack {
                Spacer()
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black.opacity(0.8), location: 0.7),
                        .init(color: .black, location: 1)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: UIScreen.main.bounds.height * 0.55)
            }
        }
    }

    // MARK: - Tap zones

    private var tapZones: some View {
        HStack(spacing: 0) {
            // Left third: previous
            Color.clear
                .contentShape(Rectangle())
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onTapGesture { advance(forward: false) }
            // Centre + right two-thirds: next
            Color.clear
                .contentShape(Rectangle())
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onTapGesture { advance(forward: true) }
        }
        // Long-press anywhere pauses the carousel (matches RN behaviour).
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.18)
                .onChanged { _ in isPaused = true }
                .onEnded { _ in isPaused = false }
        )
        // Don't intercept taps that fall on the bottom 35% (where buttons live).
        .padding(.bottom, 280)
    }

    // MARK: - Auth buttons

    private var authButtons: some View {
        VStack(spacing: 16) {
            // Continue with Apple — native button
            SignInWithAppleButton(.continue, onRequest: { request in
                let nonce = Self.makeRandomNonce()
                currentNonce = nonce
                request.requestedScopes = [.fullName, .email]
                request.nonce = Self.sha256Hex(nonce)
                signInTapCount += 1
                appleLoading = true
            }, onCompletion: { result in
                handleAppleCompletion(result)
            })
            .signInWithAppleButtonStyle(.white)
            .frame(height: 54)
            .clipShape(RoundedRectangle(cornerRadius: 30))
            .disabled(appleLoading || googleLoading)
            .opacity((appleLoading || googleLoading) ? 0.6 : 1.0)

            // Continue with Google
            SocialSignInButton(
                provider: .google,
                loading: googleLoading,
                disabled: appleLoading
            ) {
                signInTapCount += 1
                Task {
                    googleLoading = true
                    await authStore.signInWithGoogle()
                    googleLoading = false
                }
            }

            // Other Sign In — pushes EmailLoginView
            NavigationLink(value: AuthRoute.emailLogin) {
                Text("Other Sign In")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.plain)

            // Terms footer
            (
                Text("By continuing, you agree to our\n")
                    .foregroundStyle(.white.opacity(0.4))
                +
                Text("Privacy Policy").foregroundStyle(.white).bold()
                +
                Text(" • ").foregroundStyle(.white.opacity(0.4))
                +
                Text("Terms of Use").foregroundStyle(.white).bold()
            )
            .font(.system(size: 12))
            .multilineTextAlignment(.center)
            .padding(.top, 8)
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Snackbar

    private func snackbar(message: String) -> some View {
        VStack {
            Spacer()
            HStack(alignment: .center, spacing: 12) {
                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button("Dismiss") {
                    dismissSnackbar()
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(hex: 0xFF4444))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal, 16)
            .padding(.bottom, 80)
        }
    }

    private func showSnackbar(message: String) {
        snackbarMessage = message
        withAnimation(.appQuick) {
            snackbarVisible = true
        }
        snackbarDismissTask?.cancel()
        snackbarDismissTask = Task {
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            if !Task.isCancelled { await MainActor.run { dismissSnackbar() } }
        }
    }

    private func dismissSnackbar() {
        withAnimation(.easeOut(duration: 0.2)) {
            snackbarVisible = false
        }
        authStore.clearError()
    }

    // MARK: - Navigation helpers

    private func advance(forward: Bool) {
        let next = forward
            ? (currentIndex + 1) % slides.count
            : (currentIndex - 1 + slides.count) % slides.count
        currentIndex = next
        slideStart = Date()
    }

    private func jump(to index: Int) {
        guard index != currentIndex, slides.indices.contains(index) else { return }
        currentIndex = index
        slideStart = Date()
    }

    // MARK: - Apple sign-in plumbing

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        appleLoading = false
        switch result {
        case .success(let auth):
            guard
                let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else {
                showSnackbar(message: "Apple sign-in returned no identity token.")
                return
            }
            let nonce = currentNonce
            currentNonce = nil
            Task { await authStore.signInWithApple(idToken: idToken, nonce: nonce) }
        case .failure(let error):
            currentNonce = nil
            if let asError = error as? ASAuthorizationError, asError.code == .canceled { return }
            showSnackbar(message: error.localizedDescription)
        }
    }

    private static func makeRandomNonce(length: Int = 32) -> String {
        precondition(length > 0)
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var random = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &random)
        return String(random.map { charset[Int($0) % charset.count] })
    }

    private static func sha256Hex(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

// MARK: - Background video

/// Wraps an `AVPlayerLayer` for a muted, looping video.
private struct VideoBackground: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> UIView {
        let view = PlayerContainerView()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

private final class PlayerContainerView: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

private func makeVideoPlayer() -> AVPlayer? {
    // The RN app ships `login-background.mp4` as a JS bundle asset. The
    // Swift bundle does not yet have it imported; if missing we render the
    // teal placeholder for the first/last slides too — there's no crash.
    // FIDELITY-WAIVER #003: login-background.mp4 asset import deferred.
    guard let url = Bundle.main.url(forResource: "login-background", withExtension: "mp4")
    else { return nil }
    let item = AVPlayerItem(url: url)
    let player = AVPlayer(playerItem: item)
    player.isMuted = true
    player.actionAtItemEnd = .none
    NotificationCenter.default.addObserver(
        forName: .AVPlayerItemDidPlayToEndTime,
        object: item,
        queue: .main
    ) { _ in
        player.seek(to: .zero)
        player.play()
    }
    return player
}

// MARK: - Segmented progress bar

private struct SegmentedProgressBar: View {
    let total: Int
    let current: Int
    let paused: Bool
    let duration: TimeInterval
    let slideStart: Date
    let onTap: (Int) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<total, id: \.self) { i in
                Button {
                    onTap(i)
                } label: {
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(.white.opacity(0.3))
                        Capsule()
                            .fill(.white)
                            .modifier(SegmentFillModifier(
                                isActive: i == current,
                                isPast: i < current,
                                paused: paused,
                                duration: duration,
                                slideStart: slideStart
                            ))
                    }
                    .frame(height: 4)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct SegmentFillModifier: ViewModifier {
    let isActive: Bool
    let isPast: Bool
    let paused: Bool
    let duration: TimeInterval
    let slideStart: Date

    func body(content: Content) -> some View {
        if isPast {
            content.frame(maxWidth: .infinity)
        } else if isActive {
            TimelineView(.animation(minimumInterval: 0.05, paused: paused)) { context in
                let elapsed = max(0, context.date.timeIntervalSince(slideStart))
                let progress = min(1.0, elapsed / duration)
                GeometryReader { geo in
                    content
                        .frame(width: geo.size.width * progress)
                }
            }
        } else {
            content.frame(width: 0)
        }
    }
}
