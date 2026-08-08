package com.wagerproof.widgets

import android.content.Context
import android.graphics.Bitmap
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.wagerproof.core.models.TopAgentWidgetData
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.WidgetPayloadStore
import kotlin.math.abs

/**
 * "Agent Monitor" home-screen widget — Glance port of iOS `AgentMonitorWidget`.
 *
 * Renders the user's top AI agents from the App Group payload the main app
 * syncs (`WidgetPayloadStore.read().topAgentPicks`). The small tile is iOS's
 * "AGENT FORM" card: pixel sprite, cumulative W/L sparkline, net units, record,
 * current streak and BEST n. No in-widget network fetch — empty cache → "open
 * the app" placeholder. Tap → `wagerproof://agents`.
 */
class AgentMonitorGlanceWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(WidgetSizes.ALL)

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        AppGroup.initialize(context)
        val agents = WidgetPayloadStore.read().topAgentPicks
        // Bitmaps are produced HERE, outside composition: Glance composes into
        // RemoteViews and may re-run, and Canvas work per pass would be wasted.
        // Only the first three agents can ever be shown, so only those decode.
        val sprites: Map<String, Bitmap> = agents.take(3)
            .mapNotNull { agent ->
                AgentWidgetGraphics.sprite(context, agent.resolvedSpriteIndex)?.let { agent.agentId to it }
            }
            .toMap()
        // The sparkline is small-tile only, and the small tile only ever shows
        // agents.first() — rendering more would be dead pixels.
        val sparkline = agents.firstOrNull()?.let { agent ->
            AgentWidgetGraphics.formSparkline(
                values = agent.form,
                color = WidgetTheme.parseHex(agent.agentColor) ?: WidgetTheme.accent,
            )
        }
        provideContent {
            AgentMonitorContent(agents, sprites, sparkline)
        }
    }
}

class AgentMonitorWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AgentMonitorGlanceWidget()
}

private fun agentsDeepLink(context: Context): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse("wagerproof://agents")).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

@Composable
private fun AgentMonitorContent(
    agents: List<TopAgentWidgetData>,
    sprites: Map<String, Bitmap>,
    sparkline: Bitmap?,
) {
    val size = LocalSize.current
    val family = when {
        size.width < 200.dp -> WidgetFamily.SMALL
        size.height < 220.dp -> WidgetFamily.MEDIUM
        else -> WidgetFamily.LARGE
    }
    val root = GlanceModifier
        .fillMaxSize()
        .background(WidgetTheme.background)
        .clickable(actionStartActivity(agentsDeepLink(LocalContext.current)))

    when {
        agents.isEmpty() ->
            Box(root.padding(12.dp), contentAlignment = Alignment.Center) {
                EmptyAgents(compact = family == WidgetFamily.SMALL)
            }
        family == WidgetFamily.SMALL ->
            // Small keeps the gradient-tint identity; other families use a flat bg.
            Box(root, contentAlignment = Alignment.TopStart) {
                SmallAgent(agents.first(), sprites[agents.first().agentId], sparkline)
            }
        family == WidgetFamily.LARGE ->
            Box(root.padding(12.dp), contentAlignment = Alignment.TopStart) {
                AgentList(agents.take(3), sprites, showPicks = true)
            }
        else ->
            Box(root.padding(12.dp), contentAlignment = Alignment.TopStart) {
                AgentList(agents.take(2), sprites, showPicks = false)
            }
    }
}

@Composable
private fun EmptyAgents(compact: Boolean) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // FIDELITY-WAIVER #211: iOS "brain.head.profile" SF Symbol → emoji.
        Text("🧠", style = TextStyle(fontSize = if (compact) 20.sp else 24.sp))
        Spacer(GlanceModifier.height(4.dp))
        Text(
            text = if (compact) "Agents" else "Open WagerProof to load your agents",
            style = TextStyle(
                color = ColorProvider(WidgetTheme.textSecondary),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            ),
        )
    }
}

/**
 * The small "AGENT FORM" tile (iOS `SmallAgentView`): sprite + form sparkline
 * behind a header/footer pair carrying net units, record, current streak and
 * BEST n.
 *
 * FIDELITY-WAIVER #210: iOS draws a diagonal gradient (agent color 22% →
 * surface). Glance has no gradient brush on a container, so the panel takes a
 * flat 22%-alpha wash of the agent color instead.
 */
