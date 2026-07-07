package com.wagerproof.core.design.icons

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.Chat
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.List
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.automirrored.rounded.Message
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.SubdirectoryArrowRight
import androidx.compose.material.icons.automirrored.rounded.TrendingFlat
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AddCircle
import androidx.compose.material.icons.rounded.Adjust
import androidx.compose.material.icons.rounded.Air
import androidx.compose.material.icons.rounded.AlternateEmail
import androidx.compose.material.icons.rounded.Analytics
import androidx.compose.material.icons.rounded.Apartment
import androidx.compose.material.icons.rounded.ArrowCircleUp
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.Article
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.AutoFixHigh
import androidx.compose.material.icons.rounded.Autorenew
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Book
import androidx.compose.material.icons.rounded.Cancel
import androidx.compose.material.icons.rounded.CardGiftcard
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Checklist
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ConfirmationNumber
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Contrast
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Diamond
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.EventBusy
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Feedback
import androidx.compose.material.icons.rounded.Filter5
import androidx.compose.material.icons.rounded.FilterList
import androidx.compose.material.icons.rounded.FlashAuto
import androidx.compose.material.icons.rounded.FlashOff
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Functions
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Hardware
import androidx.compose.material.icons.rounded.Headset
import androidx.compose.material.icons.rounded.Healing
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.HourglassEmpty
import androidx.compose.material.icons.rounded.HowToReg
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Insights
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Layers
import androidx.compose.material.icons.rounded.Lightbulb
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.ManageAccounts
import androidx.compose.material.icons.rounded.MarkEmailUnread
import androidx.compose.material.icons.rounded.Memory
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MilitaryTech
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.MoreTime
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material.icons.rounded.NoAccounts
import androidx.compose.material.icons.rounded.NorthEast
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.PauseCircleOutline
import androidx.compose.material.icons.rounded.Payments
import androidx.compose.material.icons.rounded.People
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PhoneIphone
import androidx.compose.material.icons.rounded.PlaylistAddCheck
import androidx.compose.material.icons.rounded.Psychology
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material.icons.rounded.Sensors
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.SportsBaseball
import androidx.compose.material.icons.rounded.SportsBasketball
import androidx.compose.material.icons.rounded.SportsFootball
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.SwapVert
import androidx.compose.material.icons.rounded.Tag
import androidx.compose.material.icons.rounded.Terminal
import androidx.compose.material.icons.rounded.Thermostat
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.TouchApp
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material.icons.rounded.WatchLater
import androidx.compose.material.icons.rounded.WavingHand
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Central SF Symbol → Material icon mapping — the ONLY place symbol names are
 * translated. Covers the full 145-symbol usage inventory from
 * docs/inventory/04_design.md §9 plus the dynamic HoneydewOptionCard set.
 *
 * Vectors are resolved lazily (each `Icons.Rounded.*` property builds and
 * caches on first access), so declaring all ~150 entries costs nothing until
 * an icon is actually drawn.
 *
 * A handful of symbols have no Material analog and carry an approximation
 * with a `TODO(icon)` note — replace with custom `ImageVector`s if design
 * review flags them (crown, baseball diamond, person-badge variants, Apple
 * logo).
 */
enum class AppIcon(val systemName: String, private val vector: () -> ImageVector) {
    CHEVRON_RIGHT("chevron.right", { Icons.AutoMirrored.Rounded.KeyboardArrowRight }),
    CHEVRON_LEFT("chevron.left", { Icons.AutoMirrored.Rounded.KeyboardArrowLeft }),
    CHEVRON_BACKWARD("chevron.backward", { Icons.AutoMirrored.Rounded.KeyboardArrowLeft }),
    CHEVRON_DOWN("chevron.down", { Icons.Rounded.KeyboardArrowDown }),
    CHEVRON_UP_FORWARD("chevron.up.forward", { Icons.Rounded.NorthEast }),

