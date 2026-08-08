package com.wagerproof.core.stores

import android.net.Uri
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.shared.AppGroupKey

/**
 * Port of iOS `RootRouter.swift`. Top-level state machine behind the root
 * `when(phase)` composable switch (launching / auth / onboarding / main app).
 * Also queues deep links until auth resolves.
 */
@Stable
class RootRouter {

    enum class Phase { Launching, Unauthenticated, Onboarding, Ready }

    /**
     * Also set by "Reset Onboarding" — survives into [Phase.Ready] so the root
     * view can force the post-onboarding paywall for a Pro/admin tester.
     * Cleared via [clearTestPaywallOverride].
     */
    var testPaywallOverride by mutableStateOf(false); private set

    /** Swappable in local JVM tests so router tests never require Android prefs. */
    internal var testPaywallOverridePersistence: TestPaywallOverridePersistence =
        AppGroupTestPaywallOverridePersistence

    var phase by mutableStateOf(Phase.Launching); private set

    /** Deep-link route captured before auth resolved; replayed once [Phase.Ready]. */
    var pendingDeepLinkRoute by mutableStateOf<DeepLinkRoute?>(null); private set

    /** The ONLY phase mutator in normal flow. */
    fun resolve(authPhase: AuthStore.Phase, onboardingComplete: Boolean) {
        when (authPhase) {
            is AuthStore.Phase.Launching -> phase = Phase.Launching
            is AuthStore.Phase.Unauthenticated -> {
                // Sign-out ends a forced test run — the next account shouldn't inherit the override.
                clearTestPaywallOverride()
                phase = Phase.Unauthenticated
            }
            is AuthStore.Phase.Authenticated -> {
                phase = if (onboardingComplete) Phase.Ready else Phase.Onboarding
            }
        }
    }

    /**
     * Restore Secret Settings' pending replay before resolving the authenticated
     * root phase. A matching user keeps the override after process recreation;
     * a direct A -> B account switch clears it so the gate cannot cross accounts.
     */
    fun restoreTestPaywallOverride(userId: String) {
        val normalizedUserId = userId.trim().lowercase()
        val persistedUserId = testPaywallOverridePersistence.readUserId()
        testPaywallOverride = persistedUserId == normalizedUserId
        if (persistedUserId != null && !testPaywallOverride) {
            testPaywallOverridePersistence.clear()
        }
    }

    /** Backs Secret Settings' "Reset Onboarding". Caller must reset OnboardingStore first. */
    fun forceOnboardingForTestingNow(userId: String) {
        val normalizedUserId = userId.trim().lowercase()
        testPaywallOverridePersistence.writeUserId(normalizedUserId)
        testPaywallOverride = true
        phase = Phase.Onboarding
    }

    fun clearTestPaywallOverride() {
        testPaywallOverridePersistence.clear()
        testPaywallOverride = false
    }

    /** Parse + queue a deep link in ALL phases (queue-until-ready). */
    fun handle(uri: Uri) {
        val route = DeepLinkRoute.fromUri(uri) ?: return
        pendingDeepLinkRoute = route
    }

    /** Read+clear. Called by the root view's phase-change handler once [Phase.Ready]. */
    fun consumePendingDeepLink(): DeepLinkRoute? {
        val route = pendingDeepLinkRoute
        pendingDeepLinkRoute = null
        return route
    }
}

internal interface TestPaywallOverridePersistence {
    fun readUserId(): String?
    fun writeUserId(userId: String)
    fun clear()
}

private object AppGroupTestPaywallOverridePersistence : TestPaywallOverridePersistence {
    override fun readUserId(): String? = StorePrefs.appGroup
        .getString(AppGroupKey.TEST_PAYWALL_OVERRIDE_USER_ID, null)
        ?.trim()
        ?.lowercase()

    override fun writeUserId(userId: String) {
        StorePrefs.appGroup.edit()
            .putString(AppGroupKey.TEST_PAYWALL_OVERRIDE_USER_ID, userId)
            .apply()
    }

    override fun clear() {
        StorePrefs.appGroup.edit()
            .remove(AppGroupKey.TEST_PAYWALL_OVERRIDE_USER_ID)
            .apply()
    }
}

/** Mirrors the deep-link map in RN `app/(drawer)/_layout.tsx`. */
enum class DeepLinkRoute {
    Agents, Outliers, Feed, ResetPassword;

    companion object {
        fun fromUri(uri: Uri): DeepLinkRoute? {
            if (uri.scheme != "wagerproof") return null
            val host = uri.host ?: uri.pathSegments.firstOrNull()
            return when (host) {
                "agents" -> Agents
                "outliers" -> Outliers
                "feed" -> Feed
                "reset-password" -> ResetPassword
                else -> Feed // matches RN's default
            }
        }
    }
}
