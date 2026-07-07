package com.wagerproof.app.features.onboarding.pages

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.OnboardingChip
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.pageEntrance

/**
 * Page 6 — single-select "Where did you hear about us?". Port of iOS
 * `OnboardingAcquisitionPage.swift`. Values are the exact persisted strings.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingAcquisitionPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val haptics = LocalHapticFeedback.current

    OnboardingPageScaffold(title = "Where did you hear about us?", modifier = modifier) {
        FlowRow(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            maxItemsInEachRow = 2,
        ) {
            sources.forEachIndexed { index, source ->
                OnboardingChip(
                    label = source,
                    isSelected = store.survey.acquisitionSource == source,
                    modifier = Modifier.weight(1f).pageEntrance(2 + index),
                ) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    store.setAcquisitionSource(source)
                }
            }
        }
    }
}

private val sources = listOf("TikTok", "X/Twitter", "YouTube", "Google", "Friend/Referral", "Other")
