package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.agents.ticketColor
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentSport

// =====================================================================
// PickHistoryFolder — manila folder card + expanded browse sheet. Port of
// iOS PickHistoryFolder.swift.
//
// FIDELITY-WAIVER #212 (REVISED 2026-08-17): Android deliberately DIVERGES from
// iOS here. iOS opens a two-stage sheet (presentationDetents 440 / .large) onto
// a rolodex pile whose tickets squash, lift and fade against the folder mouth.
// That was ported faithfully and did not survive contact with the device: the
// physics are keyed to distance from the mouth, so once the sheet was open the
// same transform drove tickets to alpha 0 almost as fast as they scrolled into
// view, and the folder chrome ate ~230dp of an already-short sheet.
//
// What ships instead, per owner (2026-08-17): the folder card on the agent
// detail page is unchanged and is still the entry point, but tapping it opens a
// FULL-SCREEN sheet containing a plain LazyColumn — slight negative spacing and
// a per-index jitter/tilt keep the stacked-pile character, with no scroll
// physics at all. Tapping a ticket still opens it full-screen.
//
// Still approximated: "wide" (landscape) detection uses LocalConfiguration's
// screen dp, not hSize/vSize size classes — there's no Android equivalent here.
// =====================================================================

private val jitterX = listOf(-6f, 5f, -3f)
private val jitterTilt = listOf(-1.4f, 1.0f, -0.6f)
private val pileJitterX = listOf(-8f, 7f, -4f, 9f, -6f, 3f)
private val pileJitterTilt = listOf(-1.6f, 1.2f, -0.7f, 1.8f, -1.1f, 0.5f)

// MARK: - Folder card (agent detail page)

