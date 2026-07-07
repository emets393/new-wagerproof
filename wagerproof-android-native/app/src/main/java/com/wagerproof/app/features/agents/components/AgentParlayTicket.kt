package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.agents.iconVector
import com.wagerproof.app.features.agents.ticketColor
import com.wagerproof.app.features.agents.ticketLabel
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentParlay
import com.wagerproof.core.models.AgentParlayLeg
import com.wagerproof.core.models.AgentParlaySport
import com.wagerproof.core.models.AgentPick

// =====================================================================
// AgentParlayTicket — a multi-leg parlay in the same boarding-pass
// vocabulary as AgentPickTicket, but VARIABLE-height. Port of iOS
// AgentParlayTicket.swift. Sibling components (not param variants) because
// pick geometry is baked into folder physics.
// =====================================================================

/** Short market label for a parlay leg — market + period prefix ("1H Spread", "F5 ML"). */
fun parlayLegMarket(leg: AgentParlayLeg): String {
    val bt = leg.betType.lowercase()
    val base = when {
        bt.contains("moneyline") || bt == "ml" -> "ML"
        bt == "team_total" -> "Team Total"
        bt.contains("spread") || bt.contains("runline") -> "Spread"
        bt.contains("total") -> "Total"
        bt == "prop" -> "Prop"
        else -> if (leg.betType.isEmpty()) "Leg" else leg.betType.replaceFirstChar { it.uppercase() }
    }
    return when (leg.period) {
        "f5" -> "F5 $base"
        "h1" -> "1H $base"
        else -> base
    }
}

private val AgentParlaySport.ticketSubtitle: String
    get() = if (this == AgentParlaySport.MULTI) "Cross-sport ticket" else "${label} ticket"

// MARK: - Unified bet ticket

/** Renders the right stacked ticket for either item shape. */
@Composable
fun BetItemTicket(
    item: AgentBetItem,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
) {
    when (item) {
        is AgentBetItem.Pick -> AgentPickTicket(pick = item.pick, modifier = modifier, accent = accent)
        is AgentBetItem.Parlay -> AgentParlayTicket(parlay = item.parlay, modifier = modifier, accent = accent)
    }
}

// MARK: - Stack ticket (variable height)

