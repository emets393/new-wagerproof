package com.wagerproof.app.features.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `ComingSoonBanner.swift`. Green-tinted "PREVIEW" banner used atop
 * pre-launch sport pages. Currently MLB-only ([Sport.MLB]).
 */
enum class ComingSoonSport { MLB }

@Composable
fun ComingSoonBanner(
    sport: ComingSoonSport,
    modifier: Modifier = Modifier,
    titleOverride: String? = null,
    descriptionOverride: String? = null,
) {
    val (icon, title, description) = when (sport) {
        // baseball.fill is unmapped in AppIcon — fall back to "baseball".
        ComingSoonSport.MLB -> Triple(
            AppIcon.fromSystemName("baseball.fill")?.imageVector
                ?: AppIcon.fromSystemName("baseball")!!.imageVector,
            "MLB COMING SOON",
            "Baseball predictions launching soon",
        )
    }

    Row(
        modifier
            .padding(horizontal = Spacing.sm)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF22C55E).copy(alpha = 0.08f))
            .border(1.dp, Color(0xFF22C55E).copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            .padding(Spacing.md),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Brush.horizontalGradient(listOf(Color(0xFF22C55E), Color(0xFF16A34A)))),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(titleOverride ?: title, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = AppColors.appTextPrimary)
            Text(descriptionOverride ?: description, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextSecondary)
        }
        Text(
            "PREVIEW",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(AppColors.appAccentAmber)
                .padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}