    CHECKMARK("checkmark", { Icons.Rounded.Check }),
    CHECKMARK_CIRCLE("checkmark.circle", { Icons.Rounded.CheckCircle }),
    CHECKMARK_CIRCLE_FILL("checkmark.circle.fill", { Icons.Rounded.CheckCircle }),
    CHECKMARK_SEAL_FILL("checkmark.seal.fill", { Icons.Rounded.Verified }),
    CHECKMARK_SHIELD_FILL("checkmark.shield.fill", { Icons.Rounded.VerifiedUser }),
    CHECKLIST("checklist", { Icons.Rounded.Checklist }),

    CHART_LINE_UPTREND("chart.line.uptrend.xyaxis", { Icons.AutoMirrored.Rounded.TrendingUp }),
    CHART_LINE_UPTREND_CIRCLE("chart.line.uptrend.xyaxis.circle", { Icons.AutoMirrored.Rounded.TrendingUp }),
    CHART_LINE_FLATTREND("chart.line.flattrend.xyaxis", { Icons.AutoMirrored.Rounded.TrendingFlat }),
    CHART_BAR("chart.bar", { Icons.Rounded.BarChart }),
    CHART_BAR_FILL("chart.bar.fill", { Icons.Rounded.BarChart }),
    CHART_BAR_XAXIS("chart.bar.xaxis", { Icons.Rounded.Analytics }),
    CHART_BAR_XAXIS_ASCENDING("chart.bar.xaxis.ascending", { Icons.Rounded.Insights }),

    LOCK_FILL("lock.fill", { Icons.Rounded.Lock }),
    LOCK_OPEN_FILL("lock.open.fill", { Icons.Rounded.LockOpen }),
    LOCK_SHIELD_FILL("lock.shield.fill", { Icons.Rounded.Security }),

    XMARK("xmark", { Icons.Rounded.Close }),
    XMARK_CIRCLE_FILL("xmark.circle.fill", { Icons.Rounded.Cancel }),

    INFO_CIRCLE("info.circle", { Icons.Rounded.Info }),
    INFO_CIRCLE_FILL("info.circle.fill", { Icons.Rounded.Info }),

    BRAIN_HEAD_PROFILE("brain.head.profile", { Icons.Rounded.Psychology }),

    BOLT_FILL("bolt.fill", { Icons.Rounded.Bolt }),
    BOLT_SLASH("bolt.slash", { Icons.Rounded.FlashOff }),
    BOLT_BADGE_AUTOMATIC("bolt.badge.automatic", { Icons.Rounded.FlashAuto }),

    ARROW_CLOCKWISE("arrow.clockwise", { Icons.Rounded.Refresh }),
    ARROW_CLOCKWISE_CIRCLE_FILL("arrow.clockwise.circle.fill", { Icons.Rounded.Autorenew }),

    EXCLAMATION_TRIANGLE("exclamationmark.triangle", { Icons.Rounded.WarningAmber }),
    EXCLAMATION_TRIANGLE_FILL("exclamationmark.triangle.fill", { Icons.Rounded.Warning }),
    EXCLAMATION_CIRCLE("exclamationmark.circle", { Icons.Rounded.ErrorOutline }),

    FLAME_FILL("flame.fill", { Icons.Rounded.LocalFireDepartment }),

    CLOCK("clock", { Icons.Rounded.Schedule }),
    CLOCK_FILL("clock.fill", { Icons.Rounded.WatchLater }),
    CLOCK_BADGE("clock.badge", { Icons.Rounded.MoreTime }),
    CLOCK_ARROW_CIRCLEPATH("clock.arrow.circlepath", { Icons.Rounded.History }),
    CLOCK_ARROW_2_CIRCLEPATH("clock.arrow.2.circlepath", { Icons.Rounded.History }),

