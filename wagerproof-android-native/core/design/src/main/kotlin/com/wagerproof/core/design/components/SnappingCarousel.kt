package com.wagerproof.core.design.components

import androidx.compose.foundation.gestures.FlingBehavior
import androidx.compose.foundation.gestures.snapping.SnapPosition
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback

/**
 * Snap-to-gutter paging + a haptic per card, for horizontal card rails. Port of
 * iOS `WagerproofDesign/Modifiers/SnappingCardCarousel.swift`.
 *
 * A plain [androidx.compose.foundation.lazy.LazyRow] stops wherever momentum
 * leaves it, usually with a card sliced by the screen edge and no clear "current"
 * card. This pins every resting position instead: each swipe pulls the next card
 * fully into view against the rail's leading gutter, with the following card
 * peeking behind it, and a light tick fires as each card lands.
 *
 * [SnapPosition.Start] rather than the default centre — the gutter IS the snap
 * target, which is the whole point on iOS. The rail's `contentPadding` is what
 * defines that gutter, so pass the inset there (as these rails already do) and
 * NOT as padding on the row itself; padding the row would snap cards flush
 * against the raw viewport edge instead.
 *
 * Apply the returned behavior as the rail's `flingBehavior`, passing the same
 * [state] the rail uses.
 */
@Composable
fun rememberSnappingCarousel(state: LazyListState): FlingBehavior {
    val haptics = LocalHapticFeedback.current

    // The leading visible item is the one resting on the gutter. Recomputed from
    // live layout rather than a scroll listener, so a fling across several cards
    // ticks once per card, like a picker's detents.
    val restingIndex by remember(state) {
        derivedStateOf { state.layoutInfo.visibleItemsInfo.firstOrNull()?.index }
    }
    var previous by remember(state) { mutableStateOf<Int?>(null) }

    LaunchedEffect(restingIndex) {
        val prior = previous
        previous = restingIndex
        // Skip null->first-card on layout and card->null when a filter empties
        // the rail — neither is a movement the user made (iOS guards the same
        // two transitions on its sensoryFeedback trigger).
        if (prior != null && restingIndex != null && prior != restingIndex) {
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        }
    }

    return rememberSnapFlingBehavior(lazyListState = state, snapPosition = SnapPosition.Start)
}
