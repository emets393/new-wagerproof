plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.wagerproof.core.services"
    compileSdk = 36

    defaultConfig {
        minSdk = 31
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
    api(project(":core:models"))
    api(project(":core:shared"))

    api(platform(libs.supabase.bom))
    api(libs.supabase.postgrest)
    api(libs.supabase.auth)
    api(libs.supabase.realtime)
    api(libs.supabase.functions)
    implementation(libs.ktor.client.okhttp)

    api(libs.okhttp)
    api(libs.okhttp.sse)
    implementation(libs.okhttp.logging)

    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services)
    implementation(libs.googleid)

    api(libs.revenuecat)
    implementation(libs.mixpanel)
    implementation(libs.facebook.core)

    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.datastore.preferences)

    testImplementation(kotlin("test"))
}