@Composable
fun AgentPickFolderCard(
    recentItems: List<AgentBetItem>,
    totalCount: Int,
    loading: Boolean,
    locked: Boolean,
    agentColor: Color,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val peeks = recentItems.take(3)
    val isInteractive = !locked && !loading && peeks.isNotEmpty()

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(264.dp)
            .clip(RoundedCornerShape(0.dp))
            .clickable(enabled = isInteractive) {
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                onTap()
            }
            .semantics(mergeDescendants = true) {
                contentDescription = if (locked) "Pick history locked" else "Pick history folder, $totalCount graded picks"
                if (isInteractive) role = Role.Button
            },
    ) {
        // Tickets poking out.
        Box(Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(horizontal = 24.dp)) {
            when {
                loading -> SkeletonBlock(
                    height = 96.dp,
                    modifier = Modifier.padding(top = 22.dp).clip(RoundedCornerShape(18.dp)).shimmering(),
                )
                peeks.isEmpty() -> EmptyCaption(locked, Modifier.align(Alignment.TopCenter))
                else -> peeks.withIndex().reversed().forEach { (index, item) ->
                    BetItemTicket(
                        item = item,
                        accent = agentColor,
                        modifier = Modifier
                            .graphicsLayer {
                                translationX = jitterX[index % jitterX.size] * density
                                translationY = (26f - index * 10f) * density
                                rotationZ = jitterTilt[index % jitterTilt.size]
                            },
                    )
                }
            }
        }
        // Folder front.
        FolderFront(
            height = 140.dp,
            titleSize = 19.sp,
            tracking = 3,
            browseChip = if (isInteractive) (if (totalCount > 0) "$totalCount picks" else "Browse") else null,
            agentColor = agentColor,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

@Composable
private fun EmptyCaption(locked: Boolean, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(horizontal = 24.dp).padding(top = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(agentSymbol(if (locked) "lock.fill" else "tray"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(26.dp))
        Text(if (locked) "Pick history is locked" else "No graded picks yet", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Text(
            if (locked) "Upgrade to Pro to browse this agent's history" else "Picks land in the folder once they're graded",
            color = AppColors.appTextSecondary, fontSize = 12.sp,
        )
    }
}

@Composable
private fun FolderFront(
    height: androidx.compose.ui.unit.Dp,
    titleSize: androidx.compose.ui.unit.TextUnit,
    tracking: Int,
    browseChip: String?,
    agentColor: Color,
    modifier: Modifier = Modifier,
) {
    val shape = pickFolderFrontShape()
    Box(modifier = modifier.fillMaxWidth().height(height).padding(horizontal = 8.dp)) {
        // Scrimmed, not bare glass. This front has to READ as opaque card stock
        // hiding the bottom of the tickets peeking out behind it; plain
        // liquidGlassBackground let them show straight through, so they looked
        // like they floated in front of the folder rather than sitting inside it
        // (owner, 2026-08-17). The scrim goes THROUGH the modifier so it lands
        // after the blur — a chained .background() draws underneath and never shows.
        Box(
            Modifier
                .fillMaxSize()
                .liquidGlassBackground(shape, scrim = AppColors.appSurfaceElevated.copy(alpha = 0.72f))
                .border(1.dp, Color.White.copy(alpha = 0.08f), shape),
        )
        Text(
            "PICK HISTORY",
            color = Color.White.copy(alpha = 0.12f),
            fontSize = titleSize,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = tracking.sp,
            modifier = Modifier.align(Alignment.BottomStart).padding(start = 20.dp, bottom = 18.dp),
        )
        if (browseChip != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 18.dp, bottom = 16.dp)
                    .clip(CircleShape)
                    .background(agentColor.copy(alpha = 0.14f))
                    .border(1.dp, agentColor.copy(alpha = 0.35f), CircleShape)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            ) {
                Text(browseChip, color = agentColor, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                Icon(agentSymbol("arrow.up.right"), null, tint = agentColor, modifier = Modifier.size(10.dp))
            }
        }
    }
}

// MARK: - Browse sheet

private enum class PickSort(val label: String) { Newest("Newest"), Oldest("Oldest"), Units("Most Units") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PickHistorySheet(
    items: List<AgentBetItem>,
    agentName: String,
    agentColor: Color,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.pickHistorySheetBackground,
        // Full-bleed: no drag handle and no top inset, so the list gets the whole
        // screen. The sheet's own close button handles dismissal (the handle only
        // bought a few dp of grab target and cost ~40dp of list).
        dragHandle = null,
        contentWindowInsets = { WindowInsets(0) },
    ) {
        PickHistorySheetContent(items, agentColor, onDismiss)
    }
}

@Composable
private fun PickHistorySheetContent(
    items: List<AgentBetItem>,
    agentColor: Color,
    onDismiss: () -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    var statusFilter by remember { mutableStateOf<AgentPick.PickResultStatus?>(null) }
    var sportFilter by remember { mutableStateOf<AgentSport?>(null) }
    var sortOrder by remember { mutableStateOf(PickSort.Newest) }
    var selected by remember { mutableStateOf<AgentBetItem?>(null) }

    // Approximates iOS's `hSize == .regular && vSize == .compact` — swap the rolodex
    // pile for a grid when the sheet is wider than it is tall (landscape phones/tablets).
    val configuration = LocalConfiguration.current
    val wide = configuration.screenWidthDp > configuration.screenHeightDp

    val sportsAvailable = remember(items) { items.mapNotNull { it.sportForFilter }.distinct() }
    val filtered = remember(items, statusFilter, sportFilter, sortOrder) {
        items
            .filter { statusFilter == null || it.result == statusFilter }
            .filter { sportFilter == null || it.sportForFilter == sportFilter }
            .let { list ->
                when (sortOrder) {
                    PickSort.Newest -> list.sortedByDescending { sortKey(it) }
                    PickSort.Oldest -> list.sortedBy { sortKey(it) }
                    PickSort.Units -> list.sortedByDescending { it.units }
                }
            }
    }

    Box(
        Modifier
            .fillMaxSize()
            .drawBehind {
                drawRect(AppColors.pickHistorySheetBackground)
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(agentColor.copy(alpha = 0.30f), Color.Transparent),
                        center = Offset(size.width / 2f, 0f),
                        radius = 420.dp.toPx(),
                    ),
                )
            },
    ) {
        // No folder chrome inside the sheet any more. The back panel + front flap
        // existed to sell the "pile sitting in a folder" metaphor, and between
        // them they ate ~230dp off the bottom of the screen. The folder is still
        // the ENTRY POINT on the agent detail page (AgentPickFolderCard); once
        // it's open this is just a list, and the list gets the whole screen.
        val sel = selected
        when {
            sel != null -> ExpandedTicketArea(item = sel, agentColor = agentColor, onCollapse = { selected = null })
            wide -> WideTicketGrid(tickets = filtered, agentColor = agentColor, onSelect = { selected = it })
            filtered.isEmpty() -> SheetEmptyState(items.isEmpty(), Modifier.align(Alignment.Center))
            else -> PickList(tickets = filtered, agentColor = agentColor, onSelect = { selected = it })
        }

        // Floating top bar (back/close + filter pills). statusBarsPadding is
        // load-bearing: the sheet sets contentWindowInsets to zero to get a
        // full-bleed list, which also puts this row under the status bar and
        // clipped the sort/filter pills. The inset comes back HERE rather than
        // on the sheet, so the list still scrolls edge to edge behind it.
        Row(
            Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                Modifier
                    .size(38.dp)
                    .liquidGlassBackground(CircleShape)
                    .clickable {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        if (selected != null) selected = null else onDismiss()
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(agentSymbol(if (selected == null) "xmark" else "chevron.left"), null, tint = AppColors.appTextPrimary, modifier = Modifier.size(15.dp))
            }
            // No filters while loading — nothing to filter yet, and it keeps that state cheap.
            if (selected == null) {
                FilterMenu(
                    text = statusFilter?.let { statusName(it) } ?: "Result",
                    isActive = statusFilter != null,
                    tint = statusFilter?.ticketColor ?: agentColor,
                    options = listOf<Pair<String, AgentPick.PickResultStatus?>>(
                        "All Results" to null,
                        "Wins" to AgentPick.PickResultStatus.WON,
                        "Losses" to AgentPick.PickResultStatus.LOST,
                        "Pushes" to AgentPick.PickResultStatus.PUSH,
                    ),
                    selected = statusFilter,
                    onSelect = { statusFilter = it; haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
                )
                FilterMenu(
                    text = sportFilter?.label ?: "Sport",
                    isActive = sportFilter != null,
                    tint = agentColor,
                    options = listOf<Pair<String, AgentSport?>>("All Sports" to null) + sportsAvailable.map { it.label to it },
                    selected = sportFilter,
                    onSelect = { sportFilter = it; haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
                )
                FilterMenu(
                    text = if (sortOrder == PickSort.Newest) "Sort By" else sortOrder.label,
                    isActive = sortOrder != PickSort.Newest,
                    tint = agentColor,
                    options = PickSort.entries.map { it.label to it },
                    selected = sortOrder,
                    onSelect = { sortOrder = it; haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
                )
            }
        }

        // Inline audit sheet.
        val audit = appGraph().agentPickAudit
        // The store is shared app-wide — if the sheet is torn down (e.g. process death,
        // back gesture) while an audit is open, clear it so a stale pick can't reappear
        // when the screen-level AuditSheet next reads it.
        DisposableEffect(audit) {
            onDispose { audit.dismiss() }
        }
        val auditPick = audit.selectedPick
        if (audit.isPresented && auditPick != null) {
            AuditSheet(pick = auditPick, onDismiss = { audit.dismiss() })
        }
    }
}

// MARK: - Content states (loading shell / expanded ticket / wide grid / rolodex pile)

@Composable
private fun ExpandedTicketArea(item: AgentBetItem, agentColor: Color, onCollapse: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    // Resolved here (composable scope) — the onAudit callback below runs outside composition.
    val auditStore = appGraph().agentPickAudit
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .statusBarsPadding()
            .padding(top = 64.dp, bottom = 140.dp)
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onCollapse()
            },
    ) {
        when (item) {
            is AgentBetItem.Pick -> ExpandedAgentPickTicket(
                pick = item.pick, accent = agentColor,
                onAudit = { auditStore.present(item.pick) },
            )
            is AgentBetItem.Parlay -> ExpandedAgentParlayTicket(parlay = item.parlay, accent = agentColor)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AuditSheet(pick: AgentPick, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF050909),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(max = 700.dp)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            AgentPickPayloadAuditWidget(pick = pick, payload = appGraph().agentPickAudit.payload)
        }
    }
}

@Composable
private fun <T> FilterMenu(
    text: String,
    isActive: Boolean,
    tint: Color,
    options: List<Pair<String, T>>,
    selected: T,
    onSelect: (T) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .heightIn(min = 38.dp)
                .liquidGlassBackground(CircleShape)
                .then(if (isActive) Modifier.border(1.dp, tint.copy(alpha = 0.5f), CircleShape) else Modifier)
                .clickable { open = true }
                .padding(horizontal = 14.dp, vertical = 9.dp),
        ) {
            Text(text, color = if (isActive) tint else AppColors.appTextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            Icon(agentSymbol("chevron.down"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(10.dp))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (label, value) ->
                DropdownMenuItem(
                    text = { Text(label) },
                    leadingIcon = if (value == selected) {
                        { Icon(agentSymbol("checkmark"), null, tint = tint, modifier = Modifier.size(16.dp)) }
                    } else null,
                    onClick = { open = false; onSelect(value) },
                )
            }
        }
    }
}

/** Wide sheets (landscape) swap the folder rolodex for an adaptive grid — no room to fan a pile. */
@Composable
private fun WideTicketGrid(tickets: List<AgentBetItem>, agentColor: Color, onSelect: (AgentBetItem) -> Unit) {
    val haptics = LocalHapticFeedback.current
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 300.dp),
        // Extra top padding clears the floating filter bar (no folder chrome to push below in wide mode).
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = 72.dp + WindowInsets.statusBars.asPaddingValues().calculateTopPadding(),
            bottom = 16.dp,
        ),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(tickets, key = { it.id }) { item ->
            BetItemTicket(
                item = item,
                accent = agentColor,
                modifier = Modifier.clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    onSelect(item)
                },
            )
        }
    }
}

