package com.wagerproof.app.features.agents.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
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
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// =====================================================================
// PickHistoryFolder — manila folder card + expanded browse sheet. Port of
// iOS PickHistoryFolder.swift.
//
// FIDELITY-WAIVER #212: the rolodex pile (per-ticket squash/lift/fade off live
// LazyListState.layoutInfo) and the two-stage sheet (~440dp closed / large
// expanded, ticket taps only select once expanded) are both implemented — see
// RolodexPile/pileTicketTransform and the `expanded` height toggle in
// PickHistorySheetContent. What's still approximated, not reproduced:
//   - iOS uses real presentationDetents([.height(440), .large]); M3's
//     ModalBottomSheet has no equivalent, so the two stages are faked by
//     conditionally sizing the sheet's own content (440dp vs fillMaxHeight).
//   - Only TAP expands the collapsed pile. A raw drag detector was tried and
//     removed — it silently ate the sheet's native drag-to-dismiss gesture.
//   - The scroll-notch haptic tick approximates a continuous offset (index *
//     avg ticket stride + item scroll offset); LazyListState has no single
//     continuous content offset the way SwiftUI's ScrollView does.
//   - "Wide" (landscape) detection uses LocalConfiguration's screen dp, not
//     hSize/vSize size classes — there's no Android equivalent in this app.
// =====================================================================

private val jitterX = listOf(-6f, 5f, -3f)
private val jitterTilt = listOf(-1.4f, 1.0f, -0.6f)
private val pileJitterX = listOf(-8f, 7f, -4f, 9f, -6f, 3f)
private val pileJitterTilt = listOf(-1.6f, 1.2f, -0.7f, 1.8f, -1.1f, 0.5f)

/** Below this pick+parlay count the rolodex builds fast enough to skip the loading spinner. */
private const val instantMountThreshold = 24

