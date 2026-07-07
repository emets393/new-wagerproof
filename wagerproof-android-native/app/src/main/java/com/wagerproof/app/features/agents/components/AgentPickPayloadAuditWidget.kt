package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentPickAuditPayload

// =====================================================================
// AgentPickPayloadAuditWidget — terminal debug surface dumping a pick's raw
// audit payload (game inputs, personality, model response, leaned metrics,
// tool trace). 5 copy-to-clipboard buttons. Port of iOS
// AgentPickPayloadAuditWidget.swift.
// =====================================================================

private val auditGreen = AppColors.brandGreenBright          // 0x00E676
private val auditGreenMid = Color(0xFF26DF85)
private val auditGreenDim = Color(0xFF8CA89B)
private val auditHeaderColor = Color(0xFF9FB3AD)
private val auditInk = Color(0xFF0B1010)
private val auditAmber = Color(0xFFF59E0B)
private val auditCardBg = Color(0xFF050909)

@Composable
fun AgentPickPayloadAuditWidget(
    pick: AgentPick,
    payload: AgentPickAuditPayload,
    modifier: Modifier = Modifier,
) {
    val clipboard = LocalClipboardManager.current
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(auditCardBg)
            .border(1.dp, auditGreen.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header + full-trace export.
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(
                "terminal://pick-audit/${pick.id.take(8)}",
                color = auditHeaderColor, fontSize = 12.sp, fontFamily = FontFamily.Monospace,
            )
            Spacer(Modifier.weight(1f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier
                    .clip(CircleShape)
                    .background(auditGreenMid)
                    .clickable { clipboard.setText(AnnotatedString(payload.fullTraceJSON)) }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Icon(agentSymbol("doc.on.doc.fill"), null, tint = auditInk, modifier = Modifier.size(11.dp))
                Text("Copy Full Trace", color = auditInk, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
            }
        }

        // Matchup banner.
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("›", color = auditGreen, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            Text(
                "${pick.matchup} | ${pick.pickSelection}",
                color = auditGreenMid, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace,
            )
        }

        // LEANED METRICS.
        AuditSection("LEANED METRICS") {
            if (payload.leanedMetrics.isEmpty()) {
                Text("No explicit leaned metrics were returned for this pick.", color = AppColors.appTextSecondary, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    payload.leanedMetrics.forEach { metric ->
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("${metric.metricKey} = ${metric.metricValue}", color = auditGreenMid, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
                            Text(metric.whyItMattered, color = AppColors.appTextSecondary, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                            Text("trait: ${metric.personalityTrait}", color = AppColors.appTextSecondary.copy(alpha = 0.7f), fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }
        }

        AuditSection("WHY THIS PICK") {
            Text(payload.rationaleText, color = AppColors.appTextSecondary, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
        }
        AuditSection("PERSONALITY ALIGNMENT") {
            Text(payload.personalityAlignmentText, color = AppColors.appTextSecondary, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
        }

        PayloadSection("MODEL INPUT GAME PAYLOAD", payload.modelInputGameJSON, clipboard)
        if (!payload.payloadIsFormatted) {
            Text(
                "Note: This appears to be a legacy raw snapshot. New picks store the exact formatted model input payload.",
                color = auditAmber, fontSize = 11.sp, fontFamily = FontFamily.Monospace,
            )
        }
        PayloadSection("AGENT PERSONALITY PAYLOAD", payload.modelInputPersonalityJSON, clipboard)
        PayloadSection("AGENT RESPONSE PAYLOAD", payload.modelResponseJSON, clipboard)

        if (payload.toolTrace.isNotEmpty()) {
            Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    SectionTitle("TOOL CALLS")
                    Spacer(Modifier.weight(1f))
                    CopyButton { clipboard.setText(AnnotatedString(payload.toolTraceJSON)) }
                }
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    payload.toolTrace.forEach { entry ->
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(
                                "${entry.name} · ${entry.ms}ms · ${if (entry.ok) "ok" else "FAIL"}",
                                color = if (entry.ok) auditGreenMid else auditAmber,
                                fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace,
                            )
                            if (entry.resultExcerpt.isNotEmpty()) {
                                JsonBlock(entry.resultExcerpt)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(title, color = auditHeaderColor, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
}

@Composable
private fun AuditSection(title: String, content: @Composable () -> Unit) {
    Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        SectionTitle(title)
        content()
    }
}

@Composable
private fun PayloadSection(
    title: String,
    json: String,
    clipboard: androidx.compose.ui.platform.ClipboardManager,
) {
    Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            SectionTitle(title)
            Spacer(Modifier.weight(1f))
            CopyButton { clipboard.setText(AnnotatedString(json)) }
        }
        JsonBlock(json)
    }
}

@Composable
private fun CopyButton(onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        modifier = Modifier.clickable(onClick = onClick),
    ) {
        Icon(agentSymbol("doc.on.doc"), null, tint = auditGreenMid, modifier = Modifier.size(10.dp))
        Text("Copy", color = auditGreenMid, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun JsonBlock(text: String) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.Black.copy(alpha = 0.4f))
            .horizontalScroll(rememberScrollState())
            .padding(10.dp),
    ) {
        Text(text, color = auditGreenDim, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
    }
}
