package com.wagerproof.app.features.parlaygod

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.app.features.props.components.PlayerHeadshot
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.ParlayGodCategory
import com.wagerproof.core.models.ParlayLeg
import com.wagerproof.core.models.ParlaySport
import com.wagerproof.core.models.ParlayTicket

/** Compact rail geometry or the evidence-rich detail-sheet presentation. */
enum class ParlayGodCardDisplayMode { Compact, Expanded }

private val CompactCardHeight = 236.dp
private val CardShape = RoundedCornerShape(16.dp)

/**
 * One assembled perfect-streak ticket. This is deliberately state-free: hosts
 * own selection and sheet presentation through [onClick], which lets Outliers,
 * Props, Search, and matchup screens share the same card without hidden state.
 */
@Composable
fun ParlayGodCard(
    ticket: ParlayTicket,
    modifier: Modifier = Modifier,
    displayMode: ParlayGodCardDisplayMode = ParlayGodCardDisplayMode.Compact,
    showsMatchup: Boolean = true,
    onClick: (() -> Unit)? = null,
) {
    val compact = displayMode == ParlayGodCardDisplayMode.Compact
    val clickModifier = if (onClick == null) {
        Modifier
    } else {
        Modifier.clickable(role = Role.Button, onClick = onClick)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(if (compact) Modifier.height(CompactCardHeight) else Modifier)
            .clip(CardShape)
            .background(AppColors.appSurfaceElevated, CardShape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.35f), CardShape)
            .then(clickModifier)
            .semantics(mergeDescendants = true) {
                contentDescription = parlayTicketAccessibilityLabel(
                    ticket = ticket,
                    displayMode = displayMode,
                    showsMatchup = showsMatchup,
                )
            }
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TicketHeader(ticket, showsMatchup)

        Column(verticalArrangement = Arrangement.spacedBy(if (compact) 7.dp else 12.dp)) {
            ticket.legs.forEach { leg ->
                ParlayLegRow(leg, compact, showsMatchup)
            }
        }

        if (compact) Spacer(Modifier.weight(1f))
        TicketFooter(compact, showsMatchup)
    }
}

