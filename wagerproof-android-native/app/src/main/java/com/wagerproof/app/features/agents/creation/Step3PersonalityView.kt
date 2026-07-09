package com.wagerproof.app.features.agents.creation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.creation.inputs.SliderInput
import com.wagerproof.app.features.agents.creation.inputs.ToggleInput
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.stores.AgentCreationStore

/** Step 3: broad personality first, then bet and market selection. */
@Composable
fun Step3PersonalityView(store: AgentCreationStore, modifier: Modifier = Modifier) {
    val p = store.draft.personalityParams
    val hasNfl = AgentSport.NFL in store.draft.preferredSports
    val marketOptions = listOf("spread" to "Spread", "moneyline" to "Moneyline", "total" to "Total", "team_total" to "Team Total") +
        if (hasNfl) listOf("prop" to "Player Props") else emptyList()
    val effectiveMarkets = (p.allowedMarkets?.takeIf { it.isNotEmpty() } ?: marketOptions.map { it.first }).toSet()

    fun update(next: AgentPersonalityParams) {
        store.draft = store.draft.copy(personalityParams = next)
    }

    Column(
        modifier.fillMaxWidth().background(AppColors.appSurface).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        WizardIntro(
            eyebrow = "AGENT MINDSET",
            title = "Tune how this agent thinks before you fine-tune the data rules.",
            body = "Start with broad instincts first. The goal is a readable personality profile, not a wall of settings.",
        )

        WizardSectionHeader("CORE PERSONALITY")
        WizardSectionCard {
            SliderInput(p.riskTolerance, { update(p.copy(riskTolerance = it)) }, "Risk Tolerance", riskLabels, description = "How much risk is your agent willing to take?")
            GroupedFormDivider()
            SliderInput(p.underdogLean, { update(p.copy(underdogLean = it)) }, "Underdog Lean", underdogLabels, description = "Does your agent prefer favorites or underdogs?")
            GroupedFormDivider()
            SliderInput(p.overUnderLean, { update(p.copy(overUnderLean = it)) }, "Over/Under Lean", overUnderLabels, description = "Does your agent lean towards overs or unders on totals?")
            GroupedFormDivider()
            SliderInput(p.confidenceThreshold, { update(p.copy(confidenceThreshold = it)) }, "Confidence Threshold", confidenceLabels, description = "How confident should your agent be before making a pick?")
            GroupedFormDivider()
            ToggleInput(p.chaseValue, { update(p.copy(chaseValue = it)) }, "Chase Value", description = "Seek bets where odds exceed model probability")
            GroupedFormDivider()
            SliderInput(p.parlayAppetite, { update(p.copy(parlayAppetite = it)) }, "Parlay Appetite", parlayLabels, description = "Can your agent combine its best plays into multi-leg parlays?")
            GroupedFormDivider()
            ToggleInput(p.parlaysOnly, { update(p.copy(parlaysOnly = it)) }, "Parlays Only", description = "Force every play into a parlay ticket — no straight picks")
        }

        WizardSectionHeader("BET SELECTION")
        WizardSectionCard {
            Text("Preferred Bet Type", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
            Text("Which bet type should your agent focus on?", color = AppColors.appTextSecondary, fontSize = 13.sp)
            ChoiceRail(
                entries = listOf("any" to "Any", "spread" to "Spread", "moneyline" to "ML", "total" to "Total", "prop" to "Props"),
                selected = p.preferredBetType,
                onSelect = { update(p.copy(preferredBetType = it)) },
            )
            GroupedFormDivider()
            SliderInput(p.maxPicksPerDay, { update(p.copy(maxPicksPerDay = it)) }, "Max Picks Per Day", maxPicksLabels, description = "Maximum picks on any given day")
            GroupedFormDivider()
            ToggleInput(p.skipWeakSlates, { update(p.copy(skipWeakSlates = it)) }, "Skip Weak Slates", description = "Pass on days with poor betting opportunities")
        }

        WizardSectionHeader("MARKETS & PROPS")
        WizardSectionCard {
            marketOptions.forEach { (key, label) ->
                val checked = key in effectiveMarkets
                Row(
                    Modifier.fillMaxWidth().clickable {
                        val next = effectiveMarkets.toMutableSet()
                        if (checked && next.size > 1) next.remove(key) else next.add(key)
                        val ordered = marketOptions.map { it.first }.filter { it in next }
                        update(p.copy(allowedMarkets = ordered))
                    }.semantics { role = Role.Checkbox; selected = checked }.padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(label, color = AppColors.appTextPrimary, fontSize = 15.sp, modifier = Modifier.weight(1f))
                    if (checked) Icon(AppIcon.CHECKMARK.imageVector, null, tint = AppColors.brandGreenBright)
                }
                if (key != marketOptions.last().first) GroupedFormDivider()
            }
            if (hasNfl && "prop" in effectiveMarkets) {
                Text("Player Props Emphasis", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                Text("How hard should this agent lean into signal-backed player props?", color = AppColors.appTextSecondary, fontSize = 13.sp)
                ChoiceRail(
                    entries = listOf("off" to "Off", "allow" to "Allow", "emphasize" to "Emphasize"),
                    selected = p.propsEmphasis ?: "allow",
                    onSelect = { update(p.copy(propsEmphasis = it)) },
                )
            }
        }
        WizardSectionFooter(if (hasNfl) "Player props are NFL-only and signal-gated." else "Add NFL to enable player props.")
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
internal fun WizardIntro(eyebrow: String, title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(eyebrow, color = AppColors.brandGreenBright, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.1.sp)
        Text(title, color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
        Text(body, color = AppColors.appTextSecondary, fontSize = 13.sp)
    }
}

@Composable
internal fun ChoiceRail(entries: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        entries.forEach { (value, label) ->
            val active = value == selected
            Text(
                label,
                color = if (active) Color.Black else AppColors.appTextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.background(if (active) AppColors.brandGreenBright else AppColors.appSurfaceMuted, RoundedCornerShape(9.dp)).border(1.dp, if (active) AppColors.brandGreenBright else AppColors.appBorder, RoundedCornerShape(9.dp)).clickable { onSelect(value) }.semantics { role = Role.RadioButton; this.selected = active }.padding(horizontal = 12.dp, vertical = 9.dp),
            )
        }
    }
}

private val riskLabels = listOf("Very Safe", "Conservative", "Balanced", "Aggressive", "High Risk")
private val underdogLabels = listOf("Chalk Only", "Prefer Favs", "Balanced", "Prefer Dogs", "Dogs Only")
private val overUnderLabels = listOf("Unders Only", "Prefer Under", "Balanced", "Prefer Over", "Overs Only")
private val confidenceLabels = listOf("Any Edge", "Low Bar", "Moderate", "High Bar", "Very Picky")
private val maxPicksLabels = listOf("1 Pick", "2 Picks", "3 Picks", "4 Picks", "5 Picks")
private val parlayLabels = listOf("Straights Only", "Rarely", "Sometimes", "Often", "Loves Parlays")
