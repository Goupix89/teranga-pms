# Hotel PMS POS — ProGuard Rules

# Retrofit — preserve generic signatures on service interfaces and response types
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes Exceptions
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation

# Keep API service interface (Retrofit needs full generic method signatures)
-keep class com.hotelpms.pos.data.remote.PmsApiService { *; }
-keep class com.hotelpms.pos.data.remote.** { *; }

# Gson — keep model fields and generic type info for deserialization
-keep class com.hotelpms.pos.domain.model.** { *; }
-keepclassmembers class com.hotelpms.pos.domain.model.** { *; }
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keep class com.google.gson.** { *; }

# OkHttp SSE
-keep class okhttp3.sse.** { *; }
-dontwarn okhttp3.sse.**

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keep @androidx.room.Dao class *

# Hilt / Dagger
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends androidx.lifecycle.ViewModel { *; }
-keep class com.hotelpms.pos.data.repository.** { *; }

# Coroutines
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Keep generic signatures for type token
-keepattributes InnerClasses
-keepattributes EnclosingMethod
