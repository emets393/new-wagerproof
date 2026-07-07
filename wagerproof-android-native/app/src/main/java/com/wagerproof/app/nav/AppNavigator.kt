package com.wagerproof.app.nav

import androidx.compose.runtime.Stable
import androidx.compose.runtime.staticCompositionLocalOf
import com.wagerproof.core.stores.MainTabStore

/**
 * Thin navigation facade handed to feature screens so they can push/pop routes
 * and raise shell overlays without knowing about [TabBackStacks] internals.
 * The Android stand-in for iOS pushing onto a per-tab `NavigationStack` +
 * flipping `MainTabStore` sheet flags. Provided by [MainScaffold] via
 * [LocalAppNavigator]; the current visible tab is captured at construction.
 */
@Stable
class AppNavigator(
    private val backStacks: TabBackStacks,
    private val tabStore: MainTabStore,
) {
    private val agentsTab = MainTabStore.Tab.Agents

    /**
     * Push a per-sport game-detail carousel onto the Games tab stack. The caller
     * has already set the matching sheet store's `selectedGame`; this route only
     * carries the ids so [com.wagerproof.app.features.games.GameDetailScreen] can
     * resolve the store + sorted slate.
     */
    fun openGameDetail(sport: String, gameId: String) =
        backStacks.push(MainTabStore.Tab.Games, AppRoute.GameDetail(sport, gameId))

    fun openAgentDetail(agentId: String, isPublic: Boolean) =
        backStacks.push(agentsTab, AppRoute.AgentDetail(agentId, isPublic))

    fun openAgentCreate() = backStacks.push(agentsTab, AppRoute.AgentCreate)

    fun openAgentEdit(agentId: String) = backStacks.push(agentsTab, AppRoute.AgentEdit(agentId))

    /** Settings is a shell overlay, not a pushed route (iOS pushes; Android overlays). */
    fun openSettings() {
        tabStore.isSettingsPresented = true
    }

    fun popAgents() {
        backStacks.pop(agentsTab)
    }
}

val LocalAppNavigator = staticCompositionLocalOf<AppNavigator> {
    error("LocalAppNavigator not provided — wrap content in MainScaffold")
}
