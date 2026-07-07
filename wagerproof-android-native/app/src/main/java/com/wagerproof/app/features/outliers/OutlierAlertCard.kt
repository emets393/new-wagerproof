package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.OutlierFadeAlert
import com.wagerproof.core.models.OutlierGame
import com.wagerproof.core.models.OutlierValueAlert
import com.wagerproof.core.models.SportLeague
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Which alert a [OutlierAlertCard] renders. Port of the iOS `OutlierAlertCard.Kind`
 * sealed enum (`.value` / `.fade`).
 */
sealed interface OutlierAlertKind {
    data class Value(val alert: OutlierValueAlert) : OutlierAlertKind
    data class Fade(val alert: OutlierFadeAlert) : OutlierAlertKind
}

/**
 * Full-width Value/Fade alert card used inside [OutliersDetailView]. Port of iOS
 * `Components/OutlierAlertCard.swift`.
 *
 * Header pills row (sport / time / market / accent) + lines row; matchup row
 * (avatars + abbrevs); descriptive body; the fade variant adds a "Consider the
 * Fade" inset box + reason line. Whole card is one tap target.
 */
@Composable
fun OutlierAlertCard(
    kind: OutlierAlertKind,
    onTap: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val accent = accentColor(kind)
    val shape = RoundedCornerShape(14.dp)
    val game = gameOf(kind)

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(accent.copy(alpha = 0.1f))
            .border(1.dp, accent.copy(alpha = 0.3f), shape)
            .clickable(onClick = onTap)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        HeaderPills(kind, game, accent)
        MatchupRow(game)
        BodyText(kind)
        if (kind is OutlierAlertKind.Fade) {
            FadeBox(kind.alert)
            FadeReason(kind.alert)
        }
    }
}

// MARK: Header

@Composable
private fun HeaderPills(kind: OutlierAlertKind, game: OutlierGame, accent: Color) {
    val sport = sportOf(kind)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SportPill(sport)
            formatGameTime(game.gameTime)?.let { TimePill(it) }
            MarketPill(marketLabel(kind), accent)
            AccentPill(kind, accent)
        }
        LinesRow(game)
    }
}

