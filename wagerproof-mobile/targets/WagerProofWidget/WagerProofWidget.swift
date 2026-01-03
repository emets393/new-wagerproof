import WidgetKit
import SwiftUI

@main
struct WagerProofWidgetBundle: WidgetBundle {
    var body: some Widget {
        WagerProofWidget()
    }
}

struct WagerProofWidget: Widget {
    let kind: String = "WagerProofWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: ConfigurationIntent.self,
            provider: WagerProofTimelineProvider()
        ) { entry in
            WagerProofWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("WagerProof")
        .description("View latest picks, alerts, and market insights from WagerProof.")
        .supportedFamilies([.systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct WagerProofWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: WagerProofEntry

    var body: some View {
        switch family {
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            MediumWidgetView(entry: entry)
        }
    }
}

// MARK: - Widget Previews

#Preview("Medium Widget", as: .systemMedium) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .editorPicks,
        editorPicks: EditorPickWidgetData.sampleArray,
        fadeAlerts: FadeAlertWidgetData.sampleArray,
        polymarketValues: PolymarketValueWidgetData.sampleArray,
        isPlaceholder: false,
        lastUpdated: Date()
    )
}

#Preview("Large Widget", as: .systemLarge) {
    WagerProofWidget()
} timeline: {
    WagerProofEntry(
        date: Date(),
        contentType: .fadeAlerts,
        editorPicks: EditorPickWidgetData.sampleArray,
        fadeAlerts: FadeAlertWidgetData.sampleArray,
        polymarketValues: PolymarketValueWidgetData.sampleArray,
        isPlaceholder: false,
        lastUpdated: Date()
    )
}
