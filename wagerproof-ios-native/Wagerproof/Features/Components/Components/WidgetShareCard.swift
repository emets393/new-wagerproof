import SwiftUI
import UIKit
import WagerproofDesign

/// The image a widget's Share button produces: the card's icon + title, which
/// game it is about, its headline sentence, and a WagerProof footer.
/// See `.claude/docs/34_widget_votes_share.md` §5.
///
/// WHY THIS IS NOT A SNAPSHOT OF THE LIVE CARD: `ImageRenderer` draws a fresh
/// copy of a view OUTSIDE the view hierarchy. A widget body re-rendered that
/// way loses its environment stores (non-optional `@Environment` reads trap),
/// its `@State`, its `.task`-loaded data, any async-loaded logo, and anything
/// inside a ScrollView or Liquid Glass. So this card is a pure function of
/// plain values the shell already holds — it cannot render blank and cannot
/// crash. Every colour is a fixed hex (not an adaptive token) so the image
/// looks the same whatever theme the phone is in.
struct WidgetShareCard: View {
    let title: String
    let systemImage: String
    let iconTint: Color
    let matchup: String
    let headline: String

    static let width: CGFloat = 360

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(iconTint)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(iconTint.opacity(0.18)))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color(hex: 0xF8FAFC))
                        .lineLimit(1)
                    if !matchup.isEmpty {
                        Text(matchup)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color(hex: 0x94A3B8))
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }

            Text(headline)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Color(hex: 0xF8FAFC))
                .fixedSize(horizontal: false, vertical: true)

            Rectangle()
                .fill(Color(hex: 0x262626))
                .frame(height: 1)

            HStack(spacing: 8) {
                // Bundled asset, so it is present synchronously — a remote
                // image would render blank under ImageRenderer.
                Image("WagerproofLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
                Text("WagerProof")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color(hex: 0xF8FAFC))
                Spacer(minLength: 8)
                Text("wagerproof.bet")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color(hex: 0x22C55E))
            }
        }
        .padding(20)
        .frame(width: Self.width, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(hex: 0x0F1115))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(Color(hex: 0x262626), lineWidth: 1)
        )
        // Transparent margin so the rounded corners survive in apps that
        // composite the image onto their own bubble.
        .padding(12)
    }

    /// 3x PNG-ready image, transparent outside the rounded card.
    @MainActor
    static func render(_ card: WidgetShareCard) -> UIImage? {
        let renderer = ImageRenderer(content: card.environment(\.colorScheme, .dark))
        renderer.scale = 3
        renderer.isOpaque = false
        return renderer.uiImage
    }
}

/// Presents the system share sheet from wherever the user is.
///
/// Through UIKit on purpose: game detail lives inside a `.fullScreenCover`, and
/// a SwiftUI `.sheet` wrapping `UIActivityViewController` there tears the cover
/// down (the same reason `AgentPickFocusView` presents this way).
enum ActivitySharePresenter {
    @MainActor
    static func present(items: [Any], onComplete: @escaping @MainActor (Bool) -> Void) {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, _ in
            Task { @MainActor in onComplete(completed) }
        }
        guard let presenter = topMostViewController() else { return }
        // iPad requires an anchor or UIKit raises; centre it with no arrow.
        if let popover = controller.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        presenter.present(controller, animated: true)
    }

    @MainActor
    private static func topMostViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
            ?? scenes.first as? UIWindowScene
        guard let window = windowScene?.windows.first(where: \.isKeyWindow) ?? windowScene?.windows.first,
              var top = window.rootViewController else { return nil }
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}

#Preview("Widget share card") {
    WidgetShareCard(
        title: "Moneyline Prediction",
        systemImage: "dollarsign.circle.fill",
        iconTint: .appPrimary,
        matchup: "NO @ CHI",
        headline: "Full game: Bears need to win 85.4% of the time to break even at -585, but the model only has them at 81.2% — 4.2 points short."
    )
    .background(Color.black)
}
