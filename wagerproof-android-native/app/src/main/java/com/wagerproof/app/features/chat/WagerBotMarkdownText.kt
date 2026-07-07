package com.wagerproof.app.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors

/**
 * Port of iOS `WagerBotMarkdownText.swift` — a block-level markdown renderer.
 *
 * SwiftUI's inline-markdown collapses structure, so iOS hand-rolls a block
 * parser and applies `AttributedString(markdown:)` per line for inline runs.
 * Compose has no markdown at all, so this file hand-rolls BOTH:
 *   - a block parser (paragraphs / bullet / numbered lists / headings /
 *     blockquotes), identical to iOS's `parsedBlocks()`;
 *   - an inline parser producing an [AnnotatedString] with bold / italic /
 *     `code` / [links](url) spans (NO external markdown lib, per the contract).
 *     Links are styled (accent + underline) but not tappable — a minor
 *     divergence from iOS's system-handled AttributedString links.
 */
@Composable
fun WagerBotMarkdownText(
    text: String,
    modifier: Modifier = Modifier,
    baseFontSize: TextUnit = 15.sp,
    baseFontWeight: FontWeight = FontWeight.Normal,
    primaryColor: Color = AppColors.appTextPrimary,
    secondaryColor: Color = AppColors.appTextSecondary,
    /** When set, blockquotes render with this accent (tinted bg + colored bar). */
    quoteAccent: Color? = null,
) {
    val blocks = remember(text) { parseBlocks(text) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        blocks.forEach { block ->
            RenderBlock(
                block = block,
                baseFontSize = baseFontSize,
                baseFontWeight = baseFontWeight,
                primaryColor = primaryColor,
                secondaryColor = secondaryColor,
                quoteAccent = quoteAccent,
            )
        }
    }
}

// MARK: - Block model + parser

private sealed interface MdBlock {
    data class Paragraph(val text: String) : MdBlock
    data class Heading(val level: Int, val text: String) : MdBlock
    data class BulletList(val items: List<String>) : MdBlock
    data class NumberedList(val items: List<String>) : MdBlock
    data class Quote(val text: String) : MdBlock
}

private fun parseBlocks(text: String): List<MdBlock> {
    val blocks = mutableListOf<MdBlock>()
    val paragraphBuffer = mutableListOf<String>()
    val bulletBuffer = mutableListOf<String>()
    val numberBuffer = mutableListOf<String>()

    fun flushParagraph() {
        if (paragraphBuffer.isEmpty()) return
        val joined = paragraphBuffer.joinToString("\n").trim()
        if (joined.isNotEmpty()) blocks.add(MdBlock.Paragraph(joined))
        paragraphBuffer.clear()
    }
    fun flushBullets() {
        if (bulletBuffer.isEmpty()) return
        blocks.add(MdBlock.BulletList(bulletBuffer.toList()))
        bulletBuffer.clear()
    }
    fun flushNumbers() {
        if (numberBuffer.isEmpty()) return
        blocks.add(MdBlock.NumberedList(numberBuffer.toList()))
        numberBuffer.clear()
    }
    fun flushAll() { flushParagraph(); flushBullets(); flushNumbers() }

    // split(..., -1) keeps trailing empty lines (Swift omittingEmptySubsequences: false).
    for (rawLine in text.split("\n")) {
        val trimmed = rawLine.trim()
        if (trimmed.isEmpty()) { flushAll(); continue }
        val head = parseHeading(trimmed)
        if (head != null) {
            flushAll()
            blocks.add(MdBlock.Heading(head.first, head.second))
            continue
        }
        val bullet = parseBullet(trimmed)
        if (bullet != null) {
            flushParagraph(); flushNumbers()
            bulletBuffer.add(bullet)
            continue
        }
        val numbered = parseNumbered(trimmed)
        if (numbered != null) {
            flushParagraph(); flushBullets()
            numberBuffer.add(numbered)
            continue
        }
        if (trimmed.startsWith(">")) {
            flushAll()
            blocks.add(MdBlock.Quote(trimmed.drop(1).trim()))
            continue
        }
        flushBullets(); flushNumbers()
        paragraphBuffer.add(trimmed)
    }
    flushAll()
    return blocks
}

private fun parseHeading(s: String): Pair<Int, String>? {
    var level = 0
    for (ch in s) {
        if (ch == '#') level++ else break
        if (level > 6) return null
    }
    if (level < 1 || s.length <= level || s[level] != ' ') return null
    return level to s.drop(level).trim()
}

private fun parseBullet(s: String): String? {
    for (prefix in listOf("- ", "* ", "• ")) {
        if (s.startsWith(prefix)) return s.drop(prefix.length)
    }
    return null
}

private fun parseNumbered(s: String): String? {
    var idx = 0
    while (idx < s.length && s[idx].isDigit()) idx++
    if (idx == 0 || idx >= s.length) return null
    val marker = s[idx]
    if (marker != '.' && marker != ')') return null
    val afterMarker = idx + 1
    if (afterMarker >= s.length || s[afterMarker] != ' ') return null
    return s.substring(afterMarker + 1)
}

// MARK: - Rendering

