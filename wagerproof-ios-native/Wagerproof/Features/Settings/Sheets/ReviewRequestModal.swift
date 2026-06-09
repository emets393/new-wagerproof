import SwiftUI
import WagerproofDesign
#if canImport(StoreKit)
import StoreKit
#endif

/// Review-request modal — port of `wagerproof-mobile/components/ReviewRequestModal.tsx`.
///
/// Strategy difference: RN had to gate on `expo-store-review.isAvailableAsync()`
/// because Android may not surface a native review API; iOS always has
/// `SKStoreReviewController.requestReview(in:)`. We call it directly from the
/// "Yes, I'd love to!" button so the OS handles rate-limiting + sheet
/// presentation (Apple throttles to ~3 requests/year per app version).
struct ReviewRequestModal: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.requestReview) private var requestReview

    var body: some View {
        VStack(spacing: Spacing.xl) {
            ZStack {
                Circle()
                    .fill(Color.appPrimary.opacity(0.15))
                    .frame(width: 84, height: 84)
                Image(systemName: "bubble.left.and.text.bubble.right.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(Color.appPrimary)
            }
            .padding(.top, Spacing.xl)

            VStack(spacing: Spacing.sm) {
                Text("Would you leave us some early feedback?")
                    .font(AppFont.title)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.appTextPrimary)

                Text("Your feedback helps us build a better app for you!")
                    .font(AppFont.body)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.lg)

            VStack(spacing: Spacing.md) {
                Button {
                    handleYes()
                } label: {
                    Text("Yes, I'd love to!")
                        .font(AppFont.bodyEmphasized)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.appPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                Button {
                    dismiss()
                } label: {
                    Text("Not now")
                        .font(AppFont.bodyEmphasized)
                        .foregroundStyle(Color.appTextPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.appBorderStrong)
                        )
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.lg)
        }
        .background(Color.appSurface)
        .presentationDetents([.height(420)])
        .presentationDragIndicator(.visible)
        .sensoryFeedback(.success, trigger: false)
    }

    private func handleYes() {
        #if canImport(StoreKit)
        // SwiftUI's @Environment(\.requestReview) chooses the right APIs based
        // on iOS version and respects Apple's rate-limit. Fire and forget.
        requestReview()
        #endif
        dismiss()
    }
}
