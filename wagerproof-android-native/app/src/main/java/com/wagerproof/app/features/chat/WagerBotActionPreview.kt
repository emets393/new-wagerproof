package com.wagerproof.app.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.models.WagerBotChatWidget
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Port of iOS `WagerBotActionPreview.swift`. Renders a `present_analysis`
 * widget (legacy V1 path) as a rich inline card: header + optional markdown +
 * a type-dispatched KV grid + a "View game details" footer. Tap opens the game
 * sheet via [onTap].
 */
@Composable
fun WagerBotActionPreview(
    widget: WagerBotChatWidget,
    ui: WagerBotUiTokens,
    modifier: Modifier = Modifier,
    onTap: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ui.hintChipBackground)
            .border(1.dp, ui.borderColor, shape)
            .then(if (onTap != null) Modifier.clickable { onTap() } else Modifier)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Header(widget, ui)
        widget.analysis?.takeIf { it.isNotEmpty() }?.let {
            WagerBotMarkdownText(
                text = it,
                baseFontSize = 13.sp,
                baseFontWeight = FontWeight.Medium,
                primaryColor = ui.primaryText,
                secondaryColor = ui.mutedText,
            )
        }
        WidgetBody(widget, ui)
        Footer(ui)
    }
}

@Composable
private fun Header(widget: WagerBotChatWidget, ui: WagerBotUiTokens) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(chatIcon(headerIcon(widget.widgetType)), contentDescription = null, tint = ui.accent, modifier = Modifier.padding(0.dp).then(Modifier).let { it }.let { Modifier }.let { Modifier })
        Text(headerLabel(widget), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = ui.accent)
        Spacer(Modifier.weight(1f))
        Text(widget.sport.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = ui.mutedText)
    }
}

private fun headerLabel(widget: WagerBotChatWidget): String {
    widget.title?.takeIf { it.isNotEmpty() }?.let { return it }
    return when (widget.widgetType) {
        "matchup" -> "Matchup overview"
        "model_projection" -> "Model projection"
        "polymarket" -> "Polymarket"
        "public_betting" -> "Public betting"
        "injuries" -> "Injuries"
        "betting_trends" -> "Betting trends"
        "weather" -> "Weather"
        else -> widget.widgetType.replace('_', ' ').replaceFirstChar { it.titlecase(Locale.US) }
    }
}

private fun headerIcon(type: String): String = when (type) {
    "matchup" -> "rectangle.split.2x1.fill"
    "model_projection" -> "wand.and.stars"
    "polymarket" -> "chart.line.uptrend.xyaxis"
    "public_betting" -> "person.2.fill"
    "injuries" -> "cross.fill"
    "betting_trends" -> "chart.bar.fill"
    "weather" -> "cloud.sun.fill"
    else -> "chart.bar.doc.horizontal.fill"
}

@Composable
private fun WidgetBody(widget: WagerBotChatWidget, ui: WagerBotUiTokens) {
    val obj = widget.dataJson as? JsonObject ?: return
    val rows: List<Pair<String, String>> = when (widget.widgetType) {
        "model_projection" -> modelProjectionRows(obj)
        "polymarket" -> polymarketRows(obj)
        "public_betting" -> publicBettingRows(obj)
        "injuries" -> injuriesRows(obj)
        "betting_trends" -> genericRows(obj)
        "weather" -> weatherRows(obj)
        "matchup" -> matchupRows(obj)
        else -> genericRows(obj)
    }
    if (rows.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        rows.forEach { (label, value) -> KvRow(label, value, ui) }
    }
}

@Composable
private fun KvRow(label: String, value: String, ui: WagerBotUiTokens) {
    Row(verticalAlignment = Alignment.Top) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = ui.mutedText)
        Spacer(Modifier.weight(1f).widthIn(min = 8.dp))
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = ui.primaryText,
            textAlign = TextAlign.End,
            maxLines = 2,
        )
    }
}

@Composable
private fun Footer(ui: WagerBotUiTokens) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Spacer(Modifier.weight(1f))
        Text("View game details", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = ui.accent)
        Icon(chatIcon("arrow.up.right"), contentDescription = null, tint = ui.accent, modifier = Modifier.padding(0.dp))
    }
}

