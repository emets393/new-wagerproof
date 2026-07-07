package com.wagerproof.app.features.outliers

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsMarketSection
import com.wagerproof.core.models.OutliersTrendsMatchupFilter
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubject
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.OutliersTrendsStore
import kotlinx.coroutines.launch

/** Identifies the tapped trend card so it can be presented in the detail sheet. */
data class OutliersTrendSelection(
    val card: com.wagerproof.core.models.OutliersTrendsCard,
    val game: OutliersTrendsGame?,
) {
    val id: String get() = card.id
}

/**
 * Matchup-specific trends hub. A sticky filter pill row (sport / subject /
 * matchup) sits over per-market horizontal card carousels. Port of iOS
 * `OutliersTrendsView.swift`.
 *
 * // FIDELITY-WAIVER #234: iOS `LazyVStack(pinnedViews:[.sectionHeaders])` (glass
 * // pills the cards refract through) → a LazyColumn `stickyHeader` with glass
 * // pills over the same market carousels — the closest Compose equivalent.
 */
@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun OutliersTrendsView(
    store: OutliersTrendsStore,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    var showMatchupPicker by remember { mutableStateOf(false) }
    var selectedTrend by remember { mutableStateOf<OutliersTrendSelection?>(null) }

    // iOS `.onChange(of: store.sport)` — reset dependent filters + refetch. Skip
    // the initial composition so we don't refetch what the root screen already loaded.
    var firstSport by remember { mutableStateOf(true) }
    LaunchedEffect(store.sport) {
        if (firstSport) {
            firstSport = false
            return@LaunchedEffect
        }
        store.onSportChanged()
        store.refresh()
    }

    val sections = store.marketSections
    val gamesById = remember(store.games) { store.games.associateBy { it.id } }
    val onRetry: () -> Unit = { scope.launch { store.refresh() } }

    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(bottom = Spacing.md),
    ) {
        stickyHeader {
            FilterPills(store) { showMatchupPicker = true }
        }

        when {
            !store.sport.hasTrendsData -> item { ComingSoonState(store.sport) }

            store.loadState is LoadState.Failed && store.slateGames.isEmpty() ->
                item { ErrorState((store.loadState as LoadState.Failed).message, onRetry) }

            store.isLoadingTrends && sections.isEmpty() -> item { LoadingState() }

            store.lastError != null && sections.isEmpty() ->
                item { ErrorState(store.lastError!!, onRetry) }

            sections.isEmpty() -> item { EmptyState() }

            else -> {
                itemsIndexed(sections, key = { _, s -> s.id }) { index, section ->
                    SectionBlock(
                        section = section,
                        sport = store.sport,
                        gamesById = gamesById,
                        topPadding = if (index == 0) 4.dp else 22.dp,
                        onCardTap = { selectedTrend = it },
                    )
                }
                if (store.isLoadingTrends) item { UpdatingIndicator() }
            }
        }
    }

    if (showMatchupPicker) {
        MatchupPickerSheet(
            sport = store.sport,
            games = store.games,
            selection = store.matchupFilter,
            onSelect = { store.matchupFilter = it },
            onDismiss = { showMatchupPicker = false },
        )
    }

    selectedTrend?.let { selection ->
        OutliersTrendDetailSheet(
            card = selection.card,
            sport = store.sport,
            game = selection.game,
            onDismiss = { selectedTrend = null },
        )
    }
}

// MARK: - Filter pills

@Composable
private fun FilterPills(store: OutliersTrendsStore, onOpenMatchup: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = Spacing.md, bottom = 10.dp)) {
        Row(
            Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.lg, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SportPill(store)
            if (store.sport.hasTrendsData) {
                if (store.sport.allowedSubjects.size > 1) SubjectPill(store)
                MatchupPill(store, onOpenMatchup)
            }
        }
    }
}

@Composable
private fun SportPill(store: OutliersTrendsStore) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        PillLabel(icon = sportIcon(store.sport), text = store.sport.label) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            OutliersTrendsSport.values().forEach { s ->
                DropdownMenuItem(
                    text = { Text(s.label) },
                    leadingIcon = { Icon(sportIcon(s), null, modifier = Modifier.size(18.dp)) },
                    onClick = { store.sport = s; expanded = false },
                )
            }
        }
    }
}

