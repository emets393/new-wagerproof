package com.wagerproof.app.features.analytics.historical

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.HelpOutline
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.stores.HistoricalAnalysisStore
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.CoroutineScope

/**
 * Natural-language filter chat — the docked input at the bottom of Historical
 * Trends. Port of iOS `HistoricalAnalysisView.chatDock`.
 *
 * Why it earns the permanent bottom slot: the page exposes ~120 filter
 * dimensions behind eleven sheets, and almost nobody finds the interesting ones
 * by hand. Typing "road dogs off a loss in November" is the discovery path, so
 * the dock has to be visible without scrolling — hence a floating overlay with
 * a scrim rather than a row inside the list.
 *
 * The dock does NOT resolve anything locally: it hands the sentence plus the
 * serialized filter to the `nl-filter-patch` edge function, which re-validates
 * every proposed op through the shared reducer. See
 * [com.wagerproof.core.services.NLFilterPatchService].
 */
@Composable
internal fun TrendsFilterChatDock(
    store: HistoricalAnalysisStore,
    sport: HistoricalAnalysisSport,
    userId: String?,
    scope: CoroutineScope,
    onResult: (HistoricalAnalysisStore.NLFilterResponse) -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val keyboard = LocalSoftwareKeyboardController.current
    var focused by remember { mutableStateOf(false) }
    val signedOut = userId == null
    val canSend = !signedOut && !store.nlChat.isProcessing && store.nlChat.inputText.isNotBlank()

    fun send(text: String = store.nlChat.inputText) {
        val trimmed = text.trim()
        if (signedOut || trimmed.isEmpty() || store.nlChat.isProcessing) return
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        keyboard?.hide()
        scope.launch {
            store.submitNLFilterQuery(trimmed, isAuthenticated = true)?.let(onResult)
        }
    }

    Column(
        modifier
            .fillMaxWidth()
            // Scrim so the dock separates from whatever scrolls beneath it —
            // without it the list runs straight into the input pill.
            .background(
                Brush.verticalGradient(
                    listOf(
                        AppColors.appSurface.copy(alpha = 0f),
                        AppColors.appSurface.copy(alpha = 0.85f),
                        AppColors.appSurface,
                    ),
                ),
            )
            .padding(top = 14.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ChatSuggestionRow(store, sport, focused, enabled = !signedOut) { suggestion ->
            store.nlChat.inputText = suggestion
            send(suggestion)
        }

        Row(
            Modifier
                .padding(horizontal = 12.dp)
                .fillMaxWidth()
                .height(48.dp)
                .liquidGlassCapsule()
                .border(1.dp, AppColors.appBorder.copy(alpha = .8f), CircleShape)
                .padding(start = 16.dp, end = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            BasicTextField(
                value = store.nlChat.inputText,
                onValueChange = { store.nlChat.inputText = it.replace('\n', ' ') },
                enabled = !signedOut && !store.nlChat.isProcessing,
                singleLine = true,
                modifier = Modifier
                    .weight(1f)
                    .onFocusChanged { focused = it.isFocused }
                    .semantics { contentDescription = "Describe the filters you want" },
                textStyle = TextStyle(color = AppColors.appTextPrimary, fontSize = 15.sp),
                cursorBrush = SolidColor(AppColors.appPrimary),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { send() }),
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (store.nlChat.inputText.isEmpty()) {
                            Text(
                                if (signedOut) "Sign in to use filter chat" else "Type what filters you want…",
                                color = AppColors.appTextSecondary,
                                fontSize = 15.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        inner()
                    }
                },
            )

            if (store.nlChat.isProcessing) {
                CircularProgressIndicator(
                    Modifier.size(22.dp),
                    strokeWidth = 2.dp,
                    color = AppColors.appPrimary,
                )
            } else {
                IconButton(
                    onClick = { send() },
                    enabled = canSend,
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(if (canSend) AppColors.appPrimary else AppColors.appSurfaceMuted),
                ) {
                    Icon(
                        Icons.Rounded.ArrowUpward,
                        "Send filter request",
                        Modifier.size(19.dp),
                        tint = if (canSend) Color.White else AppColors.appTextMuted,
                    )
                }
            }
        }
    }
}

/**
 * Chips above the input. They flip to the user's own recent queries while a
 * request runs or the field is focused (and history exists); first-timers get
 * the canned examples, which is what teaches the feature at all.
 */
@Composable
private fun ChatSuggestionRow(
    store: HistoricalAnalysisStore,
    sport: HistoricalAnalysisSport,
    focused: Boolean,
    enabled: Boolean,
    onPick: (String) -> Unit,
) {
    val showRecents = (store.nlChat.isProcessing || focused) && store.recentQueries.isNotEmpty()
    val items = if (showRecents) store.recentQueries else HistoricalAnalysisCopy.nlExampleQueries(sport)
    LazyRow(
        contentPadding = PaddingValues(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showRecents) {
            item("recents-glyph") {
                Icon(Icons.Rounded.History, null, Modifier.size(14.dp), tint = AppColors.appTextMuted)
            }
        }
        items(items, key = { it }) { suggestion ->
            Text(
                suggestion,
                color = if (enabled) AppColors.appTextPrimary else AppColors.appTextMuted,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .liquidGlassCapsule()
                    .clickable(enabled = enabled && !store.nlChat.isProcessing) { onPick(suggestion) }
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            )
        }
    }
}

/**
 * Transient result banner for one chat turn. Sits under the title bar rather
 * than at the bottom because the bottom belongs to the dock, and a snackbar
 * there would cover the very input the user is still typing in.
 */
@Composable
internal fun TrendsChatResultBanner(
    result: HistoricalAnalysisCopy.NLResult?,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Re-keys on the text so a newer banner restarts the timer instead of being
    // torn down by the previous one's countdown.
    LaunchedEffect(result?.text) {
        if (result == null) return@LaunchedEffect
        delay(3_000)
        onDismiss()
    }
    // Survives the null that starts the exit animation — otherwise the content
    // vanishes on frame one and the slide-out plays over an empty box.
    var shown by remember { mutableStateOf(result) }
    LaunchedEffect(result) { if (result != null) shown = result }
    AnimatedVisibility(
        visible = result != null,
        enter = slideInVertically { -it } + fadeIn(),
        exit = slideOutVertically { -it } + fadeOut(),
        modifier = modifier,
    ) {
        shown?.let { banner ->
            val (icon, tint) = bannerStyle(banner.tone)
            Row(
                Modifier
                    .padding(horizontal = 20.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(AppColors.appSurfaceElevated)
                    .border(1.dp, AppColors.appBorder, RoundedCornerShape(22.dp))
                    .clickable(onClick = onDismiss)
                    .padding(horizontal = 16.dp, vertical = 11.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(icon, null, Modifier.size(16.dp), tint = tint)
                Text(
                    banner.text,
                    color = AppColors.appTextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

private fun bannerStyle(tone: HistoricalAnalysisCopy.NLResultTone): Pair<ImageVector, Color> = when (tone) {
    HistoricalAnalysisCopy.NLResultTone.Success -> Icons.Rounded.CheckCircle to AppColors.appWin
    HistoricalAnalysisCopy.NLResultTone.Warning -> Icons.Rounded.WarningAmber to AppColors.appAccentAmber
    HistoricalAnalysisCopy.NLResultTone.Neutral -> Icons.Rounded.HelpOutline to AppColors.appTextSecondary
}
