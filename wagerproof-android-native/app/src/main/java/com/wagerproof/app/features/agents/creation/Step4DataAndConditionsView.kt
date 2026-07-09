package com.wagerproof.app.features.agents.creation

import androidx.compose.foundation.background
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.creation.inputs.OddsInput
import com.wagerproof.app.features.agents.creation.inputs.OddsInputType
import com.wagerproof.app.features.agents.creation.inputs.SliderInput
import com.wagerproof.app.features.agents.creation.inputs.ToggleInput
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.stores.AgentCreationStore

/** Step 4: data trust, price limits, and sport-conditional rules. */
@Composable
fun Step4DataAndConditionsView(store: AgentCreationStore, modifier: Modifier = Modifier) {
    val p = store.draft.personalityParams
    val sports = store.draft.preferredSports
    val football = AgentSport.NFL in sports || AgentSport.CFB in sports
    val basketball = AgentSport.NBA in sports || AgentSport.NCAAB in sports
    val nba = AgentSport.NBA in sports
    val ncaab = AgentSport.NCAAB in sports

    fun update(next: AgentPersonalityParams) {
        store.draft = store.draft.copy(personalityParams = next)
    }

    Column(
        modifier.fillMaxWidth().background(AppColors.appSurface).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        WizardIntro("DATA CONTROLS", "Choose the signals this agent should trust most.", "Keep the defaults lightweight, then layer in sport-specific rules only where they help.")

        WizardSectionHeader("DATA TRUST")
        WizardSectionCard {
            SliderInput(p.trustModel, { update(p.copy(trustModel = it)) }, "Trust WagerProof Model", trustLabels, description = "Weight given to our predictive probabilities")
            GroupedFormDivider()
            SliderInput(p.trustPolymarket, { update(p.copy(trustPolymarket = it)) }, "Trust Polymarket", trustLabels, description = "Weight given to prediction-market odds")
            GroupedFormDivider()
            ToggleInput(p.polymarketDivergenceFlag, { update(p.copy(polymarketDivergenceFlag = it)) }, "Polymarket Divergence Flag", description = "Flag games where Polymarket differs from Vegas")
        }

        WizardSectionHeader("ODDS LIMITS")
        WizardSectionCard {
            OddsInput(p.maxFavoriteOdds, { update(p.copy(maxFavoriteOdds = it)) }, "Max Favorite Odds", OddsInputType.FAVORITE)
            GroupedFormDivider()
            OddsInput(p.minUnderdogOdds, { update(p.copy(minUnderdogOdds = it)) }, "Min Underdog Odds", OddsInputType.UNDERDOG)
        }

        if (football) {
            WizardSectionHeader("FOOTBALL SETTINGS")
            SportTags(sports.filter { it == AgentSport.NFL || it == AgentSport.CFB })
            WizardSectionCard {
                ToggleInput(p.fadePublic ?: false, { update(p.copy(fadePublic = it)) }, "Fade the Public", description = "Bet against heavy public action on one side")
                if (p.fadePublic == true) { GroupedFormDivider(); SliderInput(p.publicThreshold ?: 3, { update(p.copy(publicThreshold = it)) }, "Public Threshold", publicThresholdLabels, description = "Public bets required to trigger a fade") }
                GroupedFormDivider()
                ToggleInput(p.weatherImpactsTotals ?: false, { update(p.copy(weatherImpactsTotals = it)) }, "Weather Impacts Totals", description = "Factor wind, rain, and snow into totals")
                if (p.weatherImpactsTotals == true) { GroupedFormDivider(); SliderInput(p.weatherSensitivity ?: 3, { update(p.copy(weatherSensitivity = it)) }, "Weather Sensitivity", sensitivityLabels, description = "How aggressively to adjust for weather") }
            }
            WizardSectionFooter("Football-specific betting conditions")
        }

        if (basketball) {
            WizardSectionHeader("BASKETBALL SETTINGS")
            SportTags(sports.filter { it == AgentSport.NBA || it == AgentSport.NCAAB })
            WizardSectionCard {
                SliderInput(p.trustTeamRatings ?: 3, { update(p.copy(trustTeamRatings = it)) }, "Trust Team Ratings", trustLabels, description = "Weight advanced ratings like NET and KenPom")
                GroupedFormDivider()
                ToggleInput(p.paceAffectsTotals ?: false, { update(p.copy(paceAffectsTotals = it)) }, "Pace Affects Totals", description = "Factor team pace into over/under decisions")
                GroupedFormDivider()
                ToggleInput(p.fadeBackToBacks ?: false, { update(p.copy(fadeBackToBacks = it)) }, "Fade Back-to-Backs", description = "Bet against teams playing consecutive days")
            }
            WizardSectionFooter("Basketball-specific betting conditions")
        }

        if (nba) {
            WizardSectionHeader("NBA TRENDS")
            SportTags(listOf(AgentSport.NBA))
            WizardSectionCard {
                SliderInput(p.weightRecentForm ?: 3, { update(p.copy(weightRecentForm = it)) }, "Weight Recent Form", recentFormLabels, description = "Last 10 games versus season averages")
                GroupedFormDivider()
                ToggleInput(p.rideHotStreaks ?: false, { update(p.copy(rideHotStreaks = it)) }, "Ride Hot Streaks", description = "Back consistently winning teams")
                GroupedFormDivider()
                ToggleInput(p.fadeColdStreaks ?: false, { update(p.copy(fadeColdStreaks = it)) }, "Fade Cold Streaks", description = "Bet against consistently losing teams")
                GroupedFormDivider()
                ToggleInput(p.trustAtsTrends ?: false, { update(p.copy(trustAtsTrends = it)) }, "Trust ATS Trends", description = "Use against-the-spread performance")
                GroupedFormDivider()
                ToggleInput(p.regressLuck ?: false, { update(p.copy(regressLuck = it)) }, "Regress Luck", description = "Expect hot and cold streaks to normalize")
            }
        }

        WizardSectionHeader("SITUATIONAL FACTORS")
        WizardSectionCard {
            SliderInput(p.homeCourtBoost, { update(p.copy(homeCourtBoost = it)) }, "Home Court/Field Boost", homeBoostLabels, description = "Extra weight given to home teams")
            if (ncaab) { GroupedFormDivider(); ToggleInput(p.upsetAlert ?: false, { update(p.copy(upsetAlert = it)) }, "Upset Alert", description = "Flag potential tournament upsets") }
        }
        WizardSectionFooter("Game situation adjustments")
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SportTags(sports: List<AgentSport>) {
    Row(Modifier.fillMaxWidth().padding(start = 4.dp, bottom = 7.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        sports.forEach { sport ->
            Text(
                sport.label,
                color = AppColors.appTextPrimary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.background(AppColors.appPrimary.copy(alpha = 0.16f), RoundedCornerShape(5.dp)).padding(horizontal = 7.dp, vertical = 4.dp),
            )
        }
    }
}

private val trustLabels = listOf("Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust")
private val sensitivityLabels = listOf("Minimal", "Low", "Moderate", "High", "Maximum")
private val publicThresholdLabels = listOf("55%", "60%", "65%", "70%", "75%")
private val homeBoostLabels = listOf("Ignore", "Slight", "Moderate", "Strong", "Maximum")
private val recentFormLabels = listOf("Ignore", "Light", "Moderate", "Heavy", "Primary")
