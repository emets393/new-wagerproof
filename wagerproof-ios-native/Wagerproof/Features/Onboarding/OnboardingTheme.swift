import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Maps onboarding selections to the accent color that tints the reactive
/// pixel background, the CTA pill, and per-page highlights. The default is
/// the brand green so the entry state is visually continuous with the login
/// screen's `AuthGateBackground` (same `PixelWaveBackground`, same tint).
enum OnboardingTheme {
    static func accent(for type: OnboardingStore.BettorType?) -> Color {
        switch type {
        case .none, .casual:
            return .appPrimary
        case .serious:
            return .appAccentBlue
        case .professional:
            return .appAccentPurple
        }
    }

    /// Archetype rows carry their own hex accent (`PresetArchetypeRow.color`).
    static func archetypeAccent(hex: String?) -> Color? {
        guard let hex else { return nil }
        return Color(hexString: hex)
    }

    /// Slightly white-lifted accent used while the generation cinematic runs
    /// — reads as "energized" without touching the glyph field's grid params.
    static func generationBoost(_ accent: Color) -> Color {
        accent.mix(with: .white, by: 0.15)
    }
}
