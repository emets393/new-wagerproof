import SwiftUI
import WagerproofDesign

/// The idle "generate your picks" prompt — the main, container-less first
/// section of the agent detail picks area. A short header invites the user to
/// run a generation now, with the auto-pilot schedule offered as the wait-it-out
/// alternative. The **Generate** button is the hero of the section and carries a
/// shimmer glint to pull the eye toward it. Autopilot is deliberately demoted to
/// a small `AutopilotChip` tucked in the top-right — it's no longer a section of
/// its own.
struct AgentGeneratePrompt: View {
    var accent: Color
    var title: String
    var subtitle: String
    var autoGenerate: Bool
    var onToggleAuto: (Bool) -> Void
    var canGenerate: Bool
    var buttonLabel: String
    var onGenerate: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                AutopilotChip(isOn: autoGenerate, accent: accent, onToggle: onToggleAuto)
            }

            ShimmerGenerateButton(label: buttonLabel, enabled: canGenerate, accent: accent, action: onGenerate)
        }
    }
}

/// Prominent generate CTA. A translucent white capsule masked by the shared
/// `.shimmering()` band is layered over the filled button (`plusLighter`), so a
/// glint sweeps across it — the "use me" affordance the user asked for — without
/// the shimmer mask eating the button's own fill/label.
struct ShimmerGenerateButton: View {
    var label: String
    var enabled: Bool
    var accent: Color
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(label, systemImage: enabled ? "sparkles" : "lock.fill")
                .font(.system(size: 15, weight: .heavy))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .foregroundStyle(enabled ? Color.black : Color.appTextSecondary)
        .background(Capsule().fill(enabled ? accent : Color.appSurfaceMuted))
        .overlay {
            if enabled {
                Capsule()
                    .fill(Color.white.opacity(0.45))
                    .blendMode(.plusLighter)
                    .shimmering()
                    .allowsHitTesting(false)
            }
        }
        .clipShape(Capsule())
        .disabled(!enabled)
    }
}

/// The tucked-away autopilot control: a small pill that toggles auto-generation
/// on tap. Low-emphasis by design — autopilot is a setting, not a headline.
struct AutopilotChip: View {
    var isOn: Bool
    var accent: Color
    var onToggle: (Bool) -> Void

    var body: some View {
        Button { onToggle(!isOn) } label: {
            HStack(spacing: 5) {
                Image(systemName: "bolt.badge.automatic")
                    .font(.system(size: 11, weight: .bold))
                Text(isOn ? "Auto" : "Manual")
                    .font(.system(size: 11, weight: .heavy))
            }
            .foregroundStyle(isOn ? accent : Color.appTextSecondary)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(Capsule().fill(isOn ? accent.opacity(0.14) : Color.appSurfaceMuted.opacity(0.5)))
            .overlay(Capsule().strokeBorder(isOn ? accent.opacity(0.45) : Color.clear, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
