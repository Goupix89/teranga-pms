package com.hotelpms.pos.domain.usecase

import android.content.Context
import android.util.Log
import androidx.work.*
import com.hotelpms.pos.data.local.AppDatabase
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.data.repository.PosRepository
import com.google.gson.Gson
import java.util.concurrent.TimeUnit

/**
 * Background worker that periodically syncs pending POS transactions.
 * Uses WorkManager for reliable execution even when app is backgrounded.
 */
class SyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val db = AppDatabase.getInstance(applicationContext)
            val pending = db.pendingTransactionDao().getByStatus("PENDING")

            if (pending.isEmpty()) {
                Log.d("SyncWorker", "No pending transactions to sync")
                return Result.success()
            }

            Log.d("SyncWorker", "Found ${pending.size} pending transactions")

            // Note: In production, inject dependencies properly via Hilt
            // This is simplified for the worker context
            val tokenManager = TokenManager(applicationContext)
            if (!tokenManager.isLoggedIn) {
                Log.w("SyncWorker", "User not logged in, skipping sync")
                return Result.retry()
            }

            // Repository would handle the actual API calls
            // For now, mark as needing retry
            Result.retry()
        } catch (e: Exception) {
            Log.e("SyncWorker", "Sync failed", e)
            if (runAttemptCount < 5) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val WORK_NAME = "pos_sync_worker"

        /**
         * Schedule periodic background sync every 15 minutes.
         */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                15, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30, TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    syncRequest
                )
        }

        /**
         * Trigger an immediate one-time sync.
         */
        fun syncNow(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context)
                .enqueue(syncRequest)
        }
    }
}
