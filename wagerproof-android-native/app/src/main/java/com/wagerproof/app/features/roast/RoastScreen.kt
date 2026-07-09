package com.wagerproof.app.features.roast

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.RoastSessionStore
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch

/** Full-screen Roast Mode composition, matching the iOS/RN conversation flow. */
@Composable
fun RoastScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val tabStore = appGraph().mainTab
    val store = remember { RoastSessionStore() }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var showClearConfirm by remember { mutableStateOf(false) }
    var microphoneDenied by remember { mutableStateOf(false) }

    fun toggleMicrophone() {
        scope.launch { store.toggleRecording() }
    }

    val microphonePermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) toggleMicrophone() else microphoneDenied = true
    }

    LaunchedEffect(store) {
        try {
            store.connect()
            awaitCancellation()
        } finally {
            store.disconnect()
        }
    }

    LaunchedEffect(store.messages.size, store.liveTranscript, store.aiTranscript, store.state) {
        val count = store.messages.size +
            (if (store.liveTranscript.isNotBlank()) 1 else 0) +
            (if (store.aiTranscript.isNotBlank()) 1 else 0)
        if (count > 0) listState.animateScrollToItem(count - 1)
    }

    Box(
        modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF0A0A0A), Color(0xFF111827), Color(0xFF0A0A0A)),
                ),
            )
            .safeDrawingPadding(),
    ) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { tabStore.isRoastPresented = false }, modifier = Modifier.size(44.dp)) {
                    Icon(AppIcon.CHEVRON_LEFT.imageVector, contentDescription = "Close roast", tint = Color.White)
                }
                Text(
                    "Roast Mode",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { showClearConfirm = true }, modifier = Modifier.size(44.dp)) {
                    Icon(AppIcon.ARROW_CLOCKWISE.imageVector, contentDescription = "Clear conversation", tint = Color.White)
                }
            }

            RoastIntensitySelector(
                intensity = store.intensity,
                onChange = { next -> scope.launch { store.setIntensity(next) } },
                modifier = Modifier.padding(horizontal = 16.dp),
            )

            if (store.isConnecting) StatusBanner("Connecting to The Bookie…", isError = false)
            store.error?.let { StatusBanner(it, isError = true) }

            val isEmpty = store.messages.isEmpty() && store.liveTranscript.isBlank() && store.aiTranscript.isBlank()
            if (isEmpty) {
                Column(
                    Modifier.weight(1f).fillMaxWidth().padding(horizontal = 32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(AppIcon.MIC_FILL.imageVector, contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(42.dp))
                    Text("Ready to get roasted?", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp))
                    Text(
                        "Tell The Bookie about your worst bets and prepare to get destroyed.",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    items(store.messages, key = { it.id }) { message ->
                        RoastMessageBubble(message.text, RoastBubbleVariant.Finalized(message.role))
                    }
                    if (store.liveTranscript.isNotBlank()) {
                        item(key = "live-user") { RoastMessageBubble(store.liveTranscript, RoastBubbleVariant.LiveUser) }
                    }
                    if (store.aiTranscript.isNotBlank()) {
                        item(key = "live-assistant") { RoastMessageBubble(store.aiTranscript, RoastBubbleVariant.LiveAssistant) }
                    }
                }
            }

            Column(
                Modifier.fillMaxWidth().navigationBarsPadding().padding(bottom = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BookieOrb()
                Text(
                    if (store.isConnecting) "Connecting to The Bookie…" else store.state.statusText,
                    color = when (store.state) {
                        RoastSessionStore.SessionState.recording -> AppColors.appPrimary
                        RoastSessionStore.SessionState.responding -> AppColors.appAccentAmber
                        else -> Color.White.copy(alpha = 0.5f)
                    },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                )
                RoastMicButtonView(state = store.state, onTap = {
                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        toggleMicrophone()
                    } else {
                        microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
                    }
                })
            }
        }
    }

    if (showClearConfirm) {
        AlertDialog(
            onDismissRequest = { showClearConfirm = false },
            title = { Text("Clear conversation?") },
            text = { Text("The Bookie will forget everything you've said this session.") },
            confirmButton = {
                TextButton(onClick = {
                    showClearConfirm = false
                    scope.launch { store.clearConversation() }
                }) { Text("Clear", color = AppColors.appAccentRed) }
            },
            dismissButton = { TextButton(onClick = { showClearConfirm = false }) { Text("Cancel") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    if (microphoneDenied) {
        AlertDialog(
            onDismissRequest = { microphoneDenied = false },
            title = { Text("Microphone access required") },
            text = { Text("Allow microphone access in Android Settings to talk to The Bookie.") },
            confirmButton = { TextButton(onClick = { microphoneDenied = false }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}

@Composable
private fun StatusBanner(text: String, isError: Boolean) {
    Text(
        text,
        color = Color.White.copy(alpha = 0.75f),
        fontSize = 13.sp,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 3.dp)
            .background(
                if (isError) AppColors.appAccentRed.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.1f),
                androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
            )
            .padding(horizontal = 12.dp, vertical = 7.dp),
    )
}