// MARK: - Per-widget row builders (mirror the iOS decoders)

private fun JsonObject.dbl(key: String): Double? =
    ((this[key] as? JsonPrimitive))?.let { if (it.isString) it.content.toDoubleOrNull() else it.doubleOrNull }
private fun JsonObject.str(key: String): String? =
    (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun modelProjectionRows(obj: JsonObject): List<Pair<String, String>> = buildList {
    obj.str("spread_pick")?.let { add("Spread pick" to it) }
    obj.dbl("ml_prob")?.let { prob ->
        // 0-1 fraction for some sports, already-scaled percent for others (MLB).
        add("Moneyline" to String.format("%.1f%%", if (prob <= 1) prob * 100 else prob))
    }
    obj.str("ou_pick")?.let { ouPick ->
        val line = obj.dbl("over_under")
        add("Total" to (line?.let { "$ouPick ${String.format("%.1f", it)}" } ?: ouPick.replaceFirstChar { c -> c.titlecase(Locale.US) }))
    }
    obj.dbl("spread_edge")?.let { add("Edge" to String.format("%+.1f pts", it)) }
}

private fun polymarketRows(obj: JsonObject): List<Pair<String, String>> = buildList {
    obj.dbl("home_implied_prob")?.let { add("Home implied" to String.format("%.1f%%", it * 100)) }
    obj.dbl("away_implied_prob")?.let { add("Away implied" to String.format("%.1f%%", it * 100)) }
    obj.dbl("volume_usd")?.let { add("Volume" to String.format("$%.0fK", it / 1000)) }
}

private fun publicBettingRows(obj: JsonObject): List<Pair<String, String>> = buildList {
    obj.dbl("home_bet_pct")?.let { add("Home bet %" to String.format("%.0f%%", it)) }
    obj.dbl("away_bet_pct")?.let { add("Away bet %" to String.format("%.0f%%", it)) }
    obj.dbl("home_money_pct")?.let { add("Home $" to String.format("%.0f%%", it)) }
}

private fun injuriesRows(obj: JsonObject): List<Pair<String, String>> {
    val list = obj["players"] as? JsonArray ?: return emptyList()
    return list.take(4).mapNotNull { el ->
        val p = el as? JsonObject ?: return@mapNotNull null
        (p.str("name") ?: "") to (p.str("status") ?: "")
    }
}

private fun weatherRows(obj: JsonObject): List<Pair<String, String>> = buildList {
    obj.dbl("temperature")?.let { add("Temperature" to "${it.toInt()}°F") }
    obj.dbl("wind_speed")?.let { add("Wind" to "${it.toInt()} mph") }
    obj.str("conditions")?.let { add("Conditions" to it) }
}

private fun matchupRows(obj: JsonObject): List<Pair<String, String>> = buildList {
    val away = obj.str("away_team")
    val home = obj.str("home_team")
    if (away != null && home != null) add("Matchup" to "$away @ $home")
    obj.str("game_time")?.let { add("Time" to formatGameTime(it)) }
    obj.str("venue")?.let { add("Venue" to it) }
}

private fun genericRows(obj: JsonObject): List<Pair<String, String>> =
    obj.entries.take(5).map { (k, v) -> humanize(k) to stringify(v) }

private fun humanize(key: String): String =
    key.replace('_', ' ').replaceFirstChar { it.titlecase(Locale.US) }

private fun stringify(value: JsonElement): String = when (value) {
    is JsonPrimitive -> {
        if (value.isString) value.content
        else value.booleanOrNull?.let { if (it) "Yes" else "No" } ?: value.content
    }
    is JsonArray -> "${value.size} items"
    is JsonObject -> "..."
    else -> value.toString()
}

/** ISO-8601 → "EEE, MMM d · h:mm a". Non-ISO strings pass through. */
private fun formatGameTime(raw: String): String {
    val instant = runCatching { Instant.parse(raw) }.getOrNull() ?: return raw
    val fmt = DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US).withZone(ZoneId.systemDefault())
    return fmt.format(instant)
}
