package com.wagerproof.app.features.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * The floating "Quick Filter" capsule that heads the Games, Props and Outliers
 * Trends feeds. Port of the field iOS duplicates across
 * `GamesView.quickFilterField`, `PropsView.quickFilterBar` and
 * `OutliersTrendsView.quickFilterBar` — those three are identical apart from
 * their accessibility label, so Android keeps ONE copy: all three pinned
 * headers must share the exact same seam and 44dp height or they stop lining
 * up with the icon controls beside them.
 *
 * [BasicTextField] rather than Material's `TextField`, which reserves a 56dp
 * minimum height for its floating label and would make the capsule taller than
 * the sibling controls.
 *
 * Owns no state: the caller holds the query (per-sport in
 * `GamesStore.searchTexts` for Games, screen-local elsewhere) and is
 * responsible for trimming it before filtering.
 */
@Composable
fun QuickFilterField(
    value: String,
    onValueChange: (String) -> Unit,
    accessibilityLabel: String,
    modifier: Modifier = Modifier,
    placeholder: String = "Quick Filter",
) {
    var focused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val clearInteraction = remember { MutableInteractionSource() }
    val selectionColors = TextSelectionColors(
        handleColor = AppColors.appPrimary,
        backgroundColor = AppColors.appPrimary.copy(alpha = 0.3f),
    )

    Row(
        modifier
            .height(44.dp)
            .liquidGlassCapsule(null)
            .padding(start = 12.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Icon(
            AppIcon.MAGNIFYINGGLASS.imageVector,
            contentDescription = null,
            tint = if (focused) AppColors.appPrimary else AppColors.appTextMuted,
            modifier = Modifier.size(17.dp),
        )
        CompositionLocalProvider(LocalTextSelectionColors provides selectionColors) {
            BasicTextField(
                value = value,
                // Newlines can arrive by paste even on a single-line field and
                // would break the one-line capsule layout.
                onValueChange = { onValueChange(it.replace('\n', ' ')) },
                modifier = Modifier
                    .weight(1f)
                    .onFocusChanged { focused = it.isFocused }
                    .semantics { contentDescription = accessibilityLabel },
                singleLine = true,
                textStyle = TextStyle(
                    color = AppColors.appTextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                ),
                keyboardOptions = KeyboardOptions(
                    // Matches iOS's .textInputAutocapitalization(.never) +
                    // .autocorrectionDisabled() — team abbreviations and player
                    // surnames get mangled by both.
                    capitalization = KeyboardCapitalization.None,
                    autoCorrectEnabled = false,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                cursorBrush = SolidColor(AppColors.appPrimary),
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty()) {
                            Text(
                                placeholder,
                                color = AppColors.appTextMuted,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        inner()
                    }
                },
            )
        }
        if (value.isNotEmpty()) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(
                        interactionSource = clearInteraction,
                        indication = null,
                        onClick = { onValueChange("") },
                    )
                    .semantics { contentDescription = "Clear quick filter" },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    AppIcon.XMARK_CIRCLE_FILL.imageVector,
                    contentDescription = null,
                    tint = AppColors.appTextMuted,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

/**
 * Empty state shown when a Quick Filter query excludes everything on the board.
 * Mirrors iOS's `ContentUnavailableView` + "Clear Quick Filter" action so the
 * user is never stranded on a blank feed with no way back.
 */
@Composable
fun QuickFilterEmptyState(
    title: String,
    message: String,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val clearInteraction = remember { MutableInteractionSource() }
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            AppIcon.MAGNIFYINGGLASS.imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(34.dp),
        )
        Text(title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        Text(
            "Clear Quick Filter",
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .padding(top = 4.dp)
                .clip(CircleShape)
                .background(AppColors.appPrimary)
                .clickable(interactionSource = clearInteraction, indication = null, onClick = onClear)
                .padding(horizontal = 18.dp, vertical = 9.dp),
        )
    }
}
