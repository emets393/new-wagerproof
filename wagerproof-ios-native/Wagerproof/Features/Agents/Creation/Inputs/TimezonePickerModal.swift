import SwiftUI
import WagerproofDesign

/// Standalone timezone-only picker. Ports
/// `components/agents/inputs/TimezonePickerModal.tsx`. Used by surfaces that
/// only need to change the timezone (not the time) — the wizard uses the
/// combined `TimePickerModal`. We expose this for B15's edit screens.
///
/// Native iOS uses a searchable List built from `AgentTimezoneOption.all`.
struct TimezonePickerModal: View {
    @Binding var isPresented: Bool
    @Binding var timezone: String

    @State private var query: String = ""

    var body: some View {
        NavigationStack {
            List {
                ForEach(filtered) { option in
                    Button {
                        timezone = option.value
                        isPresented = false
                    } label: {
                        HStack {
                            Text(option.label)
                                .foregroundStyle(option.value == timezone ? Color(hex: 0x00E676) : Color.appTextPrimary)
                                .font(.system(size: 16, weight: option.value == timezone ? .bold : .regular))
                            Spacer()
                            if option.value == timezone {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color(hex: 0x00E676))
                            }
                        }
                    }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
            .navigationTitle("Timezone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { isPresented = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var filtered: [AgentTimezoneOption] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return AgentTimezoneOption.all }
        return AgentTimezoneOption.all.filter {
            $0.label.localizedCaseInsensitiveContains(trimmed) ||
            $0.value.localizedCaseInsensitiveContains(trimmed)
        }
    }
}
