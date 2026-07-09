package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.stores.HistoricalAnalysisStore
import kotlin.math.roundToInt

private enum class FilterSheet(val title: String) {
    Seasons("Seasons"), Spread("Spread"), Line("Line"), Moneyline("Moneyline odds"),
    Situation("Situation"), Conditions("Conditions"), Context("Context"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun HistoricalAnalysisFilterBar(store: HistoricalAnalysisStore) {
    var activeSheet by remember { mutableStateOf<FilterSheet?>(null) }
    val snapshot = store.snapshot
    val spread = HistoricalAnalysisFilterBuilder.spreadConfig(store.sport, store.betType)
    val total = HistoricalAnalysisFilterBuilder.totalConfig(store.sport, store.betType)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ChoicePill(
                label = HistoricalAnalysisBetType.from(store.betType).label,
                emphasized = true,
                choices = HistoricalAnalysisBetType.entries.map { it.raw to it.label },
                selected = store.betType,
                onSelect = store::setBetType,
            )
            ActionPill(HistoricalAnalysisCopy.yearRange(snapshot.seasonMin, snapshot.seasonMax)) { activeSheet = FilterSheet.Seasons }
            ChoicePill(
                label = when (snapshot.side) { "home" -> "Home"; "away" -> "Away"; else -> "Side" },
                choices = listOf("any" to "Either", "home" to "Home", "away" to "Away"),
                selected = snapshot.side,
            ) { value -> changed(store) { it.side = value } }
            if (spread != null) ActionPill(spreadLabel(store, spread.max)) { activeSheet = FilterSheet.Spread }
            if (total != null) ActionPill(lineLabel(store, total.min, total.max)) { activeSheet = FilterSheet.Line }
            ActionPill(if (snapshot.mlMin.isNotEmpty() || snapshot.mlMax.isNotEmpty()) "ML odds" else "ML") { activeSheet = FilterSheet.Moneyline }
            ActionPill("Situation") { activeSheet = FilterSheet.Situation }
            ActionPill("Conditions") { activeSheet = FilterSheet.Conditions }
            ActionPill(
                if (store.sport == HistoricalAnalysisSport.NFL) {
                    when { snapshot.coach != "any" -> snapshot.coach; snapshot.referee != "any" -> "Ref: ${snapshot.referee}"; else -> "Coach/Ref" }
                } else HistoricalAnalysisCopy.conferencePillLabel(HistoricalAnalysisCopy.activeConferences(snapshot)),
            ) { activeSheet = FilterSheet.Context }
        }
        ActiveFilters(store)
    }

    activeSheet?.let { sheet ->
        ModalBottomSheet(
            onDismissRequest = { activeSheet = null },
            containerColor = AppColors.appSurfaceElevated,
            contentColor = AppColors.appTextPrimary,
        ) {
            FilterSheetContent(store, sheet) { activeSheet = null }
        }
    }
}

@Composable
private fun ChoicePill(
    label: String,
    choices: List<Pair<String, String>>,
    selected: String,
    emphasized: Boolean = false,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        PillChrome(label, emphasized) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            choices.forEach { (value, title) ->
                DropdownMenuItem(
                    text = { Text(title, fontWeight = if (value == selected) FontWeight.Bold else FontWeight.Normal) },
                    onClick = { expanded = false; onSelect(value) },
                )
            }
        }
    }
}

@Composable private fun ActionPill(label: String, onClick: () -> Unit) = PillChrome(label, false, onClick)

@Composable
private fun PillChrome(label: String, emphasized: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.height(44.dp).clip(CircleShape)
            .background(if (emphasized) AppColors.appPrimary.copy(alpha = .14f) else AppColors.appSurfaceMuted)
            .clickable(onClick = onClick).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = if (emphasized) FontWeight.Bold else FontWeight.SemiBold, maxLines = 1)
        Icon(Icons.Rounded.ArrowDropDown, null, tint = AppColors.appTextMuted, modifier = Modifier.size(17.dp))
    }
}