/** How far the tap-to-unstack gesture scrolls the pile once the sheet expands. */
private val unstackScrollDp = 600.dp

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
        Box(
            Modifier
                .fillMaxSize()
                .liquidGlassBackground(shape)
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
    var expanded by remember { mutableStateOf(wide) }
    var stackRevealed by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(wide) { if (wide) expanded = true }

    // Gates the heavy rolodex mount for large histories — see instantMountThreshold above.
    var contentReady by remember { mutableStateOf(items.size <= instantMountThreshold) }
    LaunchedEffect(Unit) {
        if (!contentReady) {
            delay(60)
            contentReady = true
        }
    }

    // Fan the stack out: grow the sheet to full height + scroll the rolodex so a
    // handful of tickets stand clear of the folder. Mirrors iOS's unstack(). Guarded
    // by stackRevealed so re-tapping an already-expanded folder doesn't re-fire the
    // scroll animation.
    fun unstack() {
        expanded = true
        if (!stackRevealed) {
            stackRevealed = true
            scope.launch { listState.animateScrollBy(with(density) { unstackScrollDp.toPx() }) }
        }
    }

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

    // Rolodex feedback: a soft tick every ~64dp of pile scroll. LazyListState has no
    // continuous content offset (items recycle), so we approximate one from
    // index * average-ticket-stride + the current item's own scroll offset.
    var scrollNotch by remember { mutableStateOf(0) }
    LaunchedEffect(listState, contentReady, wide) {
        if (!contentReady || wide) return@LaunchedEffect
        val stridePx = with(density) { 128.dp.toPx() }
        val notchPx = with(density) { 64.dp.toPx() }
        snapshotFlow { listState.firstVisibleItemIndex * stridePx + listState.firstVisibleItemScrollOffset }
            .collect { offset ->
                val notch = (offset / notchPx).roundToInt()
                if (notch != scrollNotch) {
                    scrollNotch = notch
                    haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                }
            }
    }

    Box(
        Modifier
            .fillMaxWidth()
            // Two-stage sheet: a fixed ~440dp "closed folder" height, or nearly-full
            // once expanded — M3's ModalBottomSheet has no direct equivalent of
            // SwiftUI's presentationDetents([.height(440), .large]), so this sizes
            // the CONTENT itself (the sheet, set to skipPartiallyExpanded, follows).
            .then(if (expanded) Modifier.fillMaxHeight(0.92f) else Modifier.height(440.dp))
            // Springs the height change on unstack(), standing in for iOS's animated detent swap.
            .animateContentSize()
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
        // Folder back (behind the pile) — the wide grid has no folder chrome.
        if (!wide) {
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(232.dp)
                    .padding(horizontal = 12.dp, vertical = 0.dp)
                    .padding(bottom = 42.dp)
                    .background(
                        Brush.verticalGradient(listOf(AppColors.folderBackTop, AppColors.folderBackBottom)),
                        pickFolderTabShape(),
                    ),
            )
        }

        // Content: loading shell, expanded ticket, the wide grid, or the rolodex pile.
        val sel = selected
        when {
            !contentReady -> LoadingPileArea(agentColor)
            sel != null -> ExpandedTicketArea(item = sel, agentColor = agentColor, onCollapse = { selected = null })
            wide -> WideTicketGrid(tickets = filtered, agentColor = agentColor, onSelect = { selected = it })
            filtered.isEmpty() -> SheetEmptyState(items.isEmpty(), Modifier.align(Alignment.Center))
            else -> RolodexPile(
                tickets = filtered,
                agentColor = agentColor,
                listState = listState,
                expanded = expanded,
                onTicketTap = { item -> if (expanded) selected = item else unstack() },
                onBackgroundTap = { unstack() },
            )
        }

        // Folder front (over the pile) — hidden in the wide grid layout.
        if (!wide) Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(234.dp)
                .padding(horizontal = 12.dp)
                .clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    when {
                        selected != null -> selected = null
                        !expanded -> unstack()
                        else -> onDismiss()
                    }
                },
        ) {
            val shape = pickFolderFrontShape()
            Box(Modifier.fillMaxSize().liquidGlassBackground(shape).border(1.dp, Color.White.copy(alpha = 0.08f), shape))
            Text(
                "PICK HISTORY",
                color = Color.White.copy(alpha = 0.10f),
                fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 4.sp,
                modifier = Modifier.align(Alignment.BottomStart).padding(start = 22.dp, bottom = 20.dp),
            )
        }

        // Floating top bar (back/close + filter pills).
        Row(
            Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
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
            if (selected == null && contentReady) {
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
private fun LoadingPileArea(agentColor: Color) {
    Column(
        Modifier.fillMaxSize().padding(bottom = 230.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = agentColor)
        Spacer(Modifier.height(12.dp))
        Text("Loading pick history…", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

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
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 72.dp, bottom = 16.dp),
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
 * Per-ticket wallet physics for the rolodex pile — mirrors iOS's `.visualEffect`:
 * tickets near the folder mouth squash back into it at rest, and pull out to full
 * size + fade in as they scroll up past the mouth; tickets reaching the top fade out.
 * Position-driven off [listState]'s live layout, so it re-runs every scroll frame
 * without a recomposition (graphicsLayer blocks are re-invoked on each placement).
 */
private fun pileTicketTransform(scope: GraphicsLayerScope, listState: LazyListState, index: Int) = with(scope) {
    val info = listState.layoutInfo
    val itemInfo = info.visibleItemsInfo.firstOrNull { it.index == index }
    if (itemInfo == null) {
        // Not in visibleItemsInfo yet on first placement — fall back to identity instead of
        // computing from a fake y=0, which read as buried (alpha 0) and caused a first-frame flash.
        alpha = 1f
        return@with
    }
    translationX = pileJitterX[index % pileJitterX.size] * density
    rotationZ = pileJitterTilt[index % pileJitterTilt.size]
    val container = if (info.viewportSize.height > 0) info.viewportSize.height.toFloat() else 800.dp.toPx()
    val y = itemInfo.offset.toFloat()
    val mouth = container - 236.dp.toPx()
    val zoneTop = mouth - 130.dp.toPx()
    val into = (y - zoneTop).coerceAtLeast(0f)
    val residual = (into * 0.18f).coerceAtMost(200.dp.toPx())
    val lift = into - residual
    val buried = (1f - (residual - 150.dp.toPx()) / 45.dp.toPx()).coerceIn(0f, 1f)
    val topFade = ((y - 8.dp.toPx()) / 56.dp.toPx()).coerceIn(0f, 1f)
    val scale = 0.92f + 0.08f * topFade
    translationY = -lift
    scaleX = scale
    scaleY = scale
    transformOrigin = TransformOrigin(0.5f, 1f)
    alpha = topFade * buried
}

/**
 * The rolodex pile: tickets overlap via negative spacing (SwiftUI's `VStack(spacing: -122)`
 * fanned via later-siblings-on-top; Compose achieves the same with negative
 * `spacedBy` — LazyColumn just lays each item further up than the one before).
 * While collapsed, native list scrolling is off and a tap anywhere on the pile
 * expands the sheet (see the `expanded` height toggle above — there's no
 * sheet-level detent-drag in this simplified two-height design). A raw drag
 * detector was tried here too but competes with the sheet's own drag-to-dismiss
 * gesture on the same content area, silently swallowing it — tap is the safe,
 * unambiguous affordance, so that's what ships; drag-to-expand is not wired.
 * Once expanded, normal scrolling takes over and each ticket's own tap selects it.
 */
@Composable
private fun RolodexPile(
    tickets: List<AgentBetItem>,
    agentColor: Color,
    listState: LazyListState,
    expanded: Boolean,
    onTicketTap: (AgentBetItem) -> Unit,
    onBackgroundTap: () -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val topPad = (maxHeight - 366.dp).coerceAtLeast(16.dp)
        LazyColumn(
            state = listState,
            userScrollEnabled = expanded,
            verticalArrangement = Arrangement.spacedBy((-122).dp),
            contentPadding = PaddingValues(start = 28.dp, end = 28.dp, top = topPad, bottom = 430.dp),
            modifier = Modifier
                .fillMaxSize()
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                ) { if (!expanded) onBackgroundTap() },
        ) {
            itemsIndexed(tickets, key = { _, item -> item.id }) { index, item ->
                BetItemTicket(
                    item = item,
                    accent = agentColor,
                    modifier = Modifier
                        .graphicsLayer { pileTicketTransform(this, listState, index) }
                        .clickable {
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            onTicketTap(item)
                        },
                )
            }
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
