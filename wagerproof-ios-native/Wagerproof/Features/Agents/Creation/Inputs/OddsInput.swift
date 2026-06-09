import SwiftUI
import WagerproofDesign

/// Odds floor/ceiling input. Ports `components/agents/inputs/OddsInput.tsx`.
///
/// Behavior:
///   - `favorite` type → valid range -500...-100 (e.g. "-200")
///   - `underdog` type → valid range +100...+500 (e.g. "+150")
///   - Tapping "No limit" chip toggles between an active value and `nil`.
///   - The value is clamped to the valid range on commit (focus loss).
struct OddsInput: View {
    enum InputType { case favorite, underdog }

    @Binding var value: Int?
    let label: String
    let type: InputType

    @State private var text: String = ""
    @State private var validationError: String? = nil
    @FocusState private var isFocused: Bool

    private var isFavorite: Bool { type == .favorite }
    private var minValue: Int { isFavorite ? -500 : 100 }
    private var maxValue: Int { isFavorite ? -100 : 500 }
    private var placeholder: String { isFavorite ? "-200" : "+150" }

    private var helperText: String {
        isFavorite
            ? "Skip heavier favorites once the price gets too steep."
            : "Only allow plus-money dogs that clear your floor."
    }

    private var isNoLimit: Bool { value == nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(label)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(helperText)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Text(isNoLimit ? "No limit" : formatOdds(value ?? 0))
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.3)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(isNoLimit ? Color.appBorder.opacity(0.5) : Color(hex: 0x3B82F6).opacity(0.22))
                    )
                    .foregroundStyle(isNoLimit ? Color.appTextSecondary : Color(hex: 0xBFDBFE))
            }

            HStack(spacing: 12) {
                TextField(placeholder, text: $text)
                    .keyboardType(.numbersAndPunctuation)
                    .multilineTextAlignment(.center)
                    .font(.system(size: 18, weight: .semibold))
                    .focused($isFocused)
                    .disabled(isNoLimit)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 16)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.appBorder.opacity(0.3))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(validationError != nil ? Color(hex: 0xEF4444) : Color.appBorder, lineWidth: 1)
                    )
                    .opacity(isNoLimit ? 0.5 : 1)
                    .onChange(of: text) { _, newValue in
                        handleTextChange(newValue)
                    }
                    .onChange(of: isFocused) { _, focused in
                        if !focused { handleBlur() }
                    }

                Button {
                    toggleNoLimit()
                } label: {
                    Text("No limit")
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .foregroundStyle(isNoLimit ? Color(hex: 0x00E676) : Color.appTextSecondary)
                        .background(
                            Capsule()
                                .fill(isNoLimit ? Color(hex: 0x00E676).opacity(0.15) : Color.clear)
                        )
                        .overlay(
                            Capsule()
                                .strokeBorder(isNoLimit ? Color(hex: 0x00E676) : Color.appBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }

            if let validationError {
                Text(validationError)
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: 0xEF4444))
            }
        }
        // Outer card chrome removed — renders as a plain Form row.
        // All parsing/validation/clamping logic preserved verbatim above.
        .onAppear { syncText(from: value) }
        .onChange(of: value) { _, newValue in
            // External writes (preset apply, etc.) re-sync the text field.
            if !isFocused { syncText(from: newValue) }
        }
    }

    // MARK: - Helpers

    private func syncText(from v: Int?) {
        text = v.map(formatOdds) ?? ""
    }

    private func formatOdds(_ odds: Int) -> String {
        odds >= 0 ? "+\(odds)" : "\(odds)"
    }

    private func parseOdds(_ raw: String) -> Int? {
        let cleaned = raw.unicodeScalars.filter { CharacterSet(charactersIn: "0123456789-").contains($0) }
        let str = String(String.UnicodeScalarView(cleaned))
        return str.isEmpty ? nil : Int(str)
    }

    private func validate(_ odds: Int?) -> String? {
        guard let odds else { return nil }
        if isFavorite {
            if odds > -100 { return "Favorite odds must be -100 or lower" }
            if odds < -500 { return "Favorite odds cannot be lower than -500" }
        } else {
            if odds < 100 { return "Underdog odds must be +100 or higher" }
            if odds > 500 { return "Underdog odds cannot exceed +500" }
        }
        return nil
    }

    private func handleTextChange(_ newText: String) {
        let parsed = parseOdds(newText)
        validationError = validate(parsed)
        if validationError == nil, let parsed {
            value = parsed
        }
    }

    private func handleBlur() {
        guard !text.isEmpty else { return }
        guard let parsed = parseOdds(text) else {
            syncText(from: value)
            return
        }
        let clamped = max(minValue, min(maxValue, parsed))
        value = clamped
        text = formatOdds(clamped)
        validationError = nil
    }

    private func toggleNoLimit() {
        if value == nil {
            // Hop to a sensible default per direction (mirrors RN).
            let next = isFavorite ? -200 : 150
            value = next
            text = formatOdds(next)
        } else {
            value = nil
            text = ""
        }
        validationError = nil
    }
}
