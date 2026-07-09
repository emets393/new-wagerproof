package com.wagerproof.app.features.onboarding.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.creation.inputs.OddsInput
import com.wagerproof.app.features.agents.creation.inputs.OddsInputType
import com.wagerproof.app.features.agents.creation.inputs.SliderInput
import com.wagerproof.app.features.agents.creation.inputs.ToggleInput
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentCustomInsights
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.stores.AgentCreationStore

@Composable
private fun PersonalityExplainer(icon: String, text: String, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(onboardingIcon(icon), null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
        Text(text, color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp, lineHeight = 19.sp, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun PresetNote(store: AgentCreationStore) {
    store.draft.archetype?.let {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(onboardingIcon("wand.and.stars"), null, tint = AppColors.appPrimary, modifier = Modifier.size(13.dp))
            Text("Pre-tuned by ${it.displayName}", color = AppColors.appPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun KnobDivider() = HorizontalDivider(color = Color.White.copy(alpha = 0.08f), thickness = 0.5.dp)

@Composable
private fun KnobHeader(title: String, modifier: Modifier = Modifier) {
    Text(title, color = Color.White.copy(alpha = 0.4f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.4.sp, modifier = modifier.fillMaxWidth().padding(top = 18.dp))
}

@Composable
private fun KnobList(modifier: Modifier = Modifier, rows: List<@Composable () -> Unit>) {
    Column(modifier.fillMaxWidth()) {
        rows.forEachIndexed { index, row ->
            Box(Modifier.fillMaxWidth().padding(vertical = 14.dp)) { row() }
            if (index < rows.lastIndex) KnobDivider()
        }
    }
}

private fun AgentCreationStore.updateParams(transform: (AgentPersonalityParams) -> AgentPersonalityParams) {
    draft = draft.copy(personalityParams = transform(draft.personalityParams))
}

private fun AgentCreationStore.updateInsights(transform: (AgentCustomInsights) -> AgentCustomInsights) {
    draft = draft.copy(customInsights = transform(draft.customInsights))
}

@Composable
fun OnboardingBuilderMindsetPage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    val p = creation.draft.personalityParams
    OnboardingPageScaffold(title = "Set its instincts", modifier = modifier) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 4.dp)) {
            PersonalityExplainer("brain.head.profile", "Its temperament — a high-risk dog hunter reads a whole different board than a chalk grinder.", Modifier.pageEntrance(2))
            Box(Modifier.padding(top = 10.dp).pageEntrance(3)) { PresetNote(creation) }
            KnobList(Modifier.padding(top = 8.dp).pageEntrance(4), listOf(
                { SliderInput(p.riskTolerance, { creation.updateParams { old -> old.copy(riskTolerance = it) } }, "Risk Tolerance", listOf("Very Safe", "Conservative", "Balanced", "Aggressive", "High Risk")) },
                { SliderInput(p.underdogLean, { creation.updateParams { old -> old.copy(underdogLean = it) } }, "Underdog Lean", listOf("Chalk Only", "Prefer Favs", "Balanced", "Prefer Dogs", "Dogs Only")) },
                { SliderInput(p.overUnderLean, { creation.updateParams { old -> old.copy(overUnderLean = it) } }, "Over/Under Lean", listOf("Unders Only", "Prefer Under", "Balanced", "Prefer Over", "Overs Only")) },
                { SliderInput(p.confidenceThreshold, { creation.updateParams { old -> old.copy(confidenceThreshold = it) } }, "Confidence Threshold", listOf("Any Edge", "Low Bar", "Moderate", "High Bar", "Very Picky")) },
            ))
        }
    }
}

@Composable
fun OnboardingBuilderBetStylePage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    val p = creation.draft.personalityParams
    val hasNFL = AgentSport.NFL in creation.draft.preferredSports
    val marketOptions = listOf("spread" to "Spread", "moneyline" to "Moneyline", "total" to "Total", "team_total" to "Team Total") + if (hasNFL) listOf("prop" to "Player Props") else emptyList()
    val effectiveMarkets = (p.allowedMarkets?.takeIf { it.isNotEmpty() } ?: marketOptions.map { it.first }).toSet()
    OnboardingPageScaffold(title = "Choose its playbook", modifier = modifier) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 4.dp)) {
            PersonalityExplainer("list.clipboard", "What lands on your rail — the markets it plays, how often it fires, straights or parlays.", Modifier.pageEntrance(2))
            KnobList(Modifier.padding(top = 8.dp).pageEntrance(3), listOf(
                {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        KnobTitle("Preferred Bet Type")
                        SegmentedControl(listOf("any" to "Any", "spread" to "Spread", "moneyline" to "ML", "total" to "Total", "prop" to "Props"), p.preferredBetType) {
                            creation.updateParams { old -> old.copy(preferredBetType = it) }
                        }
                    }
                },
                { SliderInput(p.maxPicksPerDay, { creation.updateParams { old -> old.copy(maxPicksPerDay = it) } }, "Max Picks Per Day", listOf("1 Pick", "2 Picks", "3 Picks", "4 Picks", "5 Picks")) },
                { ToggleInput(p.skipWeakSlates, { creation.updateParams { old -> old.copy(skipWeakSlates = it) } }, "Skip Weak Slates") },
                { ToggleInput(p.chaseValue, { creation.updateParams { old -> old.copy(chaseValue = it) } }, "Chase Value", description = "Take positive-EV prices") },
                { SliderInput(p.parlayAppetite, { creation.updateParams { old -> old.copy(parlayAppetite = it) } }, "Parlay Appetite", listOf("Straights Only", "Rarely", "Sometimes", "Often", "Loves Parlays")) },
                { ToggleInput(p.parlaysOnly, { creation.updateParams { old -> old.copy(parlaysOnly = it) } }, "Parlays Only") },
                {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        KnobTitle("Markets")
                        marketOptions.forEach { (value, label) ->
                            val checked = value in effectiveMarkets
                            Row(
                                Modifier.fillMaxWidth().clickable {
                                    val next = effectiveMarkets.toMutableSet()
                                    if (checked && next.size > 1) next.remove(value) else if (!checked) next.add(value)
                                    creation.updateParams { old -> old.copy(allowedMarkets = marketOptions.map { it.first }.filter { it in next }) }
                                }.padding(vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(label, color = Color.White, fontSize = 15.sp, modifier = Modifier.weight(1f))
                                Icon(onboardingIcon(if (checked) "checkmark.circle.fill" else "circle"), null, tint = if (checked) AppColors.appPrimary else Color.White.copy(alpha = 0.35f), modifier = Modifier.size(20.dp))
                            }
                        }
                        if (hasNFL && "prop" in effectiveMarkets) {
                            Text("Player Props Emphasis", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp))
                            SegmentedControl(listOf("off" to "Off", "allow" to "Allow", "emphasize" to "Emphasize"), p.propsEmphasis ?: "allow") {
                                creation.updateParams { old -> old.copy(propsEmphasis = it) }
                            }
                        }
                    }
                },
            ))
        }
    }
}

