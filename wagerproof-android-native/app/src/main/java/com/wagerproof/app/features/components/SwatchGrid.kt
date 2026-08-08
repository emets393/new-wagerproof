package com.wagerproof.app.features.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Fixed-column grid of equally spaced swatches — the agent colour pickers in
 * onboarding / the in-app builder and in Agent Settings.
 *
 * Both used to be a `FlowRow`, which is the wrong primitive here. FlowRow packs
 * as many fixed-width children per line as happen to fit the measured width, so
 * the column count changes with screen size and the last line is left-aligned
 * and ragged — ten 40dp swatches land 6+4 on one device and 7+3 on another.
 * Onboarding papered over it with a hard-coded 228dp container, which pinned the
 * grid to four columns but left it as a narrow island floating in the middle of
 * a much wider screen.
 *
 * Here the row width is divided into [columns] equal cells and each swatch is
 * centred in its cell, so column pitch is identical on every device and the grid
 * spans the width it is given. A short final row is padded with empty cells, so
 * its swatches stay in the same columns as the rows above rather than
 * re-centring — that re-centring is what reads as "uneven".
 *
 * Pick a [columns] value that divides the item count (16 → 4, 10 → 5) and every
 * row is full.
 */
@Composable
fun <T> SwatchGrid(
    items: List<T>,
    columns: Int,
    modifier: Modifier = Modifier,
    verticalSpacing: Dp = 12.dp,
    swatch: @Composable (T) -> Unit,
) {
    if (items.isEmpty() || columns <= 0) return
    Column(
        modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(verticalSpacing),
    ) {
        items.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                row.forEach { item ->
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { swatch(item) }
                }
                // Keep a short last row column-aligned with the full rows above.
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}
