package com.wagerproof.app.features.chat

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.services.WagerBotVoiceFunctions
import com.wagerproof.core.services.WagerBotVoiceSession
import com.wagerproof.core.stores.StorePrefs
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class VoiceOption(val wire: String, val name: String, val subtitle: String)
private data class PersonalityOption(val wire: String, val name: String, val subtitle: String)
private data class ModelOption(val wire: String, val name: String, val subtitle: String)

private val Voices = listOf(
    VoiceOption("marin", "Sky", "Warm, measured voice"),
    VoiceOption("cedar", "Vegas", "Deep, confident voice"),
    VoiceOption("ash", "Ace", "Crisp, neutral voice"),
)
private val Personalities = listOf(
    PersonalityOption("friendly", "Friendly", "Helpful, level-headed betting analyst"),
    PersonalityOption("spicy", "Spicy", "Brutally honest hot takes — adults only"),
)
private val Models = listOf(
    ModelOption("gpt-realtime", "Flagship", "Most capable"),
    ModelOption("gpt-realtime-mini", "Fast", "Lower latency"),
)

/** Full realtime voice surface backed by [WagerBotVoiceSession]. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WagerBotVoiceScreen(
    isPro: Boolean,
    onBack: () -> Unit,
    onUpgrade: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val session = remember { WagerBotVoiceSession(context) }
    val scope = rememberCoroutineScope()
    val state by session.state.collectAsState()
    val isAiSpeaking by session.isAiSpeaking.collectAsState()
    val isWaiting by session.isWaitingForResponse.collectAsState()

    var voice by remember { mutableStateOf(StorePrefs.standard.getString("wagerbot.voice", "marin") ?: "marin") }
    var personality by remember { mutableStateOf(StorePrefs.standard.getString("wagerbot.personality", "friendly") ?: "friendly") }
    var model by remember { mutableStateOf(StorePrefs.standard.getString("wagerbot.model", "gpt-realtime") ?: "gpt-realtime") }
    var guidance by remember { mutableStateOf(StorePrefs.standard.getString("wagerbot.guidance", "").orEmpty()) }
    var isHolding by remember { mutableStateOf(false) }
    var lastError by remember { mutableStateOf<String?>(null) }
    var limitMessage by remember { mutableStateOf<String?>(null) }
    var showSettings by remember { mutableStateOf(false) }
    var spicyStep by remember { mutableIntStateOf(0) }
    var connectedAt by remember { mutableLongStateOf(0L) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var reconnectNonce by remember { mutableIntStateOf(0) }

    fun connect(
        voiceOverride: String = voice,
        personalityOverride: String = personality,
        modelOverride: String = model,
    ) {
        scope.launch {
            lastError = null
            try {
                session.start(
                    voiceWire = voiceOverride,
                    rudenessWire = personalityOverride,
                    modelWire = modelOverride,
                    guidance = guidance.trim().takeIf { it.isNotEmpty() },
                )
            } catch (error: Throwable) {
                val message = error.message ?: "Couldn't start WagerBot Voice."
                if ((error is WagerBotVoiceFunctions.VoiceSessionException && error.status == 429) ||
                    message.contains("limit", ignoreCase = true)
                ) {
                    limitMessage = message
                } else {
                    lastError = message
                }
            }
        }
    }

    suspend fun stopAndBack() {
        isHolding = false
        session.stop()
        onBack()
    }

    LaunchedEffect(Unit) { connect() }
    LaunchedEffect(state) {
        when (val current = state) {
            WagerBotVoiceSession.State.Connected -> {
                if (connectedAt == 0L) connectedAt = System.currentTimeMillis()
                lastError = null
            }
            WagerBotVoiceSession.State.Idle,
            WagerBotVoiceSession.State.Ended -> connectedAt = 0L
            is WagerBotVoiceSession.State.Error -> lastError = current.message
            else -> Unit
        }
    }
    LaunchedEffect(connectedAt) {
        while (connectedAt != 0L) {
            now = System.currentTimeMillis()
            delay(1_000)
        }
    }
    DisposableEffect(session) {
        onDispose { CoroutineScope(Dispatchers.Default).launch { session.stop() } }
    }
    BackHandler { scope.launch { stopAndBack() } }

    val connecting = state == WagerBotVoiceSession.State.RequestingSession || state == WagerBotVoiceSession.State.Connecting
    val connected = state == WagerBotVoiceSession.State.Connected
    val active = isHolding || isAiSpeaking || isWaiting
    val status = when {
        lastError != null -> "Reconnect needed"
        isHolding -> "Listening..."
        isAiSpeaking -> "Speaking..."
        isWaiting -> "Thinking..."
        connecting -> "Connecting..."
        connected -> "Ready"
        else -> "Disconnected"
    }
    val statusColor = when {
        lastError != null -> Loss
        isHolding -> Amber
        isAiSpeaking || isWaiting || connected -> VoiceGreen
        else -> Color.White.copy(alpha = 0.4f)
    }
    val pulse by rememberInfiniteTransition(label = "voice-pulse").animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1_400), RepeatMode.Reverse),
        label = "voice-pulse-value",
    )
    val elapsed = if (connectedAt == 0L) 0L else ((now - connectedAt) / 1_000).coerceAtLeast(0)
    val duration = String.format(Locale.US, "%02d:%02d", (elapsed / 60) % 60, elapsed % 60)
    val selectedVoice = Voices.firstOrNull { it.wire == voice } ?: Voices.first()

    Column(
        modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF0A0A0A), Color(0xFF111827), Color(0xFF0A0A0A))))
            .safeDrawingPadding()
            .padding(horizontal = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { scope.launch { stopAndBack() } }, modifier = Modifier.semantics { contentDescription = "Close WagerBot Voice" }) {
                Icon(chatIcon("chevron.backward"), null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.weight(1f))
            Text(duration, color = Color.White.copy(alpha = 0.7f), fontSize = 15.sp, fontFamily = FontFamily.Monospace)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { showSettings = true }, modifier = Modifier.semantics { contentDescription = "Voice settings" }) {
                Icon(chatIcon("gearshape.fill"), null, tint = Color.White, modifier = Modifier.size(21.dp))
            }
        }

        Row(
            Modifier.clip(CircleShape).background(statusColor.copy(alpha = 0.14f)).border(1.dp, statusColor.copy(alpha = 0.3f), CircleShape).padding(horizontal = 14.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(statusColor))
            Text(status, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(VoiceGreen.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                Icon(chatIcon("waveform"), null, tint = VoiceGreen, modifier = Modifier.size(18.dp))
            }
            Text("WagerBot Voice", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        }

        lastError?.let { error ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Loss.copy(alpha = 0.92f))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(chatIcon("exclamationmark.triangle.fill"), null, tint = Color.White, modifier = Modifier.size(16.dp))
                Text(error, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 2, modifier = Modifier.weight(1f))
            }
        }

        Spacer(Modifier.weight(1f))
        BoxWithConstraints(contentAlignment = Alignment.Center) {
            val orbSize = if (maxHeight < 300.dp) 200.dp else 240.dp
            val innerSize = orbSize * 0.82f
            Box(
                Modifier
                    .size(orbSize)
                    .scale(if (active) 1f + pulse * 0.04f else 1f)
                    .clip(CircleShape)
                    .background(VoiceGreen.copy(alpha = if (active) 0.22f + pulse * 0.18f else 0.08f)),
            )
            Box(Modifier.size(innerSize).clip(CircleShape).background(Color(0xFF121212)), contentAlignment = Alignment.Center) {
                WagerBotDynamicIcon(if (orbSize == 200.dp) 88.dp else 104.dp)
            }
        }
        Spacer(Modifier.height(14.dp))
        Text(selectedVoice.name, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("WagerBot Voice", color = Color.White.copy(alpha = 0.58f), fontSize = 13.sp)
        Spacer(Modifier.weight(1f))

        val talkEnabled = connected && lastError == null
        val talkShape = RoundedCornerShape(20.dp)
        Row(
            Modifier
                .fillMaxWidth()
                .clip(talkShape)
                .background(if (isHolding) VoiceGreen.copy(alpha = 0.85f) else if (talkEnabled) VoiceGreen else Color.White.copy(alpha = 0.12f))
                .pointerInput(talkEnabled, reconnectNonce) {
                    detectTapGestures(onPress = {
                        if (!talkEnabled) return@detectTapGestures
                        isHolding = true
                        session.startTalking()
                        tryAwaitRelease()
                        isHolding = false
                        session.stopTalking()
                    })
                }
                .semantics {
                    role = Role.Button
                    contentDescription = if (isHolding) "Release to send" else "Hold to talk"
                    onClick(if (isHolding) "Release to send" else "Start talking") {
                        if (!talkEnabled) {
                            false
                        } else {
                            if (isHolding) {
                                isHolding = false
                                session.stopTalking()
                            } else {
                                isHolding = true
                                session.startTalking()
                            }
                            true
                        }
                    }
                }
                .padding(horizontal = 18.dp, vertical = 18.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(chatIcon(if (isHolding) "mic.fill" else "hand.tap.fill"), null, tint = Color.White, modifier = Modifier.size(24.dp))
            Spacer(Modifier.size(12.dp))
            Text(
                when {
                    connecting -> "Connecting..."
                    !talkEnabled -> "Disconnected"
                    isHolding -> "Release To Send"
                    else -> "Press And Hold To Talk"
                },
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            val secondaryShape = RoundedCornerShape(14.dp)
            Button(
                onClick = { reconnectNonce++; connect() },
                modifier = Modifier.weight(1f).border(1.dp, Color.White.copy(alpha = 0.18f), secondaryShape),
                shape = secondaryShape,
                colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.06f)),
            ) {
                Icon(chatIcon("arrow.clockwise"), null, modifier = Modifier.size(17.dp))
                Text("  Reconnect")
            }
            Button(
                onClick = { scope.launch { session.stop() } },
                modifier = Modifier.weight(1f).border(1.dp, Loss.copy(alpha = 0.35f), secondaryShape),
                shape = secondaryShape,
                colors = ButtonDefaults.buttonColors(containerColor = Loss.copy(alpha = 0.12f), contentColor = Loss),
            ) {
                Icon(chatIcon("phone.down.fill"), null, modifier = Modifier.size(17.dp))
                Text("  Hang Up")
            }
        }
        Spacer(Modifier.height(16.dp))
    }

    if (showSettings) {
        VoiceSettingsSheet(
            voice = voice,
            personality = personality,
            model = model,
            guidance = guidance,
            onGuidance = {
                guidance = it.take(1_500)
                StorePrefs.standard.edit().putString("wagerbot.guidance", guidance).apply()
            },
            onVoice = { selected ->
                voice = selected
                StorePrefs.standard.edit().putString("wagerbot.voice", selected).apply()
                showSettings = false
                connect(voiceOverride = selected)
            },
            onPersonality = { selected ->
                if (selected == "spicy" && personality != "spicy") spicyStep = 1
                else {
                    personality = selected
                    StorePrefs.standard.edit().putString("wagerbot.personality", selected).apply()
                    showSettings = false
                    connect(personalityOverride = selected)
                }
            },
            onModel = { selected ->
                model = selected
                StorePrefs.standard.edit().putString("wagerbot.model", selected).apply()
                showSettings = false
                connect(modelOverride = selected)
            },
            onDismiss = { showSettings = false },
        )
    }

    if (spicyStep in 1..3) {
        val title = when (spicyStep) {
            1 -> "Turn on Spicy Mode?"
            2 -> "Are you sure?"
            else -> "Last chance!"
        }
        val body = when (spicyStep) {
            1 -> "Heads up — Spicy Mode is built for entertainment. WagerBot drops the level-headed analyst act and starts throwing brutally honest hot takes on your bets."
            2 -> "This gets R-rated. WagerBot will roast your picks, talk trash, and use explicit profanity. It's definitely not for kids."
            else -> "Okay, you've been warned. We're turning on the full degenerate — uncensored, unfiltered, and absolutely savage about your slips. No take-backs."
        }
        AlertDialog(
            onDismissRequest = { spicyStep = 0 },
            title = { Text(title) },
            text = { Text(body) },
            confirmButton = {
                TextButton(onClick = {
                    if (spicyStep < 3) {
                        spicyStep += 1
                    } else {
                        personality = "spicy"
                        StorePrefs.standard.edit().putString("wagerbot.personality", "spicy").apply()
                        spicyStep = 0
                        showSettings = false
                        connect(personalityOverride = "spicy")
                    }
                }) {
                    Text(
                        when (spicyStep) { 1 -> "I'm curious"; 2 -> "I can handle it"; else -> "Turn it on" },
                        color = if (spicyStep >= 2) Loss else VoiceGreen,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { spicyStep = 0 }) {
                    Text(when (spicyStep) { 1 -> "Never mind"; 2 -> "Take me back"; else -> "Actually, no" })
                }
            },
            containerColor = Color(0xFF171717),
            titleContentColor = Color.White,
            textContentColor = Color.LightGray,
        )
    }

    limitMessage?.let { message ->
        VoiceLimitSheet(
            isPro = isPro,
            message = message,
            onDismiss = { limitMessage = null },
            onUpgrade = {
                limitMessage = null
                onUpgrade()
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VoiceSettingsSheet(
    voice: String,
    personality: String,
    model: String,
    guidance: String,
    onGuidance: (String) -> Unit,
    onVoice: (String) -> Unit,
    onPersonality: (String) -> Unit,
    onModel: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color(0xFF0F0F0F),
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Voice Settings", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            SettingsLabel("VOICE")
            Voices.forEach { option -> OptionTile(option.name, option.subtitle, option.wire == voice, "waveform.circle.fill") { onVoice(option.wire) } }
            Spacer(Modifier.height(12.dp))
            SettingsLabel("PERSONALITY")
            Personalities.forEach { option -> OptionTile(option.name, option.subtitle, option.wire == personality, if (option.wire == "spicy") "flame.fill" else "face.smiling.inverse") { onPersonality(option.wire) } }
            Spacer(Modifier.height(12.dp))
            SettingsLabel("ADVANCED")
            Text("Model", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Models.forEach { option -> OptionTile(option.name, option.subtitle, option.wire == model, if (option.wire.endsWith("mini")) "bolt.fill" else "sparkles") { onModel(option.wire) } }
            Text("Custom Guidance", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
            Text("Extra instructions apply on the next connect.", color = Color.Gray, fontSize = 12.sp)
            TextField(
                value = guidance,
                onValueChange = onGuidance,
                modifier = Modifier.fillMaxWidth().height(120.dp),
                placeholder = { Text("e.g. Focus on NBA unders, talk fast, call me 'champ'.") },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFF1A1A1A),
                    unfocusedContainerColor = Color(0xFF1A1A1A),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedIndicatorColor = VoiceGreen,
                    unfocusedIndicatorColor = Color.DarkGray,
                ),
            )
            Text("${guidance.length}/1500", color = if (guidance.length >= 1_500) Loss else Color.Gray, fontSize = 11.sp, modifier = Modifier.align(Alignment.End))
            Spacer(Modifier.height(22.dp))
        }
    }
}

@Composable
private fun SettingsLabel(text: String) {
    Text(text, color = Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
}

@Composable
private fun OptionTile(label: String, subtitle: String, selected: Boolean, icon: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(if (selected) VoiceGreen.copy(alpha = 0.12f) else Color(0xFF171717)).border(if (selected) 2.dp else 1.dp, if (selected) VoiceGreen else Color(0xFF2A2A2A), shape).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(if (selected) VoiceGreen else Color(0xFF242424)), contentAlignment = Alignment.Center) {
            Icon(chatIcon(icon), null, tint = if (selected) Color.White else Color.Gray, modifier = Modifier.size(22.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(label, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = Color.Gray, fontSize = 12.sp)
        }
        if (selected) Icon(chatIcon("checkmark.circle.fill"), null, tint = VoiceGreen, modifier = Modifier.size(24.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VoiceLimitSheet(isPro: Boolean, message: String, onDismiss: () -> Unit, onUpgrade: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color(0xFF101010),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            WagerBotDynamicIcon(82.dp)
            Spacer(Modifier.height(14.dp))
            Text(if (isPro) "You've hit your Pro voice limit" else "You've hit today's voice limit", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Text(
                if (isPro) "You've used your full Pro voice budget. It resets automatically, so check back soon." else "You've used your free WagerBot Voice sessions. Upgrade to Pro for a much bigger budget, or check back when it resets.",
                color = Color.Gray,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(14.dp))
            Text(message, color = Color.LightGray, fontSize = 12.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(20.dp))
            if (!isPro) {
                Button(onClick = onUpgrade, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = VoiceGreen)) { Text("Upgrade to Pro") }
                TextButton(onClick = onDismiss) { Text("Maybe later", color = Color.Gray) }
            } else {
                Button(onClick = onDismiss, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = VoiceGreen)) { Text("Got it") }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}

private val VoiceGreen = Color(0xFF22C55E)
private val Amber = Color(0xFFF59E0B)
private val Loss = Color(0xFFE53935)