@Composable
private fun KnobTitle(text: String) = Text(text, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)

@Composable
private fun SegmentedControl(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(9.dp)).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        options.forEach { (value, label) ->
            Text(
                label,
                color = if (selected == value) Color.Black else Color.White.copy(alpha = 0.65f),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f).background(if (selected == value) Color.White else Color.Transparent, RoundedCornerShape(7.dp)).clickable { onSelect(value) }.padding(vertical = 8.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

@Composable
fun OnboardingBuilderDataTrustPage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    val p = creation.draft.personalityParams
    val trustLabels = listOf("Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust")
    OnboardingPageScaffold(title = "Pick its data diet", modifier = modifier) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 4.dp)) {
            PersonalityExplainer("cylinder.split.1x2", "Whose voice wins when our model, Polymarket, and the Vegas price disagree.", Modifier.pageEntrance(2))
            KnobList(Modifier.padding(top = 8.dp).pageEntrance(3), listOf(
                { SliderInput(p.trustModel, { creation.updateParams { old -> old.copy(trustModel = it) } }, "Trust WagerProof Model", trustLabels) },
                { SliderInput(p.trustPolymarket, { creation.updateParams { old -> old.copy(trustPolymarket = it) } }, "Trust Polymarket", trustLabels) },
                { ToggleInput(p.polymarketDivergenceFlag, { creation.updateParams { old -> old.copy(polymarketDivergenceFlag = it) } }, "Polymarket Divergence Flag", description = "Flag hard Vegas/Polymarket splits") },
            ))
            KnobHeader("Price limits", Modifier.pageEntrance(4))
            KnobList(Modifier.pageEntrance(5), listOf(
                { OddsInput(p.maxFavoriteOdds, { creation.updateParams { old -> old.copy(maxFavoriteOdds = it) } }, "Max Favorite Odds", OddsInputType.FAVORITE) },
                { OddsInput(p.minUnderdogOdds, { creation.updateParams { old -> old.copy(minUnderdogOdds = it) } }, "Min Underdog Odds", OddsInputType.UNDERDOG) },
            ))
        }
    }
}

