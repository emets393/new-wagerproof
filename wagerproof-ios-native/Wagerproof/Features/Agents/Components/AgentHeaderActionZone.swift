import SwiftUI
import WagerproofDesign
#if canImport(UIKit)
import UIKit
#endif

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
            labelContent
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .background(Capsule().fill(enabled ? accent : Color.appSurfaceMuted))
        .clipShape(Capsule())
        .disabled(!enabled)
    }

    /// The label with the shimmer glint sweeping across the *text itself* — a
    /// white copy of the label masked to the shimmer band and composited
    /// plus-lighter over the base, rather than a band over the whole capsule.
    private var labelContent: some View {
        ZStack {
            Label(label, systemImage: enabled ? "sparkles" : "lock.fill")
                .foregroundStyle(enabled ? Color.black : Color.appTextSecondary)
            if enabled {
                Label(label, systemImage: "sparkles")
                    .foregroundStyle(.white.opacity(0.6))
                    .shimmering()
                    .blendMode(.plusLighter)
                    .allowsHitTesting(false)
            }
        }
        .font(.system(size: 15, weight: .heavy))
    }
}

/// The tucked-away autopilot control: a small **tinted** Liquid-Glass pill that
/// toggles auto-generation on tap. The accent tint pulses stronger when on,
/// fainter when off (manual), so both states read as translucent glass — never a
/// flat solid fill.
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
            // ON: white over the accent-tinted glass (the accent identity comes
            // from the tint + border). Accent-colored text used to vanish into
            // the accent glass on saturated agent colors (e.g. a pink agent).
            .foregroundStyle(isOn ? Color.appTextPrimary : Color.appTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .glassChip(tint: accent.opacity(isOn ? 0.4 : 0.22))
            .overlay(Capsule().strokeBorder(accent.opacity(isOn ? 0.6 : 0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// Hold-to-confirm regenerate control. A tinted Liquid-Glass pill that fills
/// left→right with the accent while pressed; completing a full `holdDuration`
/// hold fires `onRegen` (with a success haptic). Releasing early rewinds the
/// fill. Regeneration burns one of the day's limited runs, so the deliberate
/// hold guards against an accidental tap. When `enabled` is false it shows a
/// "Limit reached" lock and ignores touches.
struct HoldToRegenButton: View {
    var accent: Color
    var enabled: Bool
    var onRegen: () -> Void

    /// Seconds the user must hold before the regeneration fires.
    static let holdDuration: Double = 5.0

    @State private var progress: CGFloat = 0
    @State private var holding = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: enabled ? "arrow.clockwise" : "lock.fill")
                .font(.system(size: 12, weight: .bold))
            Text(label)
                .font(.system(size: 12, weight: .heavy))
                .lineLimit(1)
        }
        .foregroundStyle(foreground)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        // Accent progress fill grows left→right behind the label, over the glass.
        .background(alignment: .leading) {
            GeometryReader { geo in
                Rectangle()
                    .fill(accent.opacity(0.85))
                    .frame(width: geo.size.width * progress)
            }
        }
        .glassChip(tint: enabled ? accent.opacity(0.35) : nil)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(enabled ? accent.opacity(0.55) : Color.white.opacity(0.12), lineWidth: 1))
        .contentShape(Capsule())
        .modifier(HoldGesture(
            enabled: enabled,
            duration: Self.holdDuration,
            onChanged: { pressing in
                holding = pressing
                if pressing {
                    withAnimation(.linear(duration: Self.holdDuration)) { progress = 1 }
                } else {
                    withAnimation(.easeOut(duration: 0.25)) { progress = 0 }
                }
            },
            onComplete: {
                #if canImport(UIKit)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                #endif
                onRegen()
                withAnimation(.easeOut(duration: 0.3)) { progress = 0 }
                holding = false
            }
        ))
        .animation(.easeInOut(duration: 0.2), value: holding)
    }

    private var label: String {
        guard enabled else { return "Limit reached" }
        return holding ? "Keep holding…" : "Hold to Regenerate"
    }

    private var foreground: Color {
        guard enabled else { return Color.appTextSecondary }
        // White reads over both states: the accent-tinted glass when idle AND
        // the solid accent progress fill while holding. Accent-colored text used
        // to disappear into the accent glass on saturated agent colors.
        return .white
    }
}

/// Wraps the long-press-to-fill gesture so the button body stays declarative.
/// `onChanged(true)` fires on press-down, `onChanged(false)` on release (early
/// OR after completion); `onComplete` fires once the hold reaches `duration`.
/// Disabled → no gesture attached, so touches pass through inert.
private struct HoldGesture: ViewModifier {
    var enabled: Bool
    var duration: Double
    var onChanged: (Bool) -> Void
    var onComplete: () -> Void

    func body(content: Content) -> some View {
        if enabled {
            content.onLongPressGesture(
                minimumDuration: duration,
                maximumDistance: 60,
                perform: onComplete,
                onPressingChanged: onChanged
            )
        } else {
            content
        }
    }
}

private extension View {
    /// Tinted Liquid-Glass capsule fill. Pass an accent (with the desired alpha)
    /// to tint the glass, or `nil` for neutral glass. Falls back to
    /// `.ultraThinMaterial` on iOS < 26 (handled inside `liquidGlassBackground`).
    @ViewBuilder
    func glassChip(tint: Color?) -> some View {
        if let tint {
            self.liquidGlassBackground(in: Capsule(), tint: tint)
        } else {
            self.liquidGlassBackground(in: Capsule())
        }
    }
}
