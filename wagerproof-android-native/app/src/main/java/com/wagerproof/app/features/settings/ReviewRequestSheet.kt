package com.wagerproof.app.features.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing

/**
 * Review-request sheet — port of iOS `Features/Settings/Sheets/ReviewRequestModal`.
 *
 * iOS fires `@Environment(\.requestReview)` (StoreKit, OS rate-limited). The
 * Android analog is the Play In-App Review API
 * (`com.google.android.play:review`).
 *
 * // FIDELITY-WAIVER #253: the Play In-App Review dependency is not added here
 * // (build files are owned by concurrent writers). [onRequestReview] is a stub
 * // the host wires to `ReviewManager.launchReviewFlow(...)` once the dep lands.
 *
 * Intended as bottom-sheet content (host it in a ModalBottomSheet).
 */
@Composable
fun ReviewRequestSheet(
    onDismiss: () -> Unit,
    onRequestReview: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.appSurface)
            .padding(horizontal = Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.xl),
    ) {
        Box(
            modifier = Modifier
                .padding(top = Spacing.xl)
                .size(84.dp)
                .background(AppColors.appPrimary.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = AppIcon.BUBBLE_LEFT_AND_TEXT_BUBBLE_RIGHT_FILL.imageVector,
                contentDescription = null,
                tint = AppColors.appPrimary,
                modifier = Modifier.size(40.dp),
            )
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Text(
                text = "Would you leave us some early feedback?",
                style = AppTypography.title,
                color = AppColors.appTextPrimary,
                textAlign = TextAlign.Center,
            )
            Text(
                text = "Your feedback helps us build a better app for you!",
                style = AppTypography.body,
                color = AppColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
        }

        Column(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Button(
                onClick = { onRequestReview(); onDismiss() },
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Yes, I'd love to!", style = AppTypography.bodyEmphasized, color = Color.White)
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.dp, AppColors.appBorderStrong, RoundedCornerShape(14.dp))
                    .clickable(onClick = onDismiss)
                    .padding(vertical = Spacing.md),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Not now",
                    style = AppTypography.bodyEmphasized,
                    color = AppColors.appTextPrimary,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.lg),
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
