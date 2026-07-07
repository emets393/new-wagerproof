package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.agents.iconVector
import com.wagerproof.app.features.agents.ticketColor
import com.wagerproof.app.features.agents.ticketLabel
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.MLBTeams
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// =====================================================================
// AgentPickTicket — an agent pick rendered as a boarding-pass "ticket".
// Port of iOS AgentPickTicket.swift. Two sizes share the same cardstock +
// perforation geometry: AgentPickTicket (compact list) and
// ExpandedAgentPickTicket (full pass shown when tapped). All shared ticket
// plumbing (route row, team avatar, stamps, formatting, shapes) lives here.
// =====================================================================

// MARK: - Compact stack ticket

/**
 * The compact boarding-pass ticket for a single pick. Geometry is FIXED so the
 * perforation notches always land on the tear line.
 */
@Composable
fun AgentPickTicket(
    pick: AgentPick,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
    teaserBlur: Boolean = false,
) {
    val notchY = 150.dp
    val height = 250.dp
    val shape = pickTicketShape(notchY = notchY)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    listOf(AppColors.ticketCardstockTop, AppColors.ticketCardstockBottom),
                ),
            )
            // Hairline rim (plain rounded rect, notch edges left unstroked — iOS
            // strokes a RoundedRectangle, not the notched shape).
            .border(1.dp, Color.White.copy(alpha = 0.07f), RoundedCornerShape(22.dp)),
    ) {
        Column(Modifier.fillMaxSize()) {
            PickTicketTopSection(
                pick = pick,
                codeSize = 32.dp,
                dateFontSize = 15.sp,
                namesFontSize = 12.sp,
                teaserBlurBetType = teaserBlur,
                modifier = Modifier.fillMaxWidth().height(notchY),
            )
            PickTicketBottomStub(
                pick = pick,
                accent = accent,
                teaserBlur = teaserBlur,
                modifier = Modifier.fillMaxWidth().height(height - notchY),
            )
        }
    }
}

@Composable
private fun PickTicketTopSection(
    pick: AgentPick,
    codeSize: Dp,
    dateFontSize: androidx.compose.ui.unit.TextUnit,
    namesFontSize: androidx.compose.ui.unit.TextUnit,
    teaserBlurBetType: Boolean,
    modifier: Modifier = Modifier,
) {
    val names = pick.awayHomeNames()
    Box(modifier = modifier) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp)
                .padding(top = 18.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = PickTicketFormat.gameDate(pick.gameDate),
                    color = AppColors.appTextPrimary.copy(alpha = 0.85f),
                    fontSize = dateFontSize,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(Modifier.weight(1f))
                StatusBadge(pick, fontSize = 11.sp, hPad = 9.dp, vPad = 5.dp, corner = 8.dp)
            }

            Spacer(Modifier.weight(1f))

            PickRouteLineRow(pick = pick, codeSize = codeSize, modifier = Modifier.fillMaxWidth())

            Spacer(Modifier.height(4.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = names?.first ?: pick.matchup,
                    color = AppColors.appTextSecondary,
                    fontSize = namesFontSize,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = pick.betType.replaceFirstChar { it.uppercase() },
                    color = AppColors.appTextSecondary,
                    fontSize = namesFontSize,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.then(if (teaserBlurBetType) Modifier.blur(5.dp) else Modifier),
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = names?.second ?: "",
                    color = AppColors.appTextSecondary,
                    fontSize = namesFontSize,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
            }
            Spacer(Modifier.weight(1f))
        }
        // Tear line pinned to the bottom edge.
        DashLine(
            color = Color.White.copy(alpha = 0.16f),
            dash = floatArrayOf(5f, 5f),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp)
                .height(1.dp)
                .align(Alignment.BottomCenter),
        )
    }
}

