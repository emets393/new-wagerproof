package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Flight
import androidx.compose.material.icons.rounded.GpsFixed
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AnalysisSystemCopy
import com.wagerproof.core.models.AnalysisSystemVerdict
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.stores.HistoricalAnalysisStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/**
 * Standalone Save System bottom sheet (toolbar entry point). The Systems hub
 * embeds [SaveSystemFlow] directly instead, so the two never stack.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SaveSystemSheet(
    store: HistoricalAnalysisStore,
    userId: String,
    onDismiss: () -> Unit,
    onSaved: (isPublic: Boolean) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
    ) {
        SaveSystemFlow(store = store, userId = userId, onSaved = onSaved)
    }
}

/**
 * Guided save flow for the system currently configured in Historical Trends —
 * port of iOS `SaveSystemSheet`.
 *
 * The flow edits a LOCAL draft snapshot. Picking Home/Away/Favorite/Underdog
 * narrows the draft only; the live analysis never moves unless the saved system
 * is later applied. Cancel therefore always leaves the page untouched.
 *
 * A save writes verdict + rpc_bet_type + rpc_filters, which is what makes the row
 * gradeable — see `.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md`.
 */
@Composable
internal fun SaveSystemFlow(
    store: HistoricalAnalysisStore,
    userId: String,
    modifier: Modifier = Modifier,
    initialSnapshot: HistoricalAnalysisUISnapshot? = null,
    initialVerdict: AnalysisSystemVerdict? = null,
    initialName: String = "",
    onSaved: (isPublic: Boolean) -> Unit,
) {
    val sport = store.sport
    val scope = rememberCoroutineScope()

    val seed = remember {
        (initialSnapshot ?: store.snapshot).let { base ->
            base.copy(selectedConferences = base.selectedConferences.toList()).also {
                if (it.betType.isEmpty()) it.betType = store.betType
            }
        }
    }
    var draft by remember { mutableStateOf(seed) }
    var verdict by remember { mutableStateOf(initialVerdict) }
    var name by remember { mutableStateOf(initialName) }
    var isPublic by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val isTotals = remember(seed) { AnalysisSystemCopy.isTotalMarket(seed.betType, sport) }
    /**
     * The page set is decided ONCE from the entry snapshot (iOS `entryStep`).
     * Re-deriving it from the live draft would collapse the flow mid-way: picking
     * "Home teams" makes the draft side-asymmetric, which would delete the step the
     * user is standing on and renumber the progress bar under them.
     */
    val pages = remember(seed, initialVerdict) {
        // A two-sided market whose filters pick no side grades a forced ~50%
        // tautology, so the flow makes the user commit to one first.
        val symmetricSide = AnalysisSystemCopy.isSideMarket(seed.betType, sport) &&
            AnalysisSystemCopy.isSideSymmetric(seed, sport)
        when {
            initialVerdict != null -> listOf(Step.DETAILS)
            isTotals -> listOf(Step.SIDE_CHOICE, Step.DETAILS)
            symmetricSide -> listOf(Step.SIDE_CHOICE, Step.BET_DIRECTION, Step.DETAILS)
            else -> listOf(Step.BET_DIRECTION, Step.DETAILS)
        }
    }
    var step by remember(pages) { mutableStateOf(pages.first()) }
    val stepIndex = pages.indexOf(step).coerceAtLeast(0)

    fun advance(next: Step) {
        errorMessage = null
        step = next
    }

    Column(
        modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 12.dp, bottom = 24.dp)
            .navigationBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        StepProgress(stepIndex, pages.size)
        CurrentSystemCard(sport, draft)

        when (step) {
            Step.SIDE_CHOICE -> {
                StepTitle(
                    if (isTotals) "Which total should it track?" else "Which teams should it track?",
                    if (isTotals) {
                        "Choose how every matching game is graded."
                    } else {
                        "This turns a two-sided search into one repeatable betting rule."
                    },
                )
                if (isTotals) {
                    OptionCard(Icons.Rounded.ArrowUpward, "The Over", "Grade every matching game as an Over bet.", AppColors.appWin) {
                        verdict = AnalysisSystemVerdict.OVER
                        advance(Step.DETAILS)
                    }
                    OptionCard(Icons.Rounded.ArrowDownward, "The Under", "Grade every matching game as an Under bet.", Color(0xFF38BDF8)) {
                        verdict = AnalysisSystemVerdict.UNDER
                        advance(Step.DETAILS)
                    }
                } else {
                    OptionCard(Icons.Rounded.Home, "Home teams", "Only track teams playing at home.", AppColors.appPrimary) {
                        draft = draft.copy().also { it.side = "home" }
                        advance(Step.BET_DIRECTION)
                    }
                    OptionCard(Icons.Rounded.Flight, "Away teams", "Only track teams playing on the road.", AppColors.appPrimary) {
                        draft = draft.copy().also { it.side = "away" }
                        advance(Step.BET_DIRECTION)
                    }
                    OptionCard(Icons.Rounded.Star, "Favorites", "Only track the favored side.", AppColors.appPrimary) {
                        draft = draft.withSystemFavDog("favorite")
                        advance(Step.BET_DIRECTION)
                    }
                    OptionCard(Icons.Rounded.Bolt, "Underdogs", "Only track the underdog side.", AppColors.appPrimary) {
                        draft = draft.withSystemFavDog("underdog")
                        advance(Step.BET_DIRECTION)
                    }
                }
            }

            Step.BET_DIRECTION -> {
                StepTitle(
                    "How should it bet?",
                    "Choose whether the system backs matching teams or fades them.",
                )
                OptionCard(Icons.Rounded.CheckCircle, "Bet ON matching teams", "When a team matches these filters, bet on that team.", AppColors.appWin) {
                    verdict = AnalysisSystemVerdict.TEAM
                    advance(Step.DETAILS)
                }
                OptionCard(Icons.Rounded.SwapHoriz, "Bet AGAINST matching teams", "When a team matches, bet on the other side.", AppColors.appAccentAmber) {
                    verdict = AnalysisSystemVerdict.FADE
                    advance(Step.DETAILS)
                }
            }

            Step.DETAILS -> {
                StepTitle(
                    "Name and save it",
                    "Use a name that makes the rule easy to recognize later.",
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("System name") },
                    placeholder = { Text("e.g. Home dogs off a blowout") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                verdict?.let { chosen ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(13.dp))
                            .background(AppColors.appSurfaceMuted)
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Icon(Icons.Rounded.GpsFixed, null, Modifier.size(16.dp), tint = AppColors.appPrimary)
                        Text(
                            "Tracks one bet ${AnalysisSystemCopy.betPhrase(chosen)} for every game matching this setup.",
                            color = AppColors.appTextSecondary,
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                        )
                    }
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(13.dp))
                        .background(AppColors.appSurfaceMuted)
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("Share to Systems Leaderboard", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "Your username, system name, rules, and graded performance will be visible after 10 matching games.",
                            color = AppColors.appTextSecondary,
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                        )
                    }
                    Switch(
                        checked = isPublic,
                        onCheckedChange = { isPublic = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = AppColors.appPrimary),
                    )
                }
                errorMessage?.let { message ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
                        Icon(Icons.Rounded.ErrorOutline, null, Modifier.size(15.dp), tint = AppColors.appLoss)
                        Text(message, color = AppColors.appLoss, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, lineHeight = 16.sp)
                    }
                }
                Button(
                    onClick = {
                        val chosen = verdict ?: return@Button
                        val trimmed = name.trim()
                        if (trimmed.isEmpty()) return@Button
                        errorMessage = null
                        scope.launch {
                            try {
                                store.saveSystem(
                                    name = trimmed,
                                    verdict = chosen,
                                    isPublic = isPublic,
                                    userId = userId,
                                    draftSnapshot = draft,
                                )
                                onSaved(isPublic)
                            } catch (cancellation: CancellationException) {
                                throw cancellation
                            } catch (error: Throwable) {
                                errorMessage = userFacingSaveError(error)
                            }
                        }
                    },
                    enabled = name.isNotBlank() && verdict != null && !store.isSavingSystem,
                    colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                ) {
                    if (store.isSavingSystem) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White)
                    } else {
                        Text("Save System", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (stepIndex > 0) {
            TextButton(onClick = { advance(pages[stepIndex - 1]) }, modifier = Modifier.fillMaxWidth()) {
                Text("Back", color = AppColors.appTextSecondary, fontSize = 13.sp)
            }
        }
    }
}

