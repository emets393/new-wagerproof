package com.wagerproof.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.wagerproof.app.di.LocalAppGraph
import com.wagerproof.app.nav.RootHost
import com.wagerproof.app.ui.theme.WagerproofTheme
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.auth.handleDeeplinks
import kotlinx.coroutines.launch

/**
 * Single activity (launchMode singleTask, portrait). Installs the system splash,
 * applies the dark-only theme, provides the DI graph to the tree, and renders the
 * root phase host. Deep links (`wagerproof://`) are parsed here and routed through
 * [com.wagerproof.core.stores.RootRouter], which buffers until the shell is ready.
 */
class MainActivity : ComponentActivity() {

    private val graph: AppGraph
        get() = (application as WagerproofApplication).graph

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Cold-start deep link (launcher may deliver the URL in the start Intent).
        handleDeepLink(intent)

        setContent {
            CompositionLocalProvider(LocalAppGraph provides graph) {
                WagerproofTheme {
                    RootHost()
                }
            }
        }
    }

    // singleTask → a link while running arrives here, not a new Activity.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    /** Route RevenueCat, Supabase recovery, then product ACTION_VIEW intents. */
    private fun handleDeepLink(intent: Intent?) {
        val uri: Uri = intent?.takeIf { it.action == Intent.ACTION_VIEW }?.data ?: return
        lifecycleScope.launch {
            // RevenueCat Web Billing owns its rc-* callback scheme. Only pass
            // unrelated links through the Supabase/product routing chain.
            if (graph.revenueCat.handleWebPurchaseRedemption(intent)) return@launch

            // Let supabase-kt import OAuth/OTP/recovery sessions before our product
            // router consumes the destination. Update Password needs the recovery
            // session carried by the link, not merely the route name.
            SupabaseClients.main.handleDeeplinks(intent)
            graph.rootRouter.handle(uri)
        }
    }
}
