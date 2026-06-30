// AuthButtons.swift
//
// Shared button chrome for the unauthenticated stack so the gate, email
// sign-in, and sign-up screens all read identically:
//   - AuthPillLabel       — the solid light/dark sign-in pill (Apple/Google/Email)
//   - LiquidGlassPillButton — the white-tint Liquid Glass primary CTA
//   - PillPressStyle      — shared press feedback
//   - AppleSignInCoordinator / AppleNonce — programmatic Sign in with Apple

import SwiftUI
import AuthenticationServices
import CryptoKit
import UIKit
import WagerproofDesign

/// Light (white fill / black content) vs dark (black fill / white content) pill.
enum AuthPillStyle {
    case light
    case dark

    var foreground: Color { self == .light ? .black : .white }
    var fill: Color { self == .light ? .white : .black }
}

/// The shared sign-in pill *visual*. Wrap it in a `Button` or `NavigationLink`
/// and attach `.buttonStyle(PillPressStyle())`. Callers provide the leading
/// glyph (colored to match `style.foreground`).
struct AuthPillLabel<Glyph: View>: View {
    let title: String
    var style: AuthPillStyle = .light
    var loading: Bool = false
    @ViewBuilder var glyph: () -> Glyph

    private let height: CGFloat = 50
    private let radius: CGFloat = 28

    var body: some View {
        HStack(spacing: 8) {
            if loading {
                ProgressView().tint(style.foreground)
            } else {
                glyph()
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(style.foreground)
            }
        }
        .frame(maxWidth: .infinity, minHeight: height)
        .background(RoundedRectangle(cornerRadius: radius).fill(style.fill))
        .overlay {
            // Hairline rim keeps the black pill legible on the near-black gate.
            if style == .dark {
                RoundedRectangle(cornerRadius: radius)
                    .strokeBorder(.white.opacity(0.18), lineWidth: 1)
            }
        }
    }
}

/// Light press feedback shared by every auth pill.
struct PillPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Primary CTA rendered as a white-tint interactive Liquid Glass capsule — the
/// main action on the email sign-in / sign-up / forgot-password screens. The
/// dark backdrop refracts through a frosted white pill that wobbles on touch
/// (iOS 26+); ultraThinMaterial fallback below.
struct LiquidGlassPillButton: View {
    let title: String
    var loading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button {
            if isEnabled && !loading { action() }
        } label: {
            ZStack {
                if loading {
                    ProgressView().tint(.white)
                } else {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .liquidGlassBackground(in: Capsule(), tint: .white.opacity(0.42), interactive: true)
            .overlay(
                // Specular sheen — the signature glass highlight.
                Capsule()
                    .fill(LinearGradient(
                        colors: [.white.opacity(0.26), .white.opacity(0.0)],
                        startPoint: .top,
                        endPoint: .center
                    ))
                    .allowsHitTesting(false)
            )
            .overlay(
                Capsule()
                    .strokeBorder(
                        LinearGradient(
                            colors: [.white.opacity(0.5), .white.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
                    .allowsHitTesting(false)
            )
            .contentShape(Capsule())
        }
        .buttonStyle(PillPressStyle())
        .disabled(!isEnabled || loading)
        .opacity(isEnabled ? 1 : 0.45)
    }
}

/// Random-nonce helpers for Sign in with Apple. Shared so the gate and sign-up
/// screen don't each carry their own copy.
enum AppleNonce {
    static func random(length: Int = 32) -> String {
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    static func sha256Hex(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

/// Drives a programmatic Sign in with Apple flow so the button can be fully
/// custom-styled (the SwiftUI `SignInWithAppleButton` can't match our pill font
/// or fills). Bridges `ASAuthorizationController`'s delegate callbacks back into
/// a Swift `Result` closure. Retain an instance for the view's lifetime.
final class AppleSignInCoordinator: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {

    private var completion: ((Result<ASAuthorization, Error>) -> Void)?

    func start(nonceSHA256: String, completion: @escaping (Result<ASAuthorization, Error>) -> Void) {
        self.completion = completion
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = nonceSHA256
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        completion?(.success(authorization))
        completion = nil
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        completion?(.failure(error))
        completion = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes
            .first { $0.activationState == .foregroundActive } as? UIWindowScene
        return scene?.keyWindow ?? ASPresentationAnchor()
    }
}