    ARROW_RIGHT("arrow.right", { Icons.AutoMirrored.Rounded.ArrowForward }),
    ARROW_LEFT("arrow.left", { Icons.AutoMirrored.Rounded.ArrowBack }),
    ARROW_UP("arrow.up", { Icons.Rounded.ArrowUpward }),
    ARROW_DOWN("arrow.down", { Icons.Rounded.ArrowDownward }),
    ARROW_UP_RIGHT("arrow.up.right", { Icons.Rounded.NorthEast }),
    ARROW_UP_RIGHT_SQUARE("arrow.up.right.square", { Icons.AutoMirrored.Rounded.OpenInNew }),
    ARROW_UP_ARROW_DOWN("arrow.up.arrow.down", { Icons.Rounded.SwapVert }),
    ARROW_LEFT_ARROW_RIGHT("arrow.left.arrow.right", { Icons.Rounded.SwapHoriz }),
    ARROW_TURN_DOWN_RIGHT("arrow.turn.down.right", { Icons.Rounded.SubdirectoryArrowRight }),
    ARROW_UP_CIRCLE_FILL("arrow.up.circle.fill", { Icons.Rounded.ArrowCircleUp }),

    SQUARE_GRID_2X2_FILL("square.grid.2x2.fill", { Icons.Rounded.GridView }),
    RECTANGLE_GRID_2X2_FILL("rectangle.grid.2x2.fill", { Icons.Rounded.GridView }),

    TARGET("target", { Icons.Rounded.Adjust }),
    SCOPE("scope", { Icons.Rounded.MyLocation }),

    SPORTSCOURT("sportscourt", { Icons.Rounded.SportsBasketball }),
    SPORTSCOURT_FILL("sportscourt.fill", { Icons.Rounded.SportsBasketball }),
    BASKETBALL("basketball", { Icons.Rounded.SportsBasketball }),
    FIGURE_BASKETBALL("figure.basketball", { Icons.Rounded.SportsBasketball }),
    FOOTBALL("football", { Icons.Rounded.SportsFootball }),
    FOOTBALL_FILL("football.fill", { Icons.Rounded.SportsFootball }),
    BASEBALL("baseball", { Icons.Rounded.SportsBaseball }),
    FIGURE_BASEBALL("figure.baseball", { Icons.Rounded.SportsBaseball }),
    // TODO(icon): no Material diamond-bases glyph — custom vector if needed.
    BASEBALL_DIAMOND_BASES("baseball.diamond.bases", { Icons.Rounded.SportsBaseball }),

    SPARKLES("sparkles", { Icons.Rounded.AutoAwesome }),
    WAND_AND_STARS("wand.and.stars", { Icons.Rounded.AutoFixHigh }),

    TROPHY("trophy", { Icons.Rounded.EmojiEvents }),
    TROPHY_FILL("trophy.fill", { Icons.Rounded.EmojiEvents }),
    MEDAL("medal", { Icons.Rounded.MilitaryTech }),
    MEDAL_FILL("medal.fill", { Icons.Rounded.MilitaryTech }),
    // TODO(icon): Material Icons has no crown — WorkspacePremium approximates.
    CROWN_FILL("crown.fill", { Icons.Rounded.WorkspacePremium }),

    PLUS("plus", { Icons.Rounded.Add }),
    PLUS_CIRCLE_FILL("plus.circle.fill", { Icons.Rounded.AddCircle }),

    LINK("link", { Icons.Rounded.Link }),
    LIGHTBULB("lightbulb", { Icons.Rounded.Lightbulb }),
    LIGHTBULB_FILL("lightbulb.fill", { Icons.Rounded.Lightbulb }),
    GEARSHAPE("gearshape", { Icons.Rounded.Settings }),
    GEARSHAPE_FILL("gearshape.fill", { Icons.Rounded.Settings }),
    GAUGE_MEDIUM("gauge.medium", { Icons.Rounded.Speed }),

    DOC_ON_DOC("doc.on.doc", { Icons.Rounded.ContentCopy }),
    DOC_ON_DOC_FILL("doc.on.doc.fill", { Icons.Rounded.ContentCopy }),
    DOC_TEXT_FILL("doc.text.fill", { Icons.Rounded.Description }),
    DOC_TEXT_IMAGE("doc.text.image", { Icons.Rounded.Article }),
    TEXT_BOOK_CLOSED("text.book.closed", { Icons.AutoMirrored.Rounded.MenuBook }),
    BOOK_FILL("book.fill", { Icons.Rounded.Book }),
    TEXT_BADGE_CHECKMARK("text.badge.checkmark", { Icons.Rounded.PlaylistAddCheck }),