private data class ActiveFilter(val label: String, val clear: () -> Unit)

@Composable
private fun ActiveFilters(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    val defaults = com.wagerproof.core.models.HistoricalAnalysisUISnapshot.defaults(store.sport).also {
        it.betType = s.betType
        HistoricalAnalysisFilterBuilder.spreadConfig(store.sport, s.betType)?.let { cfg -> it.spreadMax = cfg.max }
        HistoricalAnalysisFilterBuilder.totalConfig(store.sport, s.betType)?.let { cfg -> it.lineMin = cfg.min; it.lineMax = cfg.max }
        it.seasonMin = store.seasonFloor
    }
    val chips = buildList {
        fun addIf(condition: Boolean, label: String, clear: () -> Unit) { if (condition) add(ActiveFilter(label, clear)) }
        addIf(s.seasonMin != defaults.seasonMin || s.seasonMax != defaults.seasonMax, "Seasons ${HistoricalAnalysisCopy.yearRange(s.seasonMin, s.seasonMax)}") {
            changed(store) { it.seasonMin = defaults.seasonMin; it.seasonMax = defaults.seasonMax }
        }
        addIf(s.side != "any", if (s.side == "home") "Home" else "Away") { changed(store) { it.side = "any" } }
        addIf(s.spreadSide != "any" || s.spreadMin != defaults.spreadMin || s.spreadMax != defaults.spreadMax,
            "Spread ${HistoricalAnalysisCopy.trimmed(s.spreadMin)}–${HistoricalAnalysisCopy.trimmed(s.spreadMax)}") {
            changed(store) { it.spreadSide = "any"; it.spreadMin = defaults.spreadMin; it.spreadMax = defaults.spreadMax }
        }
        addIf(s.lineMin != defaults.lineMin || s.lineMax != defaults.lineMax,
            "Line ${HistoricalAnalysisCopy.trimmed(s.lineMin)}–${HistoricalAnalysisCopy.trimmed(s.lineMax)}") {
            changed(store) { it.lineMin = defaults.lineMin; it.lineMax = defaults.lineMax }
        }
        addIf(s.mlMin.isNotBlank() || s.mlMax.isNotBlank(), "ML odds") { changed(store) { it.mlMin = ""; it.mlMax = "" } }
        addIf(s.primetime != null, "Primetime: ${if (s.primetime == true) "Yes" else "No"}") { changed(store) { it.primetime = null } }
        addIf(s.division != null, "Divisional: ${if (s.division == true) "Yes" else "No"}") { changed(store) { it.division = null } }
        addIf(s.tempMin != defaults.tempMin || s.tempMax != defaults.tempMax, "Temp ${s.tempMin}–${s.tempMax}°F") {
            changed(store) { it.tempMin = defaults.tempMin; it.tempMax = defaults.tempMax }
        }
        addIf(s.windMax != defaults.windMax, "Wind ≤ ${s.windMax}") { changed(store) { it.windMax = defaults.windMax } }
        HistoricalAnalysisCopy.activeConferences(s).forEach { conference ->
            add(ActiveFilter(conference) { changed(store) { snap -> snap.selectedConferences = snap.selectedConferences - conference; snap.conference = "any" } })
        }
        addIf(s.coach != "any", "Coach: ${s.coach}") { changed(store) { it.coach = "any" } }
        addIf(s.referee != "any", "Ref: ${s.referee}") { changed(store) { it.referee = "any" } }
    }
    if (chips.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("ACTIVE FILTERS", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            TextButton(onClick = store::resetAllFilters) { Text("Reset all") }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            chips.forEach { chip ->
                Row(Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted).padding(start = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(chip.label, fontSize = 12.sp, color = AppColors.appTextPrimary)
                    IconButton(onClick = chip.clear, modifier = Modifier.size(32.dp)) { Icon(Icons.Rounded.Close, "Clear ${chip.label}", Modifier.size(15.dp)) }
                }
            }
        }
    }
}

