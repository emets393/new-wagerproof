package com.wagerproof.app.features.parlaygod

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.components.WidgetHeaderAccessory
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.ParlaySport
import com.wagerproof.core.models.ParlayTicket

/**
 * Entitlement input kept outside the component layer. Resolving intentionally
 * behaves like granted access so the rail never flashes a lock while the host
 * checks RevenueCat; Locked delegates the paywall action to [onRequestPro].
 */
enum class ParlayGodAccessState { Granted, Resolving, Locked }

/**
 * Shared horizontal Parlay God surface for Outliers, Props, and Search.
 * Selection and monetization are callbacks; this component owns neither a
 * store nor a paywall, so hosts can hoist both consistently.
 */
@Composable
fun ParlayGodRail(
    title: String,
    tickets: List<ParlayTicket>,
    isLoading: Boolean,
    onTicketClick: (ParlayTicket) -> Unit,
    modifier: Modifier = Modifier,
    icon: AppIcon = AppIcon.BOLT_FILL,
    sports: List<ParlaySport> = emptyList(),
    showsHeader: Boolean = true,
    emptyMessage: String? = null,
    errorMessage: String? = null,
    onRetry: (() -> Unit)? = null,
    accessState: ParlayGodAccessState = ParlayGodAccessState.Granted,
    onRequestPro: () -> Unit = {},
    cardWidth: Dp = 300.dp,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 2.dp),
) {
    if (tickets.isEmpty() && !isLoading && errorMessage == null && emptyMessage == null) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (showsHeader) {
            ParlayGodSectionHeader(title = title, icon = icon, sports = sports)
        }
        ParlayGodProGate(
            title = title,
            state = accessState,
            onRequestPro = onRequestPro,
            minHeight = 120.dp,
        ) {
            ParlayGodRailContent(
                tickets = tickets,
                isLoading = isLoading,
                emptyMessage = emptyMessage,
                errorMessage = errorMessage,
                onRetry = onRetry,
                onTicketClick = onTicketClick,
                cardWidth = cardWidth,
                contentPadding = contentPadding,
            )
        }
    }
}

@Composable
private fun ParlayGodSectionHeader(
    title: String,
    icon: AppIcon,
    sports: List<ParlaySport>,
) {
    Row(
        Modifier.fillMaxWidth().semantics { heading() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon.imageVector, contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(13.dp))
        Text(
            title.uppercase(),
            color = AppColors.appTextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.7.sp,
        )
        Spacer(Modifier.weight(1f))
        if (sports.isNotEmpty()) SupportsCluster(sports)
    }
}

