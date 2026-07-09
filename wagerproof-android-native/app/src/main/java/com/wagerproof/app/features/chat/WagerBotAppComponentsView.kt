package com.wagerproof.app.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.core.models.WagerBotAppComponent
import com.wagerproof.core.models.WagerBotChatNav
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** Rich V2 WagerBot components, kept visually compact enough for the chat feed. */
@Composable
fun WagerBotAppComponentsView(
    summary: String?,
    components: List<WagerBotAppComponent>,
    ui: WagerBotUiTokens,
    modifier: Modifier = Modifier,
    onNav: (WagerBotChatNav) -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        summary?.takeIf { it.isNotBlank() }?.let {
            WagerBotMarkdownText(
                text = it,
                modifier = Modifier.padding(start = 4.dp, end = 12.dp),
                baseFontSize = 14.sp,
                primaryColor = ui.primaryText,
                secondaryColor = ui.mutedText,
            )
        }
        if (components.size <= 1) {
            components.forEach { WagerBotComponentCard(it, ui, onNav = onNav) }
        } else {
            val columns = components.chunked(2)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                itemsIndexed(columns, key = { index, column -> "${index}_${column.joinToString { it.id }}" }) { _, column ->
                    Column(Modifier.width(290.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        column.forEach { WagerBotComponentCard(it, ui, onNav = onNav) }
                    }
                }
            }
        }
    }
}

@Composable
private fun WagerBotComponentCard(
    component: WagerBotAppComponent,
    ui: WagerBotUiTokens,
    onNav: (WagerBotChatNav) -> Unit,
) {
    val nav = component.nav
    val tappable = nav != null && nav.kind != "none"
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ui.surfaceBackground.copy(alpha = 0.92f))
            .border(1.dp, ui.borderColor.copy(alpha = 0.7f), shape)
            .then(if (tappable) Modifier.clickable { nav?.let(onNav) } else Modifier)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.weight(1f)) { ComponentContent(component, ui) }
        if (tappable) {
            Icon(chatIcon("chevron.right"), null, tint = ui.mutedText.copy(alpha = 0.7f), modifier = Modifier.size(12.dp))
        }
    }
}

@Composable
private fun ComponentContent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    when (c.type) {
        "game", "value" -> GameComponent(c, ui, c.type == "value")
        "prop" -> PropComponent(c, ui)
        "agent" -> AgentComponent(c, ui)
        "agent_pick" -> AgentPickComponent(c, ui)
        "editor_pick" -> EditorPickComponent(c, ui)
        "tool" -> ToolComponent(c, ui)
        "model_projection" -> ModelProjectionComponent(c, ui)
        "polymarket" -> PolymarketComponent(c, ui)
        "betting_trends" -> KeyValueRows(c, ui, "Betting Trends", "chart.bar.fill", c.rows("rows"))
        "model_accuracy" -> ModelAccuracyComponent(c, ui)
        "injury" -> InjuryComponent(c, ui)
        "weather" -> WeatherComponent(c, ui)
        "public_betting" -> KeyValueRows(c, ui, "Public Betting", "person.2.fill", c.rows("splits"))
        else -> UnknownComponent(c, ui)
    }
}

@Composable
private fun ComponentHeader(
    icon: String,
    title: String,
    ui: WagerBotUiTokens,
    accent: Color = ui.accent,
    trailing: String? = null,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(chatIcon(icon), null, tint = accent, modifier = Modifier.size(12.dp))
        Text(title.uppercase(), color = ui.mutedText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        trailing?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = ui.mutedText, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
    }
}

@Composable
private fun Pill(text: String, color: Color) {
    Text(
        text,
        color = color,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.14f)).padding(horizontal = 8.dp, vertical = 3.dp),
        maxLines = 1,
    )
}

