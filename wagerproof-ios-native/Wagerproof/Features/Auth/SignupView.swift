// SignupView.swift
//
// Create-account form with email + password + confirm, plus Apple/Google
// social fallback. 1:1 port of `wagerproof-mobile/app/(auth)/signup.tsx`.
//
// Wired to `AuthStore.signUp(email:password:)`. After success the auth state
// listener routes the user. The RN code branches on whether a session is
// returned (auto-confirm vs email verification). We mirror by showing one of
// two success strings — the auto-route back to login on email-verification is
// preserved via a 3-second sleep.

import SwiftUI
import AuthenticationServices
import CryptoKit
import WagerproofDesign
import WagerproofStores

struct SignupView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var loading: Bool = false
    @State private var isPasswordVisible: Bool = false
    @State private var isConfirmVisible: Bool = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var currentNonce: String?
    @State private var googleLoading: Bool = false
    @State private var appleLoading: Bool = false
    @FocusState private var focused: Field?

    enum Field { case email, password, confirm }

    var body: some View {
        ZStack {
            AuthGradientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    backButton.padding(.bottom, 24)
                    logo.padding(.bottom, 32)
                    header.padding(.bottom, 36)
                    form.padding(.bottom, 32)
                    footer
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollIndicators(.hidden)
        }
        .preferredColorScheme(.dark)
        .navigationBarBackButtonHidden()
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.success, trigger: successMessage)
        .sensoryFeedback(.error, trigger: errorMessage)
        .sensoryFeedback(.selection, trigger: isPasswordVisible)
        .sensoryFeedback(.selection, trigger: isConfirmVisible)
    }

    // MARK: - Sub-views

    private var backButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        // Visual stays 40pt; tap area expands to 44pt (matches RN hitSlop).
        .contentShape(Rectangle())
        .frame(minWidth: 44, minHeight: 44)
        .disabled(loading)
        .accessibilityLabel("Back")
    }

    private var logo: some View {
        HStack {
            Spacer()
            // FIDELITY-WAIVER #004: wagerproofGreenDark.png asset not yet imported.
            HStack(spacing: 8) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Color(hex: 0x00BFA5))
                Text("WagerProof")
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(height: 50)
            Spacer()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Create Account")
                .font(.system(size: 32, weight: .heavy))
                .foregroundStyle(.white)
            Text("Get started with professional sports analytics")
                .font(.system(size: 16))
                .foregroundStyle(.white.opacity(0.5))
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Email
            AuthFieldRow(label: "Email", icon: "envelope") {
                TextField("", text: $email, prompt:
                    Text("you@example.com").foregroundStyle(.white.opacity(0.3)))
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($focused, equals: .email)
                    .foregroundStyle(.white)
                    .tint(Color(hex: 0x00BFA5))
                    .onChange(of: email) { _, _ in clearMessages() }
                    .onSubmit { focused = .password }
                    .disabled(loading || successMessage != nil)
            }

            // Password
            AuthFieldRow(label: "Password", icon: "lock") {
                Group {
                    if isPasswordVisible {
                        TextField("", text: $password, prompt:
                            Text("At least 8 characters").foregroundStyle(.white.opacity(0.3)))
                            .textContentType(.newPassword)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    } else {
                        SecureField("", text: $password, prompt:
                            Text("At least 8 characters").foregroundStyle(.white.opacity(0.3)))
                            .textContentType(.newPassword)
                    }
                }
                .submitLabel(.next)
                .focused($focused, equals: .password)
                .foregroundStyle(.white)
                .tint(Color(hex: 0x00BFA5))
                .onChange(of: password) { _, _ in clearMessages() }
                .onSubmit { focused = .confirm }
                .disabled(loading || successMessage != nil)
            } trailing: {
                Button {
                    isPasswordVisible.toggle()
                } label: {
                    Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                        .font(.system(size: 18))
                        .foregroundStyle(.white.opacity(0.4))
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                // Visual stays 32pt; tap area expands to 44pt (matches RN hitSlop).
                .contentShape(Rectangle())
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel(isPasswordVisible ? "Hide password" : "Show password")
            }

            // Confirm password
            AuthFieldRow(label: "Confirm Password", icon: "lock.shield") {
                Group {
                    if isConfirmVisible {
                        TextField("", text: $confirmPassword, prompt:
                            Text("Re-enter your password").foregroundStyle(.white.opacity(0.3)))
                            .textContentType(.newPassword)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    } else {
                        SecureField("", text: $confirmPassword, prompt:
                            Text("Re-enter your password").foregroundStyle(.white.opacity(0.3)))
                            .textContentType(.newPassword)
                    }
                }
                .submitLabel(.go)
                .focused($focused, equals: .confirm)
                .foregroundStyle(.white)
                .tint(Color(hex: 0x00BFA5))
                .onChange(of: confirmPassword) { _, _ in clearMessages() }
                .onSubmit { Task { await signUp() } }
                .disabled(loading || successMessage != nil)
            } trailing: {
                Button {
                    isConfirmVisible.toggle()
                } label: {
                    Image(systemName: isConfirmVisible ? "eye.slash" : "eye")
                        .font(.system(size: 18))
                        .foregroundStyle(.white.opacity(0.4))
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                // Visual stays 32pt; tap area expands to 44pt (matches RN hitSlop).
                .contentShape(Rectangle())
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel(isConfirmVisible ? "Hide password" : "Show password")
            }

            // Disclaimer
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.4))
                Text("By signing up, you confirm that you are 18+ and understand this platform is for analytics only.")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.4))
                    .lineSpacing(2)
            }

            if let error = errorMessage {
                AuthErrorBanner(message: error).transition(.opacity)
            }
            if let success = successMessage {
                AuthSuccessBanner(message: success).transition(.opacity)
            }

            // Create Account CTA
            Button {
                Task { await signUp() }
            } label: {
                ZStack {
                    if loading {
                        ProgressView().tint(.black)
                    } else {
                        Text("Create Account")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.black)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(RoundedRectangle(cornerRadius: 30).fill(.white))
            }
            .buttonStyle(.plain)
            .disabled(loading
                      || email.isEmpty
                      || password.isEmpty
                      || confirmPassword.isEmpty
                      || successMessage != nil)
            .opacity(formIncomplete ? 0.4 : 1.0)

            // Divider
            HStack(spacing: 12) {
                Rectangle().fill(.white.opacity(0.12)).frame(height: 1)
                Text("or continue with")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.4))
                Rectangle().fill(.white.opacity(0.12)).frame(height: 1)
            }
            .padding(.vertical, 4)

            // Social buttons
            VStack(spacing: 12) {
                SignInWithAppleButton(.continue, onRequest: { request in
                    let nonce = Self.makeRandomNonce()
                    currentNonce = nonce
                    request.requestedScopes = [.fullName, .email]
                    request.nonce = Self.sha256Hex(nonce)
                    appleLoading = true
                }, onCompletion: { result in
                    handleAppleCompletion(result)
                })
                .signInWithAppleButtonStyle(.white)
                .frame(height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 30))
                .disabled(loading || appleLoading || googleLoading || successMessage != nil)
                .opacity((loading || successMessage != nil) ? 0.4 : 1)

                SocialSignInButton(
                    provider: .google,
                    compact: false,
                    loading: googleLoading,
                    disabled: loading || appleLoading || successMessage != nil
                ) {
                    Task {
                        googleLoading = true
                        await authStore.signInWithGoogle()
                        googleLoading = false
                        if let raw = authStore.lastError {
                            errorMessage = raw
                            authStore.clearError()
                        }
                    }
                }
            }
        }
    }

    private var footer: some View {
        HStack(spacing: 0) {
            Spacer()
            Text("Already have an account? ")
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.4))
            Button {
                dismiss()
            } label: {
                Text("Sign In")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x00BFA5))
            }
            .buttonStyle(.plain)
            .disabled(loading)
            Spacer()
        }
    }

    // MARK: - State helpers

    private var formIncomplete: Bool {
        loading || email.isEmpty || password.isEmpty || confirmPassword.isEmpty || successMessage != nil
    }

    private func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    // MARK: - Actions

    private func validate() -> Bool {
        if email.trimmingCharacters(in: .whitespaces).isEmpty {
            errorMessage = "Please enter your email"; return false
        }
        if !email.contains("@") {
            errorMessage = "Please enter a valid email"; return false
        }
        if password.isEmpty {
            errorMessage = "Please enter a password"; return false
        }
        if password.count < 8 {
            errorMessage = "Password must be at least 8 characters"; return false
        }
        if password != confirmPassword {
            errorMessage = "Passwords do not match"; return false
        }
        return true
    }

    private func signUp() async {
        clearMessages()
        guard validate() else { return }
        loading = true
        await authStore.signUp(
            email: email.trimmingCharacters(in: .whitespaces),
            password: password
        )
        loading = false

        if let raw = authStore.lastError {
            errorMessage = Self.classify(raw: raw)
            authStore.clearError()
            return
        }

        // RN behaviour: if a session was created (auto-confirm), show "Setting
        // up your profile…" and let the auth listener route. Otherwise show
        // "check your email" and bounce back to login after 3s.
        if case .authenticated = authStore.phase {
            successMessage = "Account created! Setting up your profile..."
        } else {
            successMessage = "Account created! Please check your email to verify your account."
            email = ""; password = ""; confirmPassword = ""
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run { dismiss() }
            }
        }
    }

    /// Mirrors the RN classification:
    ///   "already registered" → "An account with this email already exists"
    static func classify(raw: String) -> String {
        if raw.localizedCaseInsensitiveContains("already registered") {
            return "An account with this email already exists"
        }
        return raw
    }

    // MARK: - Apple plumbing

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

    private static func makeRandomNonce(length: Int = 32) -> String {
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

// MARK: - Success banner

struct AuthSuccessBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 18))
                .foregroundStyle(Color(hex: 0x00BFA5))
            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color(hex: 0x00BFA5))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: 0x00BFA5).opacity(0.12))
        )
    }
}
