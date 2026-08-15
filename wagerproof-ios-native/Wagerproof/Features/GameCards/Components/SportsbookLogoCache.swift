import SwiftUI
import UIKit
import WagerproofModels

/// Circle-cropped book logos held as `UIImage`s, for the places SwiftUI can't
/// load one asynchronously.
///
/// `SportsbookLogoView` is the right tool almost everywhere — it streams the
/// favicon and falls back to a letter tile. But a SwiftUI `Menu` is rendered by
/// UIKit as a `UIMenu`, and UIKit resolves a menu item's image ONCE at build
/// time: an async image simply never appears. So the settings picker prefetches
/// its ten logos here and hands the menu real `UIImage`s.
///
/// Cropping happens at render time rather than with `.clipShape` because a menu
/// item's icon isn't a view we can mask — the circle has to be baked into the
/// bitmap.
@MainActor
@Observable
final class SportsbookLogoCache {
    static let shared = SportsbookLogoCache()

    private(set) var images: [String: UIImage] = [:]
    private var inFlight: Set<String> = []

    private init() {}

    func image(for bookKey: String) -> UIImage? { images[bookKey] }

    /// Fire-and-forget. Failures are silent — the menu falls back to text-only
    /// rows, which is a degraded label rather than a broken one.
    func prefetch(_ bookKeys: [String], diameter: CGFloat = 22) {
        for key in bookKeys where images[key] == nil && !inFlight.contains(key) {
            guard let url = SportsbookDomainResolver.fallbackURL(
                bookKey: key,
                bookName: SportsbookCatalog.name(for: key),
                logoURL: nil
            ) else { continue }

            inFlight.insert(key)
            Task { [weak self] in
                defer { Task { @MainActor in self?.inFlight.remove(key) } }
                guard let data = try? await URLSession.shared.data(from: url).0,
                      let raw = UIImage(data: data)
                else { return }
                let circular = Self.circleCropped(raw, diameter: diameter)
                await MainActor.run { self?.images[key] = circular }
            }
        }
    }

    /// Favicons arrive square and edge-to-edge, so they're inset slightly before
    /// clipping — otherwise the logo's own corners get shaved by the circle.
    ///
    /// Rendered on a TRANSPARENT canvas (`opaque = false`, no fill): a white
    /// disc behind each logo read as a hard white dot against the dark menu.
    /// Books whose own mark is white-on-transparent still show, because the menu
    /// tints nothing — the image is drawn `.original`.
    private static func circleCropped(_ image: UIImage, diameter: CGFloat) -> UIImage {
        let size = CGSize(width: diameter, height: diameter)
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 0
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { context in
            let bounds = CGRect(origin: .zero, size: size)
            context.cgContext.addEllipse(in: bounds)
            context.cgContext.clip()
            let inset = diameter * 0.06
            image.draw(in: bounds.insetBy(dx: inset, dy: inset))
        }
    }
}