@Composable
private fun SupportsCluster(sports: List<ParlaySport>) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Text("Supports", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy((-5).dp)) {
            sports.forEach { sport ->
                Box(
                    Modifier
                        .size(19.dp)
                        .clip(CircleShape)
                        .background(AppColors.appSurfaceElevated)
                        .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.6f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = when (sport) {
                            ParlaySport.MLB -> AppIcon.BASEBALL.imageVector
                            ParlaySport.NFL -> AppIcon.FOOTBALL_FILL.imageVector
                        },
                        contentDescription = sport.shortLabel,
                        tint = AppColors.appTextSecondary,
                        modifier = Modifier.size(11.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ParlayGodRailContent(
    tickets: List<ParlayTicket>,
    isLoading: Boolean,
    emptyMessage: String?,
    errorMessage: String?,
    onRetry: (() -> Unit)?,
    onTicketClick: (ParlayTicket) -> Unit,
    cardWidth: Dp,
    contentPadding: PaddingValues,
) {
    when {
        tickets.isNotEmpty() -> {
            LazyRow(
                contentPadding = contentPadding,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(tickets, key = { it.id }) { ticket ->
                    ParlayGodCard(
                        ticket = ticket,
                        modifier = Modifier.width(cardWidth),
                        onClick = { onTicketClick(ticket) },
                    )
                }
            }
        }

        isLoading -> {
            LazyRow(
                userScrollEnabled = false,
                contentPadding = contentPadding,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(3) { ParlayGodCardShimmer(Modifier.width(cardWidth)) }
            }
        }

        errorMessage != null -> {
            ParlayGodErrorState(
                message = errorMessage,
                onRetry = onRetry,
                modifier = Modifier.padding(contentPadding),
            )
        }

        emptyMessage != null -> {
            ParlayGodEmptyState(
                message = emptyMessage,
                modifier = Modifier.padding(contentPadding),
            )
        }
    }
}

/** Calm overnight/offseason state; callers provide surface-specific copy. */
@Composable
fun ParlayGodEmptyState(
    message: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated, shape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.35f), shape)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Icon(
            AppIcon.CLOCK_FILL.imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(18.dp),
        )
        Text(
            message,
            color = AppColors.appTextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
    }
}

/** Recoverable load failure with an optional host-owned retry action. */
@Composable
fun ParlayGodErrorState(
    message: String,
    onRetry: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated, shape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Icon(
            AppIcon.EXCLAMATION_CIRCLE.imageVector,
            contentDescription = null,
            tint = AppColors.appAccentAmber,
            modifier = Modifier.size(18.dp),
        )
        Text(
            message,
            color = AppColors.appTextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        if (onRetry != null) {
            TextButton(onClick = onRetry) {
                Text("Retry", color = AppColors.appPrimary, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Expanded evidence card in the app's standard Material bottom sheet. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParlayGodDetailSheet(
    ticket: ParlayTicket,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false),
        containerColor = AppColors.appSurface,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "PARLAY GOD",
                    color = AppColors.appTextSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.semantics { heading() },
                )
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        AppIcon.XMARK_CIRCLE_FILL.imageVector,
                        contentDescription = "Close",
                        tint = AppColors.appTextMuted,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }
            ParlayGodCard(
                ticket = ticket,
                displayMode = ParlayGodCardDisplayMode.Expanded,
            )
        }
    }
}

/**
 * Same-game ticket rail for MLB/NFL detail stacks. The host supplies tickets
 * from `ParlayGodStore.tickets(gameKey)` and controls selection/paywall/retry.
 */
@Composable
fun MatchupParlaysWidget(
    tickets: List<ParlayTicket>,
    onTicketClick: (ParlayTicket) -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    errorMessage: String? = null,
    onRetry: (() -> Unit)? = null,
    accessState: ParlayGodAccessState = ParlayGodAccessState.Granted,
    onRequestPro: () -> Unit = {},
) {
    WidgetCollapsingSection(
        title = "Matchup Parlays",
        modifier = modifier,
        icon = AppIcon.BOLT_FILL,
        iconTint = AppColors.appPrimary,
        accessory = WidgetHeaderAccessory.Verdict(
            text = "${tickets.size} OPTION${if (tickets.size == 1) "" else "S"}",
            tint = AppColors.appWin,
        ),
        bodyPadding = 0.dp,
    ) {
        ParlayGodProGate(
            title = "Matchup Parlays",
            state = accessState,
            onRequestPro = onRequestPro,
            minHeight = 120.dp,
        ) {
            when {
                tickets.isNotEmpty() -> {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 2.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(tickets, key = { it.id }) { ticket ->
                            ParlayGodCard(
                                ticket = ticket,
                                showsMatchup = false,
                                modifier = Modifier.width(300.dp),
                                onClick = { onTicketClick(ticket) },
                            )
                        }
                    }
                }

                isLoading -> {
                    LazyRow(
                        userScrollEnabled = false,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 2.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(2) { ParlayGodCardShimmer(Modifier.width(300.dp)) }
                    }
                }

                errorMessage != null -> {
                    ParlayGodErrorState(
                        message = errorMessage,
                        onRetry = onRetry,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }

                else -> {
                    ParlayGodEmptyState(
                        message = "No same-game tickets cleared every streak rule for this matchup.",
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ParlayGodProGate(
    title: String,
    state: ParlayGodAccessState,
    onRequestPro: () -> Unit,
    minHeight: Dp,
    content: @Composable () -> Unit,
) {
    if (state != ParlayGodAccessState.Locked) {
        content()
        return
    }

    Box(
        Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = minHeight)
            .clip(RoundedCornerShape(12.dp)),
    ) {
        // Keep the locked preview visual-only. Clearing this node's semantics
        // prevents TalkBack from reaching ticket/retry actions beneath the
        // unlock surface even though those composables remain mounted.
        Box(
            Modifier
                .alpha(0.3f)
                .blur(8.dp)
                .clearAndSetSemantics { },
        ) {
            content()
        }
        Box(
            Modifier
                .fillMaxSize()
                .background(AppColors.appSurface.copy(alpha = 0.82f))
                .clickable(
                    role = Role.Button,
                    onClickLabel = "Unlock $title",
                    onClick = onRequestPro,
                )
                .semantics(mergeDescendants = true) {
                    contentDescription = "$title. Tap to unlock"
                },
            contentAlignment = Alignment.Center,
        ) {
            Row(
                Modifier
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.86f))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Icon(
                    AppIcon.LOCK_FILL.imageVector,
                    contentDescription = null,
                    tint = AppColors.appAccentAmber,
                    modifier = Modifier.size(18.dp),
                )
                Column {
                    Text(title, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text("Tap to unlock", color = AppColors.appTextSecondary, fontSize = 11.sp)
                }
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0A0A0A, widthDp = 390)
@Composable
private fun ParlayGodRailPreview() {
    val first = parlayGodPreviewTicket()
    ParlayGodRail(
        title = "Parlay God",
        tickets = listOf(first, first.copy(id = "preview-ticket-2")),
        isLoading = false,
        sports = first.sports,
        onTicketClick = {},
        modifier = Modifier.background(AppColors.appSurface).padding(vertical = 16.dp),
    )
}
