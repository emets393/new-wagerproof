import SwiftUI
import WidgetKit

struct LargeWidgetView: View {
    let entry: WagerProofEntry

    private var itemCount: Int { 5 }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            WidgetHeader(contentType: entry.contentType)

            // Content
            contentView

            Spacer(minLength: 0)

            // Footer with last updated
            if let lastUpdated = entry.lastUpdated {
                footerView(lastUpdated: lastUpdated)
            }
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
        }
    }

    @ViewBuilder
    private var editorPicksContent: some View {
        if entry.editorPicks.isEmpty {
            EmptyStateView(contentType: .editorPicks)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 4) {
                ForEach(entry.editorPicks.prefix(itemCount)) { pick in
                    EditorPickRow(pick: pick, isCompact: true)
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
            VStack(spacing: 4) {
                ForEach(entry.fadeAlerts.prefix(itemCount)) { alert in
                    FadeAlertRow(alert: alert, isCompact: true)
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
            VStack(spacing: 4) {
                ForEach(entry.polymarketValues.prefix(itemCount)) { value in
                    PolymarketRow(value: value, isCompact: true)
                }
            }
        }
    }

    private func footerView(lastUpdated: Date) -> some View {
        HStack {
            Spacer()
            Text("Updated \(lastUpdated, style: .date)")
                .font(.system(size: 10, weight: .regular))
                .foregroundColor(.wpDarkGray)
        }
        .padding(.top, 4)
    }
}

// MARK: - Previews

#Preview("Large - Editor Picks", as: .systemLarge) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .editorPicks,
        editorPicks: EditorPickWidgetData.sampleArray,
        fadeAlerts: [],
        polymarketValues: [],
        isPlaceholder: false,
        lastUpdated: Date().addingTimeInterval(-300)
    )
}

#Preview("Large - Fade Alerts", as: .systemLarge) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .fadeAlerts,
        editorPicks: [],
        fadeAlerts: FadeAlertWidgetData.sampleArray,
        polymarketValues: [],
        isPlaceholder: false,
        lastUpdated: Date().addingTimeInterval(-600)
    )
}

#Preview("Large - Polymarket", as: .systemLarge) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .polymarketValue,
        editorPicks: [],
        fadeAlerts: [],
        polymarketValues: PolymarketValueWidgetData.sampleArray,
        isPlaceholder: false,
        lastUpdated: Date().addingTimeInterval(-900)
    )
}

#Preview("Large - Empty", as: .systemLarge) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry.empty(contentType: .fadeAlerts)
}
