package com.wagerproof.app.features.agents

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.AgentRowCard
import com.wagerproof.app.features.agents.components.RowSwipeAction
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentSpriteIndex
import com.wagerproof.core.stores.AgentPicksSeenStore
import com.wagerproof.core.stores.FollowedAgentsStore
import kotlin.math.abs

/**
 * Following rail + "See All" sheet at the top of My Agents — port of
 * `AgentsView.followingRail` / `.followingListSheet`.
 *
 * The rail is a horizontal strip of the public agents the user follows: pixel
 * avatar tile, an unread-picks dot when the agent has generated since the user
 * last opened it, and a ±5 streak badge. Tapping opens the READ-ONLY public
 * detail (never the owner surface). "See All" opens a sheet with the full list
 * and swipe actions (Copy build / Details / Unfollow).
 */

/** Streaks below this magnitude aren't worth a badge (iOS uses the same cutoff). */
private const val STREAK_BADGE_THRESHOLD = 5

@Composable
fun FollowingRail(
    follows: List<FollowedAgentsStore.FollowedAgent>,
    unreadToken: Int,
    onOpenAgent: (String) -> Unit,
    onSeeAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (follows.isEmpty()) return
    Column(modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AgentSectionHeader(
            title = "Following",
            systemImage = "person.2.fill",
            modifier = Modifier.padding(horizontal = 12.dp),
            trailing = {
                Text(
                    "See All",
                    color = AppColors.appPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clickable(onClick = onSeeAll)
                        .semantics { contentDescription = "See all followed agents" }
                        .padding(horizontal = 4.dp, vertical = 2.dp),
                )
            },
        )
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                // The unread badge overlaps the tile's top edge; the top pad keeps
                // it inside the scroll bounds so it isn't clipped.
                .padding(horizontal = 12.dp)
                .padding(top = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            follows.forEach { followed ->
                FollowedAgentTile(
                    followed = followed,
                    unreadToken = unreadToken,
                    onTap = { onOpenAgent(followed.avatarId) },
                )
            }
        }
    }
}

@Composable
private fun FollowedAgentTile(
    followed: FollowedAgentsStore.FollowedAgent,
    unreadToken: Int,
    onTap: () -> Unit,
) {
    val hasUnread = hasUnreadPicks(followed, unreadToken)
    val streak = followed.performance?.currentStreak ?: 0
    Column(
        Modifier.width(64.dp).clickable(onClick = onTap),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(52.dp)) {
            AgentPixelAvatarTile(
                spriteIndex = AgentSpriteIndex.forSeed(followed.avatarId),
                avatarColor = followed.avatarColor,
                modifier = Modifier.fillMaxSize(),
            )
            if (hasUnread) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 4.dp, y = (-4).dp)
                        .size(11.dp)
                        .clip(CircleShape)
                        .background(AppColors.brandGreenBright)
                        .border(1.5.dp, AppColors.appSurfaceElevated, CircleShape)
                        .semantics { contentDescription = "New picks" },
                )
            }
            if (abs(streak) >= STREAK_BADGE_THRESHOLD) {
                StreakBadge(streak, Modifier.align(Alignment.CenterStart).offset(x = (-10).dp))
            }
        }
        Text(
            followed.name,
            color = AppColors.appTextPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** Hot/cold run badge — 🔥 for a win streak, 🧊 for a losing one. */
@Composable
private fun StreakBadge(streak: Int, modifier: Modifier = Modifier) {
    val edge = if (streak > 0) Color(0xFFF97316) else Color(0xFF38BDF8)
    Row(
        modifier
            .clip(CircleShape)
            .background(Color.Black.copy(alpha = 0.82f))
            .border(1.dp, edge.copy(alpha = 0.8f), CircleShape)
            .padding(horizontal = 5.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(if (streak > 0) "🔥" else "🧊", fontSize = 10.sp)
        Text("${abs(streak)}", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
    }
}

/**
 * Pixel-avatar tile used by the rail — port of iOS `AgentPixelAvatarTile`:
 * elevated surface, the agent's gradient at 85%, a 1.5dp lift border, and the
 * sprite inset 3dp.
 */
@Composable
private fun AgentPixelAvatarTile(
    spriteIndex: Int,
    avatarColor: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    val primary = AgentColorPalette.primary(avatarColor)
    Box(
        modifier
            .shadow(10.dp, shape, spotColor = primary, ambientColor = primary)
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .background(
                Brush.linearGradient(
                    AgentColorPalette.avatarGradient(avatarColor),
                    start = Offset.Zero,
                    end = Offset.Infinite,
                ),
                alpha = 0.85f,
            )
            .border(1.5.dp, AppColors.appSurfaceElevated, shape),
        contentAlignment = Alignment.Center,
    ) {
        PixelSpriteAvatar(spriteIndex, Modifier.fillMaxSize().padding(3.dp))
    }
}

/**
 * "See All" sheet: the full follow list as [AgentRowCard]s with the same swipe
 * actions iOS offers — leading Copy build / Details, trailing Unfollow.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FollowingSheet(
    follows: List<FollowedAgentsStore.FollowedAgent>,
    unreadToken: Int,
    onOpenAgent: (String) -> Unit,
    onCopyBuild: (String) -> Unit,
    onUnfollow: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false),
        containerColor = AppColors.appSurface,
    ) {
        Text(
            "Following",
            color = AppColors.appTextPrimary,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        LazyColumn(Modifier.fillMaxWidth()) {
            items(follows, key = { it.avatarId }) { followed ->
                AgentSwipeRow(
                    leadingActions = listOf(
                        RowSwipeAction("copy", "Copy", "doc.on.doc", Color(0xFF6366F1)) {
                            onCopyBuild(followed.avatarId)
                        },
                        RowSwipeAction("details", "Details", "info.circle", Color(0xFF0EA5E9)) {
                            onOpenAgent(followed.avatarId)
                        },
                    ),
                    trailingActions = listOf(
                        RowSwipeAction("unfollow", "Unfollow", "person.badge.minus", AppColors.appLoss) {
                            onUnfollow(followed.avatarId)
                        },
                    ),
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                ) {
                    AgentRowCard(
                        agent = followed.agentWithPerformance,
                        hasUnreadPicks = hasUnreadPicks(followed, unreadToken),
                        onTap = { onOpenAgent(followed.avatarId) },
                    )
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

/**
 * Unread state for a followed agent. [unreadToken] is read (and discarded) so a
 * bump after a detail visit recomposes these rows — `AgentPicksSeenStore` is
 * SharedPreferences-backed and therefore not observable on its own.
 */
@Composable
private fun hasUnreadPicks(followed: FollowedAgentsStore.FollowedAgent, unreadToken: Int): Boolean {
    @Suppress("UNUSED_EXPRESSION") unreadToken
    return AgentPicksSeenStore.hasUnread(followed.avatarId, followed.lastGeneratedAt)
}