    BUBBLE_LEFT_AND_BUBBLE_RIGHT_FILL("bubble.left.and.bubble.right.fill", { Icons.Rounded.Forum }),
    BUBBLE_LEFT_AND_TEXT_BUBBLE_RIGHT_FILL("bubble.left.and.text.bubble.right.fill", { Icons.Rounded.Forum }),
    BUBBLE_LEFT_AND_EXCLAMATION_BUBBLE_RIGHT("bubble.left.and.exclamationmark.bubble.right", { Icons.Rounded.Feedback }),

    WIND("wind", { Icons.Rounded.Air }),
    THERMOMETER_MEDIUM("thermometer.medium", { Icons.Rounded.Thermostat }),

    SQUARE_AND_ARROW_UP("square.and.arrow.up", { Icons.Rounded.Share }),
    NUMBER("number", { Icons.Rounded.Tag }),
    SUM("sum", { Icons.Rounded.Functions }),

    TRASH("trash", { Icons.Rounded.Delete }),
    TRASH_FILL("trash.fill", { Icons.Rounded.Delete }),

    SLIDER_HORIZONTAL_3("slider.horizontal.3", { Icons.Rounded.Tune }),
    LINE_3_HORIZONTAL_DECREASE("line.3.horizontal.decrease", { Icons.Rounded.FilterList }),
    LINE_3_HORIZONTAL_DECREASE_CIRCLE("line.3.horizontal.decrease.circle", { Icons.Rounded.FilterList }),

    RECTANGLE_STACK_FILL("rectangle.stack.fill", { Icons.Rounded.Layers }),
    RECTANGLE_PORTRAIT_AND_ARROW_RIGHT("rectangle.portrait.and.arrow.right", { Icons.AutoMirrored.Rounded.Logout }),

    PERSON("person.fill", { Icons.Rounded.Person }),
    PERSON_2_FILL("person.2.fill", { Icons.Rounded.People }),
    PERSON_3_FILL("person.3.fill", { Icons.Rounded.Groups }),
    PERSON_2_BADGE_GEARSHAPE_FILL("person.2.badge.gearshape.fill", { Icons.Rounded.ManageAccounts }),
    PERSON_CROP_CIRCLE("person.crop.circle", { Icons.Rounded.AccountCircle }),
    PERSON_CROP_CIRCLE_FILL("person.crop.circle.fill", { Icons.Rounded.AccountCircle }),
    // TODO(icon): no person+badge variants in Material — approximations.
    PERSON_CROP_CIRCLE_BADGE_EXCLAMATION("person.crop.circle.badge.exclamationmark", { Icons.Rounded.NoAccounts }),
    PERSON_CROP_CIRCLE_BADGE_QUESTIONMARK("person.crop.circle.badge.questionmark", { Icons.Rounded.AccountCircle }),
    PERSON_CROP_CIRCLE_BADGE_CHECKMARK("person.crop.circle.badge.checkmark", { Icons.Rounded.HowToReg }),

    MIC_FILL("mic.fill", { Icons.Rounded.Mic }),
    MAGNIFYINGGLASS("magnifyingglass", { Icons.Rounded.Search }),
    HAND_TAP_FILL("hand.tap.fill", { Icons.Rounded.TouchApp }),

    ENVELOPE_FILL("envelope.fill", { Icons.Rounded.Email }),
    ENVELOPE_BADGE("envelope.badge", { Icons.Rounded.MarkEmailUnread }),

    CALENDAR_BADGE_EXCLAMATION("calendar.badge.exclamationmark", { Icons.Rounded.EventBusy }),

    BELL("bell", { Icons.Rounded.Notifications }),
    BELL_BADGE_FILL("bell.badge.fill", { Icons.Rounded.NotificationsActive }),

