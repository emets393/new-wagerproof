import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Outliers tab — filterable NFL betting trends (teams, coaches, refs, players).
struct OutliersView: View {
    @Environment(MainTabStore.self) private var tabStore
    @Environment(AuthStore.self) private var auth
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    @Environment(ProAccessStore.self) private var proAccess
    // Shell-hoisted (MainTabView) so the Outliers tab and SearchView's "Outliers"
    // results section share one fetch. See .claude/docs/14_ios_primitives_index.md.
    @Environment(OutliersTrendsStore.self) private var trendsStore

    var body: some View {
        NavigationStack {
            ScrollView {
                OutliersTrendsView(store: trendsStore)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Outliers")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await trendsStore.refresh() }
            .task {
                if case .idle = trendsStore.loadState {
                    await trendsStore.refresh()
                }
            }
            .toolbar { mainToolbar }
            .wagerProofSettingsDestination(
                tabStore: tabStore,
                tab: .outliers,
                auth: auth,
                settingsStore: settingsStore,
                revenueCat: revenueCat,
                adminMode: adminMode,
                proAccess: proAccess
            )
            .wagerProofChatDestination(tabStore: tabStore, tab: .outliers)
        }
    }

    // WagerBot launcher hidden app-wide — see MainTabToolbar.swift's
    // WagerBotToolbarButton.
    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        WagerProofLeadingToolbarItem()
        ToolbarItemGroup(placement: .topBarTrailing) {
            SettingsToolbarButton(tabStore: tabStore)
        }
    }
}

#if DEBUG
#Preview {
    OutliersView()
        .environment(AuthStore())
        .environment(ProAccessStore(revenueCat: RevenueCatStore(), adminMode: AdminModeStore()))
        .environment(MainTabStore())
        .environment(SettingsStore())
        .environment(RevenueCatStore())
        .environment(AdminModeStore())
        .environment(OutliersTrendsStore())
}
#endif