@Composable
private fun SubjectPill(store: OutliersTrendsStore) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        PillLabel(icon = subjectIcon(store.subject), text = store.subject.label) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            store.sport.allowedSubjects.forEach { subject ->
                DropdownMenuItem(
                    text = { Text(subject.label) },
                    leadingIcon = { Icon(subjectIcon(subject), null, modifier = Modifier.size(18.dp)) },
                    onClick = { store.subject = subject; expanded = false },
                )
            }
        }
    }
}

@Composable
private fun MatchupPill(store: OutliersTrendsStore, onOpen: () -> Unit) {
    val filter = store.matchupFilter
    val game = (filter as? OutliersTrendsMatchupFilter.Game)?.let { f ->
        store.games.firstOrNull { it.id == f.id }
    }
    if (game != null) {
        PillContainer(onClick = onOpen) {
            DiagonalMatchupLogos(
                sport = store.sport,
                awayTeam = matchupLogoIdentifier(store.sport, game, away = true),
                homeTeam = matchupLogoIdentifier(store.sport, game, away = false),
                size = 21.dp,
            )
            Text(
                matchupPillText(store.sport, game),
                color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            PillChevron()
        }
    } else {
        PillLabel(icon = AppIcon.SQUARE_GRID_2X2_FILL.imageVector, text = "All games", onClick = onOpen)
    }
}

@Composable
private fun PillLabel(icon: ImageVector, text: String, onClick: () -> Unit) {
    PillContainer(onClick = onClick) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
        Text(
            text, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1,
        )
        PillChevron()
    }
}

@Composable
private fun PillContainer(onClick: () -> Unit, content: @Composable () -> Unit) {
    Row(
        Modifier
            .height(36.dp)
            .clip(CircleShape)
            .liquidGlassBackground(CircleShape)
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.35f), CircleShape)
            .clickable { onClick() }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        content()
    }
}

@Composable
private fun PillChevron() {
    Icon(
        AppIcon.CHEVRON_DOWN.imageVector,
        contentDescription = null,
        tint = AppColors.appTextMuted,
        modifier = Modifier.size(9.dp),
    )
}

private fun sportIcon(sport: OutliersTrendsSport): ImageVector = when (sport) {
    OutliersTrendsSport.NFL, OutliersTrendsSport.NCAAF -> AppIcon.FOOTBALL_FILL.imageVector
    OutliersTrendsSport.MLB -> AppIcon.FIGURE_BASEBALL.imageVector
    OutliersTrendsSport.NBA, OutliersTrendsSport.NCAAB -> AppIcon.BASKETBALL.imageVector
}

private fun subjectIcon(subject: OutliersTrendsSubject): ImageVector = when (subject) {
    OutliersTrendsSubject.ALL -> outlierSymbol("square.grid.2x2.fill", AppIcon.SQUARE_GRID_2X2_FILL.imageVector)
    OutliersTrendsSubject.TEAMS -> outlierSymbol("shield.lefthalf.filled", AppIcon.SHIELD_FILL.imageVector)
    OutliersTrendsSubject.COACHES -> outlierSymbol("person.fill", AppIcon.PERSON.imageVector)
    OutliersTrendsSubject.REFS -> outlierSymbol("flag.fill")
    OutliersTrendsSubject.PLAYERS -> outlierSymbol("figure.run")
}

/** CFB logos resolve off full team name; NFL/MLB off the abbreviation. */
private fun matchupLogoIdentifier(sport: OutliersTrendsSport, game: OutliersTrendsGame, away: Boolean): String =
    when (sport) {
        OutliersTrendsSport.NCAAF -> if (away) game.awayTeam else game.homeTeam
        else -> if (away) game.awayAb else game.homeAb
    }

private fun matchupPillText(sport: OutliersTrendsSport, game: OutliersTrendsGame): String {
    val away = if (sport == OutliersTrendsSport.NCAAF) CFBTeamAssets.abbr(game.awayTeam) else game.awayAb
    val home = if (sport == OutliersTrendsSport.NCAAF) CFBTeamAssets.abbr(game.homeTeam) else game.homeAb
    return "$away @ $home"
}

// MARK: - Market sections

