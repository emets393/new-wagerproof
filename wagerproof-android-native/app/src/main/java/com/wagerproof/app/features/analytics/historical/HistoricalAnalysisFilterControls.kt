package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.roundToInt

// Shared filter-sheet controls for the Historical Analysis taxonomy.
// Port of the iOS Form rows in HistoricalAnalysisFiltersView.swift, rendered with
// Material 3 instead of imitating the SwiftUI/Liquid Glass chrome.

/** `Section("…") { … }` equivalent — a labelled group inside a filter sheet. */
@Composable
internal fun SheetSection(title: String?, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
        if (title != null) {
            Text(
                title.uppercase(),
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        content()
    }
}

@Composable
internal fun SheetCaption(text: String) {
    Text(text, color = AppColors.appTextMuted, fontSize = 11.sp)
}

@Composable
internal fun ChoiceRow(
    title: String,
    choices: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            choices.forEach { (value, label) ->
                FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(label) })
            }
        }
    }
}

/** Tri-state Any / Yes / No row for the snapshot's `Boolean?` dimensions. */
@Composable
internal fun OptionalBoolRow(
    title: String,
    selected: Boolean?,
    yesLabel: String = "Yes",
    noLabel: String = "No",
    anyLabel: String = "Any",
    onSelect: (Boolean?) -> Unit,
) = ChoiceRow(
    title = title,
    choices = listOf("any" to anyLabel, "yes" to yesLabel, "no" to noLabel),
    selected = when (selected) {
        true -> "yes"
        false -> "no"
        null -> "any"
    },
) { value -> onSelect(when (value) { "yes" -> true; "no" -> false; else -> null }) }

/**
 * Dual-thumb range row with a live readout — the Material equivalent of iOS
 * `labeledRangeSlider` + `HistoricalAnalysisRangeSlider`.
 *
 * The thumbs drive local state and only commit on release. Writing the snapshot
 * on every drag tick would copy ~130 fields and recompose the whole filter bar
 * (chips included) at 60fps; the readout still tracks the finger because it
 * reads the draft, not the store. Re-keying on the committed bounds resyncs the
 * thumbs when something external moves them (Reset all, restoring a system).
 *
 * `steps` stays 0 — Material draws a tick mark per step, and these ranges run to
 * 100+ steps — so the draft is snapped to the step grid manually instead.
 */
@Composable
internal fun LabeledRangeSlider(
    title: String,
    lower: Double,
    upper: Double,
    min: Double,
    max: Double,
    step: Double,
    suffix: String = "",
    caption: String? = null,
    format: (Double) -> String = { HistoricalAnalysisCopy.trimmed(it) },
    onChange: (Double, Double) -> Unit,
) {
    if (max <= min) return
    fun snap(raw: Float): Float {
        val steps = ((raw - min) / step).roundToInt()
        return (min + steps * step).coerceIn(min, max).toFloat()
    }

    var draft by remember(lower, upper, min, max) {
        mutableStateOf(lower.coerceIn(min, max).toFloat()..upper.coerceIn(min, max).toFloat())
    }

    Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.fillMaxWidth()) {
        Text(
            "$title: ${format(draft.start.toDouble())}–${format(draft.endInclusive.toDouble())}$suffix",
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = AppColors.appTextPrimary,
        )
        if (caption != null) SheetCaption(caption)
        RangeSlider(
            value = draft,
            onValueChange = { next ->
                val lo = snap(next.start)
                val hi = snap(next.endInclusive)
                draft = minOf(lo, hi)..maxOf(lo, hi)
            },
            valueRange = min.toFloat()..max.toFloat(),
            onValueChangeFinished = { onChange(draft.start.toDouble(), draft.endInclusive.toDouble()) },
        )
    }
}

/** Integer flavour of [LabeledRangeSlider] (streaks, margins, weeks, seasons…). */
@Composable
internal fun LabeledIntRangeSlider(
    title: String,
    lower: Int,
    upper: Int,
    min: Int,
    max: Int,
    suffix: String = "",
    caption: String? = null,
    format: (Int) -> String = { it.toString() },
    onChange: (Int, Int) -> Unit,
) = LabeledRangeSlider(
    title = title,
    lower = lower.toDouble(),
    upper = upper.toDouble(),
    min = min.toDouble(),
    max = max.toDouble(),
    step = 1.0,
    suffix = suffix,
    caption = caption,
    format = { format(it.roundToInt()) },
) { lo, hi -> onChange(lo.roundToInt(), hi.roundToInt()) }

