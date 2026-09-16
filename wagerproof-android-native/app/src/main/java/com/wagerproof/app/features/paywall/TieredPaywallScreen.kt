package com.wagerproof.app.features.paywall

import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.hazeEffect
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.PurchasesTransactionException
import com.wagerproof.app.BuildConfig
import com.wagerproof.app.R
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.SubscriptionTier
import com.wagerproof.core.services.ExternalCheckoutService
import com.wagerproof.core.services.AnalyticsService
import com.wagerproof.core.services.PaywallConversionTracker
import com.wagerproof.core.services.RevenueCatService
import com.wagerproof.core.services.PicksExpiryService
import com.wagerproof.core.stores.AuthStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Currency

@Composable
fun TieredPaywallScreen(
    offering: Offering? = null,
    initialTier: SubscriptionTier = SubscriptionTier.PRO,
    initialYearly: Boolean = false,
    minimumTier: SubscriptionTier = SubscriptionTier.STANDARD,
    preview: Boolean = false,
    allowClose: Boolean = true,
    showsPicksExpiry: Boolean = false,
    source: String = "generic_feature",
    onDismiss: () -> Unit,
) {
    val graph = appGraph()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val designPreview = preview && BuildConfig.DEBUG
    var tier by remember { mutableStateOf(initialTier) }
    var yearly by remember { mutableStateOf(initialYearly) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var awaitingBrowser by remember { mutableStateOf(false) }
    val catalogReady = offering?.identifier == TieredPaywallCatalog.OFFERING_ID && offering.metadata["tiered_catalog_ready"] == true
    fun pkg(item: SubscriptionTier, annual: Boolean = yearly) = offering?.availablePackages?.firstOrNull {
        it.identifier == TieredPaywallCatalog.packageId(item, annual) && it.product.id == TieredPaywallCatalog.productId(item, annual)
    }
    val selectedPackage = pkg(tier)
    val authUser = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId
    val rcUser = if (RevenueCatService.isConfigured) RevenueCatService.appUserId else ""
    val hosted = TieredPaywallCatalog.hostedUrl(offering?.metadata?.get("tiered_hosted_web_url") as? String, rcUser, authUser)
    // Google eligibility and a configured transaction-reporting handoff are both
    // required. RevenueCat's generic web flag alone must never enable Play link-out.
    val externalCheckout = remember { ExternalCheckoutService(context) }
    var externalCheckoutEligible by remember { mutableStateOf(false) }
    LaunchedEffect(hosted) {
        externalCheckoutEligible = hosted != null && externalCheckout.isEligible()
    }
    DisposableEffect(externalCheckout) { onDispose { externalCheckout.close() } }
    val webReady = catalogReady && offering?.metadata?.get("tiered_hosted_web_ready") == true &&
        hosted != null && externalCheckoutEligible
    fun format(amountMicros: Long, currency: String): String = NumberFormat.getCurrencyInstance().apply { this.currency = Currency.getInstance(currency) }.format(amountMicros / 1_000_000.0)
    fun price(item: SubscriptionTier) = pkg(item)?.product?.price?.formatted ?: if (designPreview) TieredPaywallCatalog.usd(TieredPaywallCatalog.priceCents(item, yearly)) else "Unavailable"
    fun comparison(item: SubscriptionTier): Pair<Long, String>? {
        val product = pkg(item)?.product
        val cents = TieredPaywallCatalog.comparisonCents(item, yearly)
        if (designPreview) return cents?.let { it.toLong()*10000 to TieredPaywallCatalog.usd(it) }
        product ?: return null
        val amount = if (product.price.currencyCode == "USD" && cents != null) cents.toLong()*10000
            else if (yearly && pkg(item, false)?.product?.price?.currencyCode == product.price.currencyCode) pkg(item, false)!!.product.price.amountMicros*12 else return null
        return if(amount > product.price.amountMicros) amount to format(amount, product.price.currencyCode) else null
    }
    suspend fun finish(info: CustomerInfo, required: SubscriptionTier): Boolean {
        graph.revenueCat.refreshCustomerInfo()
        if (RevenueCatService.subscriptionTier(info)?.includes(required) == true || graph.proAccess.hasAccess(required)) {
            PicksExpiryService.cancel()
            onDismiss(); return true
        }
        message = "Your purchase is processing. Restore purchases to refresh your access."
        return false
    }
    fun purchase() {
        if (designPreview) { message = "Design preview only. No purchase was started."; return }
        if (busy || !catalogReady || selectedPackage == null) return
        val activity = context.activity() ?: run { message = "Checkout is unavailable. Please try again."; return }
        val purchasingTier = tier
        busy = true
        scope.launch {
            try {
                PaywallConversionTracker.trackCheckoutStarted(source, selectedPackage)
                val result = RevenueCatService.purchaseTier(activity, selectedPackage, graph.revenueCat.customerInfo)
                PaywallConversionTracker.trackConversion(source, result.storeTransaction, result.customerInfo, selectedPackage, offering)
                finish(result.customerInfo, purchasingTier)
            } catch (e: CancellationException) { throw e }
            catch (e: PurchasesTransactionException) { if (!e.userCancelled) message = e.message }
            catch (e: Exception) { message = e.localizedMessage ?: "Checkout failed. Please try again." }
            finally { busy = false }
        }
    }
    fun restore() {
        if(designPreview) { message = "Restore is available with the live subscription catalog."; return }
        if(busy) return
        busy = true
        scope.launch {
            try {
                val info = RevenueCatService.restorePurchases()
                graph.revenueCat.refreshCustomerInfo()
                if (RevenueCatService.subscriptionTier(info)?.includes(minimumTier) == true) onDismiss()
                else message = "No qualifying subscription was found for this Google account."
            } catch(e: CancellationException) { throw e }
            catch(e: Exception) { message = e.localizedMessage }
            finally { busy = false }
        }
    }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, hosted, awaitingBrowser) {
        val observer = LifecycleEventObserver { _, event ->
            if(event == Lifecycle.Event.ON_STOP && showsPicksExpiry && !designPreview && !graph.proAccess.hasSubscription) PicksExpiryService.showCountdown()
            if(event == Lifecycle.Event.ON_RESUME && awaitingBrowser && hosted != null && !busy) {
                scope.launch {
                    val checkoutUser = rcUser
                    busy = true
                    try {
                        RevenueCatService.invalidateCustomerInfoCache()
                        val info = RevenueCatService.customerInfo()
                        if (RevenueCatService.appUserId == checkoutUser && (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId == authUser && RevenueCatService.subscriptionTier(info)?.includes(minimumTier) == true) {
                            awaitingBrowser = false; finish(info, minimumTier)
                        }
                    } catch(e: CancellationException) { throw e }
                    catch(_: Exception) { /* Keep restore and retry available. */ }
                    finally { busy = false }
                }
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(offering) {
        if(catalogReady && !designPreview) {
            AnalyticsService.track("paywall_presented", mapOf("source" to source, "variant" to "tiered_v1"))
            PaywallConversionTracker.trackPaywallView(source, offering)
        }
    }
    BackHandler(enabled = !allowClose || busy) {}
    val haze = remember { dev.chrisbanes.haze.HazeState() }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Image(painterResource(R.drawable.tiered_paywall_artwork), null, Modifier.fillMaxWidth().height(360.dp).blur(24.dp), contentScale = ContentScale.Crop, alpha = .30f)
        Column(Modifier.fillMaxSize().hazeSource(haze).verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 12.dp).padding(bottom = if(webReady || designPreview) 185.dp else 128.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Box(Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = 12.dp)) {
                Image(painterResource(R.drawable.wagerproof_logo), "WagerProof", Modifier.align(Alignment.CenterStart).size(24.dp), contentScale = ContentScale.Fit)
                if(showsPicksExpiry && !graph.proAccess.hasSubscription) PicksExpiryLabel(Modifier.align(Alignment.Center), designPreview)
                if(allowClose) TextButton(onClick = onDismiss, enabled = !busy, modifier = Modifier.align(Alignment.CenterEnd)) { Text("✕", color = Color.White, fontSize = 22.sp) }
            }
            Text("Choose your plan", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 32.sp,
                modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Row(Modifier.align(Alignment.CenterHorizontally).clip(CircleShape).background(Color(0xFF161616))
                .border(1.dp,Color.White.copy(.09f),CircleShape).padding(horizontal = 18.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Monthly", color = Color.White.copy(.65f), fontWeight = FontWeight.Bold, fontSize = 16.sp,
                    modifier = Modifier.clickable(enabled = !busy) { yearly = false }.padding(vertical = 12.dp))
                Switch(checked = yearly, onCheckedChange = { yearly = it }, enabled = !busy,
                    modifier = Modifier.semantics { contentDescription = "Yearly billing" },
                    colors = SwitchDefaults.colors(checkedTrackColor = AppColors.appPrimary, checkedThumbColor = Color.White,
                        uncheckedTrackColor = Color(0xFF535358), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent))
                Text("Yearly", color = Color.White.copy(.65f), fontWeight = FontWeight.Bold, fontSize = 16.sp,
                    modifier = Modifier.clickable(enabled = !busy) { yearly = true }.padding(vertical = 12.dp))
            }
            if(graph.proAccess.hasSubscription || graph.proAccess.isPreviewing) Text("${if(graph.proAccess.isPreviewing) "Previewing" else "Current plan"}: ${graph.proAccess.planTitle}",
                color = Color(0xFFA6E9C4), fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth().background(Color.White.copy(.06f),RoundedCornerShape(14.dp)).padding(horizontal = 16.dp,vertical = 12.dp))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SubscriptionTier.entries.filter { it.includes(minimumTier) }.forEach { item ->
                    val compare = comparison(item)
                    val micros = pkg(item)?.product?.price?.amountMicros ?: if(designPreview) TieredPaywallCatalog.priceCents(item, yearly).toLong()*10000 else 0
                    val tag = if(!yearly) (if(item == SubscriptionTier.PRO) "Most popular" else null) else compare?.let { TieredPaywallCatalog.savings(micros,it.first)?.let { "Save $it%" } }
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).background(Color(0xFF171717)).border(if(item == tier) 2.dp else 1.dp, if(item == tier) AppColors.appPrimary else Color.White.copy(.04f), RoundedCornerShape(11.dp)).clickable(enabled = !busy) { tier = item }.semantics { selected = item == tier }.padding(horizontal = 14.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.size(24.dp).background(if(item == tier) AppColors.appPrimary else Color.Black, CircleShape), contentAlignment = Alignment.Center) { if(item == tier) Text("✓", color = Color.Black, fontWeight = FontWeight.Bold) }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            TierTitle("${item.title} ${if(yearly) "Yearly" else "Monthly"}", item, item == tier, 18)
                            val subtitle = if(yearly) pkg(item)?.product?.price?.let { "${format(it.amountMicros/12,it.currencyCode)}/month" } ?: if(designPreview) "${TieredPaywallCatalog.usd((TieredPaywallCatalog.priceCents(item,true)+6)/12)}/month" else "Yearly billing" else "Monthly billing"
                            Text(subtitle, color = Color.White.copy(.52f), fontSize = 13.sp)
                        }
                        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            if(tag != null) Text(tag, color = AppColors.appPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.background(AppColors.appPrimary.copy(.10f), CircleShape).padding(horizontal = 7.dp, vertical = 4.dp))
                            Text(price(item), color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            compare?.let { Text(it.second, color = Color.White.copy(.5f), fontSize = 12.sp, textDecoration = TextDecoration.LineThrough) }
                        }
                    }
                }
            }
            Column(Modifier.clip(RoundedCornerShape(16.dp)).background(Color(0xFF101010))) {
                Text("What do I get?", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(18.dp))
                TieredPaywallCatalog.features.sortedBy { if(tier.includes(it.tier)) 0 else 1 }.forEach { feature ->
                    val covered = tier.includes(feature.tier)
                    Row(Modifier.fillMaxWidth().background(if(covered) Color(0xFF191919) else Color.Black).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        val icon = when (feature.id) {
                            "predictions" -> AppIcon.CHART_LINE_UPTREND
                            "markets" -> AppIcon.CHART_BAR_XAXIS
                            "discord" -> AppIcon.BUBBLE_LEFT_AND_BUBBLE_RIGHT_FILL
                            "outliers" -> AppIcon.BOLT_FILL
                            "props" -> AppIcon.FIGURE_BASKETBALL
                            "parlays" -> AppIcon.RECTANGLE_STACK_FILL
                            "cheats" -> AppIcon.LIST_BULLET
                            "agents" -> AppIcon.PERSON_CROP_CIRCLE
                            "picks" -> AppIcon.CHECKMARK_SEAL_FILL
                            "leaderboard" -> AppIcon.TROPHY
                            else -> AppIcon.SPORTSCOURT
                        }
                        Icon(icon.imageVector, null, tint = Color.White.copy(if(covered) 1f else .48f), modifier = Modifier.size(38.dp).border(1.dp, Color.White.copy(.1f), RoundedCornerShape(10.dp)).padding(7.dp))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(feature.title, color = Color.White.copy(if(covered) 1f else .48f), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            if(!covered) Text(feature.tier.title.uppercase(), color = AppColors.appPrimary, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.background(AppColors.appPrimary.copy(.12f), RoundedCornerShape(5.dp)).padding(horizontal = 6.dp, vertical = 3.dp))
                            Text(feature.detail, color = Color.White.copy(.57f), fontSize = 15.sp)
                        }
                    }
                    HorizontalDivider(color = Color.White.copy(.08f))
                }
            }
            TierSummaryCard(tier)
            TierReviews()
            if(!catalogReady && !designPreview) Text("Subscription options are unavailable. You can restore purchases or try again from the previous screen.", color = Color.White.copy(.65f), fontSize = 14.sp)
            TextButton(onClick = {
                if(designPreview) message = "Preview only. Your account has not been signed out."
                else { busy = true; scope.launch { try { graph.auth.signOut(); onDismiss() } finally { busy = false } } }
            }, enabled = !busy, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Sign out", color = Color.White.copy(.65f)) }
            Text("Subscriptions renew automatically unless cancelled. Manage or cancel in Google Play.", color = Color.White.copy(.5f), fontSize = 12.sp)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                TextButton(onClick = ::restore, enabled = !busy) { Text("Restore", color = Color.White.copy(.65f)) }
                TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wagerproof.bet/terms-and-conditions"))) }) { Text("Terms", color = Color.White.copy(.65f)) }
                TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wagerproof.bet/privacy-policy"))) }) { Text("Privacy", color = Color.White.copy(.65f)) }
            }
            Text("© ${java.time.Year.now()} WagerProof. All rights reserved.", color = Color.White.copy(.35f), fontSize = 11.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
        }
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().hazeEffect(state = haze, style = dev.chrisbanes.haze.materials.HazeMaterials.ultraThin(containerColor = Color.Black)) { mask = Brush.verticalGradient(listOf(Color.Transparent, Color.Black)) }.background(Brush.verticalGradient(listOf(Color.Transparent, Color(0x99080B09), Color(0xE6080B09)))).navigationBarsPadding().padding(horizontal = 12.dp).padding(top = 30.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = ::purchase, enabled = !busy && (designPreview || (catalogReady && selectedPackage != null)), modifier = Modifier.fillMaxWidth().heightIn(min = 51.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color.Black)) { Text(if(busy) "Processing…" else "Continue with Google Play", fontWeight = FontWeight.Bold, fontSize = 17.sp) }
            if(webReady || designPreview) {
                Button(onClick = {
                    if(designPreview) message = "Design preview. Web checkout uses real discounted payments when enabled."
                    else if (webReady && !busy) {
                        context.activity()?.let { activity ->
                            busy = true
                            scope.launch {
                                try {
                                    when (externalCheckout.launch(activity)) {
                                        ExternalCheckoutService.Result.Opened -> awaitingBrowser = true
                                        ExternalCheckoutService.Result.Cancelled -> Unit
                                        ExternalCheckoutService.Result.Unavailable -> {
                                            externalCheckoutEligible = false
                                            message = "Browser checkout is unavailable. You can continue with Google Play."
                                        }
                                    }
                                } catch (cancellation: CancellationException) { throw cancellation }
                                catch (_: Exception) { message = "Browser checkout could not be opened. Please try Google Play." }
                                finally { busy = false }
                            }
                        }
                    }
                }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 49.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF181C19), contentColor = Color.White)) {
                    Text("Continue with", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Spacer(Modifier.width(6.dp))
                    Image(painterResource(R.drawable.stripe_wordmark), "Stripe", Modifier.size(46.dp,20.dp))
                    Text(" · ", color = AppColors.appPrimary)
                    Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("30% off", color = AppColors.appPrimary, fontWeight = FontWeight.Bold); Text("additional", color = AppColors.appPrimary, fontSize = 8.sp, lineHeight = 9.sp) }
                }
            }
        }
    }
    message?.let { AlertDialog(onDismissRequest = { message = null }, title = { Text("WagerProof") }, text = { Text(it) }, confirmButton = { TextButton(onClick = { message = null }) { Text("OK") } }) }
}

