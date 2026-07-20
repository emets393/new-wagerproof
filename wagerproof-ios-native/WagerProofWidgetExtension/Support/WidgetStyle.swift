import SwiftUI

/// Per-league badge colors for the widget's sport chips. Deliberately a
/// small, sport-level (not per-team) table — widgets have tight memory/CPU
/// budgets, so we skip the app target's full per-team color tables
/// (`SportTeamColors.swift`) rather than link them in.
enum WidgetSportBadge {
    static func color(for sport: String) -> Color {
        switch sport.lowercased() {
        case "nfl": Color(widgetRGB: 0x013369)
        case "nba": Color(widgetRGB: 0x1D428A)
        case "cfb": Color(widgetRGB: 0x8B0000)
        case "ncaab": Color(widgetRGB: 0xFF6600)
        case "mlb": Color(widgetRGB: 0x002D72)
        default: Color(widgetRGB: 0x6366F1)
        }
    }
}

extension Color {
    /// Parses "#RRGGBB" / "RRGGBB" agent avatar colors. Agent colors arrive
    /// as DB strings, so this is a minimal, widget-local parser rather than
    /// pulling in the app target's fuller
    /// `AgentColorPalette` (which also handles `"gradient:a,b"` strings the
    /// widget doesn't need).
    init?(widgetHexString hexString: String) {
        var s = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let value = UInt32(s, radix: 16) else { return nil }
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
            opacity: 1.0
        )
    }
}
