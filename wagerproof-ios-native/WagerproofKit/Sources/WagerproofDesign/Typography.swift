import SwiftUI

/// Wagerproof typography ramp. Uses the system font family with custom weight +
/// size combinations matching the RN screen designs. Implementer agents should
/// reach for these tokens before falling back to ad-hoc `.font(...)` calls.
public enum AppFont {
    public static let displayLarge = Font.system(size: 34, weight: .bold, design: .rounded)
    public static let display = Font.system(size: 28, weight: .bold, design: .rounded)
    public static let title = Font.system(size: 22, weight: .semibold, design: .default)
    public static let headline = Font.system(size: 17, weight: .semibold, design: .default)
    public static let body = Font.system(size: 15, weight: .regular, design: .default)
    public static let bodyEmphasized = Font.system(size: 15, weight: .semibold, design: .default)
    public static let caption = Font.system(size: 13, weight: .medium, design: .default)
    public static let captionEmphasized = Font.system(size: 13, weight: .semibold, design: .default)
    public static let micro = Font.system(size: 11, weight: .medium, design: .default)

    public static let mono = Font.system(.body, design: .monospaced)
    public static let monoCaption = Font.system(.caption, design: .monospaced)

    public static let oddsLarge = Font.system(size: 28, weight: .bold, design: .rounded)
    public static let oddsMedium = Font.system(size: 18, weight: .semibold, design: .rounded)
    public static let oddsSmall = Font.system(size: 13, weight: .semibold, design: .rounded)
}
