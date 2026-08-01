package com.wagerproof.app.features.paywall

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.provider.Settings
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.PackageType
import com.revenuecat.purchases.PurchasesErrorCode
import com.revenuecat.purchases.PurchasesException
import com.revenuecat.purchases.PurchasesTransactionException
import com.revenuecat.purchases.models.OfferPaymentMode
import com.revenuecat.purchases.models.Period
import com.revenuecat.purchases.models.StoreProduct
import com.revenuecat.purchases.models.StoreTransaction
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.backgrounds.PixelDotAnimation
import com.wagerproof.core.design.backgrounds.PixelDotBackground
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.services.AnalyticsService
import com.wagerproof.core.services.PaywallConversionTracker
import com.wagerproof.core.services.RevenueCatService
import com.wagerproof.core.stores.AuthStore
import kotlinx.coroutines.launch
import java.math.BigDecimal
import kotlin.math.roundToInt

/**
 * Fully custom Compose checkout — port of iOS `CustomPaywallView.swift`.
 *
 * RevenueCat stays the source of truth for offerings, localized prices, offer
 * eligibility, purchases, restores and the WagerProof Pro entitlement; it just
 * doesn't own a pixel of this screen. The visual hierarchy is product-led: one
 * flexible feature hero ([PaywallValueCarousel]), compact plan cards, one
 * branded purchase action.
 *
 * Mixpanel event names and property keys are IDENTICAL to iOS on purpose — the
 * paywall funnel is reported cross-platform off one set of events, so renaming
 * one here silently halves the funnel rather than breaking anything loudly.
 *
 * Plan resolution, price math and billing copy live in [PaywallPlanResolver]
 * (unit-tested); this file is presentation + SDK plumbing only.
 */
private const val PAYWALL_VARIANT = "custom_v2_product_hero"
private const val TERMS_URL = "https://wagerproof.bet/terms-and-conditions"
private const val PRIVACY_URL = "https://wagerproof.bet/privacy-policy"

