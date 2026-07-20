import SwiftUI
import UIKit

/// Widget-local copies of the app's small visual token subset. Keeping these
/// local avoids linking the full design package (and its Lottie dependency)
/// into WidgetKit's memory-constrained extension process.
enum WidgetPalette {
    static let background = Color(widgetLight: 0xFFFFFF, dark: 0x0A0A0A)
    static let card = Color(widgetLight: 0xF8FAFC, dark: 0x141414)
    static let textPrimary = Color(widgetLight: 0x0F172A, dark: 0xF8FAFC)
    static let textSecondary = Color(widgetLight: 0x475569, dark: 0x94A3B8)
    static let textMuted = Color(widgetLight: 0x94A3B8, dark: 0x64748B)
    static let accent = Color(widgetRGB: 0x22C55E)
    static let win = Color(widgetRGB: 0x22C55E)
    static let loss = Color(widgetRGB: 0xEF4444)
}

enum WidgetTypography {
    static let bodyEmphasized = Font.system(size: 15, weight: .semibold)
    static let caption = Font.system(size: 13, weight: .medium)
}

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
}

extension Color {
    init(widgetRGB hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    init(widgetLight light: UInt32, dark: UInt32) {
        self = Color(uiColor: UIColor { traits in
            let value = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((value >> 16) & 0xFF) / 255,
                green: CGFloat((value >> 8) & 0xFF) / 255,
                blue: CGFloat(value & 0xFF) / 255,
                alpha: 1
            )
        })
    }
}
