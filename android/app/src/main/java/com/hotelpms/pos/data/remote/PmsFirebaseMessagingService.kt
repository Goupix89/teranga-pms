package com.hotelpms.pos.data.remote

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.hotelpms.pos.MainActivity
import com.hotelpms.pos.R
import com.hotelpms.pos.data.local.TokenManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import com.hotelpms.pos.BuildConfig

class PmsFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "teranga_pms"
        const val CHANNEL_NAME = "Teranga PMS"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Register the new token with the backend
        registerTokenWithServer(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title ?: message.data["title"] ?: "Teranga PMS"
        val body = message.notification?.body ?: message.data["body"] ?: ""

        showNotification(title, body, message.data)
    }

    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel for Android O+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications Teranga PMS"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data.forEach { (key, value) -> putExtra(key, value) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .build()

        val notificationId = data["notificationId"]?.hashCode() ?: System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notification)
    }

    private fun registerTokenWithServer(token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val tokenManager = TokenManager(applicationContext)
                val accessToken = tokenManager.accessToken ?: return@launch

                val client = OkHttpClient()
                val json = """{"token":"$token","platform":"ANDROID"}"""
                val body = json.toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url("${BuildConfig.API_BASE_URL}/api/notifications/device-token")
                    .addHeader("Authorization", "Bearer $accessToken")
                    .post(body)
                    .build()

                client.newCall(request).execute().close()
            } catch (e: Exception) {
                // Silently fail — will retry on next app launch
                e.printStackTrace()
            }
        }
    }
}
