package com.wagerproof.app.nav

import com.wagerproof.core.stores.MainTabStore

/**
 * Destinations reachable inside the signed-in shell. iOS models these as per-tab
 * SwiftUI `NavigationStack` paths; Android replicates that with one back stack
 * PER TAB (see [TabBackStacks]). Each tab's stack always has its home route at
 * the bottom.
 *
 * Store-API note: iOS's `MainTabStore` owns only the SELECTED tab + sheet flags,
 * not the per-tab nav paths (those live in each `NavigationStack`). We match that
 * split — the back stacks are Compose state owned by the nav layer, driven by the
 * store's `selected` / `pendingAgentRoute` / `isSettingsPresented` signals.
 */
sealed interface AppRoute {

    /** The tab this route's home belongs to (for building each tab's initial stack). */
    val homeTab: MainTabStore.Tab

    // --- Tab roots -----------------------------------------------------------
    data object GamesFeed : AppRoute { override val homeTab = MainTabStore.Tab.Games }
    data object PropsFeed : AppRoute { override val homeTab = MainTabStore.Tab.Props }
    data object AgentsList : AppRoute { override val homeTab = MainTabStore.Tab.Agents }
    data object OutliersFeed : AppRoute { override val homeTab = MainTabStore.Tab.Outliers }
    data object SearchHome : AppRoute { override val homeTab = MainTabStore.Tab.Search }
    data object Scoreboard : AppRoute { override val homeTab = MainTabStore.Tab.Scoreboard }

    // --- Pushed destinations -------------------------------------------------
    data class GameDetail(val sport: String, val gameId: String) : AppRoute {
        override val homeTab = MainTabStore.Tab.Games
    }

    data class AgentDetail(val agentId: String, val isPublic: Boolean) : AppRoute {
        override val homeTab = MainTabStore.Tab.Agents
    }

    data object AgentCreate : AppRoute { override val homeTab = MainTabStore.Tab.Agents }

    /** Owner-only agent settings editor (list Edit swipe + detail gear). */
    data class AgentEdit(val agentId: String) : AppRoute {
        override val homeTab = MainTabStore.Tab.Agents
    }

    companion object {
        /** The home (root) route for a given tab — bottom of that tab's stack. */
        fun home(tab: MainTabStore.Tab): AppRoute = when (tab) {
            MainTabStore.Tab.Games -> GamesFeed
            MainTabStore.Tab.Props -> PropsFeed
            MainTabStore.Tab.Agents -> AgentsList
            MainTabStore.Tab.Outliers -> OutliersFeed
            MainTabStore.Tab.Search -> SearchHome
            MainTabStore.Tab.Scoreboard -> Scoreboard
            // Settings isn't a bar tab; it's presented as an overlay (isSettingsPresented).
            MainTabStore.Tab.Settings -> GamesFeed
        }
    }
}
