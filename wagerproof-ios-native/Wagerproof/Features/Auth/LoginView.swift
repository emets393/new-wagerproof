// LoginView.swift
//
// The unauthenticated welcome gate: animated pixel-glyph background, a
// left-aligned logo + tagline centered on screen, and the three sign-in
// options pinned to the bottom. Shared chrome lives in Auth/Components
// (AuthGateBackground, AuthPillLabel, AppleSignInCoordinator).

import SwiftUI
import AuthenticationServices
import WagerproofDesign
import WagerproofStores

struct LoginView: View {
    @Environment(AuthStore.self) private var authStore

    @State private var currentNonce: String?
    @State private var appleLoading: Bool = false
    @State private var googleLoading: Bool = false
    @State private var errorMessage: String?
    /// Retained for the lifetime of the view so the Apple auth callback isn't
    /// dropped mid-flow (ASAuthorizationController holds its delegate weakly).
    @State private var appleCoordinator = AppleSignInCoordinator()

    private var anyLoading: Bool { appleLoading || googleLoading }

    var body: some View {
        ZStack {
            AuthGateBackground()

            // Logo + heading: left-aligned, vertically centered on screen.
            VStack(alignment: .leading, spacing: 12) {
                Image("WagerproofLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text("Welcome to WagerProof")
                        .foregroundStyle(.white.opacity(0.92))
                    Text("The new way to bet with data")
                        .foregroundStyle(.white.opacity(0.64))
                }
                .font(.system(size: 18, weight: .medium))
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 28)

            // Sign-in options + legal copy, pinned to the bottom.
            VStack(spacing: 10) {
                if let errorMessage {
                    AuthErrorBanner(message: errorMessage).transition(.opacity)
                }

                appleButton
                googleButton
                emailButton

                legalCopy
                    .padding(.top, 6)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .padding(.bottom, 4)
        }
        .preferredColorScheme(.dark)
        .toolbar(.hidden, for: .navigationBar)
        .statusBarHidden(false)
        .sensoryFeedback(.error, trigger: errorMessage)
    }

    // MARK: - Sign-in buttons

    private var appleButton: some View {
        Button {
            startAppleSignIn()
        } label: {
            AuthPillLabel(title: "Continue with Apple", style: .light, loading: appleLoading) {
                Image(systemName: "applelogo")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.black)
            }
        }
        .buttonStyle(PillPressStyle())
        .disabled(anyLoading)
        .opacity(anyLoading && !appleLoading ? 0.6 : 1)
        .accessibilityIdentifier("auth-gate-apple")
    }

    private var googleButton: some View {
        Button {
            Task {
                errorMessage = nil
                googleLoading = true
                await authStore.signInWithGoogle()
                googleLoading = false
                if let raw = authStore.lastError {
                    errorMessage = raw
                    authStore.clearError()
                }
            }
        } label: {
            AuthPillLabel(title: "Continue with Google", style: .dark, loading: googleLoading) {
                // SF Symbols has no Google glyph — tinted "G" placeholder.
                Text("G")
                    .font(.system(size: 15, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(PillPressStyle())
        .disabled(anyLoading)
        .opacity(anyLoading && !googleLoading ? 0.6 : 1)
        .accessibilityIdentifier("auth-gate-google")
    }

    private var emailButton: some View {
        NavigationLink(value: AuthRoute.emailLogin) {
            AuthPillLabel(title: "Continue with Email", style: .dark) {
                Image(systemName: "envelope.fill")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(PillPressStyle())
        .disabled(anyLoading)
        .opacity(anyLoading ? 0.6 : 1)
        .accessibilityIdentifier("auth-gate-email")
    }

    private var legalCopy: some View {
        (
            Text("By creating an account, you agree to the\n")
                .foregroundStyle(.white.opacity(0.5))
            +
            Text("Terms of Service")
                .foregroundStyle(.white.opacity(0.72))
            +
            Text(" and ")
                .foregroundStyle(.white.opacity(0.5))
            +
            Text("Privacy Policy")
                .foregroundStyle(.white.opacity(0.72))
        )
        .font(.system(size: 12, weight: .regular))
        .lineSpacing(2)
        .lineLimit(2)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Apple plumbing (programmatic — mirrors SignupView's flow)

    private func startAppleSignIn() {
        errorMessage = nil
        let nonce = AppleNonce.random()
        currentNonce = nonce
        appleLoading = true
        appleCoordinator.start(nonceSHA256: AppleNonce.sha256Hex(nonce)) { result in
            Task { @MainActor in handleAppleCompletion(result) }
        }
    }

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        appleLoading = false
        switch result {
        case .success(let auth):
            guard
                let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else {
                errorMessage = "Apple sign-in returned no identity token."
                return
            }
            let nonce = currentNonce
            currentNonce = nil
            Task {
                await authStore.signInWithApple(idToken: idToken, nonce: nonce)
                if let raw = authStore.lastError {
                    errorMessage = raw
                    authStore.clearError()
                }
            }
        case .failure(let error):
            currentNonce = nil
            if let asError = error as? ASAuthorizationError, asError.code == .canceled { return }
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        LoginView()
    }
}
