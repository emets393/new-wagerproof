package com.wagerproof.app.features.agents.creation.inputs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors

/** Whether the input governs a favorite floor or an underdog floor. */
enum class OddsInputType { FAVORITE, UNDERDOG }

/**
 * American-odds floor/ceiling input for Step 4's "Odds Limits". Port of iOS
 * `OddsInput`.
 *   - FAVORITE → valid -500..-100 (e.g. "-200")
 *   - UNDERDOG → valid +100..+500 (e.g. "+150")
 *   - "No limit" chip toggles between an active value and null.
 *   - Value is clamped to the valid range on blur (focus loss).
 */
@Composable
fun OddsInput(
    value: Int?,
    onValueChange: (Int?) -> Unit,
    label: String,
    type: OddsInputType,
    modifier: Modifier = Modifier,
) {
    val isFavorite = type == OddsInputType.FAVORITE
    val minValue = if (isFavorite) -500 else 100
    val maxValue = if (isFavorite) -100 else 500
    val placeholder = if (isFavorite) "-200" else "+150"
    val helperText = if (isFavorite)
        "Skip heavier favorites once the price gets too steep."
    else
        "Only allow plus-money dogs that clear your floor."

    val isNoLimit = value == null

    fun formatOdds(odds: Int): String = if (odds >= 0) "+$odds" else "$odds"
    fun parseOdds(raw: String): Int? {
        val str = raw.filter { it.isDigit() || it == '-' }
        return if (str.isEmpty() || str == "-") null else str.toIntOrNull()
    }
    fun validate(odds: Int?): String? {
        if (odds == null) return null
        return if (isFavorite) {
            when {
                odds > -100 -> "Favorite odds must be -100 or lower"
                odds < -500 -> "Favorite odds cannot be lower than -500"
                else -> null
            }
        } else {
            when {
                odds < 100 -> "Underdog odds must be +100 or higher"
                odds > 500 -> "Underdog odds cannot exceed +500"
                else -> null
            }
        }
    }

    var text by remember { mutableStateOf(value?.let { formatOdds(it) } ?: "") }
    var validationError by remember { mutableStateOf<String?>(null) }
    var isFocused by remember { mutableStateOf(false) }

    // External writes (preset apply, etc.) re-sync the text when not focused.
    LaunchedEffect(value) {
        if (!isFocused) text = value?.let { formatOdds(it) } ?: ""
    }

    Column(modifier = modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label,
                    color = AppColors.appTextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = helperText,
                    color = AppColors.appTextSecondary,
                    fontSize = 12.sp,
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = if (isNoLimit) "No limit" else formatOdds(value ?: 0),
                color = if (isNoLimit) AppColors.appTextSecondary else Color(0xFFBFDBFE),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .background(
                        color = if (isNoLimit) AppColors.appBorder.copy(alpha = 0.5f)
                        else AppColors.appAccentBlue.copy(alpha = 0.22f),
                        shape = RoundedCornerShape(50),
                    )
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }

        Spacer(Modifier.width(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            val borderColor = if (validationError != null) AppColors.appAccentRed else AppColors.appBorder
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(AppColors.appBorder.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    .border(1.dp, borderColor, RoundedCornerShape(12.dp))
                    .padding(vertical = 12.dp, horizontal = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (text.isEmpty()) {
                    Text(
                        text = placeholder,
                        color = AppColors.appTextSecondary.copy(alpha = if (isNoLimit) 0.5f else 1f),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                }
                BasicTextField(
                    value = text,
                    onValueChange = { newText ->
                        text = newText
                        val parsed = parseOdds(newText)
                        validationError = validate(parsed)
                        if (validationError == null && parsed != null) onValueChange(parsed)
                    },
                    enabled = !isNoLimit,
                    singleLine = true,
                    textStyle = TextStyle(
                        color = AppColors.appTextPrimary.copy(alpha = if (isNoLimit) 0.5f else 1f),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    ),
                    cursorBrush = SolidColor(AppColors.appPrimary),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged { state ->
                            if (isFocused && !state.isFocused) {
                                // Blur: clamp a parseable value into range, else resync.
                                if (text.isNotEmpty()) {
                                    val parsed = parseOdds(text)
                                    if (parsed == null) {
                                        text = value?.let { formatOdds(it) } ?: ""
                                    } else {
                                        val cl = parsed.coerceIn(minValue, maxValue)
                                        onValueChange(cl)
                                        text = formatOdds(cl)
                                        validationError = null
                                    }
                                }
                            }
                            isFocused = state.isFocused
                        },
                )
            }

            Spacer(Modifier.width(12.dp))

            val noLimitFg = if (isNoLimit) AppColors.brandGreenBright else AppColors.appTextSecondary
            Text(
                text = "No limit",
                color = noLimitFg,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .background(
                        color = if (isNoLimit) AppColors.brandGreenBright.copy(alpha = 0.15f) else Color.Transparent,
                        shape = RoundedCornerShape(50),
                    )
                    .border(
                        1.dp,
                        if (isNoLimit) AppColors.brandGreenBright else AppColors.appBorder,
                        RoundedCornerShape(50),
                    )
                    .clickableNoRipple {
                        if (value == null) {
                            val next = if (isFavorite) -200 else 150
                            onValueChange(next)
                            text = formatOdds(next)
                        } else {
                            onValueChange(null)
                            text = ""
                        }
                        validationError = null
                    }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }

        validationError?.let { err ->
            Text(
                text = err,
                color = AppColors.appAccentRed,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
