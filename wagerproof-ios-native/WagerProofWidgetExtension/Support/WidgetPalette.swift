import SwiftUI
import WagerproofDesign

/// Shared background/surface tokens for both widgets, reusing the same
/// dynamic light/dark `WagerproofDesign` tokens the rest of the app uses —
/// so the widgets follow the Home Screen's system appearance the same way
/// every other screen follows `ThemeStore`.
enum WidgetPalette {
    static let background = Color.appSurface
    static let card = Color.appSurfaceElevated
    static let textPrimary = Color.appTextPrimary
    static let textSecondary = Color.appTextSecondary
    static let textMuted = Color.appTextMuted
    static let accent = Color.appPrimary
}