/**
 * The pick list. Deliberately plain: a LazyColumn with a slight negative gap so
 * tickets overlap, plus a per-index jitter/tilt so the stack still reads as a
 * hand-stacked pile rather than a table.
 *
 * This replaced a position-driven "rolodex" transform that squashed, lifted and
 * faded every ticket off live `LazyListState.layoutInfo`. It was keyed to the
 * folder mouth, so once the sheet opened it drove tickets transparent almost as
 * fast as they were scrolled into view — the cards simply weren't visible. A
 * list does not need scroll physics to be legible, and the owner asked for the
 * whole screen instead (2026-08-17).
 *
 * Overlap is small enough that every ticket keeps its own tap target; the
 * overlapped sliver belongs to the ticket drawn on top, which is the later one.
 */
@Composable
private fun PickList(tickets: List<AgentBetItem>, agentColor: Color, onSelect: (AgentBetItem) -> Unit) {
    val haptics = LocalHapticFeedback.current
    LazyColumn(
        // Top padding clears the floating close/filter bar; the rest is the
        // screen, since there is no folder flap to avoid any more.
        // 72dp clears the floating close/filter bar; the status-bar inset is
        // added on top because the sheet draws full-bleed behind it.
        contentPadding = PaddingValues(
            start = 20.dp,
            end = 20.dp,
            top = 72.dp + WindowInsets.statusBars.asPaddingValues().calculateTopPadding(),
            bottom = 32.dp,
        ),
        verticalArrangement = Arrangement.spacedBy((-24).dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        itemsIndexed(tickets, key = { _, item -> item.id }) { index, item ->
            BetItemTicket(
                item = item,
                accent = agentColor,
                modifier = Modifier
                    .graphicsLayer {
                        translationX = pileJitterX[index % pileJitterX.size] * density
                        rotationZ = pileJitterTilt[index % pileJitterTilt.size]
                    }
                    .clickable {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onSelect(item)
                    },
            )
        }
    }
}

@Composable
private fun SheetEmptyState(noItems: Boolean, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(agentSymbol(if (noItems) "tray" else "line.3.horizontal.decrease.circle"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(30.dp))
        Text(if (noItems) "No graded picks yet" else "Nothing matches", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(
            if (noItems) "Picks appear here once they're graded." else "No picks match these filters.",
            color = AppColors.appTextSecondary, fontSize = 13.sp,
        )
    }
}

private fun sortKey(item: AgentBetItem): String = "${item.gameDate}|${item.createdAt}"

private fun statusName(r: AgentPick.PickResultStatus): String = when (r) {
    AgentPick.PickResultStatus.WON -> "Wins"
    AgentPick.PickResultStatus.LOST -> "Losses"
    AgentPick.PickResultStatus.PUSH -> "Pushes"
    AgentPick.PickResultStatus.PENDING -> "Pending"
}