@Composable
private fun TicketHeader(ticket: ParlayTicket, showsMatchup: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            Modifier
                .size(22.dp)
                .clip(RoundedCornerShape(7.dp))
                .background(
                    Brush.linearGradient(listOf(AppColors.appPrimary, AppColors.appPrimaryStrong)),
                    RoundedCornerShape(7.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = ticket.category.parlayIcon(),
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(12.dp),
            )
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                ticket.category.title,
                color = AppColors.appTextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!showsMatchup) {
                Text(
                    "${ticket.legs.size} legs · same game",
                    color = AppColors.appTextMuted,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
            }
        }

        if (ticket.sports.isNotEmpty()) SportChips(ticket.sports)

        Text(
            ticket.combinedOddsText,
            color = AppColors.appPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            maxLines = 1,
            modifier = Modifier
                .clip(CircleShape)
                .background(AppColors.appPrimary.copy(alpha = 0.12f))
                .padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun SportChips(sports: List<ParlaySport>) {
    Row(horizontalArrangement = Arrangement.spacedBy((-4).dp)) {
        sports.forEach { sport ->
            Box(
                Modifier
                    .size(17.dp)
                    .clip(CircleShape)
                    .background(AppColors.appSurfaceMuted)
                    .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    sport.parlayIcon(),
                    contentDescription = sport.shortLabel,
                    tint = AppColors.appTextSecondary,
                    modifier = Modifier.size(10.dp),
                )
            }
        }
    }
}

@Composable
private fun ParlayLegRow(
    leg: ParlayLeg,
    compact: Boolean,
    showsMatchup: Boolean,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ParlayLegAvatar(leg, if (compact) 22.dp else 28.dp)

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold)) {
                        append(leg.subject)
                    }
                    append(" ")
                    withStyle(SpanStyle(color = AppColors.appTextSecondary, fontWeight = FontWeight.Medium)) {
                        append(leg.betText)
                    }
                },
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!compact) {
                Text(
                    if (showsMatchup) "${leg.evidence} · ${leg.matchupLabel}" else leg.evidence,
                    color = AppColors.appTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        Text(
            leg.oddsText,
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            maxLines = 1,
        )
        Text(
            leg.fractionText,
            color = AppColors.appWin,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            maxLines = 1,
            modifier = Modifier
                .clip(CircleShape)
                .background(AppColors.appWin.copy(alpha = 0.12f))
                .padding(horizontal = 5.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun ParlayLegAvatar(leg: ParlayLeg, diameter: Dp) {
    when {
        leg.kind == ParlayLeg.Kind.PROP && !leg.headshotUrl.isNullOrBlank() -> {
            RemoteImage(
                url = leg.headshotUrl,
                contentDescription = leg.subject,
                modifier = Modifier.size(diameter).clip(CircleShape).background(AppColors.appSurfaceMuted),
                contentScale = ContentScale.Crop,
                error = { InitialsDisc(TeamInitials.from(leg.subject), diameter) },
            )
        }

        leg.kind == ParlayLeg.Kind.PROP && leg.playerId != null -> {
            PlayerHeadshot(playerId = requireNotNull(leg.playerId), size = diameter)
        }

        leg.kind == ParlayLeg.Kind.PROP -> {
            InitialsDisc(TeamInitials.from(leg.subject), diameter)
        }

        else -> {
            val team = leg.teamAbbr ?: leg.subject
            GameCardTeamAvatar(sport = leg.sport.raw, team = team, diameter = diameter)
        }
    }
}

@Composable
private fun TicketFooter(compact: Boolean, showsMatchup: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.35f)))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            Icon(
                AppIcon.BOLT_FILL.imageVector,
                contentDescription = null,
                tint = AppColors.appWin,
                modifier = Modifier.size(11.dp),
            )
            Text(
                if (showsMatchup) {
                    "Every leg has hit 100% of its sample"
                } else {
                    "Every leg must win · tap for full evidence"
                },
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = if (compact) 1 else Int.MAX_VALUE,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (compact) {
                Icon(
                    AppIcon.CHEVRON_RIGHT.imageVector,
                    contentDescription = null,
                    tint = AppColors.appTextMuted,
                    modifier = Modifier.size(12.dp),
                )
            }
        }
        if (!compact) {
            Text(
                "Streaks are historical, not a prediction — sizes vary per leg. Bet responsibly.",
                color = AppColors.appTextMuted,
                fontSize = 10.sp,
            )
        }
    }
}

/** Loading placeholder with the exact compact-card geometry. */
@Composable
fun ParlayGodCardShimmer(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .height(CompactCardHeight)
            .clip(CardShape)
            .background(AppColors.appSurfaceElevated, CardShape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.35f), CardShape)
            .padding(12.dp)
            .shimmering(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            SkeletonBlock(width = 22.dp, height = 22.dp, cornerRadius = 7.dp)
            SkeletonBlock(width = 130.dp, height = 13.dp)
            Spacer(Modifier.weight(1f))
            SkeletonBlock(width = 46.dp, height = 18.dp, cornerRadius = 9.dp)
        }
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            repeat(5) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SkeletonCircle(22.dp)
                    SkeletonBlock(height = 11.dp, modifier = Modifier.weight(1f))
                    SkeletonBlock(width = 30.dp, height = 10.dp)
                }
            }
        }
        Spacer(Modifier.weight(1f))
        SkeletonBlock(width = 180.dp, height = 10.dp)
    }
}

