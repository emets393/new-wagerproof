# Preserve generic signatures and runtime annotations consumed by networking,
# Kotlin serialization, RevenueCat, and Android component discovery.
-keepattributes Signature,InnerClasses,EnclosingMethod
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault

# WagerProof's wire models are Kotlin-serialization DTOs. Generated serializers
# use stable field-name constants, but keeping these small data classes makes a
# minified release resilient to serializer lookup from generic Supabase APIs.
-keep @kotlinx.serialization.Serializable class com.wagerproof.core.models.** { *; }
-keep class com.wagerproof.core.models.**$$serializer { *; }

# Several service/store-private request DTOs are passed through reified generic
# serializers. Preserve their generated serializer companions as well.
-keepclassmembers class com.wagerproof.core.services.** {
    *** Companion;
}
-keepclassmembers class com.wagerproof.core.stores.** {
    *** Companion;
}
-keep class com.wagerproof.core.services.**$$serializer { *; }
-keep class com.wagerproof.core.stores.**$$serializer { *; }

# Keep source information useful for crash reports while allowing line-number
# remapping through the generated R8 mapping file.
-keepattributes SourceFile,LineNumberTable
