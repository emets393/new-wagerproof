package com.wagerproof.app.features.paywall

import android.animation.ValueAnimator
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.wagerproof.app.R
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.SubscriptionTier

/** Nested gates render only their feature preview, never another unlock card. */
val LocalFeatureGatePreview = staticCompositionLocalOf { false }
internal fun SubscriptionTier.bolt() = when (this) {
    SubscriptionTier.STANDARD -> R.drawable.tiered_paywall_bolt
    SubscriptionTier.PREMIUM -> R.drawable.tiered_paywall_premium_bolt
    SubscriptionTier.PRO -> R.drawable.tiered_paywall_pro_bolt
}
internal fun SubscriptionTier.artwork() = when (this) {
    SubscriptionTier.STANDARD -> R.drawable.tiered_paywall_artwork
    SubscriptionTier.PREMIUM -> R.drawable.tiered_paywall_premium_artwork
    SubscriptionTier.PRO -> R.drawable.tiered_paywall_pro_artwork
}

@Composable
fun TierUpgradeCard(minimum: SubscriptionTier, title: String, modifier: Modifier = Modifier, onUnlock: () -> Unit) {
    Box(modifier.clip(RoundedCornerShape(24.dp)).background(Color(0xFF0E0E0E))
        .border(1.dp, Color.White.copy(.12f), RoundedCornerShape(24.dp))) {
        Image(painterResource(minimum.artwork()), null, Modifier.matchParentSize(), contentScale = ContentScale.Crop, alpha = .28f)
        Box(Modifier.matchParentSize().background(Color.Black.copy(.35f)))
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Image(painterResource(minimum.bolt()), null, Modifier.size(44.dp, 64.dp), contentScale = ContentScale.Fit)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("WAGERPROOF ${minimum.title.uppercase()}", color = AppColors.appPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
                    Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Button(onClick = onUnlock, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary, contentColor = Color.Black), shape = RoundedCornerShape(14.dp)) {
                GateUnlockLabel("Unlock with ${minimum.title}", Modifier.weight(1f))
                Text("→", fontSize = 22.sp)
            }
        }
    }
}

@Composable
private fun GateUnlockLabel(text: String, modifier: Modifier) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var active by remember { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, _ -> active = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    Box(modifier) {
        Text(text, color = Color.Black, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        if (active && ValueAnimator.areAnimatorsEnabled()) {
            Text(text, color = Color.White.copy(.55f), fontSize = 15.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.clearAndSetSemantics {}.shimmering(durationMillis = 2400))
        }
    }
}

/** Retains layout but consumes input before descendants and removes all protected semantics. */
@Composable
fun LockedFeaturePreview(minimum: SubscriptionTier, title: String, onUnlock: () -> Unit, content: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth().heightIn(min = 250.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxWidth().blur(3.dp).clearAndSetSemantics {}.pointerInput(Unit) {
            awaitPointerEventScope { while (true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() } }
        }) {
            CompositionLocalProvider(LocalFeatureGatePreview provides true) { content() }
        }
        Box(Modifier.matchParentSize().background(Color.Black.copy(.28f)).pointerInput(Unit) {
            awaitPointerEventScope { while (true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() } }
        }.clearAndSetSemantics {})
        TierUpgradeCard(minimum, title, Modifier.padding(24.dp).widthIn(max = 360.dp).fillMaxWidth(), onUnlock)
    }
}

@Composable
fun TieredAccessGate(minimum: SubscriptionTier, title: String, content: @Composable () -> Unit) {
    val access = appGraph().proAccess
    var show by remember { mutableStateOf(false) }
    when {
        LocalFeatureGatePreview.current -> content()
        access.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AppColors.appPrimary) }
        access.isTierRestricted(minimum) -> LockedFeaturePreview(minimum, title, { show = true }, content)
        else -> content()
    }
    PaywallDialogHost(show, "tier_upgrade_${minimum.slug}", onDismiss = { show = false }, minimumTier = minimum)
}