private enum class Step { SIDE_CHOICE, BET_DIRECTION, DETAILS }

/**
 * Favorite/underdog lives on a different field per market: football spread markets
 * carry their own `spreadSide`, everything else uses the moneyline `favDog`.
 */
internal fun HistoricalAnalysisUISnapshot.withSystemFavDog(value: String): HistoricalAnalysisUISnapshot =
    copy().also {
        if (it.betType == "fg_spread" || it.betType == "h1_spread") it.spreadSide = value else it.favDog = value
    }

@Composable
private fun StepProgress(index: Int, total: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(
            "STEP ${index + 1} OF $total",
            color = AppColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.9.sp,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            repeat(total) { i ->
                Box(
                    Modifier
                        .weight(1f)
                        .height(3.dp)
                        .clip(CircleShape)
                        .background(if (i <= index) AppColors.appPrimary else AppColors.appBorder),
                )
            }
        }
    }
}

@Composable
private fun CurrentSystemCard(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot) {
    val labels = systemFilterLabels(sport, snapshot)
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(44.dp).clip(CircleShape).background(AppColors.appPrimary.copy(alpha = .18f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Tune, null, Modifier.size(20.dp), tint = AppColors.appPrimary)
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Save this ${sport.shortTitle} system", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
            Text(
                (listOf(systemMarketLabel(snapshot.betType)) + labels.take(2)).joinToString(" · "),
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                maxLines = 2,
            )
        }
    }
}

