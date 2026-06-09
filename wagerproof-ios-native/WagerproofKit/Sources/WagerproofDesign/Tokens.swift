import SwiftUI

/// Wagerproof color tokens. Brand color is `wagerproofGreen` (#22c55e), pulled
/// from the RN app's `app.json` Android adaptive icon background. Dark mode
/// uses near-black surfaces; light mode uses paper.
///
/// Naming convention mirrors Honeydew's: `app<Role>` (`appPrimary`,
/// `appSurface`, `appAccent`). Phase-2 implementer agents add new
/// role-named colors here, never raw hex in feature code.
public extension Color {
    static let appPrimary = Color(hex: 0x22C55E)
    static let appPrimaryStrong = Color(hex: 0x16A34A)
    static let appPrimarySubtle = Color(hex: 0xBBF7D0)

    static let appAccentRed = Color(hex: 0xEF4444)
    static let appAccentAmber = Color(hex: 0xF59E0B)
    static let appAccentBlue = Color(hex: 0x3B82F6)
    static let appAccentPurple = Color(hex: 0xA855F7)

    static let appSurface = Color(light: 0xFFFFFF, dark: 0x0A0A0A)
    static let appSurfaceElevated = Color(light: 0xF8FAFC, dark: 0x141414)
    static let appSurfaceMuted = Color(light: 0xF1F5F9, dark: 0x1F1F1F)

    static let appBorder = Color(light: 0xE2E8F0, dark: 0x262626)
    static let appBorderStrong = Color(light: 0xCBD5E1, dark: 0x404040)

    static let appTextPrimary = Color(light: 0x0F172A, dark: 0xF8FAFC)
    static let appTextSecondary = Color(light: 0x475569, dark: 0x94A3B8)
    static let appTextMuted = Color(light: 0x94A3B8, dark: 0x64748B)
    static let appTextInverse = Color(light: 0xFFFFFF, dark: 0x0F172A)

    static let appWin = Color(hex: 0x22C55E)
    static let appLoss = Color(hex: 0xEF4444)
    static let appPush = Color(hex: 0x94A3B8)
    static let appPending = Color(hex: 0xF59E0B)

    // MARK: - Skeleton / shimmer placeholders
    //
    // `appSkeleton` is the base fill for placeholder shapes — sits one step
    // above the page surface so the silhouette of a not-yet-loaded card reads
    // clearly while still feeling "empty". `appSkeletonHighlight` is the
    // brighter band the `.shimmering()` sweep reveals as it travels across the
    // skeleton (see Modifiers/Shimmer.swift). Both are light/dark aware so the
    // effect reads on white paper and near-black surfaces alike.
    static let appSkeleton = Color(light: 0xE6ECF3, dark: 0x2B2B2B)
    static let appSkeletonHighlight = Color(light: 0xF6F9FC, dark: 0x3D3D3D)
}

public extension Color {
    init(hex: Int, opacity: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }

    init(light: Int, dark: Int) {
        #if canImport(UIKit)
        let color = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(hex: dark)
                : UIColor(hex: light)
        }
        self = Color(uiColor: color)
        #else
        self = Color(hex: light)
        #endif
    }
}

#if canImport(UIKit)
import UIKit
private extension UIColor {
    convenience init(hex: Int) {
        let r = CGFloat((hex >> 16) & 0xFF) / 255
        let g = CGFloat((hex >> 8) & 0xFF) / 255
        let b = CGFloat(hex & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
#endif
