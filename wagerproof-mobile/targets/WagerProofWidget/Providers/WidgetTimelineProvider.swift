import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Timeline Entry

struct WagerProofEntry: TimelineEntry {
    let date: Date
    let contentType: WidgetContentType
    let editorPicks: [EditorPickWidgetData]
    let fadeAlerts: [FadeAlertWidgetData]
    let polymarketValues: [PolymarketValueWidgetData]
    let isPlaceholder: Bool
    let lastUpdated: Date?

    static var placeholder: WagerProofEntry {
        WagerProofEntry(
            date: Date(),
            contentType: .editorPicks,
            editorPicks: EditorPickWidgetData.sampleArray,
            fadeAlerts: [],
            polymarketValues: [],
            isPlaceholder: true,
            lastUpdated: nil
        )
    }

    static func empty(contentType: WidgetContentType) -> WagerProofEntry {
        WagerProofEntry(
            date: Date(),
            contentType: contentType,
            editorPicks: [],
            fadeAlerts: [],
            polymarketValues: [],
            isPlaceholder: false,
            lastUpdated: nil
        )
    }
}

// MARK: - Content Type App Enum

enum ContentTypeAppEnum: String, AppEnum, CaseIterable {
    case editorPicks
    case fadeAlerts
    case polymarketValue

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Content Type")

    static var caseDisplayRepresentations: [ContentTypeAppEnum: DisplayRepresentation] = [
        .editorPicks: DisplayRepresentation(title: "Editor Picks", image: .init(systemName: "star.fill")),
        .fadeAlerts: DisplayRepresentation(title: "Fade Alerts", image: .init(systemName: "bolt.fill")),
        .polymarketValue: DisplayRepresentation(title: "Market Value", image: .init(systemName: "chart.line.uptrend.xyaxis"))
    ]

    var widgetContentType: WidgetContentType {
        switch self {
        case .editorPicks: return .editorPicks
        case .fadeAlerts: return .fadeAlerts
        case .polymarketValue: return .polymarketValue
        }
    }
}

// MARK: - Configuration Intent

struct ConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Configure WagerProof Widget"
    static var description = IntentDescription("Choose what content to display on your widget")

    @Parameter(title: "Content Type", default: .editorPicks)
    var contentType: ContentTypeAppEnum
}

// MARK: - Timeline Provider

struct WagerProofTimelineProvider: AppIntentTimelineProvider {
    typealias Entry = WagerProofEntry
    typealias Intent = ConfigurationIntent

    func placeholder(in context: Context) -> Entry {
        .placeholder
    }

    func snapshot(for configuration: Intent, in context: Context) async -> Entry {
        // For preview, use sample data
        if context.isPreview {
            return createSampleEntry(for: configuration.contentType.widgetContentType)
        }

        return await createEntry(for: configuration.contentType.widgetContentType)
    }

    func timeline(for configuration: Intent, in context: Context) async -> Timeline<Entry> {
        let entry = await createEntry(for: configuration.contentType.widgetContentType)

        // Schedule next update in 60 minutes (user requested)
        // iOS controls actual refresh rate (40-70 times/day max)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 60, to: Date())!
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }

    // MARK: - Private Helpers

    private func createEntry(for contentType: WidgetContentType) async -> Entry {
        let dataManager = AppGroupDataManager.shared

        print("Widget Timeline: Creating entry for \(contentType.displayName)")

        // ALWAYS prefer cached data from App Group (app is the source of truth)
        // This ensures data persists and doesn't disappear after stale threshold
        if let cached = dataManager.loadData() {
            let hasContent = !cached.editorPicks.isEmpty ||
                             !cached.fadeAlerts.isEmpty ||
                             !cached.polymarketValues.isEmpty

            print("Widget Timeline: Found cached data - picks: \(cached.editorPicks.count), fades: \(cached.fadeAlerts.count), values: \(cached.polymarketValues.count)")

            if hasContent {
                return Entry(
                    date: Date(),
                    contentType: contentType,
                    editorPicks: cached.editorPicks,
                    fadeAlerts: cached.fadeAlerts,
                    polymarketValues: cached.polymarketValues,
                    isPlaceholder: false,
                    lastUpdated: cached.lastUpdated
                )
            }
        }

        print("Widget Timeline: No cached data found in App Group")

        // Fallback: Only fetch from Supabase if NO cached data exists
        // This handles the case where the app has never been opened
        print("Widget Timeline: Fetching from Supabase as fallback...")
        let fetchedData = await SupabaseWidgetService.shared.fetchAllData()

        // Check if we got any data
        let hasData = !fetchedData.editorPicks.isEmpty ||
                      !fetchedData.fadeAlerts.isEmpty ||
                      !fetchedData.polymarketValues.isEmpty

        print("Widget Timeline: Supabase fetch result - picks: \(fetchedData.editorPicks.count), fades: \(fetchedData.fadeAlerts.count), values: \(fetchedData.polymarketValues.count)")

        if hasData {
            return Entry(
                date: Date(),
                contentType: contentType,
                editorPicks: fetchedData.editorPicks,
                fadeAlerts: fetchedData.fadeAlerts,
                polymarketValues: fetchedData.polymarketValues,
                isPlaceholder: false,
                lastUpdated: fetchedData.lastUpdated
            )
        }

        // No data available
        print("Widget Timeline: No data available, returning empty entry")
        return .empty(contentType: contentType)
    }

    private func createSampleEntry(for contentType: WidgetContentType) -> Entry {
        Entry(
            date: Date(),
            contentType: contentType,
            editorPicks: EditorPickWidgetData.sampleArray,
            fadeAlerts: FadeAlertWidgetData.sampleArray,
            polymarketValues: PolymarketValueWidgetData.sampleArray,
            isPlaceholder: false,
            lastUpdated: Date()
        )
    }
}