@Composable
private fun StepTitle(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
        Text(subtitle, color = AppColors.appTextSecondary, fontSize = 13.sp, lineHeight = 18.sp)
    }
}

@Composable
private fun OptionCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    tint: Color,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appSurfaceElevated)
            .border(0.5.dp, AppColors.appBorder, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(40.dp).clip(CircleShape).background(tint.copy(alpha = .14f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(19.dp), tint = tint)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text(subtitle, color = AppColors.appTextSecondary, fontSize = 12.sp, lineHeight = 16.sp)
        }
        Icon(Icons.Rounded.ChevronRight, null, Modifier.size(16.dp), tint = AppColors.appTextSecondary)
    }
}

/**
 * Postgres/RLS errors are unreadable; map the ones users can actually act on.
 * Port of iOS `SaveSystemSheet.userFacingSaveError`.
 */
internal fun userFacingSaveError(error: Throwable): String {
    val raw = (error.message ?: "").trim()
    val lower = raw.lowercase()
    return when {
        lower.contains("row-level security") || lower.contains("42501") || lower.contains("not authenticated") ->
            "Couldn't save — sign in again and try once more."
        lower.contains("jwt") || lower.contains("session") ->
            "Couldn't save — your session expired. Sign in again."
        lower.contains("duplicate") || lower.contains("unique") ->
            "Couldn't save — try a different name."
        lower.contains("network") || lower.contains("timed out") || lower.contains("offline") ->
            "Couldn't save — check your connection and try again."
        raw.isEmpty() -> "Couldn't save — try again."
        raw.length > 160 -> "Couldn't save — ${raw.take(140)}…"
        else -> "Couldn't save — $raw"
    }
}
