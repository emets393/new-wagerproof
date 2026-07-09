package com.wagerproof.app.features.navigation

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing

/**
 * Persistent connectivity banner — port of iOS `Features/Navigation/OfflineBanner`
 * (doc 08 §3.4). iOS uses `NWPathMonitor`; the Android equivalent is
 * [ConnectivityManager.NetworkCallback] (see [rememberIsConnected]) so we don't
 * add a dependency.
 *
 * Overlay this at the top of the tab shell's content. The banner shows while
 * offline and stays dismissed for the rest of the session if the user taps the
 * X — reconnecting resets the manual dismiss so the next outage re-shows it.
 */
@Composable
fun OfflineBanner(modifier: Modifier = Modifier) {
    val isConnected by rememberIsConnected()
    // Session-sticky manual dismiss; cleared on reconnect (see below).
    var didDismiss by remember { mutableStateOf(false) }

    // When connectivity recovers, arm the banner again for the next outage.
    if (isConnected && didDismiss) {
        didDismiss = false
    }

    val shouldShow = !isConnected && !didDismiss

    AnimatedVisibility(
        visible = shouldShow,
        enter = slideInVertically { -it } + fadeIn(),
        exit = slideOutVertically { -it } + fadeOut(),
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFB91C1C))
                .padding(horizontal = Spacing.lg, vertical = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Icon(
                imageVector = AppIcon.WIFI_SLASH.imageVector,
                contentDescription = null,
                tint = Color.White,
            )
            Text(
                text = "No internet connection — showing cached data",
                style = AppTypography.caption,
                color = Color.White,
                textAlign = TextAlign.Start,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { didDismiss = true }) {
                Icon(
                    imageVector = AppIcon.XMARK.imageVector,
                    contentDescription = "Dismiss offline banner",
                    tint = Color.White.copy(alpha = 0.75f),
                )
            }
        }
    }
}

/**
 * Observes system connectivity via [ConnectivityManager.NetworkCallback] and
 * exposes it as recomposition-driving Compose state. Registers on first
 * composition, unregisters on dispose. Seeds with the current network state so
 * the banner never flashes on a healthy launch.
 */
@Composable
fun rememberIsConnected(): State<Boolean> {
    val context = LocalContext.current
    val state = remember { mutableStateOf(currentlyConnected(context)) }

    DisposableEffect(context) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        if (cm == null) {
            // No connectivity service (shouldn't happen) — assume online so we
            // never trap the user behind a false offline banner.
            state.value = true
            return@DisposableEffect onDispose {}
        }
        val callback = object : ConnectivityManager.NetworkCallback() {
            // Any usable network → connected. onLost fires when the last one drops.
            override fun onAvailable(network: Network) {
                state.value = currentlyConnected(context)
            }

            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                state.value = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            }

            override fun onLost(network: Network) {
                state.value = currentlyConnected(context)
            }
        }
        cm.registerDefaultNetworkCallback(callback)
        onDispose { cm.unregisterNetworkCallback(callback) }
    }

    return state
}

private fun currentlyConnected(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return true
    val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}
