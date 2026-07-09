package com.wagerproof.app.features.featurerequests

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.components.InsetGroupedDivider
import com.wagerproof.app.features.components.InsetGroupedSection
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.CornerRadius
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.FeatureRequest
import com.wagerproof.core.models.FeatureRequestVote
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.FeatureRequestsStore
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch

/**
 * Port of iOS `FeatureRequestsView.swift`. Sheet body (shell mounts it in a
 * ModalBottomSheet): top bar (X / green + → submit), sections Community Voting /
 * Planned / In Progress / Completed, skeleton/error/empty states.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeatureRequestsScreen(modifier: Modifier = Modifier) {
    // appGraph() is @Composable — resolve it here, not inside click lambdas.
    val graph = appGraph()
    val auth = graph.auth
    val store = remember { FeatureRequestsStore() }
    val scope = rememberCoroutineScope()
    var showSubmit by remember { mutableStateOf(false) }

    val userId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId

    // First-load hydrate — mirrors iOS `.task` guarded on the idle state.
    LaunchedEffect(Unit) {
        if (store.loadState is LoadState.Idle) store.refresh(userId)
    }

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        // Top bar.
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { graph.mainTab.isFeatureRequestsPresented = false }) {
                Icon(AppIcon.fromSystemName("xmark")!!.imageVector, "Close", tint = AppColors.appTextPrimary, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.weight(1f))
            Box(
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(AppColors.appPrimary)
                    .clickable { showSubmit = true },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = AppIcon.fromSystemName("plus")!!.imageVector,
                    contentDescription = "Submit feature request",
                    tint = Color.White,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
        Text(
            "Feature Requests",
            color = AppColors.appTextPrimary,
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = Spacing.lg, vertical = 4.dp),
        )

        PullToRefreshBox(
            isRefreshing = store.isLoading && store.hasRequests,
            onRefresh = { scope.launch { store.refresh(userId) } },
            modifier = Modifier.weight(1f).fillMaxWidth(),
        ) {
            val loadState = store.loadState
            when {
                store.isLoading && !store.hasRequests -> loadingPlaceholder()
                loadState is LoadState.Failed && !store.hasRequests ->
                    errorState(loadState.message) { scope.launch { store.refresh(userId) } }
                !store.hasRequests -> emptyState { showSubmit = true }
                else -> listContent(store, userId, scope)
            }
        }
    }

    if (showSubmit) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showSubmit = false },
            sheetState = sheetState,
            containerColor = AppColors.appSurfaceElevated,
        ) {
            if (userId != null) {
                SubmitFeatureRequestSheet(
                    store = store,
                    userId = userId,
                    displayName = auth.profile?.displayName,
                    onDismiss = { showSubmit = false },
                )
            } else {
                // Signed out mid-flow — rare but possible.
                Column(Modifier.fillMaxWidth().padding(Spacing.xl), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Sign in required", style = AppTypography.headline, color = AppColors.appTextPrimary)
                    Text("Sign in to submit a feature request.", style = AppTypography.caption, color = AppColors.appTextSecondary)
                }
            }
        }
    }
}

@Composable
private fun listContent(store: FeatureRequestsStore, userId: String?, scope: kotlinx.coroutines.CoroutineScope) {
    LazyColumn(
        Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        // Community Voting.
        item { sectionHeader("Community Voting", AppIcon.fromSystemName("lightbulb.fill")!!.imageVector, AppColors.appPrimary) }
        if (store.approvedRequests.isEmpty()) {
            item {
                Text(
                    "No feature requests yet. Be the first to submit one!",
                    style = AppTypography.caption,
                    color = AppColors.appTextSecondary,
                    modifier = Modifier.padding(vertical = Spacing.sm),
                )
            }
        } else {
            item {
                InsetGroupedSection {
                    store.approvedRequests.forEachIndexed { index, request ->
                        rowCard(store, request, userId, isRoadmap = false, scope)
                        if (index != store.approvedRequests.lastIndex) InsetGroupedDivider()
                    }
                }
            }
        }

        roadmapSection(
            "Planned", AppIcon.fromSystemName("clock")!!.imageVector, AppColors.appAccentBlue,
            store.plannedRoadmapItems, store, userId, scope,
        )
        roadmapSection(
            "In Progress",
            AppIcon.fromSystemName("paperplane.circle.fill")?.imageVector
                ?: AppIcon.fromSystemName("arrow.up.right")!!.imageVector,
            AppColors.appAccentPurple, store.inProgressRoadmapItems, store, userId, scope,
        )
        roadmapSection(
            "Completed", AppIcon.fromSystemName("checkmark.circle.fill")!!.imageVector, Color(0xFF22C55E),
            store.completedRoadmapItems, store, userId, scope,
        )
    }
}

private fun LazyListScope.roadmapSection(
    title: String,
    icon: ImageVector,
    color: Color,
    items: List<FeatureRequest>,
    store: FeatureRequestsStore,
    userId: String?,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    if (items.isEmpty()) return
    item {
        sectionHeader(title, icon, color, items.size)
        InsetGroupedSection {
            items.forEachIndexed { index, request ->
                rowCard(store, request, userId, isRoadmap = true, scope)
                if (index != items.lastIndex) InsetGroupedDivider()
            }
        }
    }
}

@Composable
private fun rowCard(
    store: FeatureRequestsStore,
    request: FeatureRequest,
    userId: String?,
    isRoadmap: Boolean,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    val userVote = store.userVotes.firstOrNull { it.featureRequestId == request.id }?.voteType
    Box(Modifier.fillMaxWidth().padding(horizontal = 2.dp)) {
        FeatureRequestRow(
            request = request,
            userVote = userVote,
            onVote = if (isRoadmap) null else { type: FeatureRequestVote.VoteType ->
                if (userId != null) scope.launch { store.vote(request.id, userId, type) }
                Unit
            },
        )
    }
}

@Composable
private fun sectionHeader(title: String, icon: ImageVector, color: Color, count: Int? = null) {
    Row(
        Modifier.padding(top = Spacing.sm, bottom = Spacing.xs),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(14.dp))
        Text(title, style = AppTypography.captionEmphasized, color = AppColors.appTextPrimary)
        if (count != null) {
            Text(
                "$count",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = color,
                modifier = Modifier
                    .clip(RoundedCornerShape(CornerRadius.sm))
                    .background(color.copy(alpha = 0.18f))
                    .padding(horizontal = Spacing.sm, vertical = 2.dp),
            )
        }
    }
}

@Composable
private fun loadingPlaceholder() {
    Column(
        Modifier.fillMaxWidth().padding(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        sectionHeader("Community Voting", AppIcon.fromSystemName("lightbulb.fill")!!.imageVector, AppColors.appPrimary)
        repeat(3) { skeletonRow() }
        sectionHeader("Planned", AppIcon.fromSystemName("clock")!!.imageVector, AppColors.appAccentBlue)
        repeat(2) { skeletonRow() }
    }
}

@Composable
private fun skeletonRow() {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(CornerRadius.lg))
            .background(AppColors.appSurfaceElevated)
            .padding(Spacing.md)
            .shimmering(),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            SkeletonBlock(width = 22.dp, height = 22.dp, cornerRadius = 6.dp)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                SkeletonBlock(width = 190.dp, height = 16.dp)
                SkeletonCapsule(width = 84.dp, height = 18.dp)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SkeletonBlock(height = 12.dp)
            SkeletonBlock(width = 220.dp, height = 12.dp)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            SkeletonBlock(width = 140.dp, height = 11.dp)
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                SkeletonBlock(width = 32.dp, height = 32.dp, cornerRadius = CornerRadius.sm)
                SkeletonBlock(width = 40.dp, height = 24.dp, cornerRadius = CornerRadius.sm)
                SkeletonBlock(width = 32.dp, height = 32.dp, cornerRadius = CornerRadius.sm)
            }
        }
    }
}

@Composable
private fun emptyState(onSubmit: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(
            imageVector = AppIcon.fromSystemName("lightbulb")!!.imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(36.dp),
        )
        Text("No feature requests yet", style = AppTypography.headline, color = AppColors.appTextPrimary)
        Text(
            "Be the first to submit one! Tap the green + button up top.",
            style = AppTypography.caption,
            color = AppColors.appTextSecondary,
        )
        Row(
            Modifier
                .clip(RoundedCornerShape(CornerRadius.pill))
                .background(AppColors.appPrimary)
                .clickable(onClick = onSubmit)
                .padding(horizontal = Spacing.lg, vertical = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName("plus.circle.fill")!!.imageVector,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(18.dp),
            )
            Text("Submit a request", style = AppTypography.bodyEmphasized, color = Color.White)
        }
    }
}

@Composable
private fun errorState(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(
            imageVector = AppIcon.fromSystemName("exclamationmark.triangle.fill")!!.imageVector,
            contentDescription = null,
            tint = AppColors.appAccentAmber,
            modifier = Modifier.size(36.dp),
        )
        Text("Couldn't load feature requests", style = AppTypography.headline, color = AppColors.appTextPrimary)
        Text(message, style = AppTypography.caption, color = AppColors.appTextSecondary)
        Row(
            Modifier
                .clip(RoundedCornerShape(CornerRadius.pill))
                .background(AppColors.appPrimary)
                .clickable(onClick = onRetry)
                .padding(horizontal = Spacing.lg, vertical = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName("arrow.clockwise")!!.imageVector,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(16.dp),
            )
            Text("Retry", style = AppTypography.bodyEmphasized, color = Color.White)
        }
    }
}