@Composable
internal fun CustomPaywallView(
    offering: Offering,
    allowClose: Boolean,
    source: String,
    accent: Color,
    agentName: String,
    spriteIndex: Int,
    researchBucketRaw: String?,
    stakesBucketRaw: String?,
    onPurchaseFinalized: (StoreTransaction?, CustomerInfo) -> Unit,
    onRequestClose: () -> Unit,
    /**
     * Secret-Settings debug preview flag. Renders the close control as a loud red
     * DEBUG pill so a tester can escape the otherwise-hard onboarding paywall and
     * can never mistake a debug run for the real gate. Requires [allowClose] —
     * the host forces it on in debug.
     */
    debugClose: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val graph = appGraph()
    val auth = graph.auth
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val reduceMotion = remember(context) { isReduceMotionEnabled(context) }

    // Adapt RevenueCat's catalog once; every downstream decision reads the
    // plain-Kotlin projection so the rules stay unit-testable.
    val products = remember(offering) { offering.availablePackages.map { it.toPaywallProduct() } }
    val packagesById = remember(offering) { offering.availablePackages.associateBy { it.identifier } }
    val entryOffer = remember(offering) { PaywallPlanResolver.entryOffer(offering.metadata) }
    val resolved = remember(products, entryOffer) { PaywallPlanResolver.resolve(products, entryOffer) }

    var selectedId by remember(offering.identifier) {
        mutableStateOf(PaywallPlanResolver.defaultSelection(resolved)?.packageId)
    }
    val selected = resolved.plans.firstOrNull { it.id == selectedId }?.product

    var isPurchasing by remember { mutableStateOf(false) }
    var isRestoring by remember { mutableStateOf(false) }
    var isSigningOut by remember { mutableStateOf(false) }
    var confirmSignOut by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var infoMessage by remember { mutableStateOf<String?>(null) }

    var didTrackPresented by remember(offering.identifier) { mutableStateOf(false) }
    LaunchedEffect(offering.identifier, selectedId) {
        if (didTrackPresented) return@LaunchedEffect
        didTrackPresented = true
        AnalyticsService.track(
            "paywall_presented",
            mapOf(
                "source" to source,
                "variant" to PAYWALL_VARIANT,
                "plans" to resolved.plans.joinToString(",") { it.name },
                "research_time_bucket" to (researchBucketRaw ?: "none"),
            ),
        )
        // Meta ViewContent — gives value optimization a dollar signal at the
        // impression, well before any purchase resolves. Pass the plan we
        // actually highlighted, not the offering's default: this paywall skips
        // `$rc_annual` in some offerings, so the offering-derived fallback would
        // report a price the user never saw.
        PaywallConversionTracker.trackPaywallView(
            source = source,
            offering = offering,
            pkg = selectedId?.let { packagesById[it] },
        )
    }

    fun buy() {
        val plan = resolved.plans.firstOrNull { it.id == selectedId } ?: return
        val rcPackage = packagesById[plan.id] ?: return
        val activity = context.findActivity()
        if (isPurchasing) return
        if (activity == null) {
            errorMessage = "The purchase couldn't be started. Reopen the app and try again."
            return
        }
        val baseProperties = mapOf(
            "source" to source,
            "variant" to PAYWALL_VARIANT,
            "plan" to plan.name.lowercase(),
            "product_id" to plan.product.productId,
        )
        AnalyticsService.track("paywall_checkout_started", baseProperties)
        // Meta InitiateCheckout — fires before Play Billing resolves so an
        // abandoned billing sheet still registers as checkout intent.
        PaywallConversionTracker.trackCheckoutStarted(source = source, pkg = rcPackage)
        isPurchasing = true

        scope.launch {
            try {
                val result = RevenueCatService.purchase(activity, rcPackage)
                isPurchasing = false
                val customerInfo = result.customerInfo
                if (customerInfo.entitlements.active[RevenueCatService.ENTITLEMENT_IDENTIFIER] == null) {
                    AnalyticsService.track(
                        "paywall_purchase_failed",
                        baseProperties + ("error" to "missing_entitlement_after_purchase"),
                    )
                    errorMessage = "Your purchase completed, but Pro access is still syncing. " +
                        "Tap Restore to refresh it."
                    return@launch
                }
                AnalyticsService.track(
                    "paywall_converted",
                    baseProperties + mapOf(
                        "price" to plan.product.priceAmount().toPlainString(),
                        "currency" to plan.product.currencyCode.ifBlank { "USD" },
                        "is_trial" to if (PaywallPlanResolver.hasFreeTrial(plan.product)) "true" else "false",
                    ),
                )
                // Report here rather than relying on the host: this view is
                // embedded in several containers and only one of them used to
                // fire a conversion. The tracker dedupes by order id, so the host
                // firing it again from `onPurchaseFinalized` is harmless.
                PaywallConversionTracker.trackConversion(
                    source = source,
                    transaction = result.storeTransaction,
                    customerInfo = customerInfo,
                    pkg = rcPackage,
                    offering = offering,
                )
                onPurchaseFinalized(result.storeTransaction, customerInfo)
            } catch (transactionError: PurchasesTransactionException) {
                isPurchasing = false
                if (transactionError.userCancelled ||
                    transactionError.code == PurchasesErrorCode.PurchaseCancelledError
                ) {
                    AnalyticsService.track("paywall_purchase_cancelled", baseProperties)
                    return@launch
                }
                AnalyticsService.track(
                    "paywall_purchase_failed",
                    baseProperties + ("error" to (transactionError.message ?: "unknown")),
                )
                errorMessage = purchaseErrorCopy(transactionError)
            } catch (purchasesError: PurchasesException) {
                isPurchasing = false
                AnalyticsService.track(
                    "paywall_purchase_failed",
                    baseProperties + ("error" to (purchasesError.message ?: "unknown")),
                )
                errorMessage = purchaseErrorCopy(purchasesError)
            }
        }
    }

    fun restore() {
        if (isRestoring) return
        AnalyticsService.track("paywall_restore_tapped", mapOf("source" to source))
        isRestoring = true
        scope.launch {
            try {
                val customerInfo = RevenueCatService.restorePurchases()
                isRestoring = false
                val becamePro =
                    customerInfo.entitlements.active[RevenueCatService.ENTITLEMENT_IDENTIFIER] != null
                AnalyticsService.track(
                    "paywall_restore_completed",
                    mapOf("source" to source, "became_pro" to if (becamePro) "true" else "false"),
                )
                if (becamePro) {
                    onPurchaseFinalized(null, customerInfo)
                } else {
                    infoMessage = "No previous purchases found to restore."
                }
            } catch (purchasesError: PurchasesException) {
                isRestoring = false
                errorMessage = "Restore failed. ${purchasesError.message.orEmpty()}".trim()
            }
        }
    }

    BoxWithConstraints(modifier.fillMaxSize()) {
        val accessibilityText = LocalDensity.current.fontScale >= 1.3f
        // Below ~740dp of usable height the hero has to give ground to the plan
        // cards; above it the carousel gets its full-size treatment.
        val compact = !accessibilityText && maxHeight < 740.dp
        val scrollState = rememberScrollState()

        PaywallBackground(accent = accent, reduceMotion = reduceMotion)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .then(
                    if (accessibilityText) Modifier.verticalScroll(scrollState) else Modifier,
                ),
        ) {
            PaywallTopBar(
                accent = accent,
                allowClose = allowClose,
                debugClose = debugClose,
                showSignOut = auth.phase is AuthStore.Phase.Authenticated,
                isSigningOut = isSigningOut,
                onSignOut = { confirmSignOut = true },
                onClose = {
                    AnalyticsService.track(
                        "paywall_dismissed",
                        mapOf(
                            "source" to source,
                            "variant" to PAYWALL_VARIANT,
                            "result" to if (debugClose) "debug_closed" else "closed",
                        ),
                    )
                    onRequestClose()
                },
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 4.dp),
            )

            PaywallValueCarousel(
                accent = accent,
                agentName = agentName,
                spriteIndex = spriteIndex,
                researchBucketRaw = researchBucketRaw,
                stakesBucketRaw = stakesBucketRaw,
                compact = compact,
                reduceMotion = reduceMotion,
                modifier = if (accessibilityText) {
                    // Match iOS's accessibility checkout: the feature story keeps
                    // a stable canvas and the entire purchase surface can scroll,
                    // so large font sizes never clip the CTA or Restore controls.
                    Modifier.fillMaxWidth().height(590.dp)
                } else {
                    Modifier.fillMaxWidth().weight(1f)
                },
            )

            if (resolved.plans.isEmpty()) {
                UnavailablePlans(
                    accent = accent,
                    isRestoring = isRestoring,
                    onRestore = { restore() },
                    onOpenTerms = { uriHandler.openUri(TERMS_URL) },
                    onOpenPrivacy = { uriHandler.openUri(PRIVACY_URL) },
                    onContinueWithout = {
                        AnalyticsService.track(
                            "paywall_dismissed",
                            mapOf(
                                "source" to source,
                                "variant" to PAYWALL_VARIANT,
                                "result" to "plans_unavailable",
                            ),
                        )
                        onRequestClose()
                    },
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
                )
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(
                            start = 18.dp,
                            end = 18.dp,
                            bottom = if (compact) 10.dp else 8.dp,
                        ),
                    verticalArrangement = Arrangement.spacedBy(if (compact) 9.dp else 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    PlanRow(
                        resolved = resolved,
                        selectedId = selectedId,
                        accent = accent,
                        compact = compact,
                        onSelect = { plan ->
                            selectedId = plan.id
                            AnalyticsService.track(
                                "paywall_plan_selected",
                                mapOf(
                                    "plan" to plan.name.lowercase(),
                                    "product_id" to plan.product.productId,
                                    "source" to source,
                                ),
                            )
                        },
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            imageVector = AppIcon.CHECKMARK_SHIELD_FILL.imageVector,
                            contentDescription = null,
                            tint = accent,
                            modifier = Modifier.size(if (compact) 12.dp else 14.dp),
                        )
                        Text(
                            text = "No commitment - Cancel anytime",
                            fontSize = if (compact) 10.5.sp else 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.appTextSecondary,
                        )
                    }

                    PaywallPurchaseButton(
                        title = PaywallPlanResolver.ctaTitle(selected),
                        subtitle = PaywallPlanResolver.billingLine(selected),
                        loading = isPurchasing,
                        enabled = selected != null && !isPurchasing && !isRestoring,
                        accent = accent,
                        reduceMotion = reduceMotion,
                        onClick = { buy() },
                    )

                    PaywallFooter(
                        isRestoring = isRestoring,
                        enabled = !isRestoring && !isPurchasing,
                        onRestore = { restore() },
                        onOpenTerms = { uriHandler.openUri(TERMS_URL) },
                        onOpenPrivacy = { uriHandler.openUri(PRIVACY_URL) },
                    )
                }
            }
        }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Log out of WagerProof?") },
            text = {
                Text("You'll be returned to the sign-in screen. Your subscription stays with your account.")
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmSignOut = false
                    if (!isSigningOut) {
                        isSigningOut = true
                        AnalyticsService.track(
                            "paywall_signed_out",
                            mapOf("source" to source, "variant" to PAYWALL_VARIANT),
                        )
                        // Deliberately does NOT call onRequestClose(): the host's
                        // dismiss closure latches `paywallDismissed`, which would
                        // suppress the paywall for whoever signs in next this
                        // session. Sign-out alone drops the overlay because the
                        // router leaves the Ready phase.
                        scope.launch {
                            graph.auth.signOut()
                            isSigningOut = false
                        }
                    }
                }) { Text("Log Out", color = AppColors.appAccentRed) }
            },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = { errorMessage = null },
            title = { Text("Something went wrong") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = { errorMessage = null }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    infoMessage?.let { message ->
        AlertDialog(
            onDismissRequest = { infoMessage = null },
            title = { Text("Restore Purchases") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = { infoMessage = null }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}

// MARK: - Chrome

@Composable
private fun PaywallBackground(accent: Color, reduceMotion: Boolean) {
    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(listOf(Color(0xFF07110B), Color(0xFF090C0A), Color(0xFF050706))),
                ),
        )
        PixelDotBackground(
            modifier = Modifier.fillMaxSize(),
            animation = PixelDotAnimation.Aurora,
            baseColor = Color.White,
            accentColor = accent,
            spacing = 29f,
            dotSize = 4.2f,
            baseOpacity = 0.012,
            peakOpacity = 0.20,
            speed = 0.42,
            edgeFade = true,
            reduceMotion = reduceMotion,
        )
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.12f), Color.Black.copy(alpha = 0.48f)),
                    ),
                ),
        )
    }
}

