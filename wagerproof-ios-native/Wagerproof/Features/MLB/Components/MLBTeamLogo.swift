import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Team logo on a team-tinted disc, with an abbreviation fallback. Mirrors
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
        // Disc is a neutral surface washed with the team's PRIMARY only. A
        // primary→secondary gradient filled half the disc with the team's
        // secondary (STL navy behind a red logo), which reads as another
        // team's background sitting behind the logo.
        let plate = logoContrastPlate(for: primary)

        ZStack {
            Circle()
                .fill(Color.appSurfaceElevated)
                .overlay(Circle().fill(primary).opacity(colorScheme == .dark ? 0.30 : 0.22))
                .overlay(Circle().strokeBorder(primary, lineWidth: 2))

            if let urlString = logoUrl, let url = URL(string: urlString) {
                CachedAsyncImage(url: url) { phase in
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
                            .foregroundStyle(Color.appTextPrimary)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                Text(abbrev)
                    .font(.system(size: size * 0.32, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
        }
        .frame(width: size, height: size)
    }

    /// Plate to separate a same-color logo from the disc. Only needed in light
    /// mode: a light team primary on the light surface washes the logo out. In
    /// dark mode the disc is already dark, and a lightening plate there is what
    /// produced the muddy off-team blob behind the logo.
    private func logoContrastPlate(for primary: Color) -> Color? {
        guard colorScheme != .dark else { return nil }
        return primary.relativeLuminance > 0.6 ? Color.black.opacity(0.55) : nil
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

    // Formatters are hoisted to statics because these helpers are called from
    // the detail hero's `topRow`, which SwiftUI re-evaluates on every scroll
    // frame. Constructing a DateFormatter is expensive (locale + timezone +
    // format parsing), and this was 4-5 of them per frame at 120Hz.
    private static let etTimeZone = TimeZone(identifier: "America/New_York")

    private static let dateParser: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = etTimeZone
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let dateLabelFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = etTimeZone
        f.dateFormat = "EEE, MMM d"
        return f
    }()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = etTimeZone
        f.dateFormat = "h:mm a"
        return f
    }()

    /// Two ISO parsers rather than one whose `formatOptions` get mutated —
    /// a shared static that rewrites its own options is not thread-safe.
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// Mirrors RN `formatMLBDateLabel`: short weekday + month + day from
    /// `YYYY-MM-DD`.
    static func dateLabel(_ raw: String) -> String {
        guard let date = dateParser.date(from: raw) else { return raw }
        return dateLabelFormatter.string(from: date)
    }

    /// Mirrors RN `formatMLBGameTime` — parses ISO UTC, formats `h:mm a ET`.
    static func gameTime(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "TBD" }
        guard let date = isoFractional.date(from: raw) ?? isoPlain.date(from: raw) else { return "TBD" }
        return timeFormatter.string(from: date) + " ET"
    }
}