@Composable
fun AgentParlayTicket(
    parlay: AgentParlay,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
) {
    val shownLegs = parlay.legs.take(4)
    val legCount = shownLegs.size.coerceIn(2, 4)
    val notchY = (52 + 44 * legCount).dp
    val stubHeight = 100.dp
    val height = notchY + stubHeight
    val shape = pickTicketShape(notchY = notchY)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(AppColors.ticketCardstockTop, AppColors.ticketCardstockBottom)))
            .border(1.dp, Color.White.copy(alpha = 0.07f), RoundedCornerShape(22.dp)),
    ) {
        // Top section.
        Box(Modifier.fillMaxWidth().height(notchY)) {
            Column(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(top = 18.dp)) {
                    Text(
                        PickTicketFormat.gameDate(parlay.displayDate),
                        color = AppColors.appTextPrimary.copy(alpha = 0.85f), fontSize = 15.sp, fontWeight = FontWeight.Medium,
                    )
                    Spacer(Modifier.width(8.dp))
                    ParlayBadge(parlay.displayLegsCount, accent)
                    Spacer(Modifier.weight(1f))
                    ParlayStatusBadge(parlay)
                }
                Spacer(Modifier.weight(1f))
                Column(Modifier.fillMaxWidth()) {
                    shownLegs.forEachIndexed { index, leg ->
                        ParlayLegRow(leg = leg, showsDivider = index != shownLegs.lastIndex, modifier = Modifier.height(44.dp))
                    }
                }
                Spacer(Modifier.weight(1f))
            }
            DashLine(
                color = Color.White.copy(alpha = 0.16f), dash = floatArrayOf(5f, 5f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).height(1.dp).align(Alignment.BottomCenter),
            )
        }
        // Bottom stub.
        Column(
            Modifier.fillMaxWidth().height(stubHeight).padding(horizontal = 20.dp).padding(top = 14.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
                PickTicketStamp("Legs", "${parlay.displayLegsCount}", TextAlign.Start)
                Spacer(Modifier.weight(1f))
                PickTicketStamp("Combined Odds", parlay.combinedOdds ?: "—", TextAlign.Center)
                Spacer(Modifier.weight(1f))
                PickTicketStamp("Units", PickTicketFormat.units(parlay.units), TextAlign.End)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(
                    parlay.sport.ticketSubtitle, color = AppColors.appTextSecondary,
                    fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(agentSymbol("gauge.medium"), null, tint = accent, modifier = Modifier.size(9.dp))
                    Text("${parlay.confidence}/5", color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun ParlayBadge(legs: Int, accent: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.clip(CircleShape).background(accent.copy(alpha = 0.14f)).padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Icon(agentSymbol("link"), null, tint = accent, modifier = Modifier.size(9.dp))
        Text("$legs-LEG PARLAY", color = accent, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun ParlayStatusBadge(parlay: AgentParlay) {
    Text(
        parlay.result.ticketLabel, color = parlay.result.ticketColor, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(parlay.result.ticketColor.copy(alpha = 0.16f)).padding(horizontal = 9.dp, vertical = 5.dp),
    )
}

// MARK: - Leg row (compact)

@Composable
private fun ParlayLegRow(
    leg: AgentParlayLeg,
    showsDivider: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Row(
            Modifier.fillMaxWidth().weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(leg.legResult.ticketColor))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    leg.pickSelection, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Icon(leg.sport.iconVector(), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(8.dp))
                    Text(parlayLegMarket(leg), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                    Text(leg.matchup, color = AppColors.appTextSecondary, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Text(leg.odds ?: "—", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
        }
        if (showsDivider) {
            DashLine(color = Color.White.copy(alpha = 0.08f), dash = floatArrayOf(3f, 4f), modifier = Modifier.fillMaxWidth().height(1.dp))
        }
    }
}

// MARK: - Expanded pass

@Composable
fun ExpandedAgentParlayTicket(
    parlay: AgentParlay,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
    showsBranding: Boolean = false,
) {
    val notchY = (96 + parlay.legs.size.coerceAtMost(4) * 24).dp
    val shape = pickTicketShape(notchY = notchY)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .clip(shape)
            .background(Brush.verticalGradient(listOf(AppColors.ticketExpandedTop, AppColors.ticketCardstockBottom))),
    ) {
        Box(Modifier.fillMaxWidth().height(notchY)) {
            Icon(
                agentSymbol("link"), null, tint = Color.White.copy(alpha = 0.05f),
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 14.dp, end = 6.dp).size(100.dp),
            )
            Column(Modifier.fillMaxSize().padding(horizontal = 22.dp).padding(top = 20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        PickTicketFormat.gameDate(parlay.displayDate), color = AppColors.appTextPrimary.copy(alpha = 0.9f),
                        fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.08f)).padding(horizontal = 12.dp, vertical = 7.dp),
                    )
                    Spacer(Modifier.weight(1f))
                    ParlayStatusBadge(parlay)
                }
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(agentSymbol("link"), null, tint = accent, modifier = Modifier.size(15.dp))
                    Text("${parlay.displayLegsCount}-LEG PARLAY", color = accent, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
                }
                Text(parlay.sport.ticketSubtitle, color = AppColors.appTextSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.weight(1f))
            }
            DashLine(
                color = Color.White.copy(alpha = 0.16f), dash = floatArrayOf(5f, 5f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).height(1.dp).align(Alignment.BottomCenter),
            )
        }

        Column(
            Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(top = 18.dp, bottom = if (showsBranding) 22.dp else 110.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ParlayDetailRow(
                "Combined Odds", parlay.combinedOdds ?: "—", AppColors.appTextPrimary,
                "Units", PickTicketFormat.units(parlay.units), accent,
            )
            ParlayDetailRow(
                "Confidence", "${parlay.confidence}/5", accent,
                "Result", parlay.actualResult ?: parlay.result.ticketLabel, parlay.result.ticketColor,
            )

            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("LEGS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                parlay.legs.forEachIndexed { index, leg ->
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(
                            Modifier.size(18.dp).clip(CircleShape).background(leg.legResult.ticketColor.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("${index + 1}", color = leg.legResult.ticketColor, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    leg.pickSelection, color = AppColors.appTextPrimary, fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, maxLines = 2, overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(leg.odds ?: "—", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
                            }
                            Text(
                                "${parlayLegMarket(leg)} · ${leg.matchup} · ${PickTicketFormat.gameDate(leg.gameDate)}",
                                color = AppColors.appTextSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }

            if (parlay.reasoningText.isNotEmpty()) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("SUMMARY", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                    Text(parlay.reasoningText, color = AppColors.appTextSecondary, fontSize = 14.sp)
                }
            }

            val factors = parlay.keyFactors
            if (!factors.isNullOrEmpty()) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("KEY FACTORS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                    factors.forEach { factor ->
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(Modifier.padding(top = 6.dp).size(5.dp).clip(CircleShape).background(accent))
                            Text(factor, color = AppColors.appTextSecondary, fontSize = 14.sp)
                        }
                    }
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

@Composable
private fun ParlayDetailRow(
    leftLabel: String, leftValue: String, leftColor: Color,
    rightLabel: String, rightValue: String, rightColor: Color,
) {
    Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(leftLabel, color = AppColors.appTextSecondary, fontSize = 13.sp)
            Text(leftValue, color = leftColor, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, maxLines = 1)
        }
        Spacer(Modifier.weight(1f))
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(rightLabel, color = AppColors.appTextSecondary, fontSize = 13.sp)
            Text(rightValue, color = rightColor, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, maxLines = 1)
        }
    }
}

// MARK: - Mini ticket

@Composable
fun AgentParlayMiniTicket(
    parlay: AgentParlay,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
) {
    val miniWidth = 178.dp
    val miniHeight = 240.dp
    val miniNotchY = 116.dp
    val shownLegs = parlay.legs.take(4)

    Column(
        modifier = modifier.size(miniWidth, miniHeight).miniTicketCardstock(miniNotchY),
    ) {
        Box(Modifier.fillMaxWidth().height(miniNotchY)) {
            Column(Modifier.fillMaxSize().padding(horizontal = 14.dp).padding(top = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(agentSymbol("link"), null, tint = accent, modifier = Modifier.size(9.dp))
                        Text("PARLAY", color = accent, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Spacer(Modifier.weight(1f))
                    Text(PickTicketFormat.gameDate(parlay.displayDate), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    Spacer(Modifier.width(6.dp))
                    MiniStatusCorner(
                        isPending = parlay.result == AgentPick.PickResultStatus.PENDING,
                        confidence = parlay.confidence,
                        statusLabel = parlay.result.ticketLabel,
                        statusColor = parlay.result.ticketColor,
                        accent = accent,
                    )
                }
                Spacer(Modifier.weight(1f))
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    shownLegs.forEach { leg ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            Box(Modifier.size(4.dp).clip(CircleShape).background(leg.legResult.ticketColor))
                            Text(leg.pickSelection, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Spacer(Modifier.weight(1f))
            }
            DashLine(
                color = Color.White.copy(alpha = 0.16f), dash = floatArrayOf(4f, 4f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).height(1.dp).align(Alignment.BottomCenter),
            )
        }
        Column(
            Modifier.fillMaxWidth().height(miniHeight - miniNotchY).padding(horizontal = 14.dp).padding(top = 11.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text("${parlay.displayLegsCount}-Leg Ticket", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
            Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
                MiniPickStamp("Legs", "${parlay.displayLegsCount}", TextAlign.Start)
                Spacer(Modifier.weight(1f))
                MiniPickStamp("Odds", parlay.combinedOdds ?: "—", TextAlign.Center)
                Spacer(Modifier.weight(1f))
                MiniPickStamp("Units", PickTicketFormat.units(parlay.units), TextAlign.End, tint = accent)
            }
            val snippet = miniReasoningSnippet(parlay.reasoningText, parlay.keyFactors)
            if (snippet.isNotEmpty()) {
                Text(snippet, color = AppColors.appTextSecondary, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
