package com.wagerproof.core.stores

import android.content.Intent
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.interfaces.UpdatedCustomerInfoListener
import com.revenuecat.purchases.interfaces.RedeemWebPurchaseListener
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.RevenueCatService
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch

/**
 * Port of iOS `RevenueCatStore.swift` (doc §4.1).
 *
 * Bootstraps the Purchases SDK, aliases the Supabase user, subscribes to the
 * customer-info stream, and caches entitlement state. Carries the
 * trust-downgrade guard: an untrusted (stream) update never flips
 * granted→denied — only trusted refreshes can.
 */
@Stable
class RevenueCatStore {
    enum class EntitlementStatus { Unknown, Granted, Denied }

    enum class CustomerInfoSource {
        Login, LoginRestore, Refresh, Purchase, Restore, Stream;

        val isTrusted get() = this != Stream
    }

    /** One-shot presentation state consumed by RootHost as a snackbar/dialog. */
    data class WebPurchaseRedemptionMessage(
        val text: String,
        val isError: Boolean,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var isInitialized by mutableStateOf(false); private set
    var isLoading by mutableStateOf(true); private set

    /**
     * `true` only after a LIVE fetch for the signed-in user succeeded. Gates
     * the post-onboarding paywall so paying users don't see a one-frame paywall
     * flash from the SDK's stale cached `.denied` on cold launch.
     */
    var hasResolvedActiveUserEntitlement by mutableStateOf(false); private set

    // SDK payload types kept as the real RevenueCat types — RevenueCatService
    // already works with these.
    var customerInfo by mutableStateOf<CustomerInfo?>(null); private set
    var offering by mutableStateOf<Offering?>(null); private set
    var entitlementStatus by mutableStateOf(EntitlementStatus.Unknown); private set
    var subscriptionType by mutableStateOf<String?>(null); private set
    var lastError by mutableStateOf<String?>(null); private set
    var isRedeemingWebPurchase by mutableStateOf(false); private set
    var webPurchaseRedemptionMessage by mutableStateOf<WebPurchaseRedemptionMessage?>(null)
        private set

    // No AppGroupKey constant for this one — use the literal (byte-identical to iOS).
    private val forceFreemiumKey = "rc_force_freemium"

    private var _forceFreemiumMode by mutableStateOf(
        StorePrefs.appGroup.getBoolean(forceFreemiumKey, false),
    )

    /** Secret-settings "Simulate Freemium" toggle; setter persists. */
    var forceFreemiumMode: Boolean
        get() = _forceFreemiumMode
        set(value) {
            _forceFreemiumMode = value
            StorePrefs.appGroup.edit().putBoolean(forceFreemiumKey, value).apply()
        }

    /** Effective Pro flag. `false` when freemium is simulated, else driven by cached entitlement. */
    val isPro: Boolean
        get() = if (forceFreemiumMode) false else entitlementStatus == EntitlementStatus.Granted

    val isEntitlementResolved get() = entitlementStatus != EntitlementStatus.Unknown

    private var streamJob: Job? = null
    private var currentUserId: String? = null

    /** Bootstrap the RevenueCat SDK. Idempotent. Called at app launch before auth fires. */
    fun bootstrap() {
        if (isInitialized) {
            startCustomerInfoStream()
            return
        }
        // iOS: RevenueCatService.shared.bootstrap(userId: nil). Android SDK needs a Context.
        RevenueCatService.bootstrap(AppGroup.context, userId = null)
        isInitialized = RevenueCatService.isConfigured
        // Subscribe as soon as the SDK is up so we don't miss Play Billing lifecycle events.
        startCustomerInfoStream()
    }

    /** Identify a Supabase user with RevenueCat. Called from the auth lifecycle handler. */
    suspend fun attachUser(userId: String) {
        // Defensive self-bootstrap makes auth attachment safe even if a future
        // entry point invokes it before AppGraph.bootstrap().
        if (!isInitialized) bootstrap()
        if (!isInitialized) {
            lastError = "Subscription service failed to initialize."
            isLoading = false
            return
        }
        currentUserId = userId
        isLoading = true
        try {
            val result = RevenueCatService.logIn(userId)
            apply(result.customerInfo, CustomerInfoSource.Login)
            refreshOffering()
            lastError = null
            // Only on the success path — a failed login keeps stale state and the
            // paywall predicate should keep waiting rather than fire on pre-login data.
            hasResolvedActiveUserEntitlement = true
        } catch (e: Throwable) {
            lastError = e.localizedMessage ?: e.message
            // Never downgrade paying users on a network blip; only lift from `unknown`.
            if (entitlementStatus == EntitlementStatus.Unknown) {
                entitlementStatus = EntitlementStatus.Denied
            }
        }
        isLoading = false
    }

    /** Reset back to an anonymous RC user. Called on Supabase sign-out. */
    suspend fun detachUser() {
        currentUserId = null
        if (isInitialized) RevenueCatService.logOut()
        customerInfo = null
        entitlementStatus = EntitlementStatus.Denied
        subscriptionType = null
        isLoading = false
        hasResolvedActiveUserEntitlement = false
    }

    /** Force-refresh customer info from RC servers. Trusted source — may downgrade granted→denied. */
    suspend fun refreshCustomerInfo() {
        if (!isInitialized) {
            isLoading = false
            return
        }
        try {
            val info = RevenueCatService.customerInfo()
            apply(info, CustomerInfoSource.Refresh)
            lastError = null
            hasResolvedActiveUserEntitlement = true
        } catch (e: Throwable) {
            lastError = e.localizedMessage ?: e.message
            if (entitlementStatus == EntitlementStatus.Unknown) entitlementStatus = EntitlementStatus.Denied
        }
    }

    /** Restore purchases from the store. Trusted source. */
    suspend fun restorePurchases() {
        val info = RevenueCatService.restorePurchases()
        apply(info, CustomerInfoSource.Restore)
    }

    /** Force-sync purchases from the store. Trusted source. */
    suspend fun syncPurchases() {
        val info = RevenueCatService.syncPurchases()
        apply(info, CustomerInfoSource.Refresh)
    }

    /**
     * Handle a RevenueCat Web Billing callback intent.
     *
     * @return true when the intent belonged to RevenueCat (including failure
     * states), or false when normal app deep-link routing should handle it.
     */
    suspend fun handleWebPurchaseRedemption(intent: Intent): Boolean {
        val redemption = RevenueCatService.webPurchaseRedemption(intent) ?: return false
        if (isRedeemingWebPurchase) return true

        if (!isInitialized) bootstrap()
        if (!isInitialized) {
            webPurchaseRedemptionMessage = WebPurchaseRedemptionMessage(
                text = "Subscription service failed to initialize. Please try again.",
                isError = true,
            )
            return true
        }

        isRedeemingWebPurchase = true
        try {
            when (val result = RevenueCatService.redeemWebPurchase(redemption)) {
                is RedeemWebPurchaseListener.Result.Success -> {
                    // RevenueCat returns authoritative CustomerInfo with the
                    // redemption response. Apply it as a trusted purchase so
                    // the stream downgrade guard cannot hide the entitlement.
                    apply(result.customerInfo, CustomerInfoSource.Purchase)
                    hasResolvedActiveUserEntitlement = true
                    lastError = null
                    refreshOffering()
                    webPurchaseRedemptionMessage = WebPurchaseRedemptionMessage(
                        text = "Purchase redeemed successfully.",
                        isError = false,
                    )
                }

                is RedeemWebPurchaseListener.Result.Expired -> {
                    webPurchaseRedemptionMessage = WebPurchaseRedemptionMessage(
                        text = "This purchase redemption link has expired.",
                        isError = true,
                    )
                }

                RedeemWebPurchaseListener.Result.InvalidToken -> {
                    webPurchaseRedemptionMessage = WebPurchaseRedemptionMessage(
                        text = "This purchase redemption link is invalid.",
                        isError = true,
                    )
                }

                RedeemWebPurchaseListener.Result.PurchaseBelongsToOtherUser -> {
                    webPurchaseRedemptionMessage = WebPurchaseRedemptionMessage(
                        text = "This purchase belongs to a different account.",
                        isError = true,
                    )
                }

                is RedeemWebPurchaseListener.Result.Error -> {
                    webPurchaseRedemptionMessage = WebPurchaseRedemptionMessage(
                        text = result.error.message.ifBlank {
                            "We couldn't redeem this purchase. Please try again."
                        },
                        isError = true,
                    )
                }
            }
        } catch (e: Throwable) {
            val message = e.localizedMessage?.takeIf { it.isNotBlank() }
                ?: "We couldn't redeem this purchase. Please try again."
            lastError = message
            webPurchaseRedemptionMessage = WebPurchaseRedemptionMessage(message, isError = true)
        } finally {
            isRedeemingWebPurchase = false
        }
        return true
    }

    /** Fetch the current offering (used for paywall display). */
    suspend fun refreshOffering() {
        offering = try {
            RevenueCatService.currentOffering()
        } catch (e: Throwable) {
            null
        }
    }

    suspend fun fetchOffering(placementId: String): Offering? = try {
        RevenueCatService.offering(placementId)
    } catch (e: Throwable) {
        null
    }

    fun clearError() {
        lastError = null
    }

    fun clearWebPurchaseRedemptionMessage() {
        webPurchaseRedemptionMessage = null
    }

    // MARK: - Internal

    /**
     * Apply a CustomerInfo snapshot. Honors the trust-downgrade guard so an
     * untrusted stream update can never lock a paying user out — only an
     * explicit refresh / restore / purchase can.
     */
    private fun apply(info: CustomerInfo, source: CustomerInfoSource) {
        val hasEntitlement = RevenueCatService.hasProEntitlement(info)
        val nextStatus = if (hasEntitlement) EntitlementStatus.Granted else EntitlementStatus.Denied
        val nextType = RevenueCatService.activeSubscriptionType(info)

        // Trust-downgrade guard. The native listener fires with stale
        // anonymous-identity data during sign-in; honoring it would strand
        // paying users. Real downgrades arrive via a trusted refresh.
        if (entitlementStatus == EntitlementStatus.Granted &&
            nextStatus == EntitlementStatus.Denied &&
            !source.isTrusted
        ) {
            return
        }

        customerInfo = info
        entitlementStatus = nextStatus
        subscriptionType = nextType

        // Persist a coarse snapshot to App Group so widgets + cold launch can
        // render Pro state without waiting for RC.
        val editor = StorePrefs.appGroup.edit()
        editor.putBoolean(AppGroupKey.PRO_ENTITLEMENT_GRANTED, hasEntitlement)
        if (nextType != null) {
            editor.putString(AppGroupKey.PRO_SUBSCRIPTION_TYPE, nextType)
        } else {
            editor.remove(AppGroupKey.PRO_SUBSCRIPTION_TYPE)
        }
        editor.apply()
    }

    /**
     * Subscribe to RevenueCat's customer-info updates. Every emission re-applies
     * as an untrusted `.stream` source so the trust-downgrade guard protects
     * already-granted users.
     *
     * FIDELITY-WAIVER #B21: RevenueCatService exposes no stream method (unlike
     * the iOS wrapper's `customerInfoStream`), so we bind the Android SDK's
     * single `updatedCustomerInfoListener` directly via callbackFlow. The SDK
     * supports only one listener; nothing else in the app registers one.
     */
    private fun startCustomerInfoStream() {
        if (streamJob != null) return
        streamJob = scope.launch {
            customerInfoUpdates().collect { info -> apply(info, CustomerInfoSource.Stream) }
        }
    }

    private fun customerInfoUpdates(): Flow<CustomerInfo> = callbackFlow {
        // Guard against an unconfigured SDK (placeholder API key in some builds).
        val purchases = runCatching { Purchases.sharedInstance }.getOrNull()
            ?: run { close(); return@callbackFlow }
        val listener = UpdatedCustomerInfoListener { info -> trySend(info) }
        purchases.updatedCustomerInfoListener = listener
        awaitClose { purchases.updatedCustomerInfoListener = null }
    }

    /** Cancel the store scope AND the stream Job (fixes the iOS deinit stream leak). */
    fun close() {
        streamJob?.cancel()
        streamJob = null
        scope.cancel()
    }

    // MARK: - DEBUG

    fun debugSet(
        status: EntitlementStatus,
        subscriptionType: String? = null,
        isLoading: Boolean = false,
    ) {
        if (!BuildFlags.isDebugBuild) return
        this.entitlementStatus = status
        this.subscriptionType = subscriptionType
        this.isLoading = isLoading
        this.isInitialized = true
    }
}