@Composable
private fun SectionBlock(
    section: OutliersTrendsMarketSection,
    sport: OutliersTrendsSport,
    gamesById: Map<String, OutliersTrendsGame>,
    topPadding: Dp,
    onCardTap: (OutliersTrendSelection) -> Unit,
) {
    Column(
        Modifier.padding(top = topPadding),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            Modifier.padding(horizontal = Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(marketIcon(section.marketKey), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp))
            Text(
                section.title.uppercase(),
                color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
            )
        }
        LazyRow(
            contentPadding = PaddingValues(horizontal = Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(section.cards, key = { it.id }) { card ->
                val game = gamesById[card.gameId]
                Box(
                    Modifier
                        .width(300.dp)
                        .clickable { onCardTap(OutliersTrendSelection(card, game)) },
                ) {
                    OutliersTrendCard(card = card, sport = sport, game = game)
                }
            }
        }
    }
}

/** SF Symbol per bet-type — ported verbatim from iOS, routed through [outlierSymbol]. */
private fun marketIcon(marketKey: String): ImageVector = when (marketKey) {
    "spread", "rl", "f5_rl" -> outlierSymbol("arrow.left.and.right", AppIcon.ARROW_LEFT_ARROW_RIGHT.imageVector)
    "moneyline", "ml", "f5_ml" -> outlierSymbol("dollarsign.circle.fill", AppIcon.DOLLARSIGN_CIRCLE_FILL.imageVector)
    "total", "ou", "f5_ou" -> outlierSymbol("sum", AppIcon.SUM.imageVector)
    "team_total" -> outlierSymbol("person.2.fill", AppIcon.PERSON_2_FILL.imageVector)
    "h1_spread" -> outlierSymbol("clock.arrow.trianglehead.counterclockwise.rotate.90", AppIcon.CLOCK_ARROW_CIRCLEPATH.imageVector)
    "h1_total" -> outlierSymbol("clock.badge.checkmark", AppIcon.CLOCK_BADGE.imageVector)
    "player_anytime_td" -> outlierSymbol("figure.run.circle.fill")
    "player_rush_yds" -> outlierSymbol("figure.run")
    "player_reception_yds" -> outlierSymbol("arrow.down.right.circle.fill")
    "player_receptions" -> outlierSymbol("hand.raised.fill")
    "player_pass_yds" -> outlierSymbol("paperplane.fill")
    "player_pass_tds" -> outlierSymbol("trophy.fill", AppIcon.TROPHY_FILL.imageVector)
    else -> outlierSymbol("chart.line.uptrend.xyaxis", AppIcon.CHART_LINE_UPTREND.imageVector)
}

// MARK: - States