@Composable
private fun PickTicketBottomStub(
    pick: AgentPick,
    accent: Color,
    teaserBlur: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp)
                .padding(top = 14.dp, bottom = 14.dp)
                .then(if (teaserBlur) Modifier.blur(6.dp) else Modifier),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
                PickTicketStamp("Market", PickTicketFormat.market(pick), TextAlign.Start)
                Spacer(Modifier.weight(1f))
                PickTicketStamp("Odds", pick.odds?.takeIf { it.isNotEmpty() } ?: "—", TextAlign.Center)
                Spacer(Modifier.weight(1f))
                PickTicketStamp("Units", PickTicketFormat.units(pick.units), TextAlign.End)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = pick.pickSelection,
                    color = AppColors.appTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.weight(1f))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(agentSymbol("gauge.medium"), null, tint = accent, modifier = Modifier.size(9.dp))
                    Text("${pick.confidence}/5", color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (teaserBlur) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .align(Alignment.Center)
                    .clip(CircleShape)
                    .background(AppColors.ticketCardstockBottom.copy(alpha = 0.85f))
                    .border(1.dp, accent.copy(alpha = 0.5f), CircleShape)
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            ) {
                Icon(agentSymbol("lock.fill"), null, tint = accent, modifier = Modifier.size(11.dp))
                Text("Unlock in the app", color = accent, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

// MARK: - Expanded pass

/**
 * The full pick "pass" shown when a ticket is tapped open. Bigger route header,
 * a ghosted sport glyph in the cardstock, and a detail grid. [onAudit] surfaces
 * the raw data-trace audit; [showsBranding] renders the WagerProof wordmark and
 * trims the long folder "tail" padding.
 */
@Composable
fun ExpandedAgentPickTicket(
    pick: AgentPick,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
    showsBranding: Boolean = false,
    onAudit: (() -> Unit)? = null,
) {
    val notchY = 200.dp
    val shape = pickTicketShape(notchY = notchY)
    val names = pick.awayHomeNames()

    Column(
        modifier = modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    listOf(AppColors.ticketExpandedTop, AppColors.ticketCardstockBottom),
                ),
            ),
    ) {
        // Top section with ghosted sport glyph + tear line.
        Box(Modifier.fillMaxWidth().height(notchY)) {
            // Ghost glyph — top-trailing, non-interactive.
            Icon(
                imageVector = pick.sport.iconVector(),
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.05f),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 14.dp, end = 6.dp)
                    .size(110.dp),
            )
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 22.dp)
                    .padding(top = 20.dp),
            ) {
                Text(
                    text = PickTicketFormat.gameDate(pick.gameDate),
                    color = AppColors.appTextPrimary.copy(alpha = 0.9f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.08f))
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                )
                Spacer(Modifier.weight(1f))
                PickRouteLineRow(pick = pick, codeSize = 42.dp, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = names?.first ?: pick.matchup,
                        color = AppColors.appTextSecondary, fontSize = 13.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        text = pick.betType.replaceFirstChar { it.uppercase() },
                        color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        text = names?.second ?: "",
                        color = AppColors.appTextSecondary, fontSize = 13.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                }
                Spacer(Modifier.weight(1f))
            }
            DashLine(
                color = Color.White.copy(alpha = 0.16f),
                dash = floatArrayOf(5f, 5f),
                modifier = Modifier
                    .fillMaxWidth().padding(horizontal = 18.dp).height(1.dp)
                    .align(Alignment.BottomCenter),
            )
        }

        // Detail grid.
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .padding(top = 18.dp, bottom = if (showsBranding) 22.dp else 110.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            val status = pick.result
            DetailRow(
                "Market", PickTicketFormat.market(pick), AppColors.appTextPrimary,
                "Units", PickTicketFormat.units(pick.units), accent,
            )
            DetailRow(
                "Odds", pick.odds?.takeIf { it.isNotEmpty() } ?: "—", AppColors.appTextPrimary,
                "Confidence", "${pick.confidence}/5", accent,
            )
            DetailRow(
                "Game Date", PickTicketFormat.gameDate(pick.gameDate), AppColors.appTextPrimary,
                "Result", status.ticketLabel, status.ticketColor,
            )

            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("Selection", color = AppColors.appTextSecondary, fontSize = 13.sp)
                Text(
                    pick.pickSelection, color = AppColors.appTextPrimary,
                    fontSize = 15.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace,
                )
            }

            if (pick.reasoningText.isNotEmpty()) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("SUMMARY", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                    Text(pick.reasoningText, color = AppColors.appTextSecondary, fontSize = 14.sp)
                }
            }

            val factors = pick.keyFactors
            if (!factors.isNullOrEmpty()) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("KEY FACTORS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                    factors.forEach { factor ->
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(
                                Modifier
                                    .padding(top = 6.dp)
                                    .size(5.dp)
                                    .clip(CircleShape)
                                    .background(accent),
                            )
                            Text(factor, color = AppColors.appTextSecondary, fontSize = 14.sp)
                        }
                    }
                }
            }

            if (onAudit != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(accent.copy(alpha = 0.12f))
                        .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onAudit)
                        .padding(vertical = 10.dp),
                ) {
                    Spacer(Modifier.weight(1f))
                    Icon(agentSymbol("terminal"), null, tint = accent, modifier = Modifier.size(12.dp))
                    Text("View data audit", color = accent, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.weight(1f))
                }
            }

            if (showsBranding) {
                Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) {
                    WagerproofTicketFooter()
                }
            }
        }
    }
}

