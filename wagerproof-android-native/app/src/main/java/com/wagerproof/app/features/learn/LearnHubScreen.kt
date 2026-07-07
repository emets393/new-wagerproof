package com.wagerproof.app.features.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.LearnWagerProofStore

/**
 * Port of iOS `LearnWagerProofView.swift`. "Learn & Discover" hub page — an
 * extra entry point beyond the walkthrough sheet. Intro line + 6 full-color
 * topic cards; tapping one opens [LearnWagerProofSheet] at the matching slide.
 */
private data class TopicCard(
    val topic: LearnWagerProofStore.Topic,
    val accent: Color,
    val icon: ImageVector,
    val title: String,
    val subtitle: String,
)

@Composable
fun LearnHubScreen(modifier: Modifier = Modifier) {
    val learnStore = appGraph().learn
    val cards = listOf(
        TopicCard(
            LearnWagerProofStore.Topic.CreateAgent, AppColors.appPrimary,
            AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
            "Create a 24/7 Agent",
            "Build agents that research games and find picks for you all day, every day.",
        ),
        TopicCard(
            LearnWagerProofStore.Topic.GameCards, AppColors.appAccentBlue,
            AppIcon.fromSystemName("rectangle.stack.fill")!!.imageVector,
            "Game Predictions",
            "Our AI model analyzes thousands of data points so green = strong pick.",
        ),
        TopicCard(
            LearnWagerProofStore.Topic.GameDetails, AppColors.appAccentPurple,
            AppIcon.fromSystemName("chart.bar.fill")!!.imageVector,
            "Game Details",
            "Tap any game card to reveal full analysis and public betting sentiment.",
        ),
        TopicCard(
            LearnWagerProofStore.Topic.WagerBot, AppColors.appAccentAmber,
            AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
            "WagerBot Assistant",
            "WagerBot watches for trends, streaks, and situational edges in real time.",
        ),
        TopicCard(
            LearnWagerProofStore.Topic.Outliers, Color(0xFF10B981),
            AppIcon.fromSystemName("chart.line.uptrend.xyaxis")!!.imageVector,
            "Outliers & Alerts",
            "Spot value where prediction markets disagree with Vegas — or fade overconfident models.",
        ),
        TopicCard(
            LearnWagerProofStore.Topic.MoreFeatures, Color(0xFF5865F2),
            AppIcon.fromSystemName("square.grid.2x2.fill")!!.imageVector,
            "More Features",
            "Discord, trends, live scores, bet-slip grader, and more.",
        ),
    )

    Column(
        modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.lg)
            .padding(bottom = Spacing.xxl),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Text(
            "Explore the features, signals, and shortcuts that get the most out of WagerProof.",
            fontSize = 15.sp,
            color = AppColors.appTextSecondary,
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.xs),
        )
        cards.forEach { topicCard(it) { learnStore.openSheet(it.topic) } }
    }
}

@Composable
private fun topicCard(card: TopicCard, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .widthIn(max = 720.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(card.accent)
            .clickable(onClick = onClick),
    ) {
        Box(
            Modifier.fillMaxWidth().height(180.dp).background(card.accent),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = card.icon,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.9f),
                modifier = Modifier.size(80.dp),
            )
        }
        Column(
            Modifier
                .fillMaxWidth()
                .background(card.accent)
                .padding(horizontal = Spacing.lg)
                .padding(top = Spacing.sm, bottom = Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(card.title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text(card.subtitle, fontSize = 14.sp, color = Color.White.copy(alpha = 0.85f), lineHeight = 18.sp)
        }
    }
}
