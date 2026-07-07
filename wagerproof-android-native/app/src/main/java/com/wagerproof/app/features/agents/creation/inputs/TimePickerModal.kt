package com.wagerproof.app.features.agents.creation.inputs

import android.widget.NumberPicker
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.wagerproof.core.design.tokens.AppColors

/**
 * US-timezone option used by the time + timezone pickers. Mirrors the RN
 * `US_TIMEZONES` constant / iOS `AgentTimezoneOption`.
 */
enum class AgentTimezoneOption(val value: String, val label: String) {
    EASTERN("America/New_York", "Eastern (ET)"),
    CENTRAL("America/Chicago", "Central (CT)"),
    MOUNTAIN("America/Denver", "Mountain (MT)"),
    PACIFIC("America/Los_Angeles", "Pacific (PT)"),
    ALASKA("America/Anchorage", "Alaska (AKT)"),
    HAWAII("Pacific/Honolulu", "Hawaii (HT)");

    companion object {
        val all: List<AgentTimezoneOption> = entries

        /** "Eastern (ET)" → "ET". Fallback "ET". */
        fun abbr(tz: String): String {
            val row = entries.firstOrNull { it.value == tz } ?: return "ET"
            val l = row.label.indexOf('(')
            val r = row.label.lastIndexOf(')')
            return if (l >= 0 && r > l) row.label.substring(l + 1, r) else "ET"
        }
    }
}

/**
 * Bottom-sheet for picking the autopilot generation time + timezone. Port of
 * iOS `TimePickerModal`.
 *
 * FIDELITY-WAIVER #079: RN's custom 5-minute-snap dual scroll wheels are
 * replaced with native `NumberPicker` wheels at 1-minute granularity (hour
 * 0..23, minute 0..59) plus a horizontal timezone chip row. Edits are staged
 * locally and written only on Confirm.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerModal(
    time: String,          // "HH:mm" 24-hour
    timezone: String,      // IANA name
    onConfirm: (time: String, timezone: String) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val (initHour, initMinute) = remember(time) {
        val comps = time.split(":")
        val h = comps.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 9
        val m = comps.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0
        h to m
    }

    var hour by remember { mutableIntStateOf(initHour) }
    var minute by remember { mutableIntStateOf(initMinute) }
    var localTimezone by remember { mutableStateOf(timezone) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurfaceElevated,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Text(
                text = "Time & Timezone",
                color = AppColors.appTextPrimary,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AndroidView(
                    factory = { ctx ->
                        NumberPicker(ctx).apply {
                            minValue = 0
                            maxValue = 23
                            value = initHour
                            setFormatter { String.format("%02d", it) }
                            setOnValueChangedListener { _, _, new -> hour = new }
                        }
                    },
                )
                Text(
                    text = ":",
                    color = AppColors.appTextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
                AndroidView(
                    factory = { ctx ->
                        NumberPicker(ctx).apply {
                            minValue = 0
                            maxValue = 59
                            value = initMinute
                            setFormatter { String.format("%02d", it) }
                            setOnValueChangedListener { _, _, new -> minute = new }
                        }
                    },
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "TIMEZONE",
                    color = AppColors.appTextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    AgentTimezoneOption.all.forEach { option ->
                        val isSelected = option.value == localTimezone
                        Text(
                            text = option.label,
                            color = if (isSelected) AppColors.brandGreenBright else AppColors.appTextPrimary,
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier
                                .background(
                                    color = if (isSelected) AppColors.brandGreenBright.copy(alpha = 0.15f)
                                    else AppColors.appBorder.copy(alpha = 0.3f),
                                    shape = RoundedCornerShape(10.dp),
                                )
                                .border(
                                    1.dp,
                                    if (isSelected) AppColors.brandGreenBright else AppColors.appBorder,
                                    RoundedCornerShape(10.dp),
                                )
                                .clickableNoRipple { localTimezone = option.value }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = AppColors.appTextSecondary)
                }
                Spacer(Modifier.width(8.dp))
                TextButton(onClick = {
                    val t = String.format("%02d:%02d", hour, minute)
                    onConfirm(t, localTimezone)
                }) {
                    Text(
                        "Confirm",
                        color = AppColors.brandGreenBright,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}
