package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.UUID

/**
 * Port of iOS `MainTabStore.swift`. Bottom-tab selection + tab-shell-level
 * sheet/navigation flags + cross-tab agent-navigation handoff.
 */
@Stable
class MainTabStore {

    /**
     * Visible bar order on phones: Games → Props → Agents → Outliers → Scoreboard.
     * `search` is iOS 18's detached search-tab slot; `settings` is retained for
     * the side-menu Settings row (Settings is pushed onto the active tab's nav
     * stack via [isSettingsPresented], not a bar tab).
     */
    enum class Tab(val raw: String) {
        Games("games"),
        Props("props"),
        Agents("agents"),
        Outliers("outliers"),
        Scoreboard("scoreboard"),
        Settings("settings"),
        Search("search"),
    }

    /** Payload for [pendingAgentRoute]. isPublic=true → public read-only detail. */
    data class PendingAgentRoute(val agentId: String, val isPublic: Boolean)

    var selected by mutableStateOf(Tab.Games)
    var isSideMenuPresented by mutableStateOf(false)

    /**
     * Feature Requests sheet, presented by the TAB SHELL. The side menu (itself
     * a sheet) dismisses FIRST, then flips this — chaining sheets inside the
     * menu sheet orphans presentations. Replicate the two-step handoff.
     */
    var isFeatureRequestsPresented by mutableStateOf(false)

    /** Roast full-screen cover; same chained-dismissal pattern. */
    var isRoastPresented by mutableStateOf(false)

    /**
     * Push Settings onto the ACTIVE tab's nav stack. Each tab consumes the flag
     * guarded by `selected == tab` so only the on-screen tab pushes.
     */
    var isSettingsPresented by mutableStateOf(false)

    /** WagerBot chat sheet, mounted centrally on the tab shell. */
    var isChatPresented by mutableStateOf(false)

    /**
     * Pending deep-navigation into the Agents tab's detail stack, set by global
     * Search. AgentsView observes, appends the route to its own back stack, then
     * clears. Kept as a plain value type to keep the store decoupled.
     */
    var pendingAgentRoute by mutableStateOf<PendingAgentRoute?>(null)

    /** Bumped when the user RE-TAPS the active tab; tab roots scroll-to-top/reset. */
    var scrollToTopTrigger by mutableStateOf(UUID.randomUUID()); private set

    /** Select a tab; re-tapping the active tab bumps [scrollToTopTrigger] instead. */
    fun select(tab: Tab) {
        if (tab == selected) {
            scrollToTopTrigger = UUID.randomUUID()
        } else {
            selected = tab
        }
    }

    /** Apply a deep-link route. Returns the resolved tab (null for non-tab-shell routes). */
    fun apply(route: DeepLinkRoute): Tab? = when (route) {
        DeepLinkRoute.Agents -> { selected = Tab.Agents; Tab.Agents }
        DeepLinkRoute.Outliers -> { selected = Tab.Outliers; Tab.Outliers }
        DeepLinkRoute.Feed -> { selected = Tab.Games; Tab.Games }
        DeepLinkRoute.ResetPassword -> null // auth router's concern
    }
}
