package com.hotelpms.pos.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

class TokenManager(context: Context) {

    private val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        "hotel_pms_secure_prefs",
        masterKeyAlias,
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_TENANT_ID = "tenant_id"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_ROLE = "user_role"
    }

    fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    fun saveUserInfo(userId: String, tenantId: String, userName: String, role: String) {
        prefs.edit()
            .putString(KEY_USER_ID, userId)
            .putString(KEY_TENANT_ID, tenantId)
            .putString(KEY_USER_NAME, userName)
            .putString(KEY_USER_ROLE, role)
            .apply()
    }

    val accessToken: String? get() = prefs.getString(KEY_ACCESS_TOKEN, null)
    val refreshToken: String? get() = prefs.getString(KEY_REFRESH_TOKEN, null)
    val tenantId: String? get() = prefs.getString(KEY_TENANT_ID, null)
    val userId: String? get() = prefs.getString(KEY_USER_ID, null)
    val userName: String? get() = prefs.getString(KEY_USER_NAME, null)
    val userRole: String? get() = prefs.getString(KEY_USER_ROLE, null)

    val isLoggedIn: Boolean get() = accessToken != null

    fun clearAll() {
        prefs.edit().clear().apply()
    }
}