private fun spreadLabel(store: HistoricalAnalysisStore, max: Double): String {
    val s = store.snapshot
    return when {
        s.spreadSide != "any" -> "${if (s.spreadSide == "favorite") "Fav" else "Dog"} ${HistoricalAnalysisCopy.trimmed(s.spreadMin)}–${HistoricalAnalysisCopy.trimmed(s.spreadMax)}"
        s.spreadMin > 0 || s.spreadMax < max -> "Spread ${HistoricalAnalysisCopy.trimmed(s.spreadMin)}–${HistoricalAnalysisCopy.trimmed(s.spreadMax)}"
        else -> "Spread"
    }
}

private fun lineLabel(store: HistoricalAnalysisStore, min: Double, max: Double): String {
    val s = store.snapshot
    return if (s.lineMin > min || s.lineMax < max) "Line ${HistoricalAnalysisCopy.trimmed(s.lineMin)}–${HistoricalAnalysisCopy.trimmed(s.lineMax)}" else "Line"
}

private fun changed(store: HistoricalAnalysisStore, block: (com.wagerproof.core.models.HistoricalAnalysisUISnapshot) -> Unit) {
    store.updateSnapshot(block)
    store.scheduleFetch()
}

@Composable
private fun FilterSheetContent(store: HistoricalAnalysisStore, sheet: FilterSheet, done: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().heightIn(max = 680.dp).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 30.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(if (sheet == FilterSheet.Context && store.sport == HistoricalAnalysisSport.NFL) "Coach & referee" else if (sheet == FilterSheet.Context) "Conference" else sheet.title,
                fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Button(onClick = done) { Text("Done") }
        }
        when (sheet) {
            FilterSheet.Seasons -> SeasonsSheet(store)
            FilterSheet.Spread -> SpreadSheet(store)
            FilterSheet.Line -> LineSheet(store)
            FilterSheet.Moneyline -> MoneylineSheet(store)
            FilterSheet.Situation -> SituationSheet(store)
            FilterSheet.Conditions -> ConditionsSheet(store)
            FilterSheet.Context -> ContextSheet(store)
        }
    }
}

@Composable
private fun SeasonsSheet(store: HistoricalAnalysisStore) {
    IntRangeControl("From", store.snapshot.seasonMin, store.seasonFloor, store.snapshot.seasonMax) { changed(store) { s -> s.seasonMin = it } }
    IntRangeControl("To", store.snapshot.seasonMax, store.snapshot.seasonMin, HistoricalAnalysisSport.SEASON_MAX) { changed(store) { s -> s.seasonMax = it } }
}

@Composable
private fun SpreadSheet(store: HistoricalAnalysisStore) {
    val config = HistoricalAnalysisFilterBuilder.spreadConfig(store.sport, store.betType) ?: return
    ChoiceRow("Spread side", listOf("any" to "Either side", "favorite" to "Favored by", "underdog" to "Getting"), store.snapshot.spreadSide) { changed(store) { s -> s.spreadSide = it } }
    DoubleRangeControl("Spread", store.snapshot.spreadMin, store.snapshot.spreadMax, 0.0, config.max, .5) { lower, upper -> changed(store) { it.spreadMin = lower; it.spreadMax = upper } }
}

@Composable
private fun LineSheet(store: HistoricalAnalysisStore) {
    val config = HistoricalAnalysisFilterBuilder.totalConfig(store.sport, store.betType) ?: return
    DoubleRangeControl(config.label, store.snapshot.lineMin, store.snapshot.lineMax, config.min, config.max, .5) { lower, upper -> changed(store) { it.lineMin = lower; it.lineMax = upper } }
}

