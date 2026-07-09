package com.wagerproof.app.features.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/** App-local equivalent of SwiftUI `List(.insetGrouped)` / `Section`. */
@Composable
fun InsetGroupedSection(
    title: String? = null,
    footer: String? = null,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier.fillMaxWidth()) {
        title?.let {
            Text(
                it.uppercase(),
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 0.45.sp,
                modifier = Modifier.padding(start = 4.dp, top = 18.dp, bottom = 7.dp),
            )
        }
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(11.dp))
                .background(AppColors.appSurfaceElevated)
                .border(1.dp, AppColors.appBorder.copy(alpha = 0.52f), RoundedCornerShape(11.dp))
                .padding(horizontal = 14.dp, vertical = 3.dp),
            content = content,
        )
        footer?.let {
            Text(
                it,
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                modifier = Modifier.padding(start = 4.dp, top = 7.dp),
            )
        }
    }
}

@Composable
fun InsetGroupedDivider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder.copy(alpha = 0.55f)))
}

@Composable
fun SheetSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        shape = RoundedCornerShape(11.dp),
        leadingIcon = { Icon(AppIcon.MAGNIFYINGGLASS.imageVector, null, tint = AppColors.appTextSecondary) },
        placeholder = { Text(placeholder, color = AppColors.appTextMuted) },
        modifier = modifier.fillMaxWidth(),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = AppColors.appSurfaceMuted,
            unfocusedContainerColor = AppColors.appSurfaceMuted,
            focusedTextColor = AppColors.appTextPrimary,
            unfocusedTextColor = AppColors.appTextPrimary,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            cursorColor = AppColors.appPrimary,
        ),
    )
}
