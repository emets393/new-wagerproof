package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.platform.LocalHapticFeedback
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
// FIDELITY-WAIVER #212: iOS drives the browse sheet with two presentation
// detents + a scroll-position "wallet physics" visualEffect (tickets squash
// into the folder mouth and fan out as you scroll, rolodex fade at the top).
// Android renders a full-height Material3 ModalBottomSheet with a plain
// vertically-scrolling jittered pile — the stuffed-rolodex squash/lift math and
// the notch-tick-on-scroll are approximated, not reproduced.
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

    val sportsAvailable = remember(items) { items.mapNotNull { it.sportForFilter }.distinct() }
    val filtered = items
        .filter { statusFilter == null || it.result == statusFilter }
        .filter { sportFilter == null || it.sportForFilter == sportFilter }
        .let { list ->
            when (sortOrder) {
                PickSort.Newest -> list.sortedByDescending { sortKey(it) }
                PickSort.Oldest -> list.sortedBy { sortKey(it) }
                PickSort.Units -> list.sortedByDescending { it.units }
            }
        }

    Box(
        Modifier
            .fillMaxWidth()
            .fillMaxHeight(0.92f)
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
        // Folder back (behind the pile).
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

        // Content: expanded ticket OR the rolodex pile.
        val sel = selected
        // Resolved here (composable scope) — the onAudit callback below runs outside composition.
        val auditStore = appGraph().agentPickAudit
        if (sel != null) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(top = 64.dp, bottom = 140.dp)
                    .clickable {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        selected = null
                    },
            ) {
                when (sel) {
                    is AgentBetItem.Pick -> ExpandedAgentPickTicket(
                        pick = sel.pick, accent = agentColor,
                        onAudit = { auditStore.present(sel.pick) },
                    )
                    is AgentBetItem.Parlay -> ExpandedAgentParlayTicket(parlay = sel.parlay, accent = agentColor)
                }
            }
        } else if (filtered.isEmpty()) {
            SheetEmptyState(items.isEmpty(), Modifier.align(Alignment.Center))
        } else {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Spacer(Modifier.height(72.dp))
                filtered.forEachIndexed { index, item ->
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
                                selected = item
                            },
                    )
                }
                Spacer(Modifier.height(260.dp))
            }
        }

        // Folder front (over the pile).
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(234.dp)
                .padding(horizontal = 12.dp)
                .clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    if (selected != null) selected = null else onDismiss()
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
                    onSelect = { statusFilter = it; haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
                )
                FilterMenu(
                    text = sportFilter?.label ?: "Sport",
                    isActive = sportFilter != null,
                    tint = agentColor,
                    options = listOf<Pair<String, AgentSport?>>("All Sports" to null) + sportsAvailable.map { it.label to it },
                    onSelect = { sportFilter = it; haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
                )
                FilterMenu(
                    text = if (sortOrder == PickSort.Newest) "Sort By" else sortOrder.label,
                    isActive = sortOrder != PickSort.Newest,
                    tint = agentColor,
                    options = PickSort.entries.map { it.label to it },
                    onSelect = { sortOrder = it; haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
                )
            }
        }

        // Inline audit sheet.
        val audit = appGraph().agentPickAudit
        val auditPick = audit.selectedPick
        if (audit.isPresented && auditPick != null) {
            AuditSheet(pick = auditPick, onDismiss = { audit.dismiss() })
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
        androidx.compose.material3.DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (label, value) ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(label) },
                    onClick = { open = false; onSelect(value) },
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
