// SignupView.swift
//
// Create-account form with email + password + confirm, plus Apple/Google
// social fallback. Wired to `AuthStore.signUp(email:password:)`. After success
// the auth state listener routes the user; on email-verification we show a
// "check your email" message and bounce back to login after 3s.
//
// Visual: shared pixel-glyph gate background, left-aligned minimalist logo +
// header, Liquid Glass input rows + CTA, and the shared Apple/Google sign-in
// pills (matching the welcome gate).

import SwiftUI
import AuthenticationServices
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
    @State private var appleCoordinator = AppleSignInCoordinator()
    @FocusState private var focused: Field?

    enum Field { case email, password, confirm }

    private var anyLoading: Bool { loading || googleLoading || appleLoading }
    private var formIncomplete: Bool {
        loading || email.isEmpty || password.isEmpty || confirmPassword.isEmpty || successMessage != nil
    }

    var body: some View {
        ZStack {
            AuthGateBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    topBar.padding(.bottom, 28)

                    Image("WagerproofLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40, height: 40)
                        .padding(.bottom, 18)
                        .accessibilityHidden(true)

                    header.padding(.bottom, 28)
                    form
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
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
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .liquidGlassBackground(in: Circle())
        }
        .buttonStyle(.plain)
        // Visual stays 40pt; tap area expands to 44pt (matches RN hitSlop).
        .contentShape(Rectangle())
        .frame(minWidth: 44, minHeight: 44)
        .disabled(loading)
        .accessibilityLabel("Back")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Create account")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(.white)
            Text("Get started with professional sports analytics")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.6))
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 16) {
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
                    .tint(.appPrimary)
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
                .tint(.appPrimary)
                .onChange(of: password) { _, _ in clearMessages() }
                .onSubmit { focused = .confirm }
                .disabled(loading || successMessage != nil)
            } trailing: {
                visibilityToggle(isOn: $isPasswordVisible)
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
                .tint(.appPrimary)
                .onChange(of: confirmPassword) { _, _ in clearMessages() }
                .onSubmit { Task { await signUp() } }
                .disabled(loading || successMessage != nil)
            } trailing: {
                visibilityToggle(isOn: $isConfirmVisible)
            }

            // Disclaimer
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.4))
                Text("By signing up, you confirm that you are 18+ and understand this platform is for analytics only.")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.4))
                    .lineSpacing(2)
            }
            .padding(.top, 2)

            if let error = errorMessage {
                AuthErrorBanner(message: error).transition(.opacity)
            }
            if let success = successMessage {
                AuthSuccessBanner(message: success).transition(.opacity)
            }

            // Create Account CTA
            LiquidGlassPillButton(
                title: "Create Account",
                loading: loading,
                isEnabled: !formIncomplete
            ) {
                Task { await signUp() }
            }
            .padding(.top, 4)

            divider

            // Social fallback — same pills as the welcome gate.
            appleButton
            googleButton
        }
        .animation(.easeInOut(duration: 0.2), value: errorMessage)
        .animation(.easeInOut(duration: 0.2), value: successMessage)
    }

    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(.white.opacity(0.12)).frame(height: 1)
            Text("or continue with")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.4))
            Rectangle().fill(.white.opacity(0.12)).frame(height: 1)
        }
        .padding(.vertical, 4)
    }

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
        .disabled(anyLoading || successMessage != nil)
        .opacity((anyLoading && !appleLoading) || successMessage != nil ? 0.6 : 1)
    }

    private var googleButton: some View {
        Button {
            Task {
                clearMessages()
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
                Text("G")
                    .font(.system(size: 15, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(PillPressStyle())
        .disabled(anyLoading || successMessage != nil)
        .opacity((anyLoading && !googleLoading) || successMessage != nil ? 0.6 : 1)
    }

    /// Back button on the left and the "Already have an account? Sign In" link
    /// on the right — kept at the top so users who meant to sign in don't have
    /// to scroll past the whole form to find it.
    private var topBar: some View {
        HStack(spacing: 8) {
            backButton
            Spacer(minLength: 8)
            HStack(spacing: 4) {
                Text("Already have an account?")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.5))
                Button {
                    dismiss()
                } label: {
                    Text("Sign In")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                }
                .buttonStyle(.plain)
                .disabled(loading)
            }
        }
    }

    private func visibilityToggle(isOn: Binding<Bool>) -> some View {
        Button {
            isOn.wrappedValue.toggle()
        } label: {
            Image(systemName: isOn.wrappedValue ? "eye.slash" : "eye")
                .font(.system(size: 17))
                .foregroundStyle(.white.opacity(0.45))
                .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)
        // Visual stays 32pt; tap area expands to 44pt (matches RN hitSlop).
        .contentShape(Rectangle())
        .frame(minWidth: 44, minHeight: 44)
        .accessibilityLabel(isOn.wrappedValue ? "Hide password" : "Show password")
    }

    // MARK: - State helpers

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

    // MARK: - Apple plumbing (programmatic)

    private func startAppleSignIn() {
        clearMessages()
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

// MARK: - Success banner

struct AuthSuccessBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 18))
                .foregroundStyle(Color.appPrimary)
            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.appPrimary.opacity(0.12))
        )
    }
}
