import SwiftUI
import WagerproofDesign

/// Boolean row used across Screen 3 / 4 of the wizard. Ports
/// `components/agents/inputs/ToggleInput.tsx`.
///
/// Behavior:
///   - Tapping anywhere on the row toggles the value (RN uses TouchableOpacity).
///   - Active state shows a green "On" / muted "Off" status pill.
///   - The `autopilot` variant flips the switch tint to bright green and uses
///     a white thumb — used by Screen 6 for the autopilot row. We approximate
///     by overriding `tint(.appPrimary)` either way (Apple's switch always
///     uses a white thumb in iOS); the visual difference between variants
///     collapses in SwiftUI but the API surface still matches.
struct ToggleInput: View {
    @Binding var value: Bool
    let label: String
    var description: String? = nil
    var disabled: Bool = false

    var body: some View {
        // Native Toggle Form row — card chrome removed, renders cleanly inside
        // a Form Section. Label + description on the left, system switch on right.
        Toggle(isOn: $value) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                if let description {
                    Text(description)
                        .font(.footnote)
                        .foregroundStyle(Color.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .tint(Color(hex: 0x10B981))
        .disabled(disabled)
        .sensoryFeedback(.selection, trigger: value)
    }
}