@Composable
private fun Stat(label: String, value: String, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(label, color = ui.mutedText, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = ui.primaryText, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun GameComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens, isValue: Boolean) {
    val sport = c.string("sport") ?: "nba"
    val away = c.string("away_team") ?: c.string("away_abbr") ?: "Away"
    val home = c.string("home_team") ?: c.string("home_abbr") ?: "Home"
    val awayAbbr = c.string("away_abbr") ?: away.take(3).uppercase()
    val homeAbbr = c.string("home_abbr") ?: home.take(3).uppercase()
    val accent = if (isValue) Amber else ui.accent
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ComponentHeader(
            icon = if (isValue) "bolt.fill" else "sportscourt.fill",
            title = if (isValue) "Value Play" else sport,
            ui = ui,
            accent = accent,
            trailing = gameTime(c.string("game_time")),
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
                GameCardTeamAvatar(sport, away, 36.dp)
                GameCardTeamAvatar(sport, home, 36.dp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("$awayAbbr @ $homeAbbr", color = ui.primaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                c.string("pick")?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            c.string("spread")?.let { Pill(it, ui.accent) }
            c.string("total")?.let { Pill("O/U $it", ui.accent) }
            c.double("spread_edge")?.takeIf { kotlin.math.abs(it) >= 0.5 }?.let {
                Pill("Edge ${signed(it)}", edgeColor(kotlin.math.abs(it)))
            }
        }
    }
}

@Composable
private fun PropComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ComponentHeader("figure.basketball", "Player Prop", ui, Teal, c.string("team"))
        Text(c.string("player") ?: "Player", color = ui.primaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            c.string("line")?.let { Pill(it, ui.accent) }
            c.double("l10_hit_rate")?.let { Pill("L10 ${it.toInt()}%", edgeColor(it / 10)) }
            c.string("trend")?.let { Pill(it, ui.mutedText) }
        }
    }
}

@Composable
private fun AgentComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    val units = c.double("net_units") ?: 0.0
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(ui.accent.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
            Text(c.string("emoji") ?: "🎯", fontSize = 25.sp)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(c.string("name") ?: "Agent", color = ui.primaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                c.string("record")?.let { Pill(it, ui.mutedText) }
                Pill("${signed(units)}u", if (units >= 0) Win else Loss)
                c.double("win_rate")?.let { Pill("${(it * 100).toInt()}%", ui.accent) }
            }
        }
    }
}

@Composable
private fun AgentPickComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ComponentHeader("brain.head.profile", c.string("agent_name") ?: "Agent Pick", ui, trailing = (c.string("result") ?: "pending").uppercase())
        Text(c.string("selection").orEmpty(), color = ui.primaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        c.string("matchup")?.let { Text(it, color = ui.mutedText, fontSize = 12.sp, fontWeight = FontWeight.Medium) }
        c.string("reasoning")?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = ui.mutedText, fontSize = 12.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun EditorPickComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ComponentHeader("star.fill", "Editor's Pick", ui, Amber, c.string("result")?.uppercase())
        Text(c.string("selection").orEmpty(), color = ui.primaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            c.string("matchup")?.let { Text(it, color = ui.mutedText, fontSize = 12.sp, modifier = Modifier.weight(1f, false)) }
            c.string("best_price")?.let { Pill(it, ui.accent) }
            c.string("sportsbook")?.let { Pill(it, ui.mutedText) }
        }
        c.string("analysis")?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = ui.mutedText, fontSize = 12.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ToolComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(ui.accent), contentAlignment = Alignment.Center) {
            Icon(chatIcon(c.string("icon") ?: "wrench.and.screwdriver.fill"), null, tint = Color.White, modifier = Modifier.size(20.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(c.string("title") ?: "Open tool", color = ui.primaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            c.string("subtitle")?.let { Text(it, color = ui.mutedText, fontSize = 12.sp, maxLines = 2) }
        }
    }
}

@Composable
private fun ModelProjectionComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        ComponentHeader("chart.bar.doc.horizontal.fill", "Model Projection", ui, trailing = c.string("matchup"))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Stat("Proj. Score", c.string("predicted_score") ?: "—", ui)
            Stat("Fair Line", signed(c.double("model_fair_spread")), ui)
            Stat("Fair Total", trim(c.double("model_fair_total")), ui)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            c.double("spread_edge")?.let { Pill("Spread edge ${signed(it)}", edgeColor(kotlin.math.abs(it))) }
            c.double("total_edge")?.let { Pill("Total edge ${signed(it)}", edgeColor(kotlin.math.abs(it))) }
        }
    }
}