    AT("at", { Icons.Rounded.AlternateEmail }),

    // TODO(icon): iOS-only auth affordance — replace with a Google mark on Android.
    APPLE_LOGO("applelogo", { Icons.Rounded.PhoneIphone }),

    WAVEFORM("waveform", { Icons.Rounded.GraphicEq }),
    WIFI_SLASH("wifi.slash", { Icons.Rounded.WifiOff }),

    TIMER("timer", { Icons.Rounded.Timer }),
    HOURGLASS("hourglass", { Icons.Rounded.HourglassEmpty }),

    TICKET_FILL("ticket.fill", { Icons.Rounded.ConfirmationNumber }),
    TERMINAL("terminal", { Icons.Rounded.Terminal }),
    SQUARE_AND_PENCIL("square.and.pencil", { Icons.Rounded.Edit }),
    SHIPPINGBOX_FILL("shippingbox.fill", { Icons.Rounded.Inventory2 }),
    SHIELD_FILL("shield.fill", { Icons.Rounded.Shield }),
    PIN_FILL("pin.fill", { Icons.Rounded.PushPin }),
    PAUSE_CIRCLE("pause.circle", { Icons.Rounded.PauseCircleOutline }),
    LIST_BULLET("list.bullet", { Icons.AutoMirrored.Rounded.List }),
    HAMMER_FILL("hammer.fill", { Icons.Rounded.Hardware }),
    GRADUATIONCAP("graduationcap", { Icons.Rounded.School }),
    GRADUATIONCAP_FILL("graduationcap.fill", { Icons.Rounded.School }),
    ELLIPSIS_CIRCLE("ellipsis.circle", { Icons.Rounded.MoreHoriz }),
    DOLLARSIGN_CIRCLE_FILL("dollarsign.circle.fill", { Icons.Rounded.MonetizationOn }),
    DIAMOND_FILL("diamond.fill", { Icons.Rounded.Diamond }),
    CPU("cpu", { Icons.Rounded.Memory }),
    CIRCLE_LEFTHALF_FILLED("circle.lefthalf.filled", { Icons.Rounded.Contrast }),
    BUILDING_2_FILL("building.2.fill", { Icons.Rounded.Apartment }),
    BUILDING_2_CROP_CIRCLE("building.2.crop.circle", { Icons.Rounded.Apartment }),
    BANKNOTE("banknote", { Icons.Rounded.Payments }),
    BANDAGE("bandage", { Icons.Rounded.Healing }),
    ANTENNA_RADIOWAVES("antenna.radiowaves.left.and.right", { Icons.Rounded.Sensors }),
    FIVE_CIRCLE_FILL("5.circle.fill", { Icons.Rounded.Filter5 }),

    // Dynamic symbols passed as data into HoneydewOptionCard (doc §9 tail)
    GIFT_FILL("gift.fill", { Icons.Rounded.CardGiftcard }),
    STAR_FILL("star.fill", { Icons.Rounded.Star }),
    HEADPHONES("headphones", { Icons.Rounded.Headset }),
    MESSAGE_FILL("message.fill", { Icons.AutoMirrored.Rounded.Message }),
    HAND_WAVE_FILL("hand.wave.fill", { Icons.Rounded.WavingHand }),
    HEART_FILL("heart.fill", { Icons.Rounded.Favorite }),
    ELLIPSIS_BUBBLE_FILL("ellipsis.bubble.fill", { Icons.AutoMirrored.Rounded.Chat }),
    ROSETTE("rosette", { Icons.Rounded.WorkspacePremium });

    val imageVector: ImageVector get() = vector()

    companion object {
        private val bySystemName: Map<String, AppIcon> by lazy {
            entries.associateBy { it.systemName }
        }

        /**
         * Porting convenience: resolve an SF Symbol name coming straight out
         * of transplanted Swift code (or DB-driven symbol strings). Null for
         * unmapped names so callers can fall back explicitly.
         */
        fun fromSystemName(name: String): AppIcon? = bySystemName[name]
    }
}
