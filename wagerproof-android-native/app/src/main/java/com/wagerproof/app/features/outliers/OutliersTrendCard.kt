package com.wagerproof.app.features.outliers

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.OutliersTrendsBettingLine
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import com.wagerproof.core.models.SportLeague

/**
 * THE Outliers trend card. Two modes: [OutliersTrendCardMode.Compact] (carousel,
 * fixed 240dp height, first 3 trend rows + "+N more" footer) and
 * [OutliersTrendCardMode.Expanded] (detail sheet, all rows wrap, no footer/cap).
 * Port of iOS `Components/OutliersTrendCard.swift`.
 *
 * // FIDELITY-WAIVER #232: iOS `GameCardTeamAvatar` / `NFLPlayerHeadshot` aren't
 * // ported — team/coach avatars use the shared [OutlierGlassTeamAvatar]; player
 * // headshots use RemoteImage + [InitialsDisc]; referee uses the NFL shield disc.
 */
enum class OutliersTrendCardMode { Compact, Expanded }

private const val COMPACT_ROW_CAP = 3
private const val FOOTER_PREVIEW_CAP = 3
private val COMPACT_CARD_HEIGHT = 240.dp

/** iOS trends sport → the palette/asset [SportLeague] (`ncaaf` → CFB). */
internal fun OutliersTrendsSport.league(): SportLeague = when (this) {
    OutliersTrendsSport.NFL -> SportLeague.NFL
    OutliersTrendsSport.NCAAF -> SportLeague.CFB
    OutliersTrendsSport.MLB -> SportLeague.MLB
    OutliersTrendsSport.NBA -> SportLeague.NBA
    OutliersTrendsSport.NCAAB -> SportLeague.NCAAB
}

@Composable
fun OutliersTrendCard(
    card: OutliersTrendsCard,
    sport: OutliersTrendsSport = OutliersTrendsSport.NFL,
    game: OutliersTrendsGame? = null,
    displayMode: OutliersTrendCardMode = OutliersTrendCardMode.Compact,
    modifier: Modifier = Modifier,
    onExpandPlayers: (() -> Unit)? = null,
) {
    if (card.isPlayerOverflow) {
        OverflowContent(card, modifier, onExpandPlayers)
    } else {
        CardContent(card, sport, game, displayMode, modifier)
    }
}

@Composable
private fun CardContent(
    card: OutliersTrendsCard,
    sport: OutliersTrendsSport,
    game: OutliersTrendsGame?,
    displayMode: OutliersTrendCardMode,
    modifier: Modifier,
) {
    val isCompact = displayMode == OutliersTrendCardMode.Compact
    val visibleRows = if (isCompact) card.rows.take(COMPACT_ROW_CAP) else card.rows
    val shape = RoundedCornerShape(16.dp)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(if (isCompact) Modifier.height(COMPACT_CARD_HEIGHT) else Modifier)
            .clip(shape)
            .background(AppColors.appSurfaceElevated, shape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.35f), shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        // Header + right-aligned schedule label.
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Header(card, sport, game, isCompact, Modifier.weight(1f))
            GameScheduleLabel(game)
        }

        if (card.bettingLines.isNotEmpty()) {
            BettingLinesBlock(card)
        } else if (card.lineContext != null) {
            Text(
                text = card.lineContext!!,
                color = AppColors.appPrimary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            visibleRows.forEach { TrendRow(it, isCompact) }
        }

        if (isCompact) {
            Spacer(Modifier.weight(1f))
            CompactFooter(card)
        }
    }
}

// MARK: - Header

