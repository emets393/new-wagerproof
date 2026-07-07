package com.wagerproof.app.features.onboarding.pages

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.unit.dp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.OnboardingChip
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.pageEntrance

/**
 * Page 2 — multi-select sports chips. Port of iOS `OnboardingSportsPage.swift`.
 * Labels are the exact strings persisted to `profiles.onboarding_data`
 * (`favoriteSports`) — do not rename without a data migration.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingSportsPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val haptics = LocalHapticFeedback.current

    OnboardingPageScaffold(
        title = "Which sports do you follow most?",
        subtitle = "You can change this later in Settings.",
        modifier = modifier,
    ) {
        FlowRow(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            maxItemsInEachRow = 2,
        ) {
            sports.forEachIndexed { index, sport ->
                OnboardingChip(
                    label = sport.label,
                    icon = sport.icon,
                    isSelected = store.survey.favoriteSports.contains(sport.label),
                    modifier = Modifier.weight(1f).pageEntrance(2 + index),
                ) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    store.toggleFavoriteSport(sport.label)
                }
            }
        }
    }
}

private class SportOption(val label: String, val icon: String)

private val sports = listOf(
    SportOption("NFL", "football.fill"),
    SportOption("College Football", "football"),
    SportOption("NBA", "basketball.fill"),
    SportOption("MLB", "baseball.fill"),
    SportOption("NCAAB", "basketball"),
    SportOption("Soccer", "soccerball"),
    SportOption("Other", "sparkles"),
)
