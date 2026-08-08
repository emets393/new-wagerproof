package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.stores.HistoricalAnalysisStore

/**
 * One pill = one question a bettor would ask: who / which side / what price /
 * when / what kind of game / what conditions / how are they playing / what
 * happened last game / history vs this opponent / who's pitching (MLB) /
 * who's officiating-coaching (NFL). Mirrors iOS `HistoricalAnalysisFilterBar`.
 */
internal enum class FilterSheet(val title: String) {
    Teams("Teams"),
    Lines("Lines & odds"),
    Schedule("Schedule"),
    Game("Game"),
    Weather("Weather & venue"),
    TeamForm("Team form"),
    LastGame("Last game"),
    H2H("Head-to-head"),
    Opponent("Opponent"),
    Pitching("Pitching"),
    CoachRef("Coach & referee"),
}

/**
 * Side is per-team; a football game total is game-level, so the pill is hidden
 * there (mirrors iOS `hasSideFilter`, and the builder which drops `side` on those
 * markets — leaving the pill up let users set a filter that did nothing).
 */
internal fun hasSideFilter(sport: HistoricalAnalysisSport, betType: String) =
    sport == HistoricalAnalysisSport.MLB || betType !in setOf("fg_total", "h1_total")

/** `fav_dog` only reaches the RPC on ML + team-total (football) / side markets (MLB). */
internal fun showsFavDogFilter(sport: HistoricalAnalysisSport, betType: String) =
    if (sport == HistoricalAnalysisSport.MLB) {
        betType in setOf("ml", "rl", "f5_ml", "f5_rl")
    } else {
        betType in HistoricalAnalysisBetType.moneylineMarkets || betType == "team_total"
    }

internal fun changed(store: HistoricalAnalysisStore, block: (HistoricalAnalysisUISnapshot) -> Unit) {
    store.updateSnapshot(block)
    store.scheduleFetch()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun HistoricalAnalysisFilterBar(store: HistoricalAnalysisStore) {
    var activeSheet by remember { mutableStateOf<FilterSheet?>(null) }
    val sport = store.sport
    val snapshot = store.snapshot

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth()) {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                    .padding(start = 16.dp, end = 30.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                MarketPill(store)
                ActionPill(teamsPillLabel(store)) { activeSheet = FilterSheet.Teams }
                // Side + favorite/underdog are the same question (which role); hidden
                // entirely on game totals, where neither applies.
                if (hasSideFilter(sport, store.betType) || showsFavDogFilter(sport, store.betType)) {
                    SideRolePill(store)
                }
                ActionPill("Lines") { activeSheet = FilterSheet.Lines }
                ActionPill(HistoricalAnalysisCopy.yearRange(snapshot.seasonMin, snapshot.seasonMax)) {
                    activeSheet = FilterSheet.Schedule
                }
                ActionPill("Game") { activeSheet = FilterSheet.Game }
                ActionPill("Weather") { activeSheet = FilterSheet.Weather }
                ActionPill("Team form") { activeSheet = FilterSheet.TeamForm }
                ActionPill("Last game") { activeSheet = FilterSheet.LastGame }
                ActionPill("Head-to-head") { activeSheet = FilterSheet.H2H }
                ActionPill("Opponent") { activeSheet = FilterSheet.Opponent }
                if (sport == HistoricalAnalysisSport.MLB) {
                    ActionPill(pitchingPillLabel(snapshot)) { activeSheet = FilterSheet.Pitching }
                }
                if (sport == HistoricalAnalysisSport.NFL) {
                    ActionPill(coachRefPillLabel(snapshot)) { activeSheet = FilterSheet.CoachRef }
                }
            }
            // 11 pills don't fit: a cleanly-ending row hid most of the taxonomy from
            // users ("only three filters exist"). The chevron signals the row scrolls
            // and never intercepts touches.
            Icon(
                Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = AppColors.appTextSecondary,
                modifier = Modifier.align(Alignment.CenterEnd).padding(end = 4.dp).size(22.dp),
            )
        }
        ActiveFilters(store)
    }

    activeSheet?.let { sheet ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { activeSheet = null },
            sheetState = sheetState,
            containerColor = AppColors.appSurfaceElevated,
            contentColor = AppColors.appTextPrimary,
        ) {
            Column(
                Modifier.fillMaxWidth()
                    .heightIn(max = 720.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        sheetTitle(sheet, sport),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    Button(onClick = { activeSheet = null }) { Text("Done") }
                }
                FilterSheetContent(store, sheet)
            }
        }
    }
}

private fun sheetTitle(sheet: FilterSheet, sport: HistoricalAnalysisSport): String = when {
    sheet == FilterSheet.Teams && sport == HistoricalAnalysisSport.CFB -> "Teams & conferences"
    sheet == FilterSheet.Teams && sport == HistoricalAnalysisSport.NFL -> "Teams & divisions"
    else -> sheet.title
}

// MARK: - Pill labels (iOS `teamsPillLabel` / `pitchingPillLabel` / `coachRefPillLabel`)

private fun teamsPillLabel(store: HistoricalAnalysisStore): String {
    val s = store.snapshot
    var n = s.teams.size + s.opponents.size
    if (store.sport == HistoricalAnalysisSport.CFB) n += HistoricalAnalysisCopy.activeConferences(s).size
    if (store.sport == HistoricalAnalysisSport.NFL) n += s.teamDivisions.size
    return if (n > 0) "$n selected" else "Teams"
}