@Composable
private fun SmallAgent(agent: TopAgentWidgetData, sprite: Bitmap?, sparkline: Bitmap?) {
    val color = WidgetTheme.parseHex(agent.agentColor) ?: WidgetTheme.accent
    Box(modifier = GlanceModifier.fillMaxSize().background(color.copy(alpha = 0.22f))) {
        // Sparkline sits behind the text, bottom-anchored like iOS's 42pt top pad.
        if (sparkline != null) {
            Box(
                modifier = GlanceModifier.fillMaxSize().padding(top = 46.dp),
                contentAlignment = Alignment.BottomStart,
            ) {
                Image(
                    provider = ImageProvider(sparkline),
                    contentDescription = null,
                    contentScale = ContentScale.FillBounds,
                    modifier = GlanceModifier.fillMaxWidth().height(64.dp),
                )
            }
        }

        Column(modifier = GlanceModifier.fillMaxSize().padding(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(modifier = GlanceModifier.defaultWeight()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Dot reads green while the agent is on a win run, red on a slide.
                        Box(
                            modifier = GlanceModifier
                                .width(5.dp)
                                .height(5.dp)
                                .cornerRadius(3.dp)
                                .background(if (agent.currentStreak >= 0) WidgetTheme.win else WidgetTheme.loss),
                        ) {}
                        Spacer(GlanceModifier.width(4.dp))
                        Text(
                            "AGENT FORM",
                            style = TextStyle(
                                color = ColorProvider(WidgetTheme.textMuted),
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                            ),
                        )
                    }
                    Spacer(GlanceModifier.height(3.dp))
                    Text(
                        agent.agentName,
                        style = TextStyle(
                            color = ColorProvider(WidgetTheme.textPrimary),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                        maxLines = 2,
                    )
                }
                // Sprite is the identity anchor; the emoji is the asset-missing fallback.
                if (sprite != null) {
                    Image(
                        provider = ImageProvider(sprite),
                        contentDescription = null,
                        contentScale = ContentScale.Fit,
                        modifier = GlanceModifier.width(52.dp).height(69.dp),
                    )
                } else {
                    Text(agent.agentEmoji, style = TextStyle(fontSize = 20.sp))
                }
            }

            Spacer(GlanceModifier.defaultWeight())

            Row(verticalAlignment = Alignment.Bottom) {
                Column(modifier = GlanceModifier.defaultWeight()) {
                    Text(
                        agent.netUnitsDisplay(),
                        style = TextStyle(
                            color = ColorProvider(if (agent.netUnits >= 0) WidgetTheme.win else WidgetTheme.loss),
                            fontSize = 21.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                    Text(
                        "NET UNITS",
                        style = TextStyle(
                            color = ColorProvider(WidgetTheme.textMuted),
                            fontSize = 7.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        agent.record,
                        style = TextStyle(
                            color = ColorProvider(WidgetTheme.textPrimary),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                    Spacer(GlanceModifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (agent.currentStreak != 0) {
                            Text(
                                agent.streakDisplay(),
                                style = TextStyle(
                                    color = ColorProvider(
                                        if (agent.currentStreak > 0) WidgetTheme.win else WidgetTheme.loss,
                                    ),
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                            )
                        }
                        if (agent.bestStreak > 0) {
                            if (agent.currentStreak != 0) Spacer(GlanceModifier.width(4.dp))
                            Text(
                                "BEST ${agent.bestStreak}",
                                style = TextStyle(
                                    color = ColorProvider(WidgetTheme.textMuted),
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AgentList(
    agents: List<TopAgentWidgetData>,
    sprites: Map<String, Bitmap>,
    showPicks: Boolean,
) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Agent Monitor",
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textPrimary),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
            Spacer(GlanceModifier.defaultWeight())
            Text(
                "WagerProof",
                style = TextStyle(color = ColorProvider(WidgetTheme.textMuted), fontSize = 10.sp),
            )
        }
        Spacer(GlanceModifier.height(8.dp))
        agents.forEach { agent ->
            AgentRow(agent, sprites[agent.agentId], showPicks)
            Spacer(GlanceModifier.height(6.dp))
        }
    }
}

@Composable
private fun AgentRow(agent: TopAgentWidgetData, sprite: Bitmap?, showPicks: Boolean) {
    val color = WidgetTheme.parseHex(agent.agentColor) ?: WidgetTheme.accent
    Column(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(WidgetTheme.card)
            .cornerRadius(8.dp)
            .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = GlanceModifier
                    .width(22.dp)
                    .height(22.dp)
                    .background(color.copy(alpha = 0.25f))
                    .cornerRadius(11.dp),
                contentAlignment = Alignment.Center,
            ) {
                // Same sprite-first / emoji-fallback rule as the small tile.
                if (sprite != null) {
                    Image(
                        provider = ImageProvider(sprite),
                        contentDescription = null,
                        contentScale = ContentScale.Fit,
                        modifier = GlanceModifier.width(18.dp).height(24.dp),
                    )
                } else {
                    Text(agent.agentEmoji, style = TextStyle(fontSize = 12.sp))
                }
            }
            Spacer(GlanceModifier.width(8.dp))
            Text(
                agent.agentName,
                modifier = GlanceModifier.defaultWeight(),
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textPrimary),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                ),
                maxLines = 1,
            )
            Spacer(GlanceModifier.width(6.dp))
            Text(
                agent.record,
                style = TextStyle(
                    color = ColorProvider(WidgetTheme.textSecondary),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                ),
            )
            Spacer(GlanceModifier.width(6.dp))
            Text(
                agent.netUnitsDisplay(),
                style = TextStyle(
                    color = ColorProvider(if (agent.netUnits >= 0) WidgetTheme.win else WidgetTheme.loss),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
        }
        if (showPicks) {
            agent.picks.firstOrNull()?.let { pick ->
                Spacer(GlanceModifier.height(3.dp))
                Text(
                    "${pick.matchup} — ${pick.pickSelection}",
                    modifier = GlanceModifier.padding(start = 30.dp),
                    style = TextStyle(color = ColorProvider(WidgetTheme.textMuted), fontSize = 10.sp),
                    maxLines = 1,
                )
            }
        }
    }
}

// MARK: - Display helpers (mirror of iOS view's private computed strings)

private fun TopAgentWidgetData.netUnitsDisplay(): String {
    val sign = if (netUnits >= 0) "+" else ""
    return "$sign${"%.1f".format(netUnits)}u"
}

private fun TopAgentWidgetData.streakDisplay(): String =
    if (currentStreak > 0) "W$currentStreak" else "L${abs(currentStreak)}"