@Composable
private fun RenderBlock(
    block: MdBlock,
    baseFontSize: TextUnit,
    baseFontWeight: FontWeight,
    primaryColor: Color,
    secondaryColor: Color,
    quoteAccent: Color?,
) {
    when (block) {
        is MdBlock.Paragraph -> Text(
            text = inlineAnnotated(block.text, primaryColor),
            fontSize = baseFontSize,
            fontWeight = baseFontWeight,
            color = primaryColor,
        )

        is MdBlock.Heading -> {
            val size = when (block.level) {
                1 -> 19.sp
                2 -> 17.sp
                else -> 16.sp
            }
            Text(
                text = inlineAnnotated(block.text, primaryColor),
                fontSize = size,
                fontWeight = FontWeight.Bold,
                color = primaryColor,
                modifier = Modifier.padding(top = 2.dp),
            )
        }

        is MdBlock.BulletList -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            block.items.forEach { item ->
                Row(verticalAlignment = Alignment.Top) {
                    Text(
                        text = "•",
                        fontSize = baseFontSize,
                        color = secondaryColor,
                        modifier = Modifier.width(10.dp),
                    )
                    Text(
                        text = inlineAnnotated(item, primaryColor),
                        fontSize = baseFontSize,
                        fontWeight = baseFontWeight,
                        color = primaryColor,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        is MdBlock.NumberedList -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            block.items.forEachIndexed { idx, item ->
                Row(verticalAlignment = Alignment.Top) {
                    Text(
                        text = "${idx + 1}.",
                        fontSize = baseFontSize,
                        fontFamily = FontFamily.Monospace,
                        color = secondaryColor,
                        textAlign = TextAlign.End,
                        modifier = Modifier.width(22.dp),
                    )
                    Text(
                        text = inlineAnnotated(item, primaryColor),
                        fontSize = baseFontSize,
                        fontWeight = baseFontWeight,
                        color = primaryColor,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        is MdBlock.Quote -> {
            val barColor = quoteAccent ?: secondaryColor.copy(alpha = 0.4f)
            val textColor = if (quoteAccent != null) primaryColor else secondaryColor
            Row(
                modifier = Modifier
                    .height(IntrinsicSize.Min)
                    .then(
                        if (quoteAccent != null) {
                            Modifier
                                .background(quoteAccent.copy(alpha = 0.12f), RoundedCornerShape(6.dp))
                                .padding(8.dp)
                        } else Modifier,
                    ),
                verticalAlignment = Alignment.Top,
            ) {
                Box(
                    Modifier
                        .width(3.dp)
                        .fillMaxHeight()
                        .background(barColor, RoundedCornerShape(2.dp)),
                )
                Text(
                    text = inlineAnnotated(block.text, textColor),
                    fontSize = baseFontSize,
                    fontStyle = FontStyle.Italic,
                    color = textColor,
                    modifier = Modifier.padding(start = 8.dp, top = 2.dp, bottom = 2.dp),
                )
            }
        }
    }
}

// MARK: - Inline parser

/**
 * Parse inline markdown into an [AnnotatedString]. Handles `code`, **bold**,
 * *italic* / _italic_, and [text](url). Nested emphasis recurses.
 */
private fun inlineAnnotated(text: String, baseColor: Color): AnnotatedString = buildAnnotatedString {
    appendInline(this, text, baseColor)
}

private fun appendInline(builder: AnnotatedString.Builder, text: String, baseColor: Color) {
    var i = 0
    val n = text.length
    val plain = StringBuilder()

    fun flushPlain() {
        if (plain.isNotEmpty()) {
            builder.append(plain.toString())
            plain.clear()
        }
    }

    while (i < n) {
        val c = text[i]
        when {
            c == '`' -> {
                val close = text.indexOf('`', i + 1)
                if (close > i) {
                    flushPlain()
                    val code = text.substring(i + 1, close)
                    builder.withStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = AppColors.appSurfaceMuted.copy(alpha = 0.6f),
                        ),
                    ) { append(code) }
                    i = close + 1
                } else {
                    plain.append(c); i++
                }
            }

            c == '[' -> {
                val link = parseLink(text, i)
                if (link != null) {
                    flushPlain()
                    builder.pushStringAnnotation("URL", link.url)
                    builder.withStyle(
                        SpanStyle(color = AppColors.appPrimary, textDecoration = TextDecoration.Underline),
                    ) { appendInline(builder, link.label, baseColor) }
                    builder.pop()
                    i = link.end
                } else {
                    plain.append(c); i++
                }
            }

            c == '*' && i + 1 < n && text[i + 1] == '*' -> {
                val close = text.indexOf("**", i + 2)
                if (close > i) {
                    flushPlain()
                    builder.withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        appendInline(builder, text.substring(i + 2, close), baseColor)
                    }
                    i = close + 2
                } else {
                    plain.append(c); i++
                }
            }

            c == '_' && i + 1 < n && text[i + 1] == '_' -> {
                val close = text.indexOf("__", i + 2)
                if (close > i) {
                    flushPlain()
                    builder.withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        appendInline(builder, text.substring(i + 2, close), baseColor)
                    }
                    i = close + 2
                } else {
                    plain.append(c); i++
                }
            }

            (c == '*' || c == '_') -> {
                val close = text.indexOf(c, i + 1)
                if (close > i && close != i + 1) {
                    flushPlain()
                    builder.withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        appendInline(builder, text.substring(i + 1, close), baseColor)
                    }
                    i = close + 1
                } else {
                    plain.append(c); i++
                }
            }

            else -> { plain.append(c); i++ }
        }
    }
    flushPlain()
}

private data class ParsedLink(val label: String, val url: String, val end: Int)

private fun parseLink(text: String, start: Int): ParsedLink? {
    // start points at '['. Expect [label](url).
    val labelClose = text.indexOf(']', start + 1)
    if (labelClose < 0) return null
    if (labelClose + 1 >= text.length || text[labelClose + 1] != '(') return null
    val urlClose = text.indexOf(')', labelClose + 2)
    if (urlClose < 0) return null
    val label = text.substring(start + 1, labelClose)
    val url = text.substring(labelClose + 2, urlClose)
    return ParsedLink(label, url, urlClose + 1)
}
