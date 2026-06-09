import SwiftUI
import WagerproofDesign

/// 5-step stepper used everywhere in Screen 3 / 4 of the wizard. Ports the
/// custom RN component at `components/agents/inputs/SliderInput.tsx`.
///
/// Internals: native SwiftUI `Slider(value:in:step:)` driving the discrete
/// 1...5 selection so the thumb, track, and haptics all feel iOS-canonical.
/// We keep the bold header + active-label badge + step labels under the
/// track from the RN spec; the custom dot row is gone because the system
/// Slider already shows tick discreteness via the thumb.
///
/// API stays unchanged so call sites in Step3PersonalityView /
/// Step4DataAndConditionsView compile without edits.
struct SliderInput: View {
    @Binding var value: Int
    let label: String
    var description: String? = nil
    /// Five labels for steps 1...5. Index 0 corresponds to value 1.
    let labels: [String]

    /// SwiftUI's `Slider(value:in:step:)` wants a binding to a
    /// continuous-domain `Double`; we bridge it back to the discrete
    /// `Int` binding the wizard owns. Without this bridge SwiftUI would
    /// snap on every drag tick but our `@Binding<Int>` would only update
    /// when the value crossed an integer boundary, which feels mushy.
    private var doubleBinding: Binding<Double> {
        Binding(
            get: { Double(value) },
            set: { value = max(1, min(5, Int($0.rounded()))) }
        )
    }

    var body: some View {
        // Outer card chrome removed — this renders as a plain Form row.
        // The header, slider, and step labels are preserved verbatim.
        VStack(alignment: .leading, spacing: 10) {
            // Header row: title + description on the left, active-label badge on the right.
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(label)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    if let description {
                        Text(description)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 8)
                Text(currentLabel)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(Color.appBorder.opacity(0.5))
                    )
            }

            // Native iOS Slider — discrete 1...5 with step 1 so the thumb
            // snaps to integer values. Tint paints the active track in
            // brand green; the inactive track / thumb stay system-managed.
            Slider(value: doubleBinding, in: 1...5, step: 1)
                .tint(Color.appPrimary)

            // Per-step labels under the track. Tap-to-jump retained so
            // users can target a specific step without dragging.
            HStack {
                ForEach(Array(labels.enumerated()), id: \.offset) { idx, stepLabel in
                    Button {
                        select(idx + 1)
                    } label: {
                        Text(stepLabel)
                            .font(.system(size: 10, weight: (idx + 1) == value ? .semibold : .regular))
                            .foregroundStyle((idx + 1) == value ? Color.appPrimary : Color.appTextSecondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        // Haptic on each value change — matches what the custom dot row
        // used to do via per-button selection feedback.
        .sensoryFeedback(.selection, trigger: value)
    }

    private var currentLabel: String {
        let clamped = max(1, min(5, value))
        return labels[clamped - 1]
    }

    private func select(_ step: Int) {
        guard step != value else { return }
        value = step
    }
}
