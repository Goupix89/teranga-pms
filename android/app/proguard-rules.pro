# Hotel PMS POS — ProGuard Rules

# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Gson
-keep class com.hotelpms.pos.domain.model.** { *; }
-keepclassmembers class com.hotelpms.pos.domain.model.** { *; }

# OkHttp SSE
-keep class okhttp3.sse.** { *; }
-dontwarn okhttp3.sse.**

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keep @androidx.room.Dao class *

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# Coroutines
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Keep generic signatures for type token
-keepattributes InnerClasses
-keepattributes EnclosingMethod
