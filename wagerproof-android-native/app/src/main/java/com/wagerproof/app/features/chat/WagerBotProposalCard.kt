package com.wagerproof.app.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Port of iOS `WagerBotProposalCard.swift`. Forward-compat confirm/skip card —
 * NOT currently wired to any block type. Ported for shape parity (low priority).
 */
enum class WagerBotProposalStatus { PENDING, EXECUTING, CONFIRMED, FAILED, SKIPPED }

@Composable
fun WagerBotProposalCard(
    title: String,
    detail: String?,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    ui: WagerBotUiTokens,
    modifier: Modifier = Modifier,
    status: WagerBotProposalStatus = WagerBotProposalStatus.PENDING,
    onConfirm: (() -> Unit)? = null,
    onSkip: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier = modifier
            .clip(shape)
            .background(ui.hintChipBackground)
            .border(1.dp, ui.borderColor, shape)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(28.dp).clip(CircleShape).background(ui.accent.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = ui.accent, modifier = Modifier.size(14.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ui.primaryText)
                detail?.takeIf { it.isNotEmpty() }?.let {
                    Text(it, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = ui.mutedText, maxLines = 3)
                }
            }
        }

        val enabled = status == WagerBotProposalStatus.PENDING
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { onSkip?.invoke() },
                enabled = enabled,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ui.controlBackground, contentColor = ui.primaryText),
                modifier = Modifier.weight(1f),
            ) { Text("Skip", fontSize = 13.sp, fontWeight = FontWeight.SemiBold) }

            Button(
                onClick = { onConfirm?.invoke() },
                enabled = enabled,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ui.primaryActionBackground, contentColor = ui.primaryActionForeground),
                modifier = Modifier.weight(1f),
            ) {
                if (status == WagerBotProposalStatus.EXECUTING) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = ui.primaryActionForeground)
                    Spacer(Modifier.size(6.dp))
                }
                Text(confirmLabel(status), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

private fun confirmLabel(status: WagerBotProposalStatus): String = when (status) {
    WagerBotProposalStatus.PENDING -> "Confirm"
    WagerBotProposalStatus.EXECUTING -> "Working…"
    WagerBotProposalStatus.CONFIRMED -> "Done"
    WagerBotProposalStatus.FAILED -> "Retry"
    WagerBotProposalStatus.SKIPPED -> "Skipped"
}