@Composable
private fun PicksExpiryLabel(modifier: Modifier, preview: Boolean) {
    // Retain a single deadline across recomposition and re-presentation in this session.
    val deadline = remember { if (preview) System.currentTimeMillis() + 3*60*60*1000 else PicksExpiryService.window() }
    var remaining by remember { mutableLongStateOf((deadline-System.currentTimeMillis()).coerceAtLeast(0)/1000) }
    LaunchedEffect(deadline) { while(remaining > 0) { delay(1000); remaining = (deadline-System.currentTimeMillis()).coerceAtLeast(0)/1000 } }
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(if(remaining > 0) "PICKS EXPIRE IN" else "PICKS EXPIRED", color = Color.White.copy(.65f), fontSize = 10.sp, letterSpacing = 1.sp)
        Text("%02d:%02d:%02d".format(remaining/3600, (remaining/60)%60, remaining%60), color = AppColors.appPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold)
    }
}
private tailrec fun Context.activity(): Activity? = when(this) { is Activity -> this; is ContextWrapper -> baseContext.activity(); else -> null }

@Composable
internal fun TierTitle(text: String, tier: SubscriptionTier, selected: Boolean = true, size: Int = 32) {
    val colors = when(tier) {
        SubscriptionTier.STANDARD -> listOf(AppColors.appPrimary, AppColors.appPrimary)
        SubscriptionTier.PREMIUM -> listOf(Color(0xFF5CEFBA), Color(0xFF38DBA1))
        SubscriptionTier.PRO -> listOf(Color(0xFF61FF7D), Color(0xFF24F566))
    }
    Text(text, style = TextStyle(fontSize = size.sp, fontWeight = FontWeight.Bold,
        brush = Brush.horizontalGradient(if(selected) colors else listOf(Color.White,Color.White)),
        shadow = if(selected && tier != SubscriptionTier.STANDARD) Shadow(colors[0].copy(if(tier == SubscriptionTier.PRO) .75f else .35f), blurRadius = if(tier == SubscriptionTier.PRO) 9f else 5f) else null))
}
@Composable
private fun TierSummaryCard(tier: SubscriptionTier) {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Color(0xFF141414)).border(1.dp, AppColors.appPrimary.copy(.3f), RoundedCornerShape(22.dp))) {
        Image(painterResource(tier.artwork()), null, Modifier.matchParentSize(), contentScale = ContentScale.Crop, alpha = .3f)
        Box(Modifier.matchParentSize().background(Color.Black.copy(.35f)))
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("WAGERPROOF", color = Color.White, fontSize = 11.sp, letterSpacing = 2.sp); TierTitle(tier.title,tier) }
                Image(painterResource(tier.bolt()), null, Modifier.size(68.dp,86.dp))
            }
            Text(listOf("Know the game. Follow the market.", "Find your edge with deeper research.", "Your strategies. Your team of AI agents.")[tier.ordinal], color = Color.White, fontSize = 17.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { SubscriptionTier.entries.forEach { Box(Modifier.weight(1f).height(4.dp).background(if(tier.includes(it)) AppColors.appPrimary else Color.White.copy(.15f), CircleShape)) } }
            Text("${TieredPaywallCatalog.features.count { tier.includes(it.tier) }} features included", color = Color.White.copy(.65f), fontSize = 13.sp)
        }
    }
}
@Composable
private fun TierReviews() {
    val reviews = listOf(
        "EveeD525" to "So much information to help you make better decisions. By far the best app I have come across!",
        "SpaceGuy4" to "This app is cool because it takes complicated data and makes it easy to read…and THEN it lets you use AI to ask questions…",
        "All3nu" to "If you’re looking for an actual edge, don’t waste your time looking elsewhere. This app is legit.",
        "Umm…Tray" to "With WagerProof every value decision is backed by complete, reliable data. You don’t need no other app!!! I love WagerProof",
        "Esoler393" to "It has tons of data for every game along with the editors real picks with suggested units and best available odds.",
        "felo1963" to "This app is awesome! It has helped me make a lot of very smart bets!",
    )
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("What our community says", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
        Text("Reviews from the App Store", color = Color.White.copy(.55f), fontSize = 12.sp)
        Box {
            Image(painterResource(R.drawable.tiered_reviews_background), null, Modifier.matchParentSize().blur(18.dp), contentScale = ContentScale.Crop, alpha = .5f)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 12.dp)) {
                items(reviews) { (author,quote) -> Column(Modifier.width(290.dp).heightIn(min = 180.dp).background(Color(0xDD171A18), RoundedCornerShape(18.dp)).border(1.dp,Color.White.copy(.1f),RoundedCornerShape(18.dp)).padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("★★★★★", color = AppColors.appPrimary, fontSize = 16.sp)
                    Text(quote, color = Color.White, fontSize = 15.sp, lineHeight = 21.sp)
                    Text(author, color = Color.White.copy(.5f), fontSize = 12.sp)
                } }
            }
        }
    }
}
