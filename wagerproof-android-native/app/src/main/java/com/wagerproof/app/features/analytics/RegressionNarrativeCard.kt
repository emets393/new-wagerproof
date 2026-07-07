package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors

/**
 * AI Analysis Summary body. iOS renders block-level markdown via the shared
 * `WagerBotMarkdownText` renderer; RN styles narrative blockquotes purple.
 *
 * // FIDELITY-WAIVER #280: Android has no ported markdown renderer yet (the
 * // chat feature is still a placeholder — no MarkdownText to reuse). This is a
 * // minimal in-house block renderer covering the narrative's actual grammar
 * // (emoji `#` headings, `-`/`*` bullets, `>` purple blockquotes, `**bold**`
 * // inline). Swap for the shared renderer once the chat port lands.
 */
@Composable
fun RegressionNarrativeCard(text: String, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth(),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
    ) {
        val blocks = text.split(Regex("\\n{2,}")).map { it.trim() }.filter { it.isNotEmpty() }
        for (block in blocks) {
            NarrativeBlock(block)
        }
    }
}

@Composable
private fun NarrativeBlock(block: String) {
    val lines = block.lines()
    // A block is "bulleted" when every non-empty line is a list item.
    val isBulleted = lines.all { it.trimStart().startsWith("- ") || it.trimStart().startsWith("* ") }
    when {
        block.startsWith("#") -> {
            val level = block.takeWhile { it == '#' }.length
            val content = block.trimStart('#').trim()
            Text(
                text = content,
                fontSize = if (level <= 1) 18.sp else if (level == 2) 16.sp else 14.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
                lineHeight = 22.sp,
                modifier = Modifier.padding(vertical = 2.dp),
            )
        }
        block.startsWith(">") -> {
            // Purple-tinted blockquote (RN parity).
            val content = block.lines().joinToString("\n") { it.trimStart('>').trim() }
            Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                Spacer(
                    Modifier
                        .width(3.dp)
                        .background(Regression.accentPurple),
                )
                Text(
                    text = inline(content),
                    fontSize = 14.sp,
                    color = AppColors.appTextSecondary,
                    lineHeight = 20.sp,
                    modifier = Modifier
                        .background(Regression.accentPurple.copy(alpha = 0.08f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
        }
        isBulleted -> {
            Column(Modifier.fillMaxWidth()) {
                for (line in lines) {
                    val content = line.trimStart().removePrefix("- ").removePrefix("* ")
                    Row(Modifier.fillMaxWidth().padding(vertical = 1.dp)) {
                        Text("•  ", fontSize = 14.sp, color = AppColors.appTextSecondary)
                        Text(
                            text = inline(content),
                            fontSize = 14.sp,
                            color = AppColors.appTextPrimary,
                            lineHeight = 20.sp,
                        )
                    }
                }
            }
        }
        else -> {
            Text(
                text = inline(block),
                fontSize = 14.sp,
                color = AppColors.appTextPrimary,
                lineHeight = 20.sp,
                modifier = Modifier.padding(vertical = 2.dp),
            )
        }
    }
}

// Minimal inline bold parsing (**...**). Everything else renders literally.
private fun inline(raw: String): AnnotatedString = buildAnnotatedString {
    val parts = raw.split("**")
    parts.forEachIndexed { i, part ->
        if (i % 2 == 1) {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(part) }
        } else {
            append(part)
        }
    }
}
