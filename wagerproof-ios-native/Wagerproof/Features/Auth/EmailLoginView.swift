// EmailLoginView.swift
//
// Email + password sign-in form. 1:1 port of
// `wagerproof-mobile/app/(auth)/email-login.tsx`.
//
// Wired to `AuthStore.signIn(email:password:)`. Error classification matches
// the RN strings verbatim:
//   - "Invalid login credentials" → "Invalid email or password"
//   - "Email not confirmed"       → "Please verify your email before signing in"
//   - else                        → raw error.message
//
// Visual: ScrollView + VStack, teal-to-black background gradient,
// custom circular back button, styled text-field rows, white pill CTA.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct EmailLoginView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(\.dismiss) private var dismiss

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var loading: Bool = false
    @State private var isPasswordVisible: Bool = false
    @State private var errorMessage: String?
    @State private var signInTapCount: Int = 0
    @FocusState private var focused: Field?

    enum Field { case email, password }

    var body: some View {
        ZStack {
            AuthGradientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    backButton
                        .padding(.bottom, 24)

                    logo
                        .padding(.bottom, 32)

                    header
                        .padding(.bottom, 36)

                    form
                        .padding(.bottom, 32)

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
        .sensoryFeedback(.selection, trigger: focused)
        .sensoryFeedback(.impact(weight: .light), trigger: signInTapCount)
        .sensoryFeedback(.success, trigger: authStore.lastSuccessAt)
        .sensoryFeedback(.error, trigger: errorMessage)
        .sensoryFeedback(.selection, trigger: isPasswordVisible)
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
            Text("Welcome Back")
                .font(.system(size: 32, weight: .heavy))
                .foregroundStyle(.white)
            Text("Sign in with your email")
                .font(.system(size: 16))
                .foregroundStyle(.white.opacity(0.5))
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Email
            AuthFieldRow(
                label: "Email",
                icon: "envelope",
                isError: errorMessage != nil && password.isEmpty && email.isEmpty
            ) {
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
                    .onChange(of: email) { _, _ in errorMessage = nil }
                    .onSubmit { focused = .password }
                    .disabled(loading)
            }

            // Password
            AuthFieldRow(label: "Password", icon: "lock") {
                Group {
                    if isPasswordVisible {
                        TextField("", text: $password, prompt:
                            Text("Enter your password").foregroundStyle(.white.opacity(0.3)))
                            .textContentType(.password)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    } else {
                        SecureField("", text: $password, prompt:
                            Text("Enter your password").foregroundStyle(.white.opacity(0.3)))
                            .textContentType(.password)
                    }
                }
                .submitLabel(.go)
                .focused($focused, equals: .password)
                .foregroundStyle(.white)
                .tint(Color(hex: 0x00BFA5))
                .onChange(of: password) { _, _ in errorMessage = nil }
                .onSubmit { Task { await signIn() } }
                .disabled(loading)
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

            // Forgot password link
            HStack {
                Spacer()
                NavigationLink(value: AuthRoute.forgotPassword) {
                    Text("Forgot Password?")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color(hex: 0x00BFA5))
                }
                .buttonStyle(.plain)
                .disabled(loading)
            }
            .padding(.top, -8)

            // Inline error banner
            if let error = errorMessage {
                AuthErrorBanner(message: error)
                    .transition(.opacity)
            }

            // Sign-in CTA
            Button {
                signInTapCount += 1
                Task { await signIn() }
            } label: {
                ZStack {
                    if loading {
                        ProgressView().tint(.black)
                    } else {
                        Text("Sign In")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.black)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(RoundedRectangle(cornerRadius: 30).fill(.white))
            }
            .buttonStyle(.plain)
            .disabled(loading || email.isEmpty || password.isEmpty)
            .opacity((loading || email.isEmpty || password.isEmpty) ? 0.4 : 1.0)
            .animation(.easeInOut(duration: 0.2), value: errorMessage)
        }
    }

    private var footer: some View {
        HStack(spacing: 0) {
            Spacer()
            Text("Don't have an account? ")
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.4))
            NavigationLink(value: AuthRoute.signup) {
                Text("Sign Up")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x00BFA5))
            }
            .buttonStyle(.plain)
            .disabled(loading)
            Spacer()
        }
    }

    // MARK: - Actions

    private func validate() -> Bool {
        if email.trimmingCharacters(in: .whitespaces).isEmpty {
            errorMessage = "Please enter your email"
            return false
        }
        if !email.contains("@") {
            errorMessage = "Please enter a valid email"
            return false
        }
        if password.isEmpty {
            errorMessage = "Please enter your password"
            return false
        }
        return true
    }

    private func signIn() async {
        errorMessage = nil
        guard validate() else { return }
        loading = true
        await authStore.signIn(
            email: email.trimmingCharacters(in: .whitespaces),
            password: password
        )
        loading = false
        if let raw = authStore.lastError {
            errorMessage = Self.classify(raw: raw)
            authStore.clearError()
        }
    }

    /// Mirrors the RN classification verbatim.
    static func classify(raw: String) -> String {
        if raw.localizedCaseInsensitiveContains("Invalid login credentials") {
            return "Invalid email or password"
        }
        if raw.localizedCaseInsensitiveContains("Email not confirmed") {
            return "Please verify your email before signing in"
        }
        return raw
    }
}

// MARK: - Shared auth field row

struct AuthFieldRow<Field: View, Trailing: View>: View {
    let label: String
    let icon: String
    var isError: Bool = false
    @ViewBuilder var field: () -> Field
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))

            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundStyle(.white.opacity(0.4))
                    .frame(width: 20)
                field()
                    .frame(maxWidth: .infinity)
                trailing()
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(.white.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isError ? Color(hex: 0xFF6B6B) : .white.opacity(0.12), lineWidth: 1)
            )
        }
    }
}

extension AuthFieldRow where Trailing == EmptyView {
    init(label: String,
         icon: String,
         isError: Bool = false,
         @ViewBuilder field: @escaping () -> Field) {
        self.label = label
        self.icon = icon
        self.isError = isError
        self.field = field
        self.trailing = { EmptyView() }
    }
}

// MARK: - Inline error banner

struct AuthErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 18))
                .foregroundStyle(Color(hex: 0xFF6B6B))
            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color(hex: 0xFF6B6B))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: 0xFF6B6B).opacity(0.12))
        )
    }
}

// MARK: - Shared gradient background

struct AuthGradientBackground: View {
    var body: some View {
        LinearGradient(
            stops: [
                .init(color: Color(hex: 0x00BFA5).opacity(0.15), location: 0),
                .init(color: .black.opacity(0.95), location: 0.4),
                .init(color: .black, location: 1)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
}