internal fun parlayTicketAccessibilityLabel(
    ticket: ParlayTicket,
    displayMode: ParlayGodCardDisplayMode = ParlayGodCardDisplayMode.Compact,
    showsMatchup: Boolean = true,
): String = buildString {
    append(ticket.category.title)
    append(", ")
    append(ticket.legs.size)
    append(" legs, combined odds ")
    append(ticket.combinedOddsText)
    ticket.legs.forEachIndexed { index, leg ->
        append(". Leg ")
        append(index + 1)
        append(", ")
        append(leg.subject)
        append(" ")
        append(leg.betText)
        append(", ")
        append(leg.oddsText)
        append(", cleared ")
        append(leg.fractionText)
        if (displayMode == ParlayGodCardDisplayMode.Expanded) {
            append(", ")
            append(leg.evidence)
            if (showsMatchup && leg.matchupLabel.isNotBlank()) {
                append(", matchup ")
                append(leg.matchupLabel)
            }
        }
    }
}

private fun ParlayGodCategory.parlayIcon(): ImageVector =
    AppIcon.fromSystemName(sfSymbol)?.imageVector ?: when (this) {
        ParlayGodCategory.VERSUS_OPPONENT -> AppIcon.SHIELD_FILL.imageVector
        ParlayGodCategory.HOME_AWAY -> AppIcon.ARROW_LEFT_ARROW_RIGHT.imageVector
        ParlayGodCategory.FAV_DOG -> AppIcon.STAR_FILL.imageVector
        ParlayGodCategory.DAY_NIGHT -> AppIcon.CLOCK_FILL.imageVector
        else -> AppIcon.BOLT_FILL.imageVector
    }

private fun ParlaySport.parlayIcon(): ImageVector =
    AppIcon.fromSystemName(sfSymbol)?.imageVector ?: when (this) {
        ParlaySport.MLB -> AppIcon.BASEBALL.imageVector
        ParlaySport.NFL -> AppIcon.FOOTBALL_FILL.imageVector
    }

internal fun parlayGodPreviewTicket(): ParlayTicket = ParlayTicket(
    id = "preview-ticket",
    sports = listOf(ParlaySport.MLB, ParlaySport.NFL),
    category = ParlayGodCategory.RECENT_FORM,
    combinedOddsText = "+642",
    legs = listOf(
        ParlayLeg(
            kind = ParlayLeg.Kind.TEAM,
            sport = ParlaySport.MLB,
            category = ParlayGodCategory.RECENT_FORM,
            gameKey = "preview-1",
            matchupLabel = "ATL @ PHI",
            gameTimeEt = "7:10 PM ET",
            subject = "Phillies",
            teamAbbr = "PHI",
            playerId = null,
            betText = "ML",
            odds = -118,
            evidence = "Won 6 straight at home",
            streakN = 6,
            marketKey = "ml",
            backedTeamAbbr = "PHI",
        ),
        ParlayLeg(
            kind = ParlayLeg.Kind.PROP,
            sport = ParlaySport.MLB,
            category = ParlayGodCategory.RECENT_FORM,
            gameKey = "preview-2",
            matchupLabel = "TOR @ BOS",
            gameTimeEt = "6:40 PM ET",
            subject = "V. Guerrero Jr.",
            teamAbbr = "TOR",
            playerId = 665489,
            betText = "2+ Hits",
            odds = 135,
            evidence = "Hit in 5 straight games",
            streakN = 5,
            marketKey = "batter_hits",
        ),
        ParlayLeg(
            kind = ParlayLeg.Kind.TEAM,
            sport = ParlaySport.NFL,
            category = ParlayGodCategory.RECENT_FORM,
            gameKey = "preview-3",
            matchupLabel = "KC @ BUF",
            gameTimeEt = "8:20 PM ET",
            subject = "Bills",
            teamAbbr = "BUF",
            playerId = null,
            betText = "-2.5",
            odds = -110,
            evidence = "Covered 5 straight at home",
            streakN = 5,
            marketKey = "fg_spread",
            backedTeamAbbr = "BUF",
        ),
    ),
)

@Preview(showBackground = true, backgroundColor = 0xFF0A0A0A, widthDp = 332)
@Composable
private fun ParlayGodCardPreview() {
    Box(Modifier.background(AppColors.appSurface).padding(16.dp)) {
        ParlayGodCard(parlayGodPreviewTicket())
    }
}
