import SwiftUI
import WagerproofDesign

/// Sportsbook logo badge used by NFL/CFB game sheets and Outliers betting chips.
/// Loads the primary logo URL when present, falls back to a DuckDuckGo favicon
/// resolved from book key/name, then a letter placeholder.
struct SportsbookLogoView: View {
    enum Style {
        /// CFB market rows and Outliers chips — 18×18 image in a white badge.
        case compact
        /// NFL best-book row — 30×30 image with dark-mode-aware background.
        case regular
    }

    let logoURL: String?
    let bookKey: String?
    let bookName: String?
    var style: Style = .compact

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        if let logoURL, let imageURL = URL(string: logoURL) {
            AsyncImage(url: imageURL) { phase in
                switch phase {
                case .success(let image):
                    bookLogoImage(image)
                case .failure:
                    fallbackSportsbookLogo
                case .empty:
                    loadingPlaceholder
                @unknown default:
                    fallbackSportsbookLogo
                }
            }
        } else {
            fallbackSportsbookLogo
        }
    }

    @ViewBuilder
    private var fallbackSportsbookLogo: some View {
        if let fallbackURL = SportsbookDomainResolver.fallbackURL(
            bookKey: bookKey,
            bookName: bookName,
            logoURL: logoURL
        ) {
            AsyncImage(url: fallbackURL) { phase in
                switch phase {
                case .success(let image):
                    bookLogoImage(image)
                default:
                    bookFallbackLogo
                }
            }
        } else {
            bookFallbackLogo
        }
    }

    private var loadingPlaceholder: some View {
        ProgressView()
            .scaleEffect(0.55)
            .frame(width: style == .compact ? 22 : 30, height: style == .compact ? 22 : 30)
            .padding(style == .regular ? 4 : 0)
            .background(logoBackground, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private func bookLogoImage(_ image: Image) -> some View {
        image
            .resizable()
            .scaledToFit()
            .frame(width: imageSize, height: imageSize)
            .padding(imagePadding)
            .background(logoBackground, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var bookFallbackLogo: some View {
        Text(String((bookName ?? "B").prefix(1)).uppercased())
            .font(.system(size: style == .compact ? 10 : 13, weight: .black))
            .foregroundStyle(Color.appSurface)
            .frame(width: fallbackFrameSize, height: fallbackFrameSize)
            .background(Color.appTextPrimary, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var imageSize: CGFloat { style == .compact ? 18 : 30 }
    private var imagePadding: CGFloat { style == .compact ? 2 : 4 }
    private var cornerRadius: CGFloat { style == .compact ? 5 : 8 }
    private var fallbackFrameSize: CGFloat { style == .compact ? 22 : 38 }

    private var logoBackground: Color {
        style == .compact
            ? Color.white
            : Color.white.opacity(colorScheme == .dark ? 0.92 : 1)
    }
}

enum SportsbookDomainResolver {
    static func fallbackURL(bookKey: String?, bookName: String?, logoURL: String?) -> URL? {
        guard let domain = domain(bookKey: bookKey, bookName: bookName, logoURL: logoURL) else { return nil }
        return URL(string: "https://icons.duckduckgo.com/ip3/\(domain).ico")
            ?? URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=64")
    }

    static func domain(bookKey: String?, bookName: String?, logoURL: String?) -> String? {
        if let key = bookKey?.lowercased() {
            switch key {
            case "draftkings": return "draftkings.com"
            case "fanduel": return "fanduel.com"
            case "betmgm": return "betmgm.com"
            case "betrivers": return "betrivers.com"
            case "williamhill_us": return "caesars.com"
            case "espnbet": return "espnbet.com"
            case "fanatics": return "fanatics.com"
            case "bet365": return "bet365.com"
            case "bovada": return "bovada.lv"
            case "betonlineag": return "betonline.ag"
            case "mybookieag": return "mybookie.ag"
            case "betus": return "betus.com.pa"
            case "lowvig": return "lowvig.ag"
            default: break
            }
        }
        if let name = bookName?.lowercased() {
            if name.contains("draftkings") { return "draftkings.com" }
            if name.contains("fanduel") { return "fanduel.com" }
            if name.contains("betmgm") { return "betmgm.com" }
            if name.contains("betrivers") { return "betrivers.com" }
            if name.contains("caesars") { return "caesars.com" }
            if name.contains("espn") { return "espnbet.com" }
            if name.contains("fanatics") { return "fanatics.com" }
            if name.contains("bovada") { return "bovada.lv" }
            if name.contains("betonline") { return "betonline.ag" }
            if name.contains("mybookie") { return "mybookie.ag" }
            if name.contains("betus") { return "betus.com.pa" }
        }
        if let logoURL, let host = URL(string: logoURL)?.host, !host.isEmpty {
            return host
        }
        return nil
    }
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
