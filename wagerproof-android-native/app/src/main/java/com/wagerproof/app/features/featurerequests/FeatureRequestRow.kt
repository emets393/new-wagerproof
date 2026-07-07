package com.wagerproof.app.features.featurerequests

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.CornerRadius
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.FeatureRequest
import com.wagerproof.core.models.FeatureRequestVote
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Port of iOS `FeatureRequestRow.swift`. Community-vote variant (thumbs up/down
 * + net badge) or roadmap variant (read-only "N votes" pill). [onVote] null =
 * read-only.
 */
private data class RowVisuals(val badgeText: String, val badgeColor: Color, val icon: ImageVector)

@Composable
fun FeatureRequestRow(
    request: FeatureRequest,
    userVote: FeatureRequestVote.VoteType?,
    onVote: ((FeatureRequestVote.VoteType) -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val visuals = visualsFor(request)
    Column(
        modifier.padding(vertical = Spacing.xs),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        // Header: status icon + title + status badge.
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            Box(Modifier.size(28.dp), contentAlignment = Alignment.TopStart) {
                Icon(imageVector = visuals.icon, contentDescription = null, tint = visuals.badgeColor, modifier = Modifier.size(22.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                Text(request.title, style = AppTypography.headline, color = AppColors.appTextPrimary)
                Text(
                    visuals.badgeText,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = visuals.badgeColor,
                    modifier = Modifier
                        .clip(RoundedCornerShape(CornerRadius.sm))
                        .background(visuals.badgeColor.copy(alpha = 0.18f))
                        .padding(horizontal = Spacing.sm, vertical = 4.dp),
                )
            }
        }

        Text(request.description, style = AppTypography.body, color = AppColors.appTextSecondary)

        // Footer: "By <name> · <date>" + vote cluster.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            Text(footerCaption(request), style = AppTypography.caption, color = AppColors.appTextMuted, maxLines = 1)
            Spacer(Modifier.weight(1f))
            if (onVote != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs), verticalAlignment = Alignment.CenterVertically) {
                    voteButton(FeatureRequestVote.VoteType.UPVOTE, userVote == FeatureRequestVote.VoteType.UPVOTE, onVote)
                    netBadge(request.netVotes)
                    voteButton(FeatureRequestVote.VoteType.DOWNVOTE, userVote == FeatureRequestVote.VoteType.DOWNVOTE, onVote)
                }
            } else {
                val n = request.netVotes
                Text(
                    "$n ${if (kotlin.math.abs(n) == 1) "vote" else "votes"}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.appTextSecondary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(CornerRadius.sm))
                        .background(AppColors.appSurfaceMuted)
                        .padding(horizontal = Spacing.sm, vertical = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun voteButton(
    type: FeatureRequestVote.VoteType,
    isActive: Boolean,
    onVote: (FeatureRequestVote.VoteType) -> Unit,
) {
    val activeColor = if (type == FeatureRequestVote.VoteType.UPVOTE) Color(0xFF22C55E) else AppColors.appLoss
    // hand.thumbsup.fill / hand.thumbsdown.fill are unmapped in AppIcon — fall
    // back to plain up/down arrows.
    val icon = if (type == FeatureRequestVote.VoteType.UPVOTE) {
        AppIcon.fromSystemName("hand.thumbsup.fill")?.imageVector ?: AppIcon.fromSystemName("arrow.up")!!.imageVector
    } else {
        AppIcon.fromSystemName("hand.thumbsdown.fill")?.imageVector ?: AppIcon.fromSystemName("arrow.down")!!.imageVector
    }
    Box(
        Modifier
            .size(32.dp)
            .clip(RoundedCornerShape(CornerRadius.sm))
            .background(if (isActive) activeColor.copy(alpha = 0.18f) else AppColors.appSurfaceMuted)
            .clickable { onVote(type) },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = if (type == FeatureRequestVote.VoteType.UPVOTE) "Upvote" else "Downvote",
            tint = if (isActive) activeColor else AppColors.appTextSecondary,
            modifier = Modifier.size(14.dp),
        )
    }
}

@Composable
private fun netBadge(net: Int) {
    val color = when {
        net > 0 -> Color(0xFF22C55E)
        net < 0 -> AppColors.appLoss
        else -> AppColors.appTextSecondary
    }
    val bg = when {
        net > 0 -> Color(0xFF22C55E).copy(alpha = 0.18f)
        net < 0 -> AppColors.appLoss.copy(alpha = 0.18f)
        else -> AppColors.appSurfaceMuted
    }
    Text(
        if (net > 0) "+$net" else "$net",
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        color = color,
        modifier = Modifier
            .widthIn(min = 40.dp)
            .clip(RoundedCornerShape(CornerRadius.sm))
            .background(bg)
            .padding(horizontal = Spacing.sm, vertical = 4.dp),
    )
}

private fun visualsFor(request: FeatureRequest): RowVisuals {
    if (request.status != FeatureRequest.Status.ROADMAP) {
        return RowVisuals("Community", AppColors.appPrimary, AppIcon.fromSystemName("lightbulb.fill")!!.imageVector)
    }
    return when (request.roadmapStatus) {
        FeatureRequest.RoadmapStatus.PLANNED ->
            RowVisuals("Planned", AppColors.appAccentBlue, AppIcon.fromSystemName("clock")!!.imageVector)
        FeatureRequest.RoadmapStatus.IN_PROGRESS ->
            // paperplane.circle.fill unmapped — fall back to arrow.up.right (send-ish).
            RowVisuals(
                "In Progress", AppColors.appAccentPurple,
                AppIcon.fromSystemName("paperplane.circle.fill")?.imageVector
                    ?: AppIcon.fromSystemName("arrow.up.right")!!.imageVector,
            )
        FeatureRequest.RoadmapStatus.COMPLETED ->
            RowVisuals("Completed", Color(0xFF22C55E), AppIcon.fromSystemName("checkmark.circle.fill")!!.imageVector)
        null ->
            // map.fill unmapped — fall back to list.bullet.
            RowVisuals(
                "Roadmap", AppColors.appAccentBlue,
                AppIcon.fromSystemName("map.fill")?.imageVector ?: AppIcon.fromSystemName("list.bullet")!!.imageVector,
            )
    }
}

private val displayFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault())

private fun footerCaption(request: FeatureRequest): String {
    val name = request.submitterDisplayName.ifEmpty { "Anonymous" }
    val dateStr = runCatching {
        OffsetDateTime.parse(request.createdAt).format(displayFormatter)
    }.getOrDefault(request.createdAt)
    return "By $name · $dateStr"
}
