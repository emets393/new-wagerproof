package com.wagerproof.app.features.props

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.teamVisible
import com.wagerproof.app.features.outliers.OutlierTeamPalette
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.SportLeague
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Local support for the Props feature Compose port — date/time formatting,
 * date-section grouping, team-color resolution, and a handful of small shared
 * composables the iOS sources lean on (`MLBFormatting`, `GameDateGrouping`,
 * `HoneydewOptionCard`, `SportsbookLogoView`, numericText rolling) that aren't
 * ported to the shared kit yet. Kept in-feature so the Props port is
 * self-contained.
 */

private val ET: ZoneId = ZoneId.of("America/New_York")

object PropsFormatting {

    /** ISO / `h:mm a` game time → "h:mm a ET", "TBD" when unparseable. Mirrors iOS `MLBFormatting.gameTime`. */
    fun gameTime(raw: String?): String {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return "TBD"
        val instant = com.wagerproof.app.features.gamecards.GameCardFormatting.parseInstant(s) ?: return "TBD"
        val t = DateTimeFormatter.ofPattern("h:mm a", Locale.US).withZone(ET).format(instant)
        return "$t ET"
    }

    /** "yyyy-MM-dd" → "EEE, MMM d" in ET; echoes the raw when unparseable. Mirrors iOS `MLBFormatting.dateLabel`. */
    fun dateLabel(raw: String): String {
        val date = runCatching {
            LocalDate.parse(raw.take(10), DateTimeFormatter.ofPattern("yyyy-MM-dd"))
        }.getOrNull() ?: return raw
        return DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US).format(date)
    }

    /** Stable ET `yyyy-MM-dd` bucket key for a variety of date strings. Mirrors iOS `GameDateGrouping.dateKey`. */
    fun dateKey(raw: String): String {
        if (raw.isEmpty()) return raw
        com.wagerproof.app.features.gamecards.GameCardFormatting.parseInstant(raw)?.let {
            return DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US).withZone(ET).format(it)
        }
        return runCatching {
            LocalDate.parse(raw.take(10), DateTimeFormatter.ofPattern("yyyy-MM-dd")).toString()
        }.getOrDefault(raw)
    }
}

/** One date-bucketed section, chronological by key. Mirrors iOS `GameDateGrouping.Section`. */
data class PropDateSection<T>(val key: String, val label: String, val items: List<T>)

/** Bucket items into chronological date sections. Within-section order is preserved. */
fun <T> groupByDate(
    items: List<T>,
    key: (T) -> String,
    label: (T) -> String,
): List<PropDateSection<T>> {
    val buckets = LinkedHashMap<String, Pair<String, MutableList<T>>>()
    for (item in items) {
        val k = key(item)
        val bucket = buckets.getOrPut(k) { label(item) to mutableListOf() }
        bucket.second.add(item)
    }
    return buckets.keys.sorted().mapNotNull { k ->
        buckets[k]?.let { PropDateSection(k, it.first, it.second) }
    }
}

/**
 * NFL team primary/secondary colors. Android has no name-keyed `NFLTeamColors`
 * table; resolve the primary through the shared [OutlierTeamPalette] brand map
 * and derive a secondary as a darkened variant. // FIDELITY-WAIVER #240: no
 * real per-team secondary NFL color (single brand-color table on Android).
 */
fun nflTeamColors(team: String): Pair<Color, Color> {
    val primary = OutlierTeamPalette.color(team, SportLeague.NFL, OutlierTeamPalette.Slot.away)
    val secondary = Color(
        red = primary.red * 0.6f,
        green = primary.green * 0.6f,
        blue = primary.blue * 0.6f,
        alpha = 1f,
    )
    return primary to secondary
}

/** Team-tinted glass ring around a headshot — the Android stand-in for iOS `teamGlassDisc`. */
fun Modifier.teamGlassDisc(primary: Color, secondary: Color): Modifier =
    this
        .clip(CircleShape)
        .background(
            Brush.linearGradient(
                listOf(
                    primary.teamVisible(0.5f).copy(alpha = 0.55f),
                    secondary.copy(alpha = 0.35f),
                ),
            ),
        )
        .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape)

/** The lifted, translucent 26dp card surface shared by both prop feed cards. */
fun Modifier.propCardSurface(): Modifier {
    val shape = RoundedCornerShape(26.dp)
    return this
        .clip(shape)
        .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
        .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
}

/**
 * numericText-style rolling readout — swaps the previous value up/out and the
 * new value up/in whenever [value] changes. Mirrors iOS
 * `.contentTransition(.numericText())`.
 */
@Composable
fun RollingNumber(
    value: String,
    fontSize: androidx.compose.ui.unit.TextUnit,
    color: Color,
    fontWeight: FontWeight = FontWeight.Bold,
    fontFamily: FontFamily? = null,
) {
    AnimatedContent(
        targetState = value,
        transitionSpec = {
            (slideInVertically(tween(260)) { it } + fadeIn(tween(260))) togetherWith
                (slideOutVertically(tween(260)) { -it } + fadeOut(tween(260)))
        },
        label = "rollingNumber",
    ) { v ->
        Text(v, fontSize = fontSize, color = color, fontWeight = fontWeight, fontFamily = fontFamily)
    }
}

/**
 * Tool-banner card. Android stand-in for iOS `HoneydewOptionCard` — a gradient
 * card with a title/subtitle, an action word + chevron, and faint decorative
 * symbols. // FIDELITY-WAIVER #241: no drifting-symbol animation (static glyphs).
 */
@Composable
fun PropHoneydewBanner(
    title: String,
    subtitle: String,
    actionWord: String,
    primary: Color,
    secondary: Color,
    symbols: List<String>,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Brush.linearGradient(listOf(primary.copy(alpha = 0.9f), secondary.copy(alpha = 0.85f))))
            .clickable { onTap() }
            .padding(16.dp),
    ) {
        // Faint scattered glyphs behind the copy (decorative, static).
        Row(Modifier.fillMaxWidth(), horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceEvenly) {
            symbols.take(6).forEach { sym ->
                Icon(
                    AppIcon.fromSystemName(sym)?.imageVector ?: AppIcon.SPARKLES.imageVector,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.10f),
                    modifier = Modifier.size(26.dp),
                )
            }
        }
        Column {
            Text(title, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.size(4.dp))
            Text(subtitle, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.size(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(actionWord.uppercase(), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.width(4.dp))
                Icon(
                    AppIcon.CHEVRON_RIGHT.imageVector,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(12.dp),
                )
            }
        }
    }
}

/** Compact sportsbook logo with an initials fallback. Android stand-in for `SportsbookLogoView`. */
@Composable
fun SportsbookLogo(
    logoUrl: String?,
    bookKey: String?,
    bookName: String?,
    size: androidx.compose.ui.unit.Dp = 16.dp,
) {
    val initials = (bookName ?: bookKey ?: "?").take(2).uppercase(Locale.US)
    Box(
        Modifier.size(size).clip(CircleShape).background(AppColors.appSurfaceMuted),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = logoUrl,
            contentDescription = bookName,
            modifier = Modifier.fillMaxSize(),
            error = {
                Text(
                    initials,
                    color = AppColors.appTextSecondary,
                    fontSize = (size.value * 0.42f).sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
            },
        )
    }
}
