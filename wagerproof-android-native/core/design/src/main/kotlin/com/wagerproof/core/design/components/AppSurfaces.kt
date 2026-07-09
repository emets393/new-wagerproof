package com.wagerproof.core.design.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppLayout
import com.wagerproof.core.design.tokens.CornerRadius

/**
 * Canonical WagerProof card surface: elevated dark paper, 14pt continuous
 * radius, and the quiet 1px border used by the iOS cards.
 */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    containerColor: Color = AppColors.appSurfaceElevated,
    borderColor: Color = AppColors.appBorder,
    contentPadding: PaddingValues = AppLayout.cardPadding,
    content: @Composable BoxScope.() -> Unit,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(CornerRadius.lg),
        color = containerColor,
        contentColor = AppColors.appTextPrimary,
        border = BorderStroke(width = AppLayout.cardBorderWidth, color = borderColor),
        tonalElevation = AppLayout.flatElevation,
        shadowElevation = AppLayout.flatElevation,
    ) {
        Box(
            modifier = Modifier.padding(contentPadding),
            content = content,
        )
    }
}

/**
 * Shared iOS-style modal sheet shell. Individual screens own their content;
 * presentation shape, surface, scrim, elevation, and drag handle stay uniform.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppModalBottomSheet(
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    skipPartiallyExpanded: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = skipPartiallyExpanded,
    )
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        modifier = modifier,
        sheetState = sheetState,
        containerColor = AppColors.appSurfaceElevated,
        contentColor = AppColors.appTextPrimary,
        shape = RoundedCornerShape(
            topStart = CornerRadius.xl,
            topEnd = CornerRadius.xl,
        ),
        scrimColor = Color.Black.copy(alpha = 0.45f),
        tonalElevation = AppLayout.flatElevation,
        dragHandle = {
            BottomSheetDefaults.DragHandle(
                width = AppLayout.sheetDragHandleWidth,
                height = AppLayout.sheetDragHandleHeight,
                color = AppColors.appBorderStrong,
            )
        },
        content = content,
    )
}