@Composable
private fun SportPill(sport: SportLeague) {
    val color = sportColor(sport)
    Row(
        Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(outlierSymbol(sportSymbol(sport)), null, tint = color, modifier = Modifier.size(11.dp))
        Text(sport.raw.uppercase(), color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun TimePill(text: String) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(outlierSymbol("clock"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(10.dp))
        Text(text, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun MarketPill(label: String, accent: Color) {
    Text(
        label,
        color = accent,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .clip(CircleShape)
            .background(accent.copy(alpha = 0.2f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
private fun AccentPill(kind: OutlierAlertKind, accent: Color) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(accent)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            outlierSymbol(if (kind is OutlierAlertKind.Value) "percent" else "bolt.fill"),
            null,
            tint = Color.White,
            modifier = Modifier.size(10.dp),
        )
        val text = when (kind) {
            is OutlierAlertKind.Value -> "${kind.alert.percentage.toInt()}%"
            is OutlierAlertKind.Fade -> "FADE"
        }
        Text(text, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LinesRow(game: OutlierGame) {
    val pills = buildList {
        game.homeSpread?.let { add("Spread" to formatSpread(it)) }
        game.totalLine?.let { add("O/U" to trimNumber(it)) }
        if (game.awayMl != null || game.homeMl != null) {
            val aml = game.awayMl?.let { formatMoneyline(it) } ?: "-"
            val hml = game.homeMl?.let { formatMoneyline(it) } ?: "-"
            add("ML" to "$aml/$hml")
        }
    }
    if (pills.isEmpty()) return
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        pills.forEach { (label, value) ->
            Text(
                "$label: $value",
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(AppColors.appSurfaceMuted)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
    }
}

// MARK: Body

@Composable
private fun MatchupRow(game: OutlierGame) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TeamCell(game.awayTeam, game.awayTeamLogo, game.awayTeamAbbrev)
        Text("@", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        TeamCell(game.homeTeam, game.homeTeamLogo, game.homeTeamAbbrev)
    }
}

@Composable
private fun TeamCell(name: String, logo: String?, abbrev: String?) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(AppColors.appSurfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            RemoteImage(
                url = logo,
                contentDescription = null,
                modifier = Modifier.fillMaxSize().padding(2.dp),
                contentScale = ContentScale.Fit,
                error = {
                    Text(
                        abbrev ?: OutlierTeamPalette.initials(name),
                        color = AppColors.appTextPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                },
            )
        }
        Text(
            abbrev ?: OutlierTeamPalette.initials(name),
            color = AppColors.appTextPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun BodyText(kind: OutlierAlertKind) {
    when (kind) {
        is OutlierAlertKind.Value -> {
            val a = kind.alert
            val tail = if (a.marketType == OutlierValueAlert.MarketType.MONEYLINE) {
                " - Strong ${a.percentage.toInt()}% consensus"
            } else {
                " - ${a.percentage.toInt()}% suggests line hasn't adjusted"
            }
            InlineBoldLead(a.side, tail)
        }
        is OutlierAlertKind.Fade -> {
            val a = kind.alert
            val unit = if (a.sport == SportLeague.NFL) "%" else "pt"
            InlineBoldLead(a.predictedTeam, " — Model confidence ${a.confidence}$unit on ${a.pickType.raw}")
        }
    }
}

/**
 * Body line: bold primary-color lead word(s) followed by secondary tail. Mirrors
 * iOS's concatenated `Text` — a single wrapping paragraph via AnnotatedString.
 */
@Composable
private fun InlineBoldLead(lead: String, tail: String) {
    val text = buildAnnotatedString {
        withStyle(SpanStyle(color = AppColors.appTextPrimary, fontWeight = FontWeight.Bold)) { append(lead) }
        withStyle(SpanStyle(color = AppColors.appTextSecondary)) { append(tail) }
    }
    Text(text, fontSize = 13.sp)
}

@Composable
private fun FadeBox(alert: OutlierFadeAlert) {
    val green = hexColor(0x22C55E)
    val (fadePick, fadeSpread) = computeFadePick(alert)
    val shape = RoundedCornerShape(10.dp)
    Column(
        Modifier
            .clip(shape)
            .background(green.copy(alpha = 0.1f))
            .border(1.dp, green.copy(alpha = 0.3f), shape)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(outlierSymbol("arrow.left.arrow.right"), null, tint = green, modifier = Modifier.size(12.dp))
            Text("Consider the Fade", color = green, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        Row {
            Text("Bet ", color = AppColors.appTextSecondary, fontSize = 13.sp)
            Text("$fadePick $fadeSpread", color = green, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun FadeReason(alert: OutlierFadeAlert) {
    val unit = if (alert.sport == SportLeague.NFL) "%" else "pt edge"
    Text(
        "Model shows ${alert.confidence}$unit on ${alert.predictedTeam} — historically profitable to fade",
        color = AppColors.appTextSecondary,
        fontSize = 12.sp,
        textAlign = TextAlign.Start,
    )
}

// MARK: Derived

private fun gameOf(kind: OutlierAlertKind): OutlierGame = when (kind) {
    is OutlierAlertKind.Value -> kind.alert.game
    is OutlierAlertKind.Fade -> kind.alert.game
}

private fun sportOf(kind: OutlierAlertKind): SportLeague = when (kind) {
    is OutlierAlertKind.Value -> kind.alert.sport
    is OutlierAlertKind.Fade -> kind.alert.sport
}

private fun sportSymbol(sport: SportLeague): String = when (sport) {
    SportLeague.NFL -> "football.fill"
    SportLeague.CFB -> "graduationcap.fill"
    SportLeague.NBA -> "basketball.fill"
    SportLeague.NCAAB -> "basketball.fill"
    SportLeague.MLB -> "baseball.fill"
}

private fun sportColor(sport: SportLeague): Color = when (sport) {
    SportLeague.NFL -> hexColor(0x013369)
    SportLeague.CFB -> hexColor(0xC8102E)
    SportLeague.NBA -> hexColor(0x1D428A)
    SportLeague.NCAAB -> hexColor(0xF58426)
    SportLeague.MLB -> hexColor(0x002D72)
}

private fun marketLabel(kind: OutlierAlertKind): String = when (kind) {
    is OutlierAlertKind.Value -> kind.alert.marketType.raw
    is OutlierAlertKind.Fade -> kind.alert.pickType.raw
}

private fun accentColor(kind: OutlierAlertKind): Color = when (kind) {
    is OutlierAlertKind.Value -> hexColor(0x22C55E)
    is OutlierAlertKind.Fade -> hexColor(0xF59E0B)
}

/** ISO gameTime → "EEE h:mm a" in the device time zone. Mirrors iOS's DateFormatter. */
private fun formatGameTime(raw: String?): String? {
    if (raw == null) return null
    val instant = runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
        ?: runCatching { Instant.parse(raw) }.getOrNull()
        ?: return null
    return DateTimeFormatter.ofPattern("EEE h:mm a", Locale.US)
        .withZone(ZoneId.systemDefault())
        .format(instant)
}

// Local formatters preserving iOS's exact strings (ASCII "-", "%g"-style trim) —
// NOT GameCardFormatting, which uses the Unicode minus / em-dash.
private fun formatSpread(s: Double): String =
    if (s > 0) "+${trimNumber(s)}" else trimNumber(s)

private fun formatMoneyline(m: Int): String = if (m > 0) "+$m" else "$m"

/** Swift `String(format: "%g", value)` — drop trailing ".0" but keep halves. */
private fun trimNumber(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString()
    else value.toString()

private fun computeFadePick(alert: OutlierFadeAlert): Pair<String, String> =
    when (alert.pickType) {
        OutlierFadeAlert.PickType.SPREAD -> {
            val isModelOnHome = alert.predictedTeam == alert.homeTeam
            val fadeTeam = if (isModelOnHome) alert.awayTeam else alert.homeTeam
            val fadeSpread = if (isModelOnHome) alert.game.awaySpread else alert.game.homeSpread
            fadeTeam to (fadeSpread?.let { formatSpread(it) } ?: "")
        }
        OutlierFadeAlert.PickType.TOTAL -> {
            val pick = if (alert.predictedTeam == "Over") "Under" else "Over"
            val total = alert.game.totalLine?.let { trimNumber(it) } ?: ""
            pick to total
        }
    }
