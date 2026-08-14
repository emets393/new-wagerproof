plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Local/CI builds remain usable without Firebase credentials. Production
// builds gain the generated Firebase resources as soon as the console-issued
// configuration file is present.
if (file("google-services.json").isFile) {
    apply(plugin = "com.google.gms.google-services")
}

// Release credentials are supplied by CI/developer machines via either Gradle
// properties (-P<NAME>=...) or same-named environment variables. Keeping the
// configuration optional preserves unsigned local release builds without ever
// falling back to the debug key.
fun releaseCredential(name: String): String? =
    providers.gradleProperty(name)
        .orElse(providers.environmentVariable(name))
        .orNull
        ?.trim()
        ?.takeIf { it.isNotEmpty() }

val releaseStoreFile = releaseCredential("WAGERPROOF_RELEASE_STORE_FILE")
val releaseStorePassword = releaseCredential("WAGERPROOF_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = releaseCredential("WAGERPROOF_RELEASE_KEY_ALIAS")
val releaseKeyPassword = releaseCredential("WAGERPROOF_RELEASE_KEY_PASSWORD")
val useProductionApplicationId = providers.gradleProperty("useProductionApplicationId").orNull.toBoolean()
val releaseSigningCredentials = linkedMapOf(
    "WAGERPROOF_RELEASE_STORE_FILE" to releaseStoreFile,
    "WAGERPROOF_RELEASE_STORE_PASSWORD" to releaseStorePassword,
    "WAGERPROOF_RELEASE_KEY_ALIAS" to releaseKeyAlias,
    "WAGERPROOF_RELEASE_KEY_PASSWORD" to releaseKeyPassword,
)
val hasReleaseSigning = releaseSigningCredentials.values.all { it != null }
check(releaseSigningCredentials.values.none { it != null } || hasReleaseSigning) {
    "Partial release signing configuration. Missing: " +
        releaseSigningCredentials.filterValues { it == null }.keys.joinToString()
}

fun quotedBuildConfig(value: String): String =
    "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

// Meta attribution credentials for the shared WagerProof Meta app. Committed, not
// injected: iOS hardcodes the identical pair in Wagerproof/Info.plist, every client
// binary ships them anyway, and neither authorizes anything server-side.
//
// They are DEFAULTS rather than required overrides because the injected-only design
// shipped dead. Nothing ever supplied them — the repo has no Actions secrets and the
// hand-built AABs passed no -P flags — so BuildConfig.FACEBOOK_APP_ID compiled to "",
// MetaAnalyticsService.initialize() returned at its blank check on every launch, and
// every event call then no-oped behind `if (!initialized) return`. Meta received nothing
// from Android, not even the auto-logged install, while every build said SUCCESSFUL.
// A committed default is wrong loudly; an absent credential was wrong silently.
val metaAppIdOverride = releaseCredential("FACEBOOK_APP_ID")
val metaClientTokenOverride = releaseCredential("FACEBOOK_CLIENT_TOKEN")
check((metaAppIdOverride == null) == (metaClientTokenOverride == null)) {
    "Override FACEBOOK_APP_ID and FACEBOOK_CLIENT_TOKEN together — a client token from a " +
        "different Meta app is rejected for every event."
}
val facebookAppId = metaAppIdOverride ?: "935005752525075"
val facebookClientToken = metaClientTokenOverride ?: "bd008d0839f36a9941c0ed27d686b615"

android {
    namespace = "com.wagerproof.app"
    compileSdk = 36

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "com.wagerproof.mobile"
        minSdk = 31
        targetSdk = 36
        // versionName tracks iOS MARKETING_VERSION (Configuration/Release.xcconfig) so one
        // user-facing version means the same feature set on both stores. versionCode starts
        // from the iOS CURRENT_PROJECT_VERSION but drifts above it: Play rejects any code not
        // strictly greater than the live one, so an Android-only respin of the same
        // marketing version (here: the launcher-icon fix) still has to increment. 91 = iOS.
        versionCode = 92
        versionName = "3.5.9"
        buildConfigField("String", "FACEBOOK_APP_ID", quotedBuildConfig(facebookAppId))
        buildConfigField("String", "FACEBOOK_CLIENT_TOKEN", quotedBuildConfig(facebookClientToken))
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(requireNotNull(releaseStoreFile))
                storePassword = requireNotNull(releaseStorePassword)
                keyAlias = requireNotNull(releaseKeyAlias)
                keyPassword = requireNotNull(releaseKeyPassword)
            }
        }
    }

    buildTypes {
        debug {
            // Install alongside the Play/release app during device testing.
            // This also prevents a local debug keystore from forcing users to
            // uninstall the production-signed package and lose its app data.
            // Billing-catalog diagnosis can opt into the real package id with
            // `-PuseProductionApplicationId=true`; Google Play resolves products
            // by package, so the side-by-side id cannot return production plans.
            if (!useProductionApplicationId) applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
    compilerOptions {
        // kotlinx-datetime 0.7 moved Instant to kotlin.time (still experimental in 2.2).
        optIn.add("kotlin.time.ExperimentalTime")
    }
}

dependencies {
    implementation(project(":core:models"))
    implementation(project(":core:services"))
    implementation(project(":core:stores"))
    implementation(project(":core:design"))
    implementation(project(":core:shared"))
    implementation(project(":widgets"))

    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.animation)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.compose.ui.text.google.fonts)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.browser)
    implementation(libs.androidx.work.runtime)
    implementation(libs.play.review)
    implementation(libs.play.review.ktx)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.coil.svg)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    // RevenueCat Paywall + CustomerCenter composables — parity with iOS
    // RevenueCatUI.PaywallView / CustomerCenterView (doc 08 §4.3).
    implementation(libs.revenuecat)
    implementation(libs.revenuecat.ui)

    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.ui.tooling.preview)

    testImplementation(kotlin("test"))
}