/** Single-thumb row (min-games style floors). */
@Composable
internal fun LabeledIntSlider(
    title: String,
    value: Int,
    min: Int,
    max: Int,
    onChange: (Int) -> Unit,
) {
    if (max <= min) return
    var draft by remember(value, min, max) { mutableStateOf(value.coerceIn(min, max).toFloat()) }
    Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.fillMaxWidth()) {
        Text(
            "$title: ${draft.roundToInt()}",
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = AppColors.appTextPrimary,
        )
        Slider(
            value = draft,
            onValueChange = { draft = it.roundToInt().toFloat() },
            valueRange = min.toFloat()..max.toFloat(),
            onValueChangeFinished = { onChange(draft.roundToInt()) },
        )
    }
}

/** Wrapping chip group for the small multi-selects (days, divisions, series games). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MultiSelectChips(
    title: String,
    options: List<Pair<String, String>>,
    selected: List<String>,
    emptyLabel: String,
    onToggle: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary, modifier = Modifier.weight(1f))
            Text(
                if (selected.isEmpty()) emptyLabel else "${selected.size} selected",
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
            )
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            options.forEach { (value, label) ->
                FilterChip(selected = value in selected, onClick = { onToggle(value) }, label = { Text(label) })
            }
        }
    }
}

@Composable
internal fun SheetTextField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
}

/**
 * Row that opens a full-screen searchable list — the Material answer to iOS's
 * `NavigationLink → SearchableMultiSelectList`. A ModalBottomSheet can't push, and
 * a 130-school team list inline makes the sheet unusable, so the picker is a
 * full-screen dialog layered over it.
 */
@Composable
internal fun SearchableMultiSelectRow(
    title: String,
    options: List<SelectOption>,
    selected: List<String>,
    onChange: (List<String>) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    DisclosureRow(title, if (selected.isEmpty()) "All" else "${selected.size} selected") { open = true }
    if (open) {
        SearchableListDialog(
            title = title,
            options = options,
            isSelected = { it in selected },
            onDismiss = { open = false },
            onClear = { onChange(emptyList()) },
            onPick = { id ->
                onChange(if (id in selected) selected - id else (selected + id).sorted())
            },
        )
    }
}

/** Single-select flavour ("any" + one value) for the NFL coach / referee lists. */
@Composable
internal fun SearchableSingleSelectRow(
    title: String,
    anyLabel: String,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    DisclosureRow(title, if (selected == "any") "Any" else selected) { open = true }
    if (open) {
        SearchableListDialog(
            title = title,
            options = listOf(SelectOption("any", anyLabel)) + options.distinct().map { SelectOption(it, it) },
            isSelected = { it == selected },
            onDismiss = { open = false },
            onClear = null,
            onPick = { id -> onSelect(id); open = false },
        )
    }
}

internal data class SelectOption(val id: String, val label: String)

@Composable
private fun DisclosureRow(title: String, value: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appSurfaceMuted)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text(value, color = AppColors.appTextSecondary, fontSize = 13.sp, maxLines = 1)
    }
}

@Composable
private fun SearchableListDialog(
    title: String,
    options: List<SelectOption>,
    isSelected: (String) -> Boolean,
    onDismiss: () -> Unit,
    onClear: (() -> Unit)?,
    onPick: (String) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    // Accent- and case-insensitive substring match, matching iOS `fold`, so
    // "Jose"/"jose" finds "José" and "usc" finds "USC".
    val filtered = remember(query, options) {
        val q = foldForSearch(query.trim())
        if (q.isEmpty()) options
        else options.filter { foldForSearch(it.label).contains(q) || foldForSearch(it.id).contains(q) }
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = AppColors.appSurface) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        title,
                        color = AppColors.appTextPrimary,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    if (onClear != null) TextButton(onClick = { onClear() }) { Text("Clear all") }
                    IconButton(onClick = onDismiss) { Icon(Icons.Rounded.Close, "Close") }
                }
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Search ${title.lowercase()}") },
                    leadingIcon = { Icon(Icons.Rounded.Search, null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                )
                if (filtered.isEmpty()) {
                    Text(
                        "No matches",
                        color = AppColors.appTextSecondary,
                        modifier = Modifier.padding(16.dp),
                    )
                }
                LazyColumn(Modifier.fillMaxSize()) {
                    items(filtered, key = { it.id }) { option ->
                        Row(
                            Modifier.fillMaxWidth()
                                .clickable { onPick(option.id) }
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                option.label,
                                color = AppColors.appTextPrimary,
                                modifier = Modifier.weight(1f),
                                maxLines = 1,
                            )
                            if (isSelected(option.id)) {
                                Icon(
                                    Icons.Rounded.Check,
                                    "Selected",
                                    tint = AppColors.appPrimary,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                    }
                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }
}
