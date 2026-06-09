import Foundation
import Observation
import SwiftUI
import WagerproofSharedKit

/// Mirrors RN `contexts/ThemeContext.tsx`. Three modes: system / light / dark.
@Observable
@MainActor
public final class ThemeStore {
    public enum Mode: String, CaseIterable, Codable, Sendable {
        case system
        case light
        case dark

        public var colorScheme: ColorScheme? {
            switch self {
            case .system: nil
            case .light: .light
            case .dark: .dark
            }
        }
    }

    public var mode: Mode {
        didSet {
            AppGroup.defaults.set(mode.rawValue, forKey: AppGroupKey.themePreference)
        }
    }

    public init() {
        if let raw = AppGroup.defaults.string(forKey: AppGroupKey.themePreference),
           let parsed = Mode(rawValue: raw) {
            self.mode = parsed
        } else {
            self.mode = .system
        }
    }
}