@Composable
private fun MoneylineSheet(store: HistoricalAnalysisStore) {
    OutlinedTextField(store.snapshot.mlMin, { value -> changed(store) { it.mlMin = value } }, label = { Text("Min American odds (e.g. -200)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(store.snapshot.mlMax, { value -> changed(store) { it.mlMax = value } }, label = { Text("Max American odds (e.g. -120)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun SituationSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    if (store.sport == HistoricalAnalysisSport.NFL) {
        ChoiceRow("Season type", listOf("any" to "Regular + Playoffs", "regular" to "Regular", "postseason" to "Playoffs"), s.seasonType) { changed(store) { snap -> snap.seasonType = it } }
        if (s.seasonType == "postseason") ChoiceRow("Playoff round", listOf("any" to "All", "Wild Card" to "Wild Card", "Divisional" to "Divisional", "Conference" to "Conference", "Super Bowl" to "Super Bowl"), s.playoffRound) { changed(store) { snap -> snap.playoffRound = it } }
        if (s.seasonType == "regular") WeekControls(store, 18)
    } else {
        ChoiceRow("Game type", listOf("any" to "All", "regular" to "Regular", "bowl" to "Bowls", "playoff" to "Playoff", "postseason" to "Postseason"), s.gameType) { changed(store) { snap -> snap.gameType = it } }
        if (s.gameType == "regular") WeekControls(store, 16)
        ChoiceRow("Ranked matchup", listOf("any" to "Any", "both" to "Both ranked", "neither" to "Neither", "home_ranked" to "Home ranked", "away_ranked" to "Away ranked", "either" to "Either ranked"), s.rankedMatchup) { changed(store) { snap -> snap.rankedMatchup = it } }
    }
    if (store.betType in HistoricalAnalysisBetType.moneylineMarkets || store.betType == "team_total") {
        ChoiceRow("Favorite / underdog", listOf("any" to "Either", "favorite" to "Favorites", "underdog" to "Underdogs"), s.favDog) { changed(store) { snap -> snap.favDog = it } }
    }
}

@Composable private fun WeekControls(store: HistoricalAnalysisStore, max: Int) {
    IntRangeControl("Week from", store.snapshot.weekMin, 1, store.snapshot.weekMax) { changed(store) { s -> s.weekMin = it } }
    IntRangeControl("Week to", store.snapshot.weekMax, store.snapshot.weekMin, max) { changed(store) { s -> s.weekMax = it } }
}

@Composable
private fun ConditionsSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    OptionalBoolRow("Primetime", s.primetime) { changed(store) { snap -> snap.primetime = it } }
    if (store.sport == HistoricalAnalysisSport.NFL) {
        OptionalBoolRow("Divisional", s.division) { changed(store) { snap -> snap.division = it } }
        ChoiceRow("Venue", listOf("any" to "Any", "dome" to "Dome", "outdoor" to "Outdoor"), s.dome) { changed(store) { snap -> snap.dome = it } }
        ChoiceRow("Precipitation", listOf("any" to "Any", "none" to "None", "rain" to "Rain", "snow" to "Snow"), s.precip) { changed(store) { snap -> snap.precip = it } }
        ChoiceRow("Rest / bye", listOf("any" to "Any", "off_bye" to "Off a bye", "pre_bye" to "Before bye", "short" to "Short rest"), s.restBye) { changed(store) { snap -> snap.restBye = it } }
    } else {
        OptionalBoolRow("Conference game", s.conferenceGame) { changed(store) { snap -> snap.conferenceGame = it } }
        OptionalBoolRow("Neutral site", s.neutralSite) { changed(store) { snap -> snap.neutralSite = it } }
    }
    DoubleRangeControl("Temperature (°F)", s.tempMin.toDouble(), s.tempMax.toDouble(), -10.0, if (store.sport == HistoricalAnalysisSport.NFL) 100.0 else 110.0, 1.0) { low, high -> changed(store) { it.tempMin = low.roundToInt(); it.tempMax = high.roundToInt() } }
    Text("Max wind ${s.windMax} mph", fontWeight = FontWeight.SemiBold)
    Slider(value = s.windMax.toFloat(), onValueChange = { value -> changed(store) { it.windMax = value.roundToInt() } }, valueRange = 0f..60f, steps = 59)
}

@Composable
private fun ContextSheet(store: HistoricalAnalysisStore) {
    if (store.sport == HistoricalAnalysisSport.NFL) {
        ScrollChoice("Coach", store.snapshot.coach, listOf("any") + store.coaches, "Any coach") { changed(store) { snap -> snap.coach = it } }
        ScrollChoice("Referee", store.snapshot.referee, listOf("any") + store.referees, "Any referee") { changed(store) { snap -> snap.referee = it } }
    } else {
        Text(if (store.snapshot.selectedConferences.isEmpty()) "All conferences" else "${store.snapshot.selectedConferences.size} selected", color = AppColors.appTextSecondary)
        store.conferences.forEach { conference ->
            FilterChip(
                selected = conference in store.snapshot.selectedConferences,
                onClick = { changed(store) { s -> s.selectedConferences = if (conference in s.selectedConferences) s.selectedConferences - conference else (s.selectedConferences + conference).sorted(); s.conference = "any" } },
                label = { Text(conference) }, modifier = Modifier.fillMaxWidth(),
            )
        }
        if (store.snapshot.selectedConferences.isNotEmpty()) TextButton(onClick = { changed(store) { it.selectedConferences = emptyList(); it.conference = "any" } }) { Text("Clear all conferences", color = AppColors.appAccentRed) }
    }
}

@Composable
private fun ScrollChoice(title: String, selected: String, choices: List<String>, anyLabel: String, onSelect: (String) -> Unit) {
    Text(title, fontWeight = FontWeight.SemiBold)
    Column(Modifier.fillMaxWidth().heightIn(max = 240.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        choices.distinct().forEach { value -> FilterChip(selected = value == selected, onClick = { onSelect(value) }, label = { Text(if (value == "any") anyLabel else value) }, modifier = Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun OptionalBoolRow(title: String, selected: Boolean?, onSelect: (Boolean?) -> Unit) =
    ChoiceRow(title, listOf("any" to "Any", "yes" to "Yes", "no" to "No"), when (selected) { true -> "yes"; false -> "no"; null -> "any" }) {
        onSelect(when (it) { "yes" -> true; "no" -> false; else -> null })
    }

@Composable
private fun ChoiceRow(title: String, choices: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold)
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            choices.forEach { (value, label) -> FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(label) }) }
        }
    }
}

@Composable
private fun IntRangeControl(title: String, value: Int, min: Int, max: Int, onChange: (Int) -> Unit) {
    Column {
        Text("$title: $value", fontWeight = FontWeight.SemiBold)
        if (max > min) {
            Slider(value.toFloat(), { onChange(it.roundToInt().coerceIn(min, max)) }, valueRange = min.toFloat()..max.toFloat(), steps = (max - min - 1).coerceAtLeast(0))
        }
    }
}

@Composable
private fun DoubleRangeControl(title: String, lower: Double, upper: Double, min: Double, max: Double, step: Double, onChange: (Double, Double) -> Unit) {
    Column {
        Text("$title: ${HistoricalAnalysisCopy.trimmed(lower)}–${HistoricalAnalysisCopy.trimmed(upper)}", fontWeight = FontWeight.SemiBold)
        if (upper > min) Slider(lower.toFloat(), { raw -> onChange(((raw / step).roundToInt() * step).coerceAtMost(upper - step), upper) }, valueRange = min.toFloat()..upper.toFloat())
        if (max > lower) Slider(upper.toFloat(), { raw -> onChange(lower, ((raw / step).roundToInt() * step).coerceAtLeast(lower + step)) }, valueRange = lower.toFloat()..max.toFloat())
    }
}