@Composable
private fun UpdatingIndicator() {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = AppColors.appPrimary)
        Text("Updating trends…", color = AppColors.appTextSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun ComingSoonState(sport: OutliersTrendsSport) {
    CenteredState {
        Icon(
            outlierSymbol("chart.line.uptrend.xyaxis", AppIcon.CHART_LINE_UPTREND.imageVector),
            null, tint = AppColors.appTextMuted, modifier = Modifier.size(34.dp),
        )
        Text("Trends coming soon", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "${sport.label} situational betting trends aren't live yet — NFL, NCAAF, and MLB are available now.",
            color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun EmptyState() {
    CenteredState {
        Icon(
            outlierSymbol("line.3.horizontal.decrease.circle", AppIcon.LINE_3_HORIZONTAL_DECREASE_CIRCLE.imageVector),
            null, tint = AppColors.appTextMuted, modifier = Modifier.size(34.dp),
        )
        Text("No trends match", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "Try a different matchup or subject — or check back when the slate fills in.",
            color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    CenteredState {
        Icon(
            outlierSymbol("exclamationmark.triangle", AppIcon.EXCLAMATION_TRIANGLE.imageVector),
            null, tint = AppColors.appTextMuted, modifier = Modifier.size(34.dp),
        )
        Text("Couldn't load trends", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary, contentColor = AppColors.appTextInverse),
        ) { Text("Retry") }
    }
}

@Composable
private fun CenteredState(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) { content() }
}

@Composable
private fun LoadingState() {
    Column(
        Modifier.padding(top = 4.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        repeat(3) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    Modifier.padding(horizontal = Spacing.lg),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(14.dp).clip(RoundedCornerShape(4.dp)).background(Color.White.copy(alpha = 0.35f)))
                    com.wagerproof.core.design.components.SkeletonBlock(height = 12.dp, width = 110.dp)
                }
                LazyRow(
                    userScrollEnabled = false,
                    contentPadding = PaddingValues(horizontal = Spacing.lg),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(3) { OutliersTrendCardShimmer(Modifier.width(300.dp)) }
                }
            }
        }
    }
}

// MARK: - Matchup picker

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MatchupPickerSheet(
    sport: OutliersTrendsSport,
    games: List<OutliersTrendsGame>,
    selection: OutliersTrendsMatchupFilter,
    onSelect: (OutliersTrendsMatchupFilter) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(query, games) {
        val trimmed = query.trim()
        if (trimmed.isEmpty()) games
        else games.filter { g ->
            listOf(g.awayTeam, g.homeTeam, g.awayAb, g.homeAb).any { it.contains(trimmed, ignoreCase = true) }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = AppColors.appSurfaceElevated,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(bottom = 24.dp)) {
            Text(
                "Select matchup",
                color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search teams") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
                MatchupPickerRow(
                    selected = selection is OutliersTrendsMatchupFilter.AllGames,
                    onClick = { onSelect(OutliersTrendsMatchupFilter.AllGames); onDismiss() },
                ) {
                    Icon(AppIcon.SQUARE_GRID_2X2_FILL.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(20.dp))
                    Text("All games", color = AppColors.appTextPrimary, fontSize = 15.sp)
                }
                // MLB is capped to today's slate; the others list the week.
                filtered.forEach { game ->
                    val isSelected = (selection as? OutliersTrendsMatchupFilter.Game)?.id == game.id
                    MatchupPickerRow(
                        selected = isSelected,
                        onClick = { onSelect(OutliersTrendsMatchupFilter.Game(game.id)); onDismiss() },
                    ) {
                        DiagonalMatchupLogos(
                            sport = sport,
                            awayTeam = matchupLogoIdentifier(sport, game, away = true),
                            homeTeam = matchupLogoIdentifier(sport, game, away = false),
                            size = 30.dp,
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(1.dp), modifier = Modifier.weight(1f)) {
                            Text(
                                teamName(sport, game, away = true),
                                color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                "@ ${teamName(sport, game, away = false)}",
                                color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MatchupPickerRow(
    selected: Boolean,
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().clickable { onClick() }.padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        content()
        Spacer(Modifier.weight(1f))
        if (selected) {
            Icon(AppIcon.CHECKMARK.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(18.dp))
        }
    }
}

private fun teamName(sport: OutliersTrendsSport, game: OutliersTrendsGame, away: Boolean): String {
    val full = if (away) game.awayTeam else game.homeTeam
    return when (sport) {
        OutliersTrendsSport.NCAAF -> CFBTeamAssets.displayName(full)
        OutliersTrendsSport.MLB -> MLBTeams.nickname(full)
        else -> NFLTeamAssets.nickname(full)
    }
}

// MARK: - Diagonal matchup logos

/**
 * Two team discs on a diagonal (away upper-left, home lower-right) — the matchup
 * motif reused for the filter pill + picker rows.
 * // FIDELITY-WAIVER #235: iOS `LiquidGlassMergeContainer` + `teamGlassDisc` →
 * // two [OutlierGlassTeamAvatar]s offset diagonally (no glass blob merge).
 */
@Composable
private fun DiagonalMatchupLogos(
    sport: OutliersTrendsSport,
    awayTeam: String,
    homeTeam: String,
    size: Dp,
) {
    val off = size * 0.48f
    Box(Modifier.size(size + off)) {
        OutlierGlassTeamAvatar(
            logoUrl = diagonalLogoUrl(awayTeam, sport),
            initials = TeamInitials.from(awayTeam),
            primary = OutlierTeamPalette.color(awayTeam, sport.league(), OutlierTeamPalette.Slot.away),
            size = size,
            modifier = Modifier.align(Alignment.TopStart),
        )
        OutlierGlassTeamAvatar(
            logoUrl = diagonalLogoUrl(homeTeam, sport),
            initials = TeamInitials.from(homeTeam),
            primary = OutlierTeamPalette.color(homeTeam, sport.league(), OutlierTeamPalette.Slot.home),
            size = size,
            modifier = Modifier.align(Alignment.BottomEnd),
        )
    }
}

private fun diagonalLogoUrl(team: String, sport: OutliersTrendsSport): String? = when (sport) {
    OutliersTrendsSport.NCAAF -> CFBTeamAssets.logo(team)
    OutliersTrendsSport.MLB -> MLBTeams.logoUrl(team)
    else -> NFLTeamAssets.logo(team)
}