@Composable
private fun PolymarketComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        ComponentHeader("chart.line.uptrend.xyaxis", "Prediction Market", ui, Purple)
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Stat(c.string("away_abbr") ?: "Away", c.double("away_implied")?.let { "${it.toInt()}%" } ?: "—", ui)
            Stat(c.string("home_abbr") ?: "Home", c.double("home_implied")?.let { "${it.toInt()}%" } ?: "—", ui)
            c.double("model_prob")?.let { Stat("Model", "${it.toInt()}%", ui) }
        }
    }
}

@Composable
private fun ModelAccuracyComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        ComponentHeader("scope", "Model Accuracy", ui, Teal, c.string("bet_type"))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Stat("Record", c.string("record") ?: "—", ui)
            Stat("Win %", c.double("win_pct")?.let { "${it.toInt()}%" } ?: "—", ui)
            c.double("roi_pct")?.let { Stat("ROI", "${signed(it)}%", ui) }
        }
    }
}

@Composable
private fun InjuryComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    val rows = c.rows("players")
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ComponentHeader("cross.case.fill", "Injury Report", ui, Loss, c.string("matchup"))
        if (rows.isEmpty()) Text("No notable injuries", color = ui.mutedText, fontSize = 12.sp)
        rows.forEach { row ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(row.text("name"), color = ui.primaryText, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                row.text("team").takeIf { it.isNotBlank() }?.let { Text("  $it", color = ui.mutedText, fontSize = 11.sp) }
                Spacer(Modifier.weight(1f))
                Text(row.text("status"), color = Loss, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun WeatherComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        ComponentHeader("cloud.sun.fill", "Weather", ui, Blue, c.string("matchup"))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            c.double("temperature")?.let { Stat("Temp", "${it.toInt()}°", ui) }
            c.double("wind_speed")?.let { Stat("Wind", "${it.toInt()} mph", ui) }
            c.string("precipitation")?.let { Stat("Precip", it, ui) }
            c.string("sky")?.let { Stat("Sky", it, ui) }
        }
    }
}

@Composable
private fun KeyValueRows(c: WagerBotAppComponent, ui: WagerBotUiTokens, title: String, icon: String, rows: List<JsonObject>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ComponentHeader(icon, title, ui, trailing = c.string("matchup"))
        rows.forEach { row ->
            Row {
                Text(row.text("label"), color = ui.mutedText, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                Spacer(Modifier.weight(1f))
                Text(row.text("value"), color = ui.primaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun UnknownComponent(c: WagerBotAppComponent, ui: WagerBotUiTokens) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        c.string("title")?.let { Text(it, color = ui.primaryText, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
        c.string("analysis")?.let { Text(it, color = ui.mutedText, fontSize = 12.sp) }
    }
}

private fun JsonObject.text(key: String): String = (this[key] as? JsonPrimitive)?.contentOrNull.orEmpty()
private fun edgeColor(edge: Double): Color = when {
    edge >= 5 -> Win
    edge >= 2 -> LightGreen
    else -> Color.Gray
}
private fun signed(value: Double?): String = value?.let { if (it > 0) "+${trim(it)}" else trim(it) } ?: "—"
private fun trim(value: Double?): String = value?.let { if (it % 1.0 == 0.0) it.toInt().toString() else String.format(Locale.US, "%.1f", it) } ?: "—"
private fun gameTime(raw: String?): String? {
    if (raw.isNullOrBlank() || !raw.contains('T')) return raw
    val instant = runCatching { Instant.parse(raw) }.getOrNull()
        ?: runCatching { java.time.OffsetDateTime.parse(raw).toInstant() }.getOrNull()
        ?: return raw
    return DateTimeFormatter.ofPattern("h:mm a", Locale.US).withZone(ZoneId.of("America/New_York")).format(instant) + " ET"
}

private val Amber = Color(0xFFF59E0B)
private val Teal = Color(0xFF14B8A6)
private val Purple = Color(0xFF8B5CF6)
private val Blue = Color(0xFF0EA5E9)
private val Win = Color(0xFF00C853)
private val LightGreen = Color(0xFF8BC34A)
private val Loss = Color(0xFFE53935)
