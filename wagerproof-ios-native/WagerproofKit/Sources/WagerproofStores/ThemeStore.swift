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
        // The in-app theme changer is hidden and the app ships dark-only, so we
        // always resolve to dark. Coercing any stored light/system preference (or
        // none) to dark guarantees existing users land in dark with no way — or
        // need — to switch back.
        self.mode = .dark
    }
}
