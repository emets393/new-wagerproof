import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels

/// Sportsbook mark keyed by the book on screen.
///
/// Images live in the app bundle (`sportsbook_<book_key>`). The catalog
/// tables still own names/keys so Outliers can remap FanDuel → DraftKings
/// without keeping the previous book's mark. Remote `logo_url` values in
/// those tables currently point at a dead Clearbit host — we do not wait
/// on them to draw a chip.
struct SportsbookLogoView: View {
    enum Style {
        case compact
        case regular
    }

    let logoURL: String?
    let bookKey: String?
    let bookName: String?
    var style: Style = .compact

    var body: some View {
        Group {
            if let ui = bundledLogo {
                bookLogoImage(Image(uiImage: ui))
            } else if let url = remoteURL {
                CachedAsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        bookLogoImage(image)
                    case .empty:
                        loadingPlaceholder
                    default:
                        bookFallbackLogo
                    }
                }
            } else {
                bookFallbackLogo
            }
        }
        .id(resolvedKey ?? bookName ?? logoURL ?? "book")
    }

    private var resolvedKey: String? {
        bookKey?.lowercased() ?? SportsbookCatalog.key(forDisplayName: bookName)
    }

    private var bundledLogo: UIImage? {
        guard let key = resolvedKey else { return nil }
        return UIImage(named: "sportsbook_\(key)")
    }

    private var remoteURL: URL? {
        if let key = resolvedKey, let fromTable = SportsbookCatalog.logoURL(for: key),
           let url = URL(string: fromTable), !fromTable.contains("logo.clearbit.com") {
            return url
        }
        if let logoURL, !logoURL.contains("logo.clearbit.com"), let url = URL(string: logoURL) {
            return url
        }
        return nil
    }

    private var loadingPlaceholder: some View {
        ProgressView()
            .scaleEffect(0.55)
            .frame(width: frameSize, height: frameSize)
    }

    private func bookLogoImage(_ image: Image) -> some View {
        image
            .resizable()
            .scaledToFit()
            .frame(width: imageSize, height: imageSize)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var bookFallbackLogo: some View {
        Text(String((bookName ?? "B").prefix(1)).uppercased())
            .font(.system(size: style == .compact ? 10 : 13, weight: .black))
            .foregroundStyle(Color.appSurface)
            .frame(width: fallbackFrameSize, height: fallbackFrameSize)
            .background(Color.appTextPrimary, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var imageSize: CGFloat { style == .compact ? 18 : 30 }
    private var frameSize: CGFloat { style == .compact ? 22 : 38 }
    private var cornerRadius: CGFloat { style == .compact ? 5 : 8 }
    private var fallbackFrameSize: CGFloat { style == .compact ? 22 : 38 }
}

#Preview {
    HStack(spacing: 12) {
        SportsbookLogoView(
            logoURL: nil,
            bookKey: "draftkings",
            bookName: "DraftKings",
            style: .compact
        )
        SportsbookLogoView(
            logoURL: nil,
            bookKey: "fanduel",
            bookName: "FanDuel",
            style: .regular
        )
    }
    .padding()
    .background(Color.appSurface)
}
