package com.wagerproof.app.features.agents

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.creation.WizardSectionCard
import com.wagerproof.app.features.agents.creation.WizardSectionFooter
import com.wagerproof.app.features.agents.creation.WizardSectionHeader
import com.wagerproof.app.features.agents.creation.inputs.OddsInput
import com.wagerproof.app.features.agents.creation.inputs.OddsInputType
import com.wagerproof.app.features.agents.creation.inputs.SliderInput
import com.wagerproof.app.features.agents.creation.inputs.TimePickerModal
import com.wagerproof.app.features.agents.creation.inputs.ToggleInput
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentCustomInsights
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.stores.AgentDetailStore
import com.wagerproof.core.stores.AgentEntitlementsStore
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.put

private val riskLabels = listOf("Very Safe", "Conservative", "Balanced", "Aggressive", "High Risk")
private val underdogLabels = listOf("Chalk Only", "Prefer Favs", "Balanced", "Prefer Dogs", "Dogs Only")
private val overUnderLabels = listOf("Unders Only", "Prefer Under", "Balanced", "Prefer Over", "Overs Only")
private val confidenceLabels = listOf("Any Edge", "Low Bar", "Moderate", "High Bar", "Very Picky")
private val maxPicksLabels = listOf("1 Pick", "2 Picks", "3 Picks", "4 Picks", "5 Picks")
private val parlayLabels = listOf("Straights Only", "Rarely", "Sometimes", "Often", "Loves Parlays")
private val trustLabels = listOf("Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust")
private val sensitivityLabels = listOf("Minimal", "Low", "Moderate", "High", "Maximum")
private val publicThresholdLabels = listOf("55%", "60%", "65%", "70%", "75%")
private val homeBoostLabels = listOf("Ignore", "Slight", "Moderate", "Strong", "Maximum")
private val recentFormLabels = listOf("Ignore", "Light", "Moderate", "Heavy", "Primary")
private val colorOptions = listOf(
    "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
)
private val betTypes = listOf("any" to "Any", "spread" to "Spread", "moneyline" to "ML", "total" to "Total")

/**
 * Owner-only full settings editor. iOS `AgentSettingsView`. Saves through the
 * `update_agent` action via [AgentDetailStore.saveSettings]. Full wizard parity:
 * identity, sports, personality, bet selection, data trust, odds limits, the
 * sport-conditional sections, four custom-insight fields, autopilot, visibility,
 * and a delete danger zone.
 */