@Composable
private fun PaywallTopBar(
    accent: Color,
    allowClose: Boolean,
    debugClose: Boolean,
    showSignOut: Boolean,
    isSigningOut: Boolean,
    onSignOut: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().height(44.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = buildAnnotatedString {
                withStyle(SpanStyle(color = Color.White.copy(alpha = 0.92f))) { append("Wager") }
                withStyle(SpanStyle(color = accent)) { append("Proof") }
            },
            style = AppTypography.display.copy(fontSize = 16.sp),
            fontWeight = FontWeight.Black,
        )
        Text(
            text = "PRO",
            style = AppTypography.monoCaption.copy(fontSize = 9.sp),
            fontWeight = FontWeight.Black,
            color = Color.Black,
            modifier = Modifier
                .clip(CircleShape)
                .background(accent)
                .padding(horizontal = 7.dp, vertical = 3.dp),
        )

        Spacer(Modifier.weight(1f))

        // Account escape hatch. The real onboarding gate ships HARD (no X), so
        // someone signed into the wrong account would otherwise be trapped here.
        if (showSignOut) {
            Text(
                text = "Log Out",
                style = AppTypography.captionEmphasized.copy(fontSize = 12.sp),
                color = AppColors.appTextSecondary.copy(alpha = if (isSigningOut) 0.5f else 1f),
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.06f))
                    .border(1.dp, Color.White.copy(alpha = 0.10f), CircleShape)
                    .clickable(enabled = !isSigningOut, onClick = onSignOut)
                    .padding(horizontal = 13.dp, vertical = 7.dp),
            )
        }

        if (allowClose) {
            if (debugClose) {
                // Deliberately loud: a tester can never mistake a debug run for
                // the real hard onboarding gate, which has no close button.
                Row(
                    modifier = Modifier
                        .height(34.dp)
                        .clip(CircleShape)
                        .background(Color.Red)
                        .border(1.dp, Color.White.copy(alpha = 0.55f), CircleShape)
                        .clickable(onClick = onClose)
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Icon(
                        imageVector = AppIcon.XMARK.imageVector,
                        contentDescription = "Close debug paywall",
                        tint = Color.White,
                        modifier = Modifier.size(12.dp),
                    )
                    Text(
                        text = "DEBUG",
                        style = AppTypography.monoCaption.copy(fontSize = 11.sp),
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                    )
                }
            } else {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.06f))
                        .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape)
                        .clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = AppIcon.XMARK.imageVector,
                        contentDescription = "Close paywall",
                        tint = AppColors.appTextSecondary,
                        modifier = Modifier.size(15.dp),
                    )
                }
            }
        }
    }
}

