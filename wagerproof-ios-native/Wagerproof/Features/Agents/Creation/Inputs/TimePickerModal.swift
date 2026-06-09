import SwiftUI
import WagerproofDesign

/// US-timezone option used by both the time + timezone pickers. Mirrors the
/// RN `US_TIMEZONES` constant in `wagerproof-mobile/types/agent.ts:468-475`.
struct AgentTimezoneOption: Identifiable, Hashable {
    let value: String
    let label: String
    var id: String { value }

    static let all: [AgentTimezoneOption] = [
        .init(value: "America/New_York", label: "Eastern (ET)"),
        .init(value: "America/Chicago", label: "Central (CT)"),
        .init(value: "America/Denver", label: "Mountain (MT)"),
        .init(value: "America/Los_Angeles", label: "Pacific (PT)"),
        .init(value: "America/Anchorage", label: "Alaska (AKT)"),
        .init(value: "Pacific/Honolulu", label: "Hawaii (HT)"),
    ]

    static func abbr(for tz: String) -> String {
        guard let row = all.first(where: { $0.value == tz }) else { return "ET" }
        // "Eastern (ET)" → "ET"
        if let lparen = row.label.firstIndex(of: "("),
           let rparen = row.label.lastIndex(of: ")") {
            let start = row.label.index(after: lparen)
            return String(row.label[start..<rparen])
        }
        return "ET"
    }
}

/// Sheet for picking the autopilot generation time + timezone. Replaces the
/// RN custom-built spinning column picker with native SwiftUI `DatePicker`
/// (wheel style for the time portion) + a horizontal chip row for timezones.
/// Source: `components/agents/inputs/TimePickerModal.tsx`.
///
/// FIDELITY-WAIVER #079: RN renders custom dual ScrollView wheels for hour /
/// minute snapped to 5-min increments. We use SwiftUI's built-in
/// `DatePicker(.wheel)` which gives proper iOS spinner behavior and a/p
/// formatting for free. Minute increment can't be snapped to 5 natively
/// without rolling a custom picker — we leave it at 1-min granularity.
struct TimePickerModal: View {
    @Binding var isPresented: Bool
    @Binding var time: String        // "HH:mm" 24-hour
    @Binding var timezone: String    // IANA name

    @State private var localDate: Date = Date()
    @State private var localTimezone: String = "America/New_York"

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                DatePicker(
                    "Time",
                    selection: $localDate,
                    displayedComponents: .hourAndMinute
                )
                .datePickerStyle(.wheel)
                .labelsHidden()

                VStack(alignment: .leading, spacing: 8) {
                    Text("Timezone")
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(0.5)
                        .foregroundStyle(Color.appTextSecondary)
                        .textCase(.uppercase)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(AgentTimezoneOption.all) { option in
                                let isSelected = option.value == localTimezone
                                Button {
                                    localTimezone = option.value
                                } label: {
                                    Text(option.label)
                                        .font(.system(size: 13, weight: isSelected ? .bold : .regular))
                                        .padding(.vertical, 8)
                                        .padding(.horizontal, 12)
                                        .foregroundStyle(isSelected ? Color(hex: 0x00E676) : Color.appTextPrimary)
                                        .background(
                                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                .fill(isSelected ? Color(hex: 0x00E676).opacity(0.15) : Color.appBorder.opacity(0.3))
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                .strokeBorder(isSelected ? Color(hex: 0x00E676) : Color.appBorder, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                Spacer()
            }
            .padding(24)
            .navigationTitle("Time & Timezone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirm") { commit() }
                        .bold()
                }
            }
            .onAppear { syncFromBindings() }
        }
        .presentationDetents([.medium, .large])
    }

    private func syncFromBindings() {
        let comps = time.split(separator: ":")
        var hours = 9
        var minutes = 0
        if comps.count == 2 {
            hours = Int(comps[0]) ?? 9
            minutes = Int(comps[1]) ?? 0
        }
        var dc = DateComponents()
        dc.hour = hours
        dc.minute = minutes
        // Build the picker's reference Date from those components — DatePicker
        // ignores the date portion when in `.hourAndMinute` mode, so any
        // reference date works.
        if let date = Calendar.current.date(from: dc) {
            localDate = date
        }
        localTimezone = timezone
    }

    private func commit() {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: localDate)
        let h = String(format: "%02d", comps.hour ?? 9)
        let m = String(format: "%02d", comps.minute ?? 0)
        time = "\(h):\(m)"
        timezone = localTimezone
        isPresented = false
    }
}
