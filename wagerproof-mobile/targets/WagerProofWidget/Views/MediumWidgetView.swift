import SwiftUI
import WidgetKit

struct MediumWidgetView: View {
    let entry: WagerProofEntry

    private var itemCount: Int { 2 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            WidgetHeader(contentType: entry.contentType)

            // Content
            contentView

            Spacer(minLength: 0)
        }
        .padding(14)
        .containerBackground(Color.wpBackground, for: .widget)
        .widgetURL(URL(string: "wagerproof://\(entry.contentType.deepLinkPath)"))
    }

    @ViewBuilder
    private var contentView: some View {
        switch entry.contentType {
        case .editorPicks:
            editorPicksContent
        case .fadeAlerts:
            fadeAlertsContent
        case .polymarketValue:
            polymarketContent
        case .topAgentsPicks:
            topAgentsContent
        }
    }

    @ViewBuilder
    private var editorPicksContent: some View {
        if entry.editorPicks.isEmpty {
            EmptyStateView(contentType: .editorPicks)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 8) {
                ForEach(entry.editorPicks.prefix(itemCount)) { pick in
                    EditorPickRow(pick: pick, isCompact: false)
                }
            }
        }
    }

    @ViewBuilder
    private var fadeAlertsContent: some View {
        if entry.fadeAlerts.isEmpty {
            EmptyStateView(contentType: .fadeAlerts)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 8) {
                ForEach(entry.fadeAlerts.prefix(itemCount)) { alert in
                    FadeAlertRow(alert: alert, isCompact: false)
                }
            }
        }
    }

    @ViewBuilder
    private var polymarketContent: some View {
        if entry.polymarketValues.isEmpty {
            EmptyStateView(contentType: .polymarketValue)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 8) {
                ForEach(entry.polymarketValues.prefix(itemCount)) { value in
                    PolymarketRow(value: value, isCompact: false)
                }
            }
        }
    }

    @ViewBuilder
    private var topAgentsContent: some View {
        if entry.topAgentPicks.isEmpty {
            EmptyStateView(contentType: .topAgentsPicks)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 8) {
                ForEach(entry.topAgentPicks.prefix(2)) { agent in
                    TopAgentPicksRow(agent: agent, maxPicks: 1, isCompact: false)
                }
            }
        }
    }
}

// MARK: - Previews

#Preview("Medium - Editor Picks", as: .systemMedium) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .editorPicks,
        editorPicks: EditorPickWidgetData.sampleArray,
        fadeAlerts: [],
        polymarketValues: [],
        topAgentPicks: [],
        isPlaceholder: false,
        lastUpdated: Date()
    )
}

#Preview("Medium - Fade Alerts", as: .systemMedium) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .fadeAlerts,
        editorPicks: [],
        fadeAlerts: FadeAlertWidgetData.sampleArray,
        polymarketValues: [],
        topAgentPicks: [],
        isPlaceholder: false,
        lastUpdated: Date()
    )
}

#Preview("Medium - Polymarket", as: .systemMedium) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .polymarketValue,
        editorPicks: [],
        fadeAlerts: [],
        polymarketValues: PolymarketValueWidgetData.sampleArray,
        topAgentPicks: [],
        isPlaceholder: false,
        lastUpdated: Date()
    )
}

#Preview("Medium - Top Agents", as: .systemMedium) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .topAgentsPicks,
        editorPicks: [],
        fadeAlerts: [],
        polymarketValues: [],
        topAgentPicks: TopAgentWidgetData.sampleArray,
        isPlaceholder: false,
        lastUpdated: Date()
    )
}

#Preview("Medium - Empty", as: .systemMedium) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry.empty(contentType: .editorPicks)
}
