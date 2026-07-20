import SwiftUI
import UIKit

/// Static front-idle frame from the same eight pixel-office sprite sheets used
/// in the app. Widgets render archived SwiftUI snapshots, so a crisp frozen
/// pose is both cheaper and more reliable than attempting an animation loop.
struct WidgetPixelAvatar: View {
    let spriteIndex: Int

    var body: some View {
        Group {
            if let image = Self.image(for: spriteIndex) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "person.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(WidgetPalette.textMuted)
                    .padding(12)
            }
        }
        .accessibilityHidden(true)
    }

    @MainActor private static var cache: [Int: UIImage] = [:]

    @MainActor
    private static func image(for index: Int) -> UIImage? {
        let safeIndex = max(0, min(7, index))
        if let cached = cache[safeIndex] { return cached }
        guard let sheet = UIImage(
            named: "avatar_\(safeIndex)",
            in: .main,
            compatibleWith: nil
        ), let cgImage = sheet.cgImage else { return nil }

        // Sprite sheets are 8 columns × 9 rows; frame zero is front-idle.
        let frame = CGRect(
            x: 0,
            y: 0,
            width: cgImage.width / 8,
            height: cgImage.height / 9
        )
        guard let cropped = cgImage.cropping(to: frame) else { return nil }
        let image = UIImage(cgImage: cropped, scale: sheet.scale, orientation: .up)
        cache[safeIndex] = image
        return image
    }
}
