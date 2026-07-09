package com.wagerproof.core.design.tokens

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.unit.dp

/**
 * Shared structural metrics used by root pages and presentation chrome.
 * These mirror SwiftUI's 16pt content gutter, 44pt navigation controls,
 * compact tab content, and the card/sheet padding used across iOS.
 */
object AppLayout {
    val screenHorizontalPadding = 16.dp
    val compactHorizontalPadding = 12.dp
    val cardContentPadding = 16.dp
    val sheetContentPadding = 16.dp
    val topBarContentHeight = 44.dp
    val bottomBarContentHeight = 52.dp
    val sheetDragHandleWidth = 36.dp
    val sheetDragHandleHeight = 5.dp
    val cardBorderWidth = 1.dp
    val flatElevation = 0.dp

    val screenPadding = PaddingValues(horizontal = screenHorizontalPadding)
    val cardPadding = PaddingValues(cardContentPadding)
    val sheetPadding = PaddingValues(
        start = sheetContentPadding,
        top = Spacing.sm,
        end = sheetContentPadding,
        bottom = Spacing.xl,
    )
}
