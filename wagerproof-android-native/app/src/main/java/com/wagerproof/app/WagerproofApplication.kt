package com.wagerproof.app

import android.app.Application
import com.google.firebase.messaging.FirebaseMessaging
import com.revenuecat.purchases.Purchases
import com.wagerproof.app.widgets.WidgetSyncCoordinator
import com.wagerproof.core.services.MetaAnalyticsService
import com.wagerproof.core.services.NotificationService
import com.wagerproof.core.services.SupabaseClients
import com.wagerproof.core.shared.AppGroup
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * App entry point. Mirrors iOS `WagerproofApp.init()` process-launch sequence
 * (doc 08 §1.1): initialize the shared-prefs surface, build the DI graph, then
 * boot process services. Auth-reactive work (session restore, RC user attach)
 * runs from the root composable, which can observe Compose state.
 */
class WagerproofApplication : Application(), DefaultLifecycleObserver {

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super<Application>.onCreate()

        // MUST precede AppGraph(...) — the graph eagerly constructs stores
        // (ThemeStore) whose init reads/writes StorePrefs → AppGroup.prefs.
        AppGroup.initialize(this)

        graph = AppGraph(this)
        graph.bootstrap()
        // Join explicit client-side Meta events to RevenueCat's server-side
        // CAPI events. Both SDKs are configured by graph.bootstrap(); failure
        // is non-fatal because attribution must never block app launch.
        runCatching {
            MetaAnalyticsService.anonymousId()?.let(Purchases.sharedInstance::setFBAnonymousID)
        }
        WidgetSyncCoordinator.schedule(this)
        WagerproofMessagingService.ensureNotificationChannel(this)
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)

        // Firebase is deliberately optional for credential-free local builds.
        // With google-services.json present, cache/register the existing token;
        // future rotations are handled by WagerproofMessagingService.
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                handleFirebaseToken(token)
            }
        }
    }

    /** Process-lifetime owner for token callbacks from the short-lived FCM service. */
    internal fun handleFirebaseToken(token: String) {
        NotificationService.cacheToken(token)
        registerCachedPushToken()
    }

    /** Retry transient registration failures whenever the app foregrounds. */
    override fun onStart(owner: LifecycleOwner) {
        registerCachedPushToken()
        refreshVisibleSlate()
    }

    /**
     * Re-hydrate the slate on foreground. MainScaffold's hydrate is keyed on
     * `Unit` and the Activity survives rotation (`configChanges` in the
     * manifest), so nothing else re-arms it — a two-hour background/resume
     * would repaint this morning's spreads, totals and splits until the user
     * happened to pull-to-refresh.
     *
     * Unforced and visible-sport only, matching pull-to-refresh's "refresh what
     * you see" scope: the 5-minute TTL makes a quick app-switch free, and the
     * other four sports would be a full multi-query pipeline each.
     */
    private fun refreshVisibleSlate() {
        if (!::graph.isInitialized) return
        // GamesStore holds Compose state — main thread, not the IO scope above.
        applicationScope.launch(Dispatchers.Main.immediate) {
            runCatching { graph.games.refresh(graph.games.selectedSport) }
        }
    }

    private fun registerCachedPushToken() {
        applicationScope.launch {
            runCatching { SupabaseClients.main.auth.awaitInitialization() }
            SupabaseClients.main.auth.currentSessionOrNull()?.user?.id?.let { userId ->
                NotificationService.registerPushToken(userId)
            }
        }
    }
}
