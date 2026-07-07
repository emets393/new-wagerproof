package com.wagerproof.app.features.agents

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AcUnit
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.PauseCircle
import androidx.compose.material.icons.filled.PersonAddAlt1
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material.icons.rounded.Bedtime
import androidx.compose.material.icons.rounded.Circle
import androidx.compose.material.icons.rounded.Dangerous
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.WbSunny
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.AgentStrategyKind
import com.wagerproof.core.models.AgentStrategyTag

/**
 * SF-symbol name → Compose [ImageVector]. Agents Swift code refers to icons by
 * SF Symbol name everywhere; this resolves through the shared [AppIcon] map
 * first (~180 symbols) and fills the handful of agents-only symbols AppIcon
 * lacks. Unknown names fall back to a filled circle so nothing crashes.
 */
fun agentSymbol(systemName: String): ImageVector {
    AppIcon.fromSystemName(systemName)?.let { return it.imageVector }
    return when (systemName) {
        "snowflake" -> Icons.Filled.AcUnit
        "globe", "globe.americas", "globe.americas.fill" -> Icons.Filled.Language
        "play.circle.fill", "play.circle" -> Icons.Filled.PlayCircle
        "pause.circle.fill" -> Icons.Filled.PauseCircle
        "hand.raised", "hand.raised.fill" -> Icons.Filled.PanTool
        "person.crop.circle.badge.plus" -> Icons.Filled.PersonAddAlt1
        "circle.hexagongrid.fill" -> Icons.Rounded.GridView
        "moon.zzz", "moon.zzz.fill", "moon", "moon.fill" -> Icons.Rounded.Bedtime
        "sun.max", "sun.max.fill" -> Icons.Rounded.WbSunny
        "calendar" -> Icons.Filled.CalendarToday
        "star", "star.circle" -> Icons.Filled.StarBorder
        "star.fill" -> Icons.Filled.Star
        "star.slash", "star.slash.fill" -> Icons.Filled.StarBorder
        "xmark.octagon", "xmark.octagon.fill" -> Icons.Rounded.Dangerous
        else -> Icons.Rounded.Circle
    }
}

/** Sport → tab/pill icon (SF-symbol names carried on [AgentSport.sfSymbol]). */
fun AgentSport.iconVector(): ImageVector = agentSymbol(sfSymbol)

// ---------------------------------------------------------------------------
// Pick / parlay result-state coloring (AgentPick.ticketStatus in iOS).
// ---------------------------------------------------------------------------

/** Uppercase status label shown on the ticket badge. */
val AgentPick.PickResultStatus.ticketLabel: String
    get() = when (this) {
        AgentPick.PickResultStatus.WON -> "WIN"
        AgentPick.PickResultStatus.LOST -> "LOSS"
        AgentPick.PickResultStatus.PUSH -> "PUSH"
        AgentPick.PickResultStatus.PENDING -> "PENDING"
    }

/** Status color: won→win green, lost→loss red, push→pending amber, pending→muted text. */
val AgentPick.PickResultStatus.ticketColor: Color
    get() = when (this) {
        AgentPick.PickResultStatus.WON -> AppColors.appWin
        AgentPick.PickResultStatus.LOST -> AppColors.appLoss
        AgentPick.PickResultStatus.PUSH -> AppColors.appPending
        AgentPick.PickResultStatus.PENDING -> AppColors.appTextSecondary
    }

// ---------------------------------------------------------------------------
// Strategy-tag chip coloring — shared by AgentRowCard, feed cards, hero pills.
// (iOS tagColor: archetype→primary, risk 1-2→win / 4-5→orange, betType→blue,
//  lean→secondary, value→win, fade→purple.)
// ---------------------------------------------------------------------------

private val strategyOrange = Color(0xFFF97316)
private val strategyPurple = Color(0xFF8B5CF6)

val AgentStrategyTag.color: Color
    get() = when (kind) {
        AgentStrategyKind.ARCHETYPE -> AppColors.appPrimary
        AgentStrategyKind.RISK -> when (level) {
            1, 2 -> AppColors.appWin
            4, 5 -> strategyOrange
            else -> AppColors.appTextSecondary
        }
        AgentStrategyKind.BET_TYPE -> AppColors.appAccentBlue
        AgentStrategyKind.LEAN -> AppColors.appTextSecondary
        AgentStrategyKind.VALUE -> AppColors.appWin
        AgentStrategyKind.FADE -> strategyPurple
    }

/**
 * Inline section header used across both detail screens + timeline (iOS
 * `AgentSectionHeader`): 11pt-bold SF icon + uppercased 13pt semibold title,
 * secondary color, flush-left (no internal h-padding).
 */
@Composable
fun AgentSectionHeader(
    title: String,
    systemImage: String,
    modifier: Modifier = Modifier,
    tint: Color = AppColors.appTextSecondary,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = agentSymbol(systemImage),
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(13.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = title.uppercase(),
            color = tint,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * Inline pixel-art emoji (iOS `PixelEmojiInline`): emoji Text with a subtle
 * drop shadow. Compose renders color emoji natively; the shadow is decorative.
 */
@Composable
fun PixelEmojiInline(emoji: String, size: androidx.compose.ui.unit.TextUnit = 16.sp) {
    Text(text = emoji, fontSize = size)
}

/**
 * Ticket geometry contract — LOAD-BEARING. Folder peek offsets, rolodex spacing
 * and wallet physics all assume these exact values (part3 doc §Shared geometry).
 * Keep in sync with the shapes in AgentPickTicket.kt.
 */
object AgentTicketGeometry {
    // Compact list ticket
    val PICK_HEIGHT = 250.dp
    val PICK_NOTCH_Y = 150.dp

    // Mini fixed ticket (also used by parlay mini)
    val MINI_WIDTH = 178.dp
    val MINI_HEIGHT = 240.dp
    val MINI_NOTCH_Y = 116.dp

    // Parlay ticket rows
    val PARLAY_HEADER_HEIGHT = 52.dp
    val PARLAY_LEG_ROW_HEIGHT = 44.dp
    val PARLAY_STUB_HEIGHT = 100.dp

    // Ticket cardstock corner + notch radii
    val CARD_CORNER = 22.dp
    val CARD_NOTCH_RADIUS = 9.dp
    val MINI_CORNER = 18.dp
    val MINI_NOTCH_RADIUS = 7.dp

    /** Section-to-section gap on both detail screens (wider than the 12dp card gap). */
    val SECTION_GAP = 28.dp

    /** Collapsing hero heights. */
    val HERO_MAX = 196.dp
    val HERO_MIN = 60.dp
}