// MARK: - Branding footer

/** WagerProof logo + two-tone wordmark for shareable pick cards. */
@Composable
fun WagerproofTicketFooter(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        // FIDELITY-WAIVER #211: iOS renders the "WagerproofLogo" bundle asset; no
        // equivalent drawable wired in the shared design module, so the glyph
        // mark is dropped and only the two-tone wordmark shows.
        Row {
            Text("Wager", color = AppColors.appTextPrimary.copy(alpha = 0.7f), fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
            Text("Proof", color = AppColors.brandGreenBright, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

// MARK: - Shared ticket pieces

@Composable
private fun StatusBadge(
    pick: AgentPick,
    fontSize: androidx.compose.ui.unit.TextUnit,
    hPad: Dp,
    vPad: Dp,
    corner: Dp,
) {
    val status = pick.result
    Text(
        text = status.ticketLabel,
        color = status.ticketColor,
        fontSize = fontSize,
        fontWeight = FontWeight.ExtraBold,
        modifier = Modifier
            .clip(RoundedCornerShape(corner))
            .background(status.ticketColor.copy(alpha = 0.16f))
            .padding(horizontal = hPad, vertical = vPad),
    )
}

/** The route header both ticket sizes share: away avatar · dashed sport line · home avatar. */
@Composable
fun PickRouteLineRow(
    pick: AgentPick,
    codeSize: Dp,
    modifier: Modifier = Modifier,
) {
    val dotColor = pick.result.ticketColor
    val names = pick.awayHomeNames()
    val away = PickTicketFormat.teamVisual(names?.first ?: pick.matchup, pick.sport)
    val home = PickTicketFormat.teamVisual(names?.second ?: "", pick.sport)

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TeamEnd(away, codeSize)
        // Route line — expands to fill.
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(dotColor))
            DashLine(
                color = Color.White.copy(alpha = 0.22f),
                dash = floatArrayOf(3f, 4f),
                modifier = Modifier.weight(1f).height(1.dp),
            )
            Icon(
                pick.sport.iconVector(), null,
                tint = AppColors.appTextSecondary,
                modifier = Modifier.size(codeSize * 0.42f),
            )
            DashLine(
                color = Color.White.copy(alpha = 0.22f),
                dash = floatArrayOf(3f, 4f),
                modifier = Modifier.weight(1f).height(1.dp),
            )
            Box(Modifier.size(6.dp).clip(CircleShape).background(dotColor))
        }
        TeamEnd(home, codeSize)
    }
}

@Composable
private fun TeamEnd(visual: PickTeamVisual, codeSize: Dp) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PickTeamAvatar(visual = visual, size = codeSize * 1.25f)
        Text(
            text = visual.code,
            color = AppColors.appTextPrimary,
            fontSize = (codeSize.value * 0.8f).sp,
            fontWeight = FontWeight.ExtraBold,
            maxLines = 1,
        )
    }
}

/**
 * Flat (non-glass) team logo avatar — ESPN logo (MLB) or abbreviation initials
 * over a team-tinted gradient disc, with a contrast plate so a same-color logo
 * never vanishes into the disc.
 */
