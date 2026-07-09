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

val facebookAppId = releaseCredential("FACEBOOK_APP_ID").orEmpty()
val facebookClientToken = releaseCredential("FACEBOOK_CLIENT_TOKEN").orEmpty()
check(facebookAppId.isBlank() == facebookClientToken.isBlank()) {
    "FACEBOOK_APP_ID and FACEBOOK_CLIENT_TOKEN must either both be set or both be absent."
}

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
        versionCode = 49
        versionName = "3.5.6"
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
            applicationIdSuffix = ".debug"
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
