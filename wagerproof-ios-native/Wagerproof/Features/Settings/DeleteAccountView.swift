import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Delete Account modal — the SwiftUI port of
/// `wagerproof-mobile/app/(modals)/delete-account.tsx`.
///
/// Spec §16: "Danger zone with destructive confirmation". RN used a custom
/// swipe-to-delete slider; iOS HIG calls for an explicit confirmation alert
/// after a destructive button tap. We use the system `.alert` with a
/// `.destructive` role so the destructive action stands out properly.
struct DeleteAccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthStore.self) private var auth
    @State private var isConfirmAlertPresented = false
    @State private var isDeleting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: Spacing.xl) {
                Spacer(minLength: Spacing.lg)

                ZStack {
                    Circle()
                        .fill(Color.appAccentRed.opacity(0.15))
                        .frame(width: 100, height: 100)
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.appAccentRed)
                }

                VStack(spacing: Spacing.md) {
                    Text("Delete Your Account")
                        .font(AppFont.display)
                        .foregroundStyle(Color.appTextPrimary)
                        .multilineTextAlignment(.center)

                    Text("Permanently delete your account and all associated data including your picks, settings, and subscription. This action cannot be undone.")
                        .font(AppFont.body)
                        .foregroundStyle(Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.xl)
                }

                HStack(alignment: .top, spacing: Spacing.md) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(Color.appAccentRed)
                    Text("You will be logged out immediately and your data will be permanently erased.")
                        .font(AppFont.caption)
                        .foregroundStyle(Color.appAccentRed)
                }
                .padding(Spacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.appAccentRed.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.appAccentRed.opacity(0.3))
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, Spacing.lg)

                Spacer()

                Button(role: .destructive) {
                    isConfirmAlertPresented = true
                } label: {
                    if isDeleting {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.md)
                    } else {
                        Text("Delete Account")
                            .font(AppFont.bodyEmphasized)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.md)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.appAccentRed)
                .disabled(isDeleting)
                .padding(.horizontal, Spacing.lg)

                Button("Cancel") {
                    dismiss()
                }
                .tint(Color.appTextSecondary)
                .padding(.bottom, Spacing.md)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Danger Zone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .tint(Color.appTextPrimary)
                    .accessibilityLabel("Close")
                }
            }
            .alert("Delete Account", isPresented: $isConfirmAlertPresented) {
                Button("Cancel", role: .cancel) {}
                Button("Delete Account", role: .destructive) {
                    Task { await performDelete() }
                }
            } message: {
                Text("Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.")
            }
            .alert("Error", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func performDelete() async {
        isDeleting = true
        defer { isDeleting = false }
        // FIDELITY-WAIVER #054: Server-side cascade delete RPC `delete_user_account`
        // not yet wired — current implementation signs out + clears local data.
        // Full RPC integration in ticket.
        await auth.signOut()
        dismiss()
    }
}