@Composable
fun OnboardingBuilderSportRulesPage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    val p = creation.draft.personalityParams
    val sports = creation.draft.preferredSports
    val hasFootball = AgentSport.NFL in sports || AgentSport.CFB in sports
    val hasBasketball = AgentSport.NBA in sports || AgentSport.NCAAB in sports
    val hasNBA = AgentSport.NBA in sports
    val hasNCAAB = AgentSport.NCAAB in sports
    val trust = listOf("Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust")
    OnboardingPageScaffold(title = "Teach it your sports", modifier = modifier) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 4.dp)) {
            PersonalityExplainer("figure.run", "Edges that only fire where they're real — weather in football, back-to-backs in hoops.", Modifier.pageEntrance(2))
            if (hasFootball) {
                KnobHeader("Football")
                val rows = mutableListOf<@Composable () -> Unit>(
                    { ToggleInput(p.fadePublic ?: false, { creation.updateParams { old -> old.copy(fadePublic = it) } }, "Fade the Public", description = "Bet against the crowd") },
                )
                if (p.fadePublic == true) rows += { SliderInput(p.publicThreshold ?: 3, { creation.updateParams { old -> old.copy(publicThreshold = it) } }, "Public Threshold", listOf("55%", "60%", "65%", "70%", "75%")) }
                rows += { ToggleInput(p.weatherImpactsTotals ?: false, { creation.updateParams { old -> old.copy(weatherImpactsTotals = it) } }, "Weather Impacts Totals") }
                if (p.weatherImpactsTotals == true) rows += { SliderInput(p.weatherSensitivity ?: 3, { creation.updateParams { old -> old.copy(weatherSensitivity = it) } }, "Weather Sensitivity", listOf("Minimal", "Low", "Moderate", "High", "Maximum")) }
                KnobList(rows = rows)
            }
            if (hasBasketball) {
                KnobHeader("Basketball")
                KnobList(rows = listOf(
                    { SliderInput(p.trustTeamRatings ?: 3, { creation.updateParams { old -> old.copy(trustTeamRatings = it) } }, "Trust Team Ratings", trust) },
                    { ToggleInput(p.paceAffectsTotals ?: false, { creation.updateParams { old -> old.copy(paceAffectsTotals = it) } }, "Pace Affects Totals") },
                    { ToggleInput(p.fadeBackToBacks ?: false, { creation.updateParams { old -> old.copy(fadeBackToBacks = it) } }, "Fade Back-to-Backs", description = "Bet against tired teams") },
                ))
            }
            if (hasNBA) {
                KnobHeader("NBA trends")
                KnobList(rows = listOf(
                    { SliderInput(p.weightRecentForm ?: 3, { creation.updateParams { old -> old.copy(weightRecentForm = it) } }, "Weight Recent Form", listOf("Ignore", "Light", "Moderate", "Heavy", "Primary")) },
                    { ToggleInput(p.rideHotStreaks ?: false, { creation.updateParams { old -> old.copy(rideHotStreaks = it) } }, "Ride Hot Streaks") },
                    { ToggleInput(p.fadeColdStreaks ?: false, { creation.updateParams { old -> old.copy(fadeColdStreaks = it) } }, "Fade Cold Streaks") },
                    { ToggleInput(p.trustAtsTrends ?: false, { creation.updateParams { old -> old.copy(trustAtsTrends = it) } }, "Trust ATS Trends") },
                    { ToggleInput(p.regressLuck ?: false, { creation.updateParams { old -> old.copy(regressLuck = it) } }, "Regress Luck", description = "Expect runs to snap back") },
                ))
            }
            KnobHeader("Situational")
            val situational = mutableListOf<@Composable () -> Unit>(
                { SliderInput(p.homeCourtBoost, { creation.updateParams { old -> old.copy(homeCourtBoost = it) } }, "Home Court/Field Boost", listOf("Ignore", "Slight", "Moderate", "Strong", "Maximum")) },
            )
            if (hasNCAAB) situational += { ToggleInput(p.upsetAlert ?: false, { creation.updateParams { old -> old.copy(upsetAlert = it) } }, "Upset Alert", description = "Flag tournament upsets") }
            KnobList(rows = situational)
        }
    }
}