@Composable
fun PickTeamAvatar(
    visual: PickTeamVisual,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    // App is dark-only: plate = white wash when the team primary is dark.
    val plate: Color? = if (relativeLuminance(visual.primary) < 0.45f) {
        Color(0xFFC7C7C7).copy(alpha = 0.15f)
    } else {
        null
    }
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(AppColors.appSurfaceElevated)
            .drawBehind {
                // Team gradient wash @ 0.45.
                drawRoundRectGradient(visual.primary, visual.secondary)
            }
            .border(1.5.dp, AppColors.appSurfaceElevated, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        val url = visual.logoURL
        if (url != null) {
            Box(
                Modifier.size(size * 0.82f).clip(CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (plate != null) Box(Modifier.fillMaxSize().clip(CircleShape).background(plate))
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(if (plate != null) size * 0.07f else 0.dp),
                )
            }
        } else {
            Text(
                text = visual.code,
                color = Color.White,
                fontSize = (size.value * 0.36f).sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
            )
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawRoundRectGradient(
    primary: Color,
    secondary: Color,
) {
    drawCircle(
        brush = Brush.linearGradient(
            colors = listOf(primary, secondary),
            start = Offset(0f, 0f),
            end = Offset(size.width, size.height),
        ),
        alpha = 0.45f,
    )
}

/** WCAG-ish relative luminance for the contrast-plate threshold. */
private fun relativeLuminance(c: Color): Float {
    fun lin(v: Float): Float = if (v <= 0.03928f) v / 12.92f else Math.pow(((v + 0.055) / 1.055), 2.4).toFloat()
    return 0.2126f * lin(c.red) + 0.7152f * lin(c.green) + 0.0722f * lin(c.blue)
}

/** Label over monospaced value, aligned start/center/end. */
@Composable
fun PickTicketStamp(label: String, value: String, alignment: TextAlign) {
    val hAlign = when (alignment) {
        TextAlign.End -> Alignment.End
        TextAlign.Center -> Alignment.CenterHorizontally
        else -> Alignment.Start
    }
    Column(horizontalAlignment = hAlign, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, color = AppColors.appTextSecondary, fontSize = 12.sp)
        Text(
            value, color = AppColors.appTextPrimary,
            fontSize = 16.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace,
            maxLines = 1,
        )
    }
}

@Composable
private fun DetailRow(
    leftLabel: String, leftValue: String, leftColor: Color,
    rightLabel: String, rightValue: String, rightColor: Color,
) {
    Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(leftLabel, color = AppColors.appTextSecondary, fontSize = 13.sp)
            Text(
                leftValue, color = leftColor, fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, maxLines = 1,
            )
        }
        Spacer(Modifier.weight(1f))
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(rightLabel, color = AppColors.appTextSecondary, fontSize = 13.sp)
            Text(
                rightValue, color = rightColor, fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, maxLines = 1,
            )
        }
    }
}

/** 1pt dashed horizontal line — perforations and route lines. */
@Composable
fun DashLine(
    color: Color,
    dash: FloatArray,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.drawBehind {
            drawLine(
                color = color,
                start = Offset(0f, size.height / 2f),
                end = Offset(size.width, size.height / 2f),
                strokeWidth = 1.dp.toPx(),
                pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(
                    floatArrayOf(dash[0] * density, dash[1] * density),
                ),
            )
        },
    )
}

// MARK: - Formatting

/** Away / home names parsed from the matchup string; null when not a 2-team split. */
fun AgentPick.awayHomeNames(): Pair<String, String>? {
    val parts = PickTicketFormat.splitMatchup(matchup)
    if (parts.size != 2) return null
    return parts[0] to parts[1]
}

/** Resolved display identity for one team on a pick ticket. */
data class PickTeamVisual(
    val code: String,
    val logoURL: String?,
    val primary: Color,
    val secondary: Color,
)

/** Pure formatting helpers shared by the ticket, folder, and sheet. */
object PickTicketFormat {
    private val neutralTop = AppColors.teamDiscNeutralTop
    private val neutralBottom = AppColors.teamDiscNeutralBottom

    fun gameDate(s: String): String {
        if (s.isEmpty()) return "Pending"
        val date = try {
            LocalDate.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd"))
        } catch (_: Throwable) {
            return s
        }
        val today = LocalDate.now()
        return when (date) {
            today -> "Today"
            today.minusDays(1) -> "Yesterday"
            today.plusDays(1) -> "Tomorrow"
            else -> date.format(DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US))
        }
    }

    fun market(pick: AgentPick): String {
        val bt = pick.betType.lowercase()
        if (bt.contains("moneyline") || bt == "ml") return "Moneyline"
        if (bt.contains("spread") || bt.contains("runline") || bt.contains("run line")) return "Spread"
        if (bt.contains("total") || bt.contains("over") || bt.contains("under")) return "Total"
        return if (pick.betType.isEmpty()) "Pick" else pick.betType.replaceFirstChar { it.uppercase() }
    }

    fun units(u: Double): String =
        if (u == Math.rint(u)) String.format(Locale.US, "%.0fu", u)
        else String.format(Locale.US, "%.1fu", u)

    fun splitMatchup(matchup: String): List<String> {
        val separators = listOf(" @ ", " at ", " vs. ", " vs ", " v. ", " v ")
        for (sep in separators) {
            val parts = matchup.split(sep)
            if (parts.size == 2) return parts.map { it.trim() }
        }
        return emptyList()
    }

    fun teamCode(name: String, sport: AgentSport): String {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return "—"
        if (sport == AgentSport.MLB) {
            MLBTeams.info(trimmed)?.let { return it.team }
        }
        val words = trimmed.split(" ").filter { it.isNotEmpty() }
        if (words.size >= 2) {
            return words.take(3).mapNotNull { it.firstOrNull() }.joinToString("").uppercase()
        }
        return trimmed.take(3).uppercase()
    }

    fun teamVisual(name: String, sport: AgentSport): PickTeamVisual {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) {
            return PickTeamVisual("—", null, neutralTop, neutralBottom)
        }
        if (sport == AgentSport.MLB) {
            MLBTeams.info(trimmed)?.let { info ->
                return PickTeamVisual(
                    code = info.team,
                    logoURL = info.logoUrl,
                    primary = Color(0xFF000000 or info.primaryHex),
                    secondary = Color(0xFF000000 or info.secondaryHex),
                )
            }
        }
        return PickTeamVisual(teamCode(trimmed, sport), null, neutralTop, neutralBottom)
    }
}

