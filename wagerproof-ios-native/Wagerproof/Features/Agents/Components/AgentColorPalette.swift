import SwiftUI
import UIKit

/// Helpers for the per-agent `avatar_color` field, which is either a hex
/// string ("#6366f1") or a gradient pair ("gradient:#6366f1,#ec4899"). Ports
/// the `parseAvatarColor` / `getPrimaryColor` / `getSecondaryColor` helpers
/// duplicated across multiple RN components.
enum AgentColorPalette {
    static func primary(for raw: String) -> Color {
        Color(hexString: primaryHex(for: raw)) ?? Color(hex: 0x6366F1)
    }

    static func secondary(for raw: String) -> Color {
        Color(hexString: secondaryHex(for: raw)) ?? primary(for: raw)
    }

    static func gradient(for raw: String) -> (Color, Color) {
        (primary(for: raw), secondary(for: raw))
    }

    /// A two-color gradient for avatar tiles that is *always* visibly two-tone.
    /// When `avatar_color` is a solid hex (primary == secondary), `[primary,
    /// secondary]` would render a flat fill — so we derive a darker partner to
    /// give the tile real top-left→bottom-right depth. Gradient-pair colors are
    /// used as-is.
    static func avatarGradient(for raw: String) -> [Color] {
        let p = primary(for: raw)
        if secondaryHex(for: raw).caseInsensitiveCompare(primaryHex(for: raw)) == .orderedSame {
            return [p, p.shaded(by: 0.55)]
        }
        return [p, secondary(for: raw)]
    }

    static func primaryHex(for raw: String) -> String {
        if raw.hasPrefix("gradient:") {
            let stripped = String(raw.dropFirst("gradient:".count))
            return stripped.split(separator: ",").first.map(String.init) ?? "#6366f1"
        }
        return raw
    }

    static func secondaryHex(for raw: String) -> String {
        if raw.hasPrefix("gradient:") {
            let stripped = String(raw.dropFirst("gradient:".count))
            let parts = stripped.split(separator: ",")
            if parts.count >= 2 { return String(parts[1]) }
            return parts.first.map(String.init) ?? "#6366f1"
        }
        return raw
    }
}

extension Color {
    /// Multiply RGB by `factor` (<1 darkens, >1 lightens), clamped to [0,1].
    /// Used to derive a gradient partner for solid avatar colors.
    func shaded(by factor: Double) -> Color {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a) else { return self }
        func cl(_ v: CGFloat) -> Double { Double(min(max(v * CGFloat(factor), 0), 1)) }
        return Color(.sRGB, red: cl(r), green: cl(g), blue: cl(b), opacity: Double(a))
    }

    /// Parses "#RRGGBB" or "#AARRGGBB" / "RRGGBB" strings. Returns nil on
    /// malformed input.
    init?(hexString: String) {
        var s = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6 || s.count == 8 else { return nil }
        var value: UInt64 = 0
        guard Scanner(string: s).scanHexInt64(&value) else { return nil }
        let r, g, b, a: Double
        if s.count == 6 {
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
            a = 1.0
        } else {
            a = Double((value >> 24) & 0xFF) / 255
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
