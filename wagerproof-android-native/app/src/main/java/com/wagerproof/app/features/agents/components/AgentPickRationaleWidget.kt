package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPick
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

// =====================================================================
// AgentPickRationaleWidget — terminal-styled "agent rationale" card shown
// inside sport game bottom sheets. Renders ONLY when the audit store's
// selected pick's gameId matches one of the sheet's game keys. Port of iOS
// AgentPickRationaleWidget.swift (dark-only terminal palette).
// =====================================================================

private val terminalSurface = Color(0xFF0B1010)
private val terminalBorder = AppColors.brandGreenBright.copy(alpha = 0.22f)
private val terminalHeaderColor = Color(0xFF9FB3AD)
private val terminalAccent = AppColors.brandGreenBright

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AgentPickRationaleWidget(
    gameKeys: List<String?>,
    modifier: Modifier = Modifier,
) {
    val pick = appGraph().agentPickAudit.selectedPick ?: return
    val keySet = gameKeys.filterNotNull().filter { it.isNotEmpty() }.toSet()
    if (!keySet.contains(pick.gameId)) return

    val factors = (pick.keyFactors ?: emptyList()).take(3)
    val rationale = pick.rationaleSummary().ifEmpty { pick.reasoningText }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 14.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(terminalSurface)
            .border(1.dp, terminalBorder, RoundedCornerShape(14.dp))
            .padding(12.dp),
    ) {
        Text(
            "terminal://agent-rationale", color = terminalHeaderColor,
            fontSize = 11.sp, fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
            Icon(agentSymbol("brain.head.profile"), null, tint = terminalAccent, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(8.dp))
            Text(pick.pickSelection, color = terminalAccent, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
        }
        Text(
            "${pick.betType.uppercase()} pick with ${pick.confidence}/5 confidence",
            color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 10.dp),
        )
        Text(
            rationale.ifEmpty { "No rationale text available." },
            color = AppColors.appTextPrimary, fontSize = 13.sp,
        )
        if (factors.isNotEmpty()) {
            FlowRow(
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                factors.forEach { factor ->
                    Text(
                        factor, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.06f))
                            .border(1.dp, Color.White.copy(alpha = 0.08f), CircleShape)
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}

/** Reads `ai_decision_trace.rationale_summary`, empty when absent. */
private fun AgentPick.rationaleSummary(): String {
    val prim = (aiDecisionTrace as? JsonObject)?.get("rationale_summary") as? JsonPrimitive ?: return ""
    return prim.contentOrNull ?: ""
}