private fun pitchingPillLabel(s: HistoricalAnalysisUISnapshot): String {
    val count = s.sp.size + s.oppSp.size
    if (count == 1) return (s.sp.firstOrNull() ?: s.oppSp.firstOrNull())?.name ?: "Pitching"
    if (count > 1) return "$count pitchers"
    return "Pitching"
}

private fun coachRefPillLabel(s: HistoricalAnalysisUISnapshot): String = when {
    s.coach != "any" -> s.coach
    s.referee != "any" -> "Ref: ${s.referee}"
    else -> "Coach/Ref"
}

private fun sideRolePillLabel(s: HistoricalAnalysisUISnapshot): String {
    val side = when (s.side) {
        "home" -> "Home"
        "away" -> "Away"
        else -> null
    }
    val role = when (s.favDog) {
        "favorite" -> "Favorites"
        "underdog" -> "Underdogs"
        else -> null
    }
    return when {
        side != null && role != null -> "$side ${role.lowercase()}"
        side != null -> side
        role != null -> role
        else -> "Side & role"
    }
}

// MARK: - Pills

/**
 * Market picker — only the markets this sport's RPC understands, grouped the way
 * iOS groups them. Listing all 13 bet types meant NFL offered MLB's Run Line and
 * F5 markets (and MLB offered 1H markets); picking one sent a `bet_type` the RPC
 * rejects and the screen came back empty with no explanation.
 */
@Composable
private fun MarketPill(store: HistoricalAnalysisStore) {
    var expanded by remember { mutableStateOf(false) }
    val cases = HistoricalAnalysisBetType.casesFor(store.sport)
    val secondaryGroup = if (store.sport == HistoricalAnalysisSport.MLB) "First Five" else "First Half"
    Box {
        PillChrome(HistoricalAnalysisBetType.from(store.betType).label, true) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            listOf("Full Game", secondaryGroup).forEach { group ->
                val inGroup = cases.filter { it.group == group }
                if (inGroup.isEmpty()) return@forEach
                MenuSectionHeader(group)
                inGroup.forEach { betType ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                betType.label,
                                fontWeight = if (betType.raw == store.betType) FontWeight.Bold else FontWeight.Normal,
                            )
                        },
                        onClick = { expanded = false; store.setBetType(betType.raw) },
                    )
                }
            }
        }
    }
}

/** Home/Away + Favorite/Underdog in one menu — the same "which role" question. */
@Composable
private fun SideRolePill(store: HistoricalAnalysisStore) {
    var expanded by remember { mutableStateOf(false) }
    val s = store.snapshot
    Box {
        PillChrome(sideRolePillLabel(s), false) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            if (hasSideFilter(store.sport, store.betType)) {
                MenuSectionHeader("Side")
                listOf("any" to "Either", "home" to "Home", "away" to "Away").forEach { (value, label) ->
                    DropdownMenuItem(
                        text = { Text(label, fontWeight = if (value == s.side) FontWeight.Bold else FontWeight.Normal) },
                        onClick = { expanded = false; changed(store) { it.side = value } },
                    )
                }
            }
            // Fav/dog and run-line side are independent questions (the ML favorite
            // gets +1.5 in ~7% of MLB games), so both filters stay available.
            if (showsFavDogFilter(store.sport, store.betType)) {
                MenuSectionHeader("Favorite / underdog")
                listOf("any" to "Either", "favorite" to "Favorites", "underdog" to "Underdogs").forEach { (value, label) ->
                    DropdownMenuItem(
                        text = { Text(label, fontWeight = if (value == s.favDog) FontWeight.Bold else FontWeight.Normal) },
                        onClick = { expanded = false; changed(store) { it.favDog = value } },
                    )
                }
            }
        }
    }
}

@Composable
private fun MenuSectionHeader(title: String) = Text(
    title,
    color = AppColors.appTextSecondary,
    fontSize = 11.sp,
    fontWeight = FontWeight.Bold,
    modifier = Modifier.padding(start = 12.dp, top = 8.dp, bottom = 2.dp),
)

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
        Text(
            label,
            color = AppColors.appTextPrimary,
            fontSize = 13.sp,
            fontWeight = if (emphasized) FontWeight.Bold else FontWeight.SemiBold,
            maxLines = 1,
        )
        Icon(Icons.Rounded.ArrowDropDown, null, tint = AppColors.appTextMuted, modifier = Modifier.size(17.dp))
    }
}

// MARK: - Active filter capsules

@Composable
private fun ActiveFilters(store: HistoricalAnalysisStore) {
    val chips = HistoricalAnalysisActiveChips.build(store.sport, store.snapshot, store.seasonFloor)
    if (chips.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "ACTIVE FILTERS",
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = store::resetAllFilters) { Text("Reset all") }
        }
        Row(
            Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            chips.forEach { chip ->
                Row(
                    Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted).padding(start = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(chip.label, fontSize = 12.sp, color = AppColors.appTextPrimary, maxLines = 1)
                    IconButton(
                        onClick = { changed(store, chip.clear) },
                        modifier = Modifier.size(32.dp),
                    ) { Icon(Icons.Rounded.Close, "Clear ${chip.label}", Modifier.size(15.dp)) }
                }
            }
        }
    }
}