// MARK: - Plans

@Composable
private fun PlanRow(
    resolved: ResolvedPaywallPlans,
    selectedId: String?,
    accent: Color,
    compact: Boolean,
    onSelect: (PaywallPlan) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        resolved.plans.forEach { plan ->
            PlanCard(
                plan = plan,
                isSelected = plan.id == selectedId,
                isAnnual = plan.product.packageId == resolved.annual?.packageId,
                savingsPercent = resolved.annualSavingsPercent,
                accent = accent,
                compact = compact,
                onSelect = { onSelect(plan) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun PlanCard(
    plan: PaywallPlan,
    isSelected: Boolean,
    isAnnual: Boolean,
    savingsPercent: Int?,
    accent: Color,
    compact: Boolean,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val product = plan.product
    val shape = RoundedCornerShape(17.dp)
    val ribbon = PaywallPlanResolver.cardRibbon(product, isAnnual, savingsPercent)
    val perMonth = PaywallPlanResolver.perMonthPrice(product)
    val showIntro = PaywallPlanResolver.introDisplayEligible(product)
    val label = PaywallPlanResolver.accessibilityLabel(plan, isSelected)

    // The ribbon straddles the card's top edge. The head-room is padding on the
    // CARD (before its background), not on this Box — that way the ribbon can sit
    // at the Box's true top and overlap the card, while the whole unit still fits
    // inside the row's bounds.
    Box(modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 9.dp)
                .clip(shape)
                .background(Color.White.copy(alpha = if (isSelected) 0.12f else 0.045f), shape)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) accent else Color.White.copy(alpha = 0.12f),
                    shape = shape,
                )
                // One merged, labelled node so TalkBack reads the whole plan
                // ("Yearly, $99.99 per year, selected") instead of five fragments.
                .clickable(onClickLabel = label, onClick = onSelect)
                .padding(vertical = if (compact) 10.dp else 13.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(if (compact) 2.dp else 4.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text(
                    text = plan.name,
                    style = AppTypography.display.copy(fontSize = if (compact) 13.sp else 15.sp),
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.appTextPrimary,
                )
                if (isSelected) {
                    Icon(
                        imageVector = AppIcon.CHECKMARK_CIRCLE_FILL.imageVector,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(11.dp),
                    )
                }
            }

            Text(
                text = PaywallPlanResolver.cardPrice(product),
                style = AppTypography.display.copy(fontSize = if (compact) 19.sp else 22.sp),
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )

            val secondarySize = if (compact) 10.5.sp else 12.sp
            when {
                showIntro -> Text(
                    // e.g. "then $99.99/year" under the $19.99 first-month price.
                    text = "then ${product.formattedPrice}/${PaywallPlanResolver.billingPeriod(product)}",
                    fontSize = secondarySize,
                    fontWeight = FontWeight.Medium,
                    color = accent,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )

                isAnnual && perMonth != null -> Text(
                    text = buildAnnotatedString {
                        withStyle(SpanStyle(color = AppColors.appTextSecondary)) { append("$perMonth/mo") }
                        if (savingsPercent != null) {
                            withStyle(SpanStyle(color = accent)) { append(" • Save $savingsPercent%") }
                        }
                    },
                    fontSize = secondarySize,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )

                else -> Text(
                    text = "per ${PaywallPlanResolver.billingPeriod(product)}",
                    fontSize = secondarySize,
                    fontWeight = FontWeight.Medium,
                    color = AppColors.appTextSecondary,
                    maxLines = 1,
                )
            }
        }

        if (ribbon != null) {
            Text(
                text = ribbon,
                style = AppTypography.monoCaption.copy(fontSize = 9.sp),
                fontWeight = FontWeight.Black,
                color = Color.Black,
                maxLines = 1,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .clip(CircleShape)
                    .background(AppColors.appAccentAmber)
                    .padding(horizontal = 9.dp, vertical = 3.dp),
            )
        }
    }
}

@Composable
private fun UnavailablePlans(
    accent: Color,
    isRestoring: Boolean,
    onRestore: () -> Unit,
    onOpenTerms: () -> Unit,
    onOpenPrivacy: () -> Unit,
    onContinueWithout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White.copy(alpha = 0.055f), shape)
            .border(1.dp, Color.White.copy(alpha = 0.12f), shape)
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(
                imageVector = AppIcon.WIFI_SLASH.imageVector,
                contentDescription = null,
                tint = AppColors.appTextPrimary,
                modifier = Modifier.size(16.dp),
            )
            Text(
                text = "Subscription options unavailable",
                style = AppTypography.display.copy(fontSize = 14.sp),
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
            )
        }
        Text(
            text = "We couldn't load the Monthly or non-trial Yearly plan.",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            color = AppColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(15.dp))
                .background(accent)
                .clickable(onClick = onContinueWithout),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Continue without subscription",
                style = AppTypography.majorCta.copy(fontSize = 13.sp),
                color = Color.Black,
                textAlign = TextAlign.Center,
            )
        }
        PaywallFooter(
            isRestoring = isRestoring,
            enabled = !isRestoring,
            onRestore = onRestore,
            onOpenTerms = onOpenTerms,
            onOpenPrivacy = onOpenPrivacy,
        )
    }
}

