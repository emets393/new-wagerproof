package com.wagerproof.app

import android.app.Application
import com.wagerproof.core.shared.AppGroup

/**
 * App entry point. Mirrors iOS `WagerproofApp.init()` process-launch sequence
 * (doc 08 §1.1): initialize the shared-prefs surface, build the DI graph, then
 * boot process services. Auth-reactive work (session restore, RC user attach)
 * runs from the root composable, which can observe Compose state.
 */
class WagerproofApplication : Application() {

    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()

        // MUST precede AppGraph(...) — the graph eagerly constructs stores
        // (ThemeStore) whose init reads/writes StorePrefs → AppGroup.prefs.
        AppGroup.initialize(this)

        graph = AppGraph(this)
        graph.bootstrap()
    }
}
