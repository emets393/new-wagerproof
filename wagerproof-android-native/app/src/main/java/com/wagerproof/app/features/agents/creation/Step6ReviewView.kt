package com.wagerproof.app.features.agents.creation

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.creation.inputs.AgentTimezoneOption
import com.wagerproof.app.features.agents.creation.inputs.TimePickerModal
import com.wagerproof.app.features.agents.creation.inputs.ToggleInput
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.AgentSpriteIndex
import com.wagerproof.core.stores.AgentCreationStore

/** Step 6: summary, autopilot scheduling, and real create action. */
@Composable
fun Step6ReviewView(
    store: AgentCreationStore,
    autoModeForcedOff: Boolean,
    liveAutoAgentsCount: Int,
    maxLiveAutoAgents: Int?,
    onRequestNotifications: () -> Unit,
    onCreate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val draft = store.draft
    val p = draft.personalityParams
    val archetypeRow = draft.archetype?.raw?.let { id -> store.archetypeRows.firstOrNull { it.id == id } }
    val sprite = draft.spriteIndex ?: AgentSpriteIndex.forSeed(draft.name)
    var timePickerOpen by remember { mutableStateOf(false) }
    val submitting = store.submitState is AgentCreationStore.SubmitState.Submitting

    Column(
        modifier.fillMaxWidth().background(AppColors.appSurface).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        WizardSectionHeader("AGENT SUMMARY")
        WizardSectionCard {
            Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(Modifier.size(66.dp).clip(RoundedCornerShape(19.dp)).background(Brush.linearGradient(AgentColorPalette.avatarGradient(draft.avatarColor))), contentAlignment = Alignment.Center) {
                    PixelSpriteAvatar(sprite, animated = true, modifier = Modifier.size(55.dp))
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(draft.name.ifBlank { "Agent Name" }, color = AppColors.appTextPrimary, fontSize = 23.sp, fontWeight = FontWeight.Black)
                    archetypeRow?.let { Text(it.name, color = AppColors.brandGreenBright, fontSize = 14.sp, fontWeight = FontWeight.SemiBold) }
                }
            }
            if (draft.preferredSports.isNotEmpty()) {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    draft.preferredSports.forEach { SportBadge(it) }
                }
            }
        }

        WizardSectionHeader("THIS AGENT WILL…")
        WizardSectionCard { Text(generatedDescription(store), color = AppColors.appTextSecondary, fontSize = 15.sp, modifier = Modifier.padding(vertical = 6.dp)) }

        WizardSectionHeader("KEY TRAITS")
        WizardSectionCard {
            personalityTraits(p).forEachIndexed { index, trait ->
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(AppIcon.CHECKMARK_CIRCLE_FILL.imageVector, null, tint = AppColors.brandGreenBright, modifier = Modifier.size(18.dp))
                    Text(trait, color = AppColors.appTextPrimary, fontSize = 15.sp)
                }
                if (index != personalityTraits(p).lastIndex) GroupedFormDivider()
            }
        }

        if (hasCustomInsights(store)) {
            WizardSectionCard(Modifier.padding(top = 12.dp)) {
                Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(AppIcon.CHECKMARK_CIRCLE_FILL.imageVector, null, tint = AppColors.brandGreenBright)
                    Text("Custom insights will personalize this agent's behavior", color = AppColors.appTextSecondary, fontSize = 14.sp)
                }
            }
        }

        WizardSectionHeader("AUTOPILOT")
        WizardSectionCard {
            ToggleInput(
                value = draft.autoGenerate && !autoModeForcedOff,
                onValueChange = {
                    store.draft = store.draft.copy(autoGenerate = it)
                    if (it) onRequestNotifications()
                },
                label = "Auto-Generate Picks",
                description = "Automatically generate picks each day based on this strategy",
                enabled = !autoModeForcedOff,
            )
            if (draft.autoGenerate && !autoModeForcedOff) {
                GroupedFormDivider()
                Row(
                    Modifier.fillMaxWidth().clickable { timePickerOpen = true }.semantics { role = Role.Button; contentDescription = "Preferred time ${draft.autoGenerateTime}" }.padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Preferred Time", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Icon(AppIcon.CLOCK.imageVector, null, tint = AppColors.brandGreenBright, modifier = Modifier.size(16.dp))
                    Text(" ${draft.autoGenerateTime} ${AgentTimezoneOption.abbr(draft.autoGenerateTimezone)}", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        if (autoModeForcedOff && maxLiveAutoAgents != null) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("⚡ Auto mode is full", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text("$liveAutoAgentsCount/$maxLiveAutoAgents live auto agents running", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
                Text("This agent will start in manual mode. Turn off a live auto agent to free a slot later.", color = AppColors.appTextSecondary, fontSize = 13.sp)
            }
        }

        Spacer(Modifier.height(18.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(AppColors.brandGreenBright).clickable(enabled = !submitting, onClick = onCreate).semantics { role = Role.Button; contentDescription = if (submitting) "Creating agent" else "Create agent" }.padding(vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            if (submitting) {
                CircularProgressIndicator(color = Color.Black, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Text("  Creating Agent...", color = Color.Black, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            } else Text("Create Agent", color = Color.Black, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        Text("You can edit your agent's settings at any time after creation.", color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp))
        Spacer(Modifier.height(24.dp))
    }

    if (timePickerOpen) {
        TimePickerModal(
            time = draft.autoGenerateTime,
            timezone = draft.autoGenerateTimezone,
            onConfirm = { time, zone ->
                store.draft = store.draft.copy(autoGenerateTime = time, autoGenerateTimezone = zone)
                timePickerOpen = false
            },
            onDismiss = { timePickerOpen = false },
        )
    }
}

@Composable
private fun SportBadge(sport: AgentSport) {
    val color = when (sport) {
        AgentSport.NFL, AgentSport.NBA -> Color(0xFF3B82F6)
        AgentSport.CFB -> Color(0xFFEF4444)
        AgentSport.NCAAB -> Color(0xFFF97316)
        AgentSport.MLB -> Color(0xFF336FA8)
    }
    Text(sport.label, color = color.copy(red = (color.red + 0.35f).coerceAtMost(1f), green = (color.green + 0.35f).coerceAtMost(1f), blue = (color.blue + 0.35f).coerceAtMost(1f)), fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.background(color.copy(alpha = 0.20f), RoundedCornerShape(8.dp)).border(1.dp, color.copy(alpha = 0.45f), RoundedCornerShape(8.dp)).padding(horizontal = 12.dp, vertical = 6.dp))
}

private fun hasCustomInsights(store: AgentCreationStore): Boolean = with(store.draft.customInsights) {
    !bettingPhilosophy.isNullOrEmpty() || !perceivedEdges.isNullOrEmpty() || !avoidSituations.isNullOrEmpty() || !targetSituations.isNullOrEmpty()
}

private fun personalityTraits(p: AgentPersonalityParams): List<String> = buildList {
    add(when {
        p.riskTolerance <= 2 -> "Plays it safe with conservative picks"
        p.riskTolerance >= 4 -> "Aggressive risk-taker looking for big payouts"
        else -> "Balanced approach to risk"
    })
    if (p.underdogLean <= 2) add("Prefers betting on favorites") else if (p.underdogLean >= 4) add("Loves hunting for underdog value")
    if (p.overUnderLean <= 2) add("Tends to bet unders on totals") else if (p.overUnderLean >= 4) add("Leans towards overs on totals")
    if (p.confidenceThreshold >= 4) add("Only picks high-confidence plays") else if (p.confidenceThreshold <= 2) add("Willing to take smaller edges")
    if (p.chaseValue) add("Seeks positive expected value opportunities")
    if (p.parlaysOnly) add("Builds parlay tickets only — no straight picks") else if (p.parlayAppetite >= 4) add("Loves stacking legs into parlays") else if (p.parlayAppetite >= 2) add("Mixes in the occasional parlay")
    if (p.trustModel >= 4) add("Heavily relies on WagerProof model predictions")
    if (p.trustPolymarket >= 4) add("Incorporates Polymarket prediction data")
    when (p.preferredBetType) {
        "spread" -> add("Focuses primarily on spreads")
        "moneyline" -> add("Focuses primarily on moneylines")
        "total" -> add("Focuses primarily on totals")
    }
}.take(7)

private fun generatedDescription(store: AgentCreationStore): String {
    val draft = store.draft
    val p = draft.personalityParams
    val sports = draft.preferredSports.takeIf { it.isNotEmpty() }?.joinToString { it.label } ?: "your selected"
    draft.archetype?.raw?.let { id -> store.archetypeRows.firstOrNull { it.id == id } }?.let { row ->
        return "This agent follows the \"${row.name}\" style and will analyze $sports games to find opportunities that match your preferences."
    }
    val risk = if (p.riskTolerance >= 4) "an aggressive" else if (p.riskTolerance <= 2) "a conservative" else "a balanced"
    val focus = if (p.underdogLean >= 4) "underdog hunting" else if (p.underdogLean <= 2) "chalk grinding" else "value betting"
    return "This is $risk $focus agent that will analyze $sports games and generate picks from your custom settings."
}