// MARK: - CTA + footer

@Composable
private fun PaywallPurchaseButton(
    title: String,
    subtitle: String,
    loading: Boolean,
    enabled: Boolean,
    accent: Color,
    reduceMotion: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    val transition = rememberInfiniteTransition(label = "cta")
    // Kept as State (not `by`) so the offset lambda below reads it in the LAYOUT
    // phase — reading it during composition would recompose the whole button on
    // every animation frame.
    val shimmer = transition.animateFloat(
        initialValue = -0.7f,
        targetValue = 1.25f,
        animationSpec = infiniteRepeatable(tween(2_600), RepeatMode.Restart),
        label = "cta-shimmer",
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(60.dp)
            .clip(shape)
            .background(
                Brush.horizontalGradient(listOf(accent, Color(0xFF8EF0B6), AppColors.appAccentAmber)),
            )
            .border(1.dp, Color.White.copy(alpha = 0.3f), shape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (!reduceMotion) {
            // Travelling highlight band. A soft white sweep rather than iOS's
            // `.blendMode(.screen)` overlay, which Compose has no equivalent for;
            // over the green/amber gradient it reads the same at this scale.
            // Offset (not padding) because the band starts OFF the left edge.
            BoxWithConstraints(Modifier.fillMaxSize()) {
                val widthPx = with(LocalDensity.current) { maxWidth.toPx() }
                Box(
                    Modifier
                        .offset { IntOffset((widthPx * shimmer.value).roundToInt(), 0) }
                        .width(maxWidth * 0.45f)
                        .fillMaxHeight()
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color.Transparent, Color.White.copy(alpha = 0.35f), Color.Transparent),
                            ),
                        ),
                )
            }
        }

        if (loading) {
            CircularProgressIndicator(color = Color(0xFF04120A), modifier = Modifier.size(24.dp))
        } else {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 44.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = title,
                    style = AppTypography.display.copy(fontSize = 18.sp),
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF04120A),
                    maxLines = 1,
                )
                Text(
                    text = subtitle,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF04120A).copy(alpha = 0.76f),
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(
                imageVector = AppIcon.CHEVRON_RIGHT.imageVector,
                contentDescription = null,
                tint = Color(0xFF04120A).copy(alpha = 0.78f),
                modifier = Modifier.align(Alignment.CenterEnd).padding(end = 18.dp).size(18.dp),
            )
        }

        if (!enabled) {
            Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = 0.42f)))
        }
    }
}