private data class InsightField(
    val title: String,
    val icon: String,
    val placeholder: String,
    val max: Int,
    val value: (AgentCustomInsights) -> String?,
    val update: (AgentCustomInsights, String?) -> AgentCustomInsights,
)

private val insightFields = listOf(
    InsightField("Betting Philosophy", "book.fill", "e.g., Only take plays with a real edge over the market...", 500, { it.bettingPhilosophy }, { old, value -> old.copy(bettingPhilosophy = value) }),
    InsightField("Perceived Edges", "chart.line.uptrend.xyaxis", "e.g., Mispriced totals in divisional games, especially in bad weather...", 500, { it.perceivedEdges }, { old, value -> old.copy(perceivedEdges = value) }),
    InsightField("Situations to Avoid", "xmark.octagon", "e.g., No primetime games, skip uncertain QB situations...", 300, { it.avoidSituations }, { old, value -> old.copy(avoidSituations = value) }),
    InsightField("Target Situations", "target", "e.g., Home dogs off a bye, early-season totals before lines adjust...", 300, { it.targetSituations }, { old, value -> old.copy(targetSituations = value) }),
)

@Composable
fun OnboardingBuilderInsightsPage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    OnboardingPageScaffold(title = "Tell it your rules", modifier = modifier) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 4.dp)) {
            PersonalityExplainer("text.quote", "Optional. Anything here goes straight into its research brief as standing orders.", Modifier.pageEntrance(2))
            Column(Modifier.padding(top = 8.dp).pageEntrance(3)) {
                insightFields.forEachIndexed { index, field ->
                    InsightRow(creation, field)
                    if (index < insightFields.lastIndex) KnobDivider()
                }
            }
        }
    }
}

@Composable
private fun InsightRow(creation: AgentCreationStore, field: InsightField) {
    val value = field.value(creation.draft.customInsights).orEmpty()
    Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(onboardingIcon(field.icon), null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
            Text(field.title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text("${value.length}/${field.max}", color = Color.White.copy(alpha = 0.4f), fontSize = 11.sp)
        }
        Box(Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.25f), RoundedCornerShape(10.dp)).border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(10.dp)).padding(10.dp)) {
            if (value.isEmpty()) Text(field.placeholder, color = Color.White.copy(alpha = 0.35f), fontSize = 14.sp, lineHeight = 19.sp)
            BasicTextField(
                value = value,
                onValueChange = { next -> creation.updateInsights { old -> field.update(old, next.take(field.max).ifEmpty { null }) } },
                textStyle = TextStyle(Color.White, fontSize = 14.sp, lineHeight = 19.sp),
                cursorBrush = SolidColor(AppColors.appPrimary),
                minLines = 3,
                maxLines = 6,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
