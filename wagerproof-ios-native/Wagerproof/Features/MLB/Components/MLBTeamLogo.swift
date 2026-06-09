import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Team logo with an image-or-fallback gradient circle + initials. Mirrors
/// RN `TeamLogo` in MLBGameCard.tsx. Used by the MLB bottom sheet, the
/// betting trends sheet, and the trends situation section — extracted out
/// of `MLBGameCard.swift` when the home feed switched to the shared
/// `GameRowCard` (which handles avatar rendering itself).
struct MLBTeamLogo: View {
    let logoUrl: String?
    let abbrev: String
    let name: String
    var size: CGFloat = 42

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let pair = MLBTeams.colors(for: name.isEmpty ? abbrev : name)
        let primary = Color(hex: Int(pair.primary))
        let secondary = Color(hex: Int(pair.secondary))
        // Same faint contrast lift as the game-list avatars: logos are usually
        // the team primary, so a same-color logo blends into the team-color
        // disc. When it would, drop a very faint opposite-luminance wash behind
        // the logo — just enough to separate it, keeping the team color visible.
        let plate = logoContrastPlate(for: primary)

        ZStack {
            LinearGradient(
                colors: [primary, secondary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(primary, lineWidth: 2))

            if let urlString = logoUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        ZStack {
                            if let plate {
                                Circle().fill(plate).padding(size * 0.08)
                            }
                            image.resizable().scaledToFit()
                        }
                    default:
                        Text(abbrev)
                            .font(.system(size: size * 0.32, weight: .bold))
                            .foregroundStyle(contrastingText(primary: pair.primary))
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                Text(abbrev)
                    .font(.system(size: size * 0.32, weight: .bold))
                    .foregroundStyle(contrastingText(primary: pair.primary))
            }
        }
        .frame(width: size, height: size)
    }

    /// Faint plate to separate a same-color logo from the team-color disc.
    /// Matches `GameRowCard`'s avatar treatment (shares `Color.relativeLuminance`).
    private func logoContrastPlate(for primary: Color) -> Color? {
        let lum = primary.relativeLuminance
        switch colorScheme {
        case .dark:
            return lum < 0.45 ? Color(white: 0.78).opacity(0.15) : nil
        default:
            return lum > 0.6 ? Color.black.opacity(0.55) : nil
        }
    }

    /// Mirrors RN `getContrastingTextColor` — luminance threshold of 0.5.
    private func contrastingText(primary: UInt32) -> Color {
        let r = Double((primary >> 16) & 0xFF) / 255
        let g = Double((primary >> 8) & 0xFF) / 255
        let b = Double(primary & 0xFF) / 255
        let lum = 0.299 * r + 0.587 * g + 0.114 * b
        return lum > 0.5 ? .black : .white
    }
}

/// Shared MLB-specific formatting helpers. Mirrors `types/mlb.ts`. Used by
/// the bottom sheet, betting trends sheet, and the row card; extracted out
/// of `MLBGameCard.swift` so the trimmed home-feed wrapper can stay
/// focused on adapting to `GameRowCard`.
enum MLBFormatting {
    static func moneyline(_ ml: Int?) -> String {
        guard let ml else { return "-" }
        return ml > 0 ? "+\(ml)" : "\(ml)"
    }

    static func spread(_ s: Double?) -> String {
        guard let s, !s.isNaN else { return "-" }
        let body: String = (s == s.rounded()) ? "\(Int(s))" : String(format: "%.1f", s)
        return s > 0 ? "+\(body)" : body
    }

    static func line(_ value: Double?) -> String {
        guard let value else { return "-" }
        if value == value.rounded() { return "\(Int(value))" }
        return String(format: "%.1f", value)
    }

    /// Mirrors RN `formatMLBDateLabel`: short weekday + month + day from
    /// `YYYY-MM-DD`.
    static func dateLabel(_ raw: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "America/New_York")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: raw) else { return raw }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "EEE, MMM d"
        return fmt.string(from: date)
    }

    /// Mirrors RN `formatMLBGameTime` — parses ISO UTC, formats `h:mm a ET`.
    static func gameTime(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "TBD" }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: raw) ?? {
            iso.formatOptions = [.withInternetDateTime]
            return iso.date(from: raw)
        }()
        guard let date else { return "TBD" }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "h:mm a"
        return fmt.string(from: date) + " ET"
    }
}
