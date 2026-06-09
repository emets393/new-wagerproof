import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Step 5 of the wizard — free-form custom insight fields. Ports
/// `components/agents/creation/Screen5_CustomInsights.tsx`.
///
/// Converted to native Form/Section — each insight field is its own Section
/// containing a multi-line TextField (axis: .vertical). The collapsible
/// InsightCard behaviour is replaced by always-visible sections (Form itself
/// groups them clearly). Char limits (500/500/300/300), filled-badge logic,
/// and bindings to `store.draft.customInsights.*` are all preserved verbatim.
struct Step5CustomInsightsView: View {
    @Bindable var store: AgentCreationStore

    private struct FieldConfig {
        let title: String
        let icon: String
        let description: String
        let placeholder: String
        let maxLength: Int
        let keyPath: WritableKeyPath<AgentCustomInsights, String?>
    }

    private let fields: [FieldConfig] = [
        .init(
            title: "Betting Philosophy",
            icon: "book.fill",
            description: "Describe your overall approach to betting. What principles guide your decisions?",
            placeholder: "e.g., I believe in value betting and only taking plays where I have a significant edge over the market...",
            maxLength: 500,
            keyPath: \.bettingPhilosophy
        ),
        .init(
            title: "Perceived Edges",
            icon: "chart.line.uptrend.xyaxis",
            description: "What unique insights or edges do you think you have?",
            placeholder: "e.g., I'm particularly good at spotting mispriced totals in divisional games, especially when weather is a factor...",
            maxLength: 500,
            keyPath: \.perceivedEdges
        ),
        .init(
            title: "Situations to Avoid",
            icon: "xmark.octagon",
            description: "What types of games or situations should your agent avoid?",
            placeholder: "e.g., Never bet on primetime games, avoid teams coming off emotional wins, skip games with uncertain QB situations...",
            maxLength: 300,
            keyPath: \.avoidSituations
        ),
        .init(
            title: "Target Situations",
            icon: "target",
            description: "What types of games or situations should your agent prioritize?",
            placeholder: "e.g., Look for home underdogs off a bye week, target early season totals before lines adjust, focus on late-season division games...",
            maxLength: 300,
            keyPath: \.targetSituations
        ),
    ]

    private var filledCount: Int {
        var n = 0
        if (store.draft.customInsights.bettingPhilosophy ?? "").isEmpty == false { n += 1 }
        if (store.draft.customInsights.perceivedEdges ?? "").isEmpty == false { n += 1 }
        if (store.draft.customInsights.avoidSituations ?? "").isEmpty == false { n += 1 }
        if (store.draft.customInsights.targetSituations ?? "").isEmpty == false { n += 1 }
        return n
    }

    var body: some View {
        Form {
            // Intro Section — description + filled count.
            Section {
                EmptyView()
            } header: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Custom Insights")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .textCase(nil)
                    Text("Help your agent understand your unique betting perspective. These fields are optional but can improve how well your agent matches your style.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                        .textCase(nil)
                    Text("\(filledCount) of \(fields.count) completed (optional)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .textCase(nil)
                        .padding(.bottom, 4)
                }
                .padding(.bottom, 6)
            }

            // One Section per insight field.
            ForEach(Array(fields.enumerated()), id: \.offset) { _, config in
                insightSection(config: config, binding: optionalStringBinding(for: config.keyPath))
            }

            // Info footer row.
            Section {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.appTextSecondary)
                    Text("These insights help the AI understand your betting philosophy. You can always edit them later from the agent settings.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .listRowBackground(Color.clear)
            }
        }
    }

    @ViewBuilder
    private func insightSection(config: FieldConfig, binding: Binding<String>) -> some View {
        let charCount = binding.wrappedValue.count
        let isOverLimit = charCount > config.maxLength
        let isFilled = !binding.wrappedValue.isEmpty

        Section {
            // Multi-line TextField — axis:.vertical grows with content.
            TextField(config.placeholder, text: binding, axis: .vertical)
                .font(.system(size: 15))
                .lineLimit(4...10)
        } header: {
            HStack(spacing: 6) {
                Image(systemName: config.icon)
                    .font(.system(size: 13))
                    .foregroundStyle(isFilled ? Color(hex: 0x00E676) : Color.secondary)
                Text(config.title)
                    .textCase(nil)
                if isFilled {
                    // "Filled" pill moved to header to match the original badge.
                    Text("Filled")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .foregroundStyle(Color(hex: 0x00E676))
                        .background(Capsule().fill(Color(hex: 0x00E676).opacity(0.18)))
                }
            }
        } footer: {
            VStack(alignment: .leading, spacing: 2) {
                Text(config.description)
                    .font(.system(size: 12))
                HStack {
                    Spacer()
                    Text("\(charCount)/\(config.maxLength)")
                        .font(.system(size: 11))
                        .foregroundStyle(isOverLimit ? Color(hex: 0xEF4444) : Color.secondary)
                }
            }
        }
    }

    private func optionalStringBinding(for keyPath: WritableKeyPath<AgentCustomInsights, String?>) -> Binding<String> {
        Binding(
            get: { store.draft.customInsights[keyPath: keyPath] ?? "" },
            set: { newValue in
                store.draft.customInsights[keyPath: keyPath] = newValue.isEmpty ? nil : newValue
            }
        )
    }
}