@Composable
private fun Header(
    card: OutliersTrendsCard,
    sport: OutliersTrendsSport,
    game: OutliersTrendsGame?,
    isCompact: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
        SubjectAvatar(card, sport)
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                text = "${card.subjectName} — ${card.betTypeLabel}",
                color = AppColors.appTextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                maxLines = if (isCompact) 1 else Int.MAX_VALUE,
                overflow = TextOverflow.Ellipsis,
            )
            displaySubjectDetail(card)?.let { detail ->
                Text(detail, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
            Text(
                text = displayMatchupLabel(card, sport, game),
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun GameScheduleLabel(game: OutliersTrendsGame?) {
    val kickoff = game?.kickoff
    if (kickoff.isNullOrEmpty()) return
    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(
            GameCardFormatting.formatCompactDate(kickoff),
            color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.End,
        )
        Text(
            GameCardFormatting.convertTimeToEST(kickoff),
            color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun SubjectAvatar(card: OutliersTrendsCard, sport: OutliersTrendsSport) {
    when (card.subjectKind) {
        OutliersTrendsSubjectKind.TEAM, OutliersTrendsSubjectKind.COACH -> {
            val team = card.teamAbbr
            if (team != null) {
                OutlierGlassTeamAvatar(
                    logoUrl = teamLogoUrl(team, sport),
                    initials = TeamInitials.from(team),
                    primary = OutlierTeamPalette.color(team, sport.league(), OutlierTeamPalette.Slot.away),
                    size = 36.dp,
                )
            } else {
                SubjectIcon(if (card.subjectKind == OutliersTrendsSubjectKind.TEAM) "sportscourt.fill" else "person.fill")
            }
        }
        OutliersTrendsSubjectKind.REFEREE -> RefereeShieldAvatar()
        OutliersTrendsSubjectKind.PLAYER -> {
            val url = card.headshotUrl
            if (!url.isNullOrEmpty()) {
                RemoteImage(
                    url = url,
                    contentDescription = card.subjectName,
                    modifier = Modifier.size(40.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop,
                    error = { InitialsDisc(TeamInitials.from(card.subjectName), 40.dp) },
                )
            } else {
                InitialsDisc(TeamInitials.from(card.subjectName), 36.dp)
            }
        }
    }
}

private fun teamLogoUrl(team: String, sport: OutliersTrendsSport): String? = when (sport) {
    OutliersTrendsSport.NCAAF -> CFBTeamAssets.logo(team)
    OutliersTrendsSport.MLB -> MLBTeams.logoUrl(team)
    else -> NFLTeamAssets.logo(team)
}

@Composable
private fun RefereeShieldAvatar() {
    Box(
        Modifier.size(40.dp).clip(CircleShape).background(AppColors.appPrimary.copy(alpha = 0.12f)),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
            contentDescription = null,
            modifier = Modifier.size(28.dp),
            contentScale = ContentScale.Fit,
            error = {
                Icon(
                    outlierSymbol("shield.fill", AppIcon.SHIELD_FILL.imageVector),
                    contentDescription = null,
                    tint = AppColors.appPrimary,
                    modifier = Modifier.size(18.dp),
                )
            },
        )
    }
}

@Composable
private fun SubjectIcon(name: String) {
    Box(
        Modifier.size(40.dp).clip(CircleShape).background(AppColors.appPrimary.copy(alpha = 0.12f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            outlierSymbol(name),
            contentDescription = null,
            tint = AppColors.appPrimary,
            modifier = Modifier.size(16.dp),
        )
    }
}

// MARK: - Betting lines

@Composable
private fun BettingLinesBlock(card: OutliersTrendsCard) {
    if (card.bettingLines.size >= 2) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
            card.bettingLines.forEach { line ->
                BettingLineChip(card, line, showBookName = false, modifier = Modifier.weight(1f))
            }
        }
    } else {
        card.bettingLines.forEach { line ->
            BettingLineChip(card, line, showBookName = card.bettingLines.size < 2)
        }
    }
}

@Composable
private fun BettingLineChip(
    card: OutliersTrendsCard,
    line: OutliersTrendsBettingLine,
    showBookName: Boolean,
    modifier: Modifier = Modifier,
) {
    val isPair = card.bettingLines.size >= 2
    Row(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.35f))
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (isPair) SportsbookTrailingBlock(line, showBookName = false)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                overUnderChipLabel(card, line),
                color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                teamPrefix(card, line)?.let {
                    Text(it, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
                Text(
                    displayLineText(card, line),
                    color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                line.oddsText?.let {
                    Text(it, color = AppColors.appPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        if (!isPair) SportsbookTrailingBlock(line, showBookName = showBookName)
    }
}

@Composable
private fun SportsbookTrailingBlock(line: OutliersTrendsBettingLine, showBookName: Boolean) {
    if (line.bookName == null && line.bookLogoUrl == null) return
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        if (showBookName) {
            Text("@", color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        // FIDELITY-WAIVER #231: SportsbookLogoView not ported, using RemoteImage.
        RemoteImage(
            url = line.bookLogoUrl,
            contentDescription = line.bookName,
            modifier = Modifier.size(16.dp),
            contentScale = ContentScale.Fit,
        )
        if (showBookName && line.bookName != null) {
            Text(
                line.bookName!!,
                color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

// MARK: - Trend rows

@Composable
private fun TrendRow(row: OutliersTrendsCardRow, isCompact: Boolean) {
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.Top) {
        Box(Modifier.width(14.dp), contentAlignment = Alignment.Center) {
            Icon(
                outlierSymbol(rowIcon(row.text)),
                contentDescription = null,
                tint = trendColor(row.dominantPct),
                modifier = Modifier.size(12.dp),
            )
        }
        Text(
            rowDisplayText(row),
            color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium,
            maxLines = if (isCompact) 1 else Int.MAX_VALUE, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            pctText(row),
            color = trendColor(row.dominantPct), fontSize = 12.sp, fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Default,
        )
    }
}

// MARK: - Footer

@Composable
private fun CompactFooter(card: OutliersTrendsCard) {
    val hidden = card.rows.drop(COMPACT_ROW_CAP)
    val preview = hidden.take(FOOTER_PREVIEW_CAP)
    val overflow = maxOf(0, hidden.size - FOOTER_PREVIEW_CAP)

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.25f)))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            if (preview.isNotEmpty()) {
                Icon(
                    outlierSymbol("plus.circle.fill", AppIcon.PLUS_CIRCLE_FILL.imageVector),
                    contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(12.dp),
                )
                preview.forEach { PctPreviewChip(it) }
                if (overflow > 0) {
                    Text("+$overflow", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.weight(1f))
                FooterCta("More")
            } else {
                Spacer(Modifier.weight(1f))
                FooterCta("View breakdown")
            }
        }
    }
}

@Composable
private fun PctPreviewChip(row: OutliersTrendsCardRow) {
    val tint = trendColor(row.dominantPct)
    Row(
        Modifier
            .clip(CircleShape)
            .background(tint.copy(alpha = 0.14f))
            .padding(horizontal = 6.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(outlierSymbol(rowIcon(row.text)), contentDescription = null, tint = tint, modifier = Modifier.size(9.dp))
        Text(pctText(row), color = tint, fontSize = 10.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun FooterCta(label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = AppColors.appPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Icon(
            outlierSymbol("chevron.right", AppIcon.CHEVRON_RIGHT.imageVector),
            contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(9.dp),
        )
    }
}

// MARK: - Player overflow variant

@Composable
private fun OverflowContent(card: OutliersTrendsCard, modifier: Modifier, onExpandPlayers: (() -> Unit)?) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appPrimary.copy(alpha = 0.08f), shape)
            .border(1.dp, AppColors.appPrimary.copy(alpha = 0.25f), shape)
            .clickable(enabled = onExpandPlayers != null) { onExpandPlayers?.invoke() }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            outlierSymbol("person.3.fill", AppIcon.PERSON_3_FILL.imageVector),
            contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(18.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(card.subjectName, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            card.subjectDetail?.let {
                Text(it, color = AppColors.appTextSecondary, fontSize = 12.sp)
            }
        }
        Icon(
            outlierSymbol("chevron.right", AppIcon.CHEVRON_RIGHT.imageVector),
            contentDescription = null, tint = AppColors.appTextMuted, modifier = Modifier.size(12.dp),
        )
    }
}

// MARK: - Pure helpers (ported verbatim)

private fun pctText(row: OutliersTrendsCardRow): String = "${Math.round(row.dominantPct * 100)}%"

private fun trendColor(pct: Double): Color = when {
    pct > 0.75 -> AppColors.appWin
    pct >= 0.60 -> AppColors.appAccentAmber
    else -> AppColors.appTextSecondary
}

private val trailingPctRegex = Regex(" \\(\\d{1,3}%\\)$")

private fun rowDisplayText(row: OutliersTrendsCardRow): String =
    trailingPctRegex.find(row.text)?.let { row.text.substring(0, it.range.first) } ?: row.text

private fun isOverUnderMarket(marketKey: String): Boolean =
    marketKey in setOf("total", "h1_total", "team_total", "ou", "f5_ou")

private fun overUnderChipLabel(card: OutliersTrendsCard, line: OutliersTrendsBettingLine): String {
    if (!isOverUnderMarket(card.marketKey)) return line.label.uppercase()
    val lower = line.label.lowercase()
    return when {
        lower.contains("over") -> "OVER"
        lower.contains("under") -> "UNDER"
        else -> line.label.uppercase()
    }
}

private val leadingTeamOverUnderRegex = Regex("^[A-Za-z]{2,4}\\s+(?=Over|Under)", RegexOption.IGNORE_CASE)

private fun displayLineText(card: OutliersTrendsCard, line: OutliersTrendsBettingLine): String {
    val text = line.lineText.trim()
    if (!isOverUnderMarket(card.marketKey)) return text
    return leadingTeamOverUnderRegex.replaceFirst(text, "")
}

/** Coach/referee spread/ML lines need a team tag so the side is obvious. */
private fun teamPrefix(card: OutliersTrendsCard, line: OutliersTrendsBettingLine): String? {
    if (isOverUnderMarket(card.marketKey)) return null
    if (card.subjectKind != OutliersTrendsSubjectKind.COACH && card.subjectKind != OutliersTrendsSubjectKind.REFEREE) return null
    val abbr = (line.teamAbbr ?: card.teamAbbr) ?: return null
    val upper = abbr.uppercase()
    val lineUpper = line.lineText.uppercase()
    if (lineUpper.startsWith(upper) || lineUpper.contains(" $upper ") || lineUpper.contains("$upper ML")) return null
    return upper
}

private fun displaySubjectDetail(card: OutliersTrendsCard): String? {
    val detail = card.subjectDetail ?: return null
    if (detail.contains("career games", ignoreCase = true)) return null
    if (card.subjectKind == OutliersTrendsSubjectKind.TEAM) return null
    if (card.subjectKind == OutliersTrendsSubjectKind.COACH) {
        val abbr = card.teamAbbr?.uppercase()
        if (abbr != null && (detail.uppercase() == abbr || detail.uppercase().startsWith("$abbr ·"))) return null
    }
    return detail
}

private fun displayMatchupLabel(card: OutliersTrendsCard, sport: OutliersTrendsSport, game: OutliersTrendsGame?): String {
    if (game != null) {
        return when (sport) {
            OutliersTrendsSport.NCAAF ->
                "${CFBTeamAssets.displayName(game.awayTeam)} @ ${CFBTeamAssets.displayName(game.homeTeam)}"
            OutliersTrendsSport.MLB -> "${game.awayAb} @ ${game.homeAb}"
            else -> "${NFLTeamAssets.nickname(game.awayTeam)} @ ${NFLTeamAssets.nickname(game.homeTeam)}"
        }
    }
    val parts = card.matchupLabel.split("@", limit = 2).map { it.trim() }
    if (parts.size != 2) return card.matchupLabel
    return "${NFLTeamAssets.nickname(parts[0])} @ ${NFLTeamAssets.nickname(parts[1])}"
}

/**
 * Maps a trend row to an SF Symbol keyed on its *dimension* — the trailing
 * context phrase (road games, as an underdog, non-division, vs OPP, …). Ported
 * verbatim from iOS; result feeds through [outlierSymbol].
 */
internal fun rowIcon(text: String): String {
    val dimension = trendDimension(text)
    if (dimension.isEmpty()) return "circle.fill"
    return when {
        dimension.startsWith("non-division") -> "globe.americas.fill"
        dimension.startsWith("non-primetime") -> "sun.max.fill"
        dimension.contains("road") || dimension == "away" || dimension.startsWith("away ") -> "airplane"
        dimension.contains("home") -> "house.fill"
        dimension.contains("underdog") -> "pawprint.fill"
        dimension.contains("favorite") || dimension.contains("favourite") -> "star.fill"
        dimension.contains("division") -> "person.2.fill"
        dimension.contains("primetime") || dimension.contains("night") -> "moon.stars.fill"
        dimension.contains("day game") -> "sun.max.fill"
        dimension.startsWith("vs") -> "person.line.dotted.person.fill"
        dimension.contains("series g1") -> "1.circle.fill"
        dimension.contains("series g2") -> "2.circle.fill"
        dimension.contains("series g3") -> "3.circle.fill"
        dimension.contains("series g4") -> "4.circle.fill"
        dimension.endsWith("games") || dimension == "games" -> "sportscourt.fill"
        else -> "circle.fill"
    }
}

private fun trendDimension(text: String): String {
    val lower = text.lowercase()
    val idx = lower.indexOf(" of last ")
    if (idx < 0) return ""
    var context = lower.substring(idx + " of last ".length).trim()
    val paren = context.lastIndexOf('(')
    if (paren >= 0) context = context.substring(0, paren).trim()
    // Drop the leading sample-count token ("10 road games" -> "road games").
    val parts = context.split(" ", limit = 2)
    val first = parts.firstOrNull()
    if (first != null && first.isNotEmpty() && first.all { it.isDigit() }) {
        context = if (parts.size > 1) parts[1] else ""
    }
    return context.trim()
}