@Composable
private fun PaywallFooter(
    isRestoring: Boolean,
    enabled: Boolean,
    onRestore: () -> Unit,
    onOpenTerms: () -> Unit,
    onOpenPrivacy: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (isRestoring) {
            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp))
        } else {
            FooterLink("Restore", enabled = enabled, onClick = onRestore)
        }
        Text("·", color = AppColors.appTextMuted.copy(alpha = 0.5f), fontSize = 12.sp)
        FooterLink("Terms", enabled = true, onClick = onOpenTerms)
        Text("·", color = AppColors.appTextMuted.copy(alpha = 0.5f), fontSize = 12.sp)
        FooterLink("Privacy", enabled = true, onClick = onOpenPrivacy)
    }
}

@Composable
private fun FooterLink(text: String, enabled: Boolean, onClick: () -> Unit) {
    Text(
        text = text,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = AppColors.appTextSecondary.copy(alpha = if (enabled) 1f else 0.5f),
        modifier = Modifier
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 6.dp),
    )
}

// MARK: - RevenueCat adapters

/**
 * Flatten a RevenueCat `Package` into the plain-Kotlin [PaywallProduct] the
 * resolver works with.
 *
 * Offer selection follows Play's model: RevenueCat's `defaultOption` is both the
 * option a package purchase launches and an option the signed-in shopper is
 * eligible for. Reading that exact option keeps the displayed trial/intro terms
 * identical to checkout and needs no separate eligibility round-trip (iOS's
 * `checkTrialOrIntroDiscountEligibility` has no Android counterpart for exactly
 * this reason).
 */
