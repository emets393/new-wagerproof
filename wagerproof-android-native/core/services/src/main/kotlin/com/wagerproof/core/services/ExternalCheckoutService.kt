package com.wagerproof.core.services

import android.app.Activity
import android.content.Context
import android.net.Uri
import com.android.billingclient.api.*
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/** Google owns regional eligibility, parental controls, and the link-out disclosure. */
class ExternalCheckoutService(
    context: Context,
    private val prepareReportedCheckout: (suspend (String) -> Uri?)? = null,
) {
    private val client = BillingClient.newBuilder(context.applicationContext)
        .enableBillingProgram(BillingClient.BillingProgram.EXTERNAL_CONTENT_LINK)
        .build()

    private suspend fun connect(): Boolean {
        if (client.isReady) return true
        return suspendCancellableCoroutine { continuation ->
            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (continuation.isActive) continuation.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
                }
                override fun onBillingServiceDisconnected() {
                    if (continuation.isActive) continuation.resume(false)
                }
            })
        }
    }

    suspend fun isEligible(): Boolean = withTimeoutOrNull(8_000) {
        // Enabling link-out requires a verified reporting handoff, not just a
        // RevenueCat URL. Keep checkout hidden until that integration is supplied.
        if (prepareReportedCheckout == null || !connect()) return@withTimeoutOrNull false
        suspendCancellableCoroutine { continuation ->
            client.isBillingProgramAvailableAsync(BillingClient.BillingProgram.EXTERNAL_CONTENT_LINK) { result, _ ->
                if (continuation.isActive) continuation.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
            }
        }
    } ?: false

    /**
     * A reporting handoff is mandatory. It must durably associate the token with
     * the signed-in checkout and return its hosted URL before Play opens it.
     * Never fall back to ACTION_VIEW when eligibility, reporting, or disclosure fails.
     */
    suspend fun launch(activity: Activity): Result {
        if (!isEligible()) return Result.Unavailable
        val token = withTimeoutOrNull(8_000) {
            suspendCancellableCoroutine<String?> { continuation ->
                val params = BillingProgramReportingDetailsParams.newBuilder()
                    .setBillingProgram(BillingClient.BillingProgram.EXTERNAL_CONTENT_LINK).build()
                client.createBillingProgramReportingDetailsAsync(params) { result, details ->
                    if (continuation.isActive) continuation.resume(
                        details?.externalTransactionToken?.takeIf { result.responseCode == BillingClient.BillingResponseCode.OK }
                    )
                }
            }
        } ?: return Result.Unavailable
        val url = prepareReportedCheckout?.invoke(token) ?: return Result.Unavailable
        if (url.scheme != "https" || url.host != "pay.rev.cat") return Result.Unavailable
        return suspendCancellableCoroutine { continuation ->
            val params = LaunchExternalLinkParams.newBuilder()
                .setBillingProgram(BillingClient.BillingProgram.EXTERNAL_CONTENT_LINK)
                .setLinkUri(url)
                .setLinkType(LaunchExternalLinkParams.LinkType.LINK_TO_DIGITAL_CONTENT_OFFER)
                .setLaunchMode(LaunchExternalLinkParams.LaunchMode.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP)
                .build()
            client.launchExternalLink(activity, params) { result ->
                if (continuation.isActive) continuation.resume(when (result.responseCode) {
                    BillingClient.BillingResponseCode.OK -> Result.Opened
                    BillingClient.BillingResponseCode.USER_CANCELED -> Result.Cancelled
                    else -> Result.Unavailable
                })
            }
        }
    }

    fun close() = client.endConnection()
    enum class Result { Opened, Cancelled, Unavailable }
}