// MARK: - Shapes

/**
 * Boarding-pass cardstock: rounded rect with two circular notches punched into
 * both edges at [notchY] (Path difference cuts true holes AND trims the outer
 * half of each notch, matching iOS's even-odd fill + rounded-rect clip).
 */
fun pickTicketShape(
    notchY: Dp,
    corner: Dp = 22.dp,
    notchRadius: Dp = 9.dp,
): Shape = object : Shape {
    override fun createOutline(
        size: androidx.compose.ui.geometry.Size,
        layoutDirection: LayoutDirection,
        density: Density,
    ): Outline {
        with(density) {
            val ny = notchY.toPx()
            val nr = notchRadius.toPx()
            val cr = corner.toPx()
            val base = Path().apply {
                addRoundRect(RoundRect(0f, 0f, size.width, size.height, cr, cr))
            }
            val notches = Path().apply {
                addOval(Rect(-nr, ny - nr, nr, ny + nr))
                addOval(Rect(size.width - nr, ny - nr, size.width + nr, ny + nr))
            }
            val result = Path()
            result.op(base, notches, PathOperation.Difference)
            return Outline.Generic(result)
        }
    }
}

/** The folder FRONT panel: low left brim rising over a chamfer to a raised right tab. */
fun pickFolderFrontShape(): Shape = object : Shape {
    override fun createOutline(
        size: androidx.compose.ui.geometry.Size,
        layoutDirection: LayoutDirection,
        density: Density,
    ): Outline {
        with(density) {
            val r = 18.dp.toPx()
            val rb = 26.dp.toPx()
            val brimDrop = 26.dp.toPx()
            val chamferStart = size.width * 0.46f
            val chamferEnd = chamferStart + 34.dp.toPx()
            val maxX = size.width
            val maxY = size.height
            val p = Path().apply {
                moveTo(rb, maxY)
                quadraticBezierTo(0f, maxY, 0f, maxY - rb)
                lineTo(0f, brimDrop + r)
                quadraticBezierTo(0f, brimDrop, r, brimDrop)
                lineTo(chamferStart, brimDrop)
                lineTo(chamferEnd, 0f)
                lineTo(maxX - r, 0f)
                quadraticBezierTo(maxX, 0f, maxX, r)
                lineTo(maxX, maxY - rb)
                quadraticBezierTo(maxX, maxY, maxX - rb, maxY)
                close()
            }
            return Outline.Generic(p)
        }
    }
}

/** The folder BACK flap: a wide left tab, then a chamfer down to the main edge. */
fun pickFolderTabShape(): Shape = object : Shape {
    override fun createOutline(
        size: androidx.compose.ui.geometry.Size,
        layoutDirection: LayoutDirection,
        density: Density,
    ): Outline {
        with(density) {
            val r = 18.dp.toPx()
            val tabDrop = 30.dp.toPx()
            val tabEnd = size.width * 0.52f
            val chamferEnd = tabEnd + 34.dp.toPx()
            val maxX = size.width
            val maxY = size.height
            val p = Path().apply {
                moveTo(0f, maxY)
                lineTo(0f, r)
                quadraticBezierTo(0f, 0f, r, 0f)
                lineTo(tabEnd, 0f)
                lineTo(chamferEnd, tabDrop)
                lineTo(maxX - r, tabDrop)
                quadraticBezierTo(maxX, tabDrop, maxX, tabDrop + r)
                lineTo(maxX, maxY)
                close()
            }
            return Outline.Generic(p)
        }
    }
}