private fun Package.toPaywallProduct(): PaywallProduct {
    val storeProduct = product
    return PaywallProduct(
        packageId = identifier,
        productId = storeProduct.id,
        kind = when (packageType) {
            PackageType.ANNUAL -> PaywallPackageKind.ANNUAL
            PackageType.MONTHLY -> PaywallPackageKind.MONTHLY
            else -> PaywallPackageKind.OTHER
        },
        formattedPrice = storeProduct.price.formatted,
        priceMicros = storeProduct.price.amountMicros,
        currencyCode = storeProduct.price.currencyCode,
        period = storeProduct.period?.toPaywallPeriod(),
        introOffer = storeProduct.resolveIntroOffer(),
    )
}

private fun Period.toPaywallPeriod() = PaywallPeriod(
    value = value,
    unit = when (unit) {
        Period.Unit.DAY -> PaywallPeriodUnit.DAY
        Period.Unit.WEEK -> PaywallPeriodUnit.WEEK
        Period.Unit.MONTH -> PaywallPeriodUnit.MONTH
        Period.Unit.YEAR -> PaywallPeriodUnit.YEAR
        Period.Unit.UNKNOWN -> PaywallPeriodUnit.UNKNOWN
    },
)

private fun StoreProduct.resolveIntroOffer(): PaywallIntroOffer? {
    val option = defaultOption ?: return null
    option.freePhase?.let { phase ->
        return PaywallIntroOffer(
            mode = PaywallIntroMode.FREE_TRIAL,
            formattedPrice = phase.price.formatted,
            period = phase.billingPeriod.toPaywallPeriod(),
        )
    }
    val introPhase = option.introPhase ?: return null
    val mode = when (introPhase.offerPaymentMode) {
        OfferPaymentMode.FREE_TRIAL -> PaywallIntroMode.FREE_TRIAL
        OfferPaymentMode.SINGLE_PAYMENT -> PaywallIntroMode.PAY_UP_FRONT
        OfferPaymentMode.DISCOUNTED_RECURRING_PAYMENT -> PaywallIntroMode.DISCOUNTED_RECURRING
        null -> return null
    }
    return PaywallIntroOffer(
        mode = mode,
        formattedPrice = introPhase.price.formatted,
        period = introPhase.billingPeriod.toPaywallPeriod(),
    )
}

private fun PaywallProduct.priceAmount(): BigDecimal =
    BigDecimal.valueOf(priceMicros, 6).stripTrailingZeros()

private fun purchaseErrorCopy(error: PurchasesException): String = when (error.code) {
    PurchasesErrorCode.PaymentPendingError ->
        "Your purchase is pending approval. Pro will unlock automatically when Google Play completes it."
    PurchasesErrorCode.StoreProblemError ->
        "We couldn't confirm the purchase status. Check your Play subscriptions or tap Restore before trying again."
    else ->
        "The purchase couldn't be completed. You haven't been charged. ${error.message.orEmpty()}".trim()
}

/**
 * Play Billing needs the hosting Activity to launch its sheet, and Compose only
 * hands us a Context — which is an Activity in this app but a ContextWrapper
 * chain under some theming/preview setups, hence the unwrap.
 */
internal fun Context.findActivity(): Activity? {
    var current: Context? = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}

/** iOS reads `accessibilityReduceMotion`; Android's analogue is a zero animator scale. */
internal fun isReduceMotionEnabled(context: Context): Boolean = try {
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
} catch (_: Throwable) {
    false
}