@Composable
fun AgentSettingsScreen(agentId: String, modifier: Modifier = Modifier) {
    val graph = appGraph()
    val nav = LocalAppNavigator.current
    val scope = rememberCoroutineScope()
    val entitlements = AgentEntitlementsStore(graph.proAccess)
    val store = remember(agentId) { AgentDetailStore(agentId) }

    var name by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("🤖") }
    var spriteIndex by remember { mutableIntStateOf(0) }
    var color by remember { mutableStateOf("#3B82F6") }
    var sports by remember { mutableStateOf<Set<AgentSport>>(emptySet()) }
    var personality by remember { mutableStateOf(AgentPersonalityParams.default) }
    var customInsights by remember { mutableStateOf(AgentCustomInsights.empty) }
    var autoGenerate by remember { mutableStateOf(true) }
    var autoGenerateTime by remember { mutableStateOf("09:00") }
    var autoGenerateTimezone by remember { mutableStateOf("America/New_York") }
    var isPublic by remember { mutableStateOf(false) }
    var hasChanges by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var deleteConfirm by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showTimePicker by remember { mutableStateOf(false) }

    fun mutatePersonality(block: (AgentPersonalityParams) -> AgentPersonalityParams) {
        personality = block(personality)
        hasChanges = true
    }

    fun hydrate(agent: Agent) {
        if (hasChanges) return
        name = agent.name
        emoji = agent.avatarEmoji
        spriteIndex = agent.spriteIndex
        color = agent.avatarColor
        sports = agent.preferredSports.toSet()
        personality = agent.personalityParams
        customInsights = agent.customInsights
        autoGenerate = agent.autoGenerate
        autoGenerateTime = agent.autoGenerateTime
        autoGenerateTimezone = agent.autoGenerateTimezone
        isPublic = agent.isPublic
        hasChanges = false
    }

    LaunchedEffect(agentId) {
        store.refreshSnapshot()
        store.snapshot?.agent?.let { hydrate(it) }
    }

    suspend fun save() {
        saving = true
        val payload = buildJsonObject {
            put("name", name)
            put("avatar_emoji", emoji)
            put("sprite_index", spriteIndex)
            put("avatar_color", color)
            put("preferred_sports", buildJsonArray { sports.forEach { add(it.raw) } })
            put("personality_params", WagerproofJson.encodeToJsonElement(AgentPersonalityParams.serializer(), personality))
            put("custom_insights", WagerproofJson.encodeToJsonElement(AgentCustomInsights.serializer(), customInsights))
            put("auto_generate", autoGenerate)
            put("auto_generate_time", autoGenerateTime)
            put("auto_generate_timezone", autoGenerateTimezone)
            put("is_public", isPublic)
        }
        val ok = store.saveSettings(payload)
        saving = false
        if (ok) {
            hasChanges = false
            nav.popAgents()
        } else {
            errorMessage = store.lastGenerationError ?: "Failed to save settings."
        }
    }

    val hasFootball = sports.contains(AgentSport.NFL) || sports.contains(AgentSport.CFB)
    val hasBasketball = sports.contains(AgentSport.NBA) || sports.contains(AgentSport.NCAAB)
    val hasNBA = sports.contains(AgentSport.NBA)
    val hasNCAAB = sports.contains(AgentSport.NCAAB)

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        // Top bar with Save.
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { nav.popAgents() }) {
                Icon(agentSymbol("chevron.left"), contentDescription = "Back", tint = AppColors.appTextPrimary)
            }
            Text("Settings", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            TextButton(
                onClick = { scope.launch { save() } },
                enabled = hasChanges && !saving,
            ) {
                if (saving) CircularProgressIndicator(color = AppColors.appPrimary, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                else Text("Save", fontWeight = FontWeight.Bold, color = if (hasChanges) AppColors.appPrimary else AppColors.appTextSecondary)
            }
        }

        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        ) {
            // Identity
            WizardSectionHeader("Identity")
            WizardSectionCard {
                SettingsTextField(value = name, onValueChange = { name = it; hasChanges = true }, placeholder = "Agent name", singleLine = true)
                Spacer(Modifier.height(10.dp))
                Text("Character", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (0..7).forEach { idx ->
                        val selected = spriteIndex == idx
                        Box(
                            Modifier
                                .background(
                                    if (selected) AppColors.brandGreenBright.copy(alpha = 0.18f) else AppColors.appBorder.copy(alpha = 0.3f),
                                    RoundedCornerShape(10.dp),
                                )
                                .border(if (selected) 2.dp else 0.dp, if (selected) AppColors.brandGreenBright else Color.Transparent, RoundedCornerShape(10.dp))
                                .clickable { spriteIndex = idx; hasChanges = true }
                                .padding(horizontal = 7.dp, vertical = 6.dp),
                        ) {
                            PixelSpriteAvatar(spriteIndex = idx, animated = selected, modifier = Modifier.width(42.dp).height(56.dp))
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text("Color", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    colorOptions.forEach { c ->
                        val selected = color.equals(c, ignoreCase = true)
                        Box(
                            Modifier
                                .size(40.dp)
                                .background(colorFromHexString(c) ?: AppColors.appAccentBlue, CircleShape)
                                .border(if (selected) 3.dp else 0.dp, Color.White, CircleShape)
                                .clickable { color = c; hasChanges = true },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selected) Icon(agentSymbol("checkmark"), contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }

            // Sports
            WizardSectionHeader("Sports")
            WizardSectionCard {
                AgentSport.entries.forEach { sport ->
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            sports = if (sports.contains(sport)) {
                                if (sports.size > 1) sports - sport else sports
                            } else sports + sport
                            hasChanges = true
                        }.padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(sport.iconVector(), contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.width(24.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(sport.label, color = AppColors.appTextPrimary, fontSize = 16.sp)
                        Spacer(Modifier.weight(1f))
                        if (sports.contains(sport)) Icon(agentSymbol("checkmark"), contentDescription = null, tint = AppColors.brandGreenBright, modifier = Modifier.size(14.dp))
                    }
                }
            }
            WizardSectionFooter("Pick at least one sport this agent should cover.")

            // Core Personality
            WizardSectionHeader("Core Personality")
            WizardSectionCard {
                SliderInput(personality.riskTolerance, { mutatePersonality { p -> p.copy(riskTolerance = it) } }, "Risk Tolerance", riskLabels, description = "How much risk is your agent willing to take?")
                SliderInput(personality.underdogLean, { mutatePersonality { p -> p.copy(underdogLean = it) } }, "Underdog Lean", underdogLabels, description = "Does your agent prefer favorites or underdogs?")
                SliderInput(personality.overUnderLean, { mutatePersonality { p -> p.copy(overUnderLean = it) } }, "Over/Under Lean", overUnderLabels, description = "Does your agent lean towards overs or unders on totals?")
                SliderInput(personality.confidenceThreshold, { mutatePersonality { p -> p.copy(confidenceThreshold = it) } }, "Confidence Threshold", confidenceLabels, description = "How confident should your agent be before making a pick?")
                ToggleInput(personality.chaseValue, { mutatePersonality { p -> p.copy(chaseValue = it) } }, "Chase Value", description = "Seek out bets where odds exceed model probability (positive expected value)")
                SliderInput(personality.parlayAppetite, { mutatePersonality { p -> p.copy(parlayAppetite = it) } }, "Parlay Appetite", parlayLabels, description = "Can your agent combine its best plays into multi-leg parlays?")
                ToggleInput(personality.parlaysOnly, { mutatePersonality { p -> p.copy(parlaysOnly = it) } }, "Parlays Only", description = "Force every play into multi-leg parlay tickets — the agent never submits straight picks")
            }

            // Bet Selection
            WizardSectionHeader("Bet Selection")
            WizardSectionCard {
                Text("Preferred Bet Type", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                SegmentedBetType(personality.preferredBetType) { mutatePersonality { p -> p.copy(preferredBetType = it) } }
                Spacer(Modifier.height(8.dp))
                SliderInput(personality.maxPicksPerDay, { mutatePersonality { p -> p.copy(maxPicksPerDay = it) } }, "Max Picks Per Day", maxPicksLabels, description = "Maximum number of picks your agent will make on any given day")
                ToggleInput(personality.skipWeakSlates, { mutatePersonality { p -> p.copy(skipWeakSlates = it) } }, "Skip Weak Slates", description = "Pass on days with few games or poor betting opportunities")
            }

            // Data Trust
            WizardSectionHeader("Data Trust")
            WizardSectionCard {
                SliderInput(personality.trustModel, { mutatePersonality { p -> p.copy(trustModel = it) } }, "Trust WagerProof Model", trustLabels, description = "How much weight to give our predictive model's probabilities")
                SliderInput(personality.trustPolymarket, { mutatePersonality { p -> p.copy(trustPolymarket = it) } }, "Trust Polymarket", trustLabels, description = "How much weight to give Polymarket prediction market odds")
                ToggleInput(personality.polymarketDivergenceFlag, { mutatePersonality { p -> p.copy(polymarketDivergenceFlag = it) } }, "Polymarket Divergence Flag", description = "Flag games where Polymarket significantly differs from Vegas lines")
            }

            // Odds Limits
            WizardSectionHeader("Odds Limits")
            WizardSectionCard {
                OddsInput(personality.maxFavoriteOdds, { mutatePersonality { p -> p.copy(maxFavoriteOdds = it) } }, "Max Favorite Odds", OddsInputType.FAVORITE)
                OddsInput(personality.minUnderdogOdds, { mutatePersonality { p -> p.copy(minUnderdogOdds = it) } }, "Min Underdog Odds", OddsInputType.UNDERDOG)
            }

            // Conditional: Football
            if (hasFootball) {
                WizardSectionHeader("Football Settings")
                WizardSectionCard {
                    ToggleInput((personality.fadePublic ?: false), { mutatePersonality { p -> p.copy(fadePublic = it) } }, "Fade the Public", description = "Bet against heavy public action on one side")
                    if (personality.fadePublic == true) {
                        SliderInput(personality.publicThreshold ?: 3, { mutatePersonality { p -> p.copy(publicThreshold = it) } }, "Public Threshold", publicThresholdLabels, description = "Percentage of public bets required to trigger a fade")
                    }
                    ToggleInput((personality.weatherImpactsTotals ?: false), { mutatePersonality { p -> p.copy(weatherImpactsTotals = it) } }, "Weather Impacts Totals", description = "Factor in weather conditions for total bets (wind, rain, snow)")
                    if (personality.weatherImpactsTotals == true) {
                        SliderInput(personality.weatherSensitivity ?: 3, { mutatePersonality { p -> p.copy(weatherSensitivity = it) } }, "Weather Sensitivity", sensitivityLabels, description = "How aggressively to adjust for weather conditions")
                    }
                }
                WizardSectionFooter("Football-specific betting conditions")
            }

            // Conditional: Basketball
            if (hasBasketball) {
                WizardSectionHeader("Basketball Settings")
                WizardSectionCard {
                    SliderInput(personality.trustTeamRatings ?: 3, { mutatePersonality { p -> p.copy(trustTeamRatings = it) } }, "Trust Team Ratings", trustLabels, description = "How much to trust advanced team ratings (e.g., NET, KenPom)")
                    ToggleInput((personality.paceAffectsTotals ?: false), { mutatePersonality { p -> p.copy(paceAffectsTotals = it) } }, "Pace Affects Totals", description = "Factor team pace into over/under decisions")
                    ToggleInput((personality.fadeBackToBacks ?: false), { mutatePersonality { p -> p.copy(fadeBackToBacks = it) } }, "Fade Back-to-Backs", description = "Bet against teams playing on consecutive days")
                }
                WizardSectionFooter("Basketball-specific betting conditions")
            }

            // Conditional: NBA Trends
            if (hasNBA) {
                WizardSectionHeader("NBA Trends")
                WizardSectionCard {
                    SliderInput(personality.weightRecentForm ?: 3, { mutatePersonality { p -> p.copy(weightRecentForm = it) } }, "Weight Recent Form", recentFormLabels, description = "How much to weigh a team's last 10 games vs. season averages")
                    ToggleInput((personality.rideHotStreaks ?: false), { mutatePersonality { p -> p.copy(rideHotStreaks = it) } }, "Ride Hot Streaks", description = "Bet on teams that are winning consistently")
                    ToggleInput((personality.fadeColdStreaks ?: false), { mutatePersonality { p -> p.copy(fadeColdStreaks = it) } }, "Fade Cold Streaks", description = "Bet against teams that are losing consistently")
                    ToggleInput((personality.trustAtsTrends ?: false), { mutatePersonality { p -> p.copy(trustAtsTrends = it) } }, "Trust ATS Trends", description = "Factor in against-the-spread performance trends")
                    ToggleInput((personality.regressLuck ?: false), { mutatePersonality { p -> p.copy(regressLuck = it) } }, "Regress Luck", description = "Expect teams on hot/cold streaks to regress to the mean")
                }
                WizardSectionFooter("NBA-specific trend and streak analysis")
            }

            // Situational (always)
            WizardSectionHeader("Situational Factors")
            WizardSectionCard {
                SliderInput(personality.homeCourtBoost, { mutatePersonality { p -> p.copy(homeCourtBoost = it) } }, "Home Court/Field Boost", homeBoostLabels, description = "How much extra weight to give home teams")
                if (hasNCAAB) {
                    ToggleInput((personality.upsetAlert ?: false), { mutatePersonality { p -> p.copy(upsetAlert = it) } }, "Upset Alert", description = "Flag potential March Madness upsets based on tournament trends")
                }
            }
            WizardSectionFooter("Game situation adjustments")

            // Custom Insights
            InsightSection("Betting Philosophy", "book.fill", customInsights.bettingPhilosophy ?: "", 500, "Describe your overall approach to betting.") {
                customInsights = customInsights.copy(bettingPhilosophy = it.ifEmpty { null }); hasChanges = true
            }
            InsightSection("Perceived Edges", "chart.line.uptrend.xyaxis", customInsights.perceivedEdges ?: "", 500, "What unique insights or edges do you think you have?") {
                customInsights = customInsights.copy(perceivedEdges = it.ifEmpty { null }); hasChanges = true
            }
            InsightSection("Situations to Avoid", "xmark.octagon", customInsights.avoidSituations ?: "", 300, "What types of games or situations should your agent avoid?") {
                customInsights = customInsights.copy(avoidSituations = it.ifEmpty { null }); hasChanges = true
            }
            InsightSection("Target Situations", "target", customInsights.targetSituations ?: "", 300, "What types of games or situations should your agent prioritize?") {
                customInsights = customInsights.copy(targetSituations = it.ifEmpty { null }); hasChanges = true
            }

            // Autopilot
            WizardSectionHeader("Autopilot")
            WizardSectionCard {
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Auto-generate picks", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    Switch(
                        checked = autoGenerate,
                        enabled = entitlements.canUseAutopilot,
                        onCheckedChange = { checked ->
                            if (!entitlements.canUseAutopilot && checked) {
                                errorMessage = "Upgrade to Pro to enable autopilot."
                            } else {
                                autoGenerate = checked; hasChanges = true
                            }
                        },
                        colors = SwitchDefaults.colors(checkedTrackColor = AppColors.brandGreenBright, checkedThumbColor = Color.White),
                    )
                }
                if (autoGenerate) {
                    Row(
                        Modifier.fillMaxWidth().clickable { showTimePicker = true }.padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Preferred time", color = AppColors.appTextPrimary, fontSize = 16.sp)
                        Spacer(Modifier.weight(1f))
                        Text("$autoGenerateTime ${tzAbbr(autoGenerateTimezone)}", color = AppColors.appPrimary, fontSize = 14.sp)
                        Spacer(Modifier.width(6.dp))
                        Icon(agentSymbol("chevron.right"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp))
                    }
                }
            }
            WizardSectionFooter(
                if (entitlements.canUseAutopilot) "When on, the agent will analyze games and generate picks daily."
                else "Pro subscribers get daily auto-generation. Free users can still manually generate.",
            )

            // Visibility
            WizardSectionHeader("Visibility")
            WizardSectionCard {
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Public agent", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    Switch(
                        checked = isPublic,
                        enabled = entitlements.canCreatePublicAgent,
                        onCheckedChange = { checked ->
                            if (!entitlements.canCreatePublicAgent && checked) {
                                errorMessage = "Only Pro users can make agents public."
                            } else {
                                isPublic = checked; hasChanges = true
                            }
                        },
                        colors = SwitchDefaults.colors(checkedTrackColor = AppColors.brandGreenBright, checkedThumbColor = Color.White),
                    )
                }
            }
            WizardSectionFooter("Public agents appear on the leaderboard. Pick history and performance become visible.")

            // Danger Zone
            WizardSectionHeader("Danger Zone")
            WizardSectionCard {
                Row(
                    Modifier.fillMaxWidth().clickable { deleteConfirm = true }.padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(agentSymbol("trash"), contentDescription = null, tint = AppColors.appLoss, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Delete Agent", color = AppColors.appLoss, fontSize = 16.sp)
                }
            }
            WizardSectionFooter("Deleting is permanent. Picks and performance history are lost.")

            Spacer(Modifier.height(48.dp))
        }
    }

    if (showTimePicker) {
        TimePickerModal(
            time = autoGenerateTime,
            timezone = autoGenerateTimezone,
            onConfirm = { t, tz -> autoGenerateTime = t; autoGenerateTimezone = tz; hasChanges = true; showTimePicker = false },
            onDismiss = { showTimePicker = false },
        )
    }

    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text("Delete Agent?") },
            text = { Text("Are you sure you want to delete \"$name\"? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteConfirm = false
                    scope.launch { if (store.delete()) nav.popAgents() }
                }) { Text("Delete", color = AppColors.appLoss) }
            },
            dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Cancel") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    errorMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { errorMessage = null },
            title = { Text("Error") },
            text = { Text(msg) },
            confirmButton = { TextButton(onClick = { errorMessage = null }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}

@Composable
private fun SegmentedBetType(selected: String, onSelect: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(AppColors.appBorder.copy(alpha = 0.35f), RoundedCornerShape(8.dp)).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        betTypes.forEach { (value, label) ->
            val active = value == selected
            Box(
                Modifier
                    .weight(1f)
                    .background(if (active) AppColors.appPrimary else Color.Transparent, RoundedCornerShape(6.dp))
                    .clickable { onSelect(value) }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, color = if (active) Color.Black else AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun InsightSection(title: String, icon: String, value: String, maxLength: Int, description: String, onValueChange: (String) -> Unit) {
    val filled = value.isNotEmpty()
    val overLimit = value.length > maxLength
    Row(Modifier.fillMaxWidth().padding(start = 4.dp, top = 20.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(agentSymbol(icon), contentDescription = null, tint = if (filled) AppColors.brandGreenBright else AppColors.appTextSecondary, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(6.dp))
        Text(title, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        if (filled) {
            Spacer(Modifier.width(6.dp))
            Text(
                "Filled",
                color = AppColors.brandGreenBright,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.background(AppColors.brandGreenBright.copy(alpha = 0.18f), RoundedCornerShape(50)).padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
    }
    WizardSectionCard {
        SettingsTextField(value = value, onValueChange = onValueChange, placeholder = "Add your notes…", singleLine = false)
    }
    Row(Modifier.fillMaxWidth().padding(start = 4.dp, top = 6.dp)) {
        Text(description, color = AppColors.appTextSecondary, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Text("${value.length}/$maxLength", color = if (overLimit) AppColors.appAccentRed else AppColors.appTextSecondary, fontSize = 11.sp)
    }
}

@Composable
private fun SettingsTextField(value: String, onValueChange: (String) -> Unit, placeholder: String, singleLine: Boolean) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = AppColors.appTextSecondary) },
        singleLine = singleLine,
        modifier = Modifier.fillMaxWidth(),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Color.Transparent,
            unfocusedContainerColor = Color.Transparent,
            focusedTextColor = AppColors.appTextPrimary,
            unfocusedTextColor = AppColors.appTextPrimary,
            focusedIndicatorColor = AppColors.appPrimary,
            unfocusedIndicatorColor = AppColors.appBorder,
            cursorColor = AppColors.appPrimary,
        ),
    )
}

private fun tzAbbr(tz: String): String = when {
    tz.contains("New_York") -> "ET"
    tz.contains("Chicago") -> "CT"
    tz.contains("Denver") -> "MT"
    tz.contains("Los_Angeles") -> "PT"
    else -> tz
}
