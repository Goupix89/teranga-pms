package com.hotelpms.pos.data.repository

import com.google.gson.Gson
import com.hotelpms.pos.data.local.AppDatabase
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.*
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.util.UUID

class PosRepository(
    private val api: PmsApiService,
    private val db: AppDatabase,
    private val tokenManager: TokenManager,
    private val gson: Gson
) {
    // ==========================================================================
    // Auth
    // ==========================================================================

    suspend fun login(email: String, password: String): Result<UserInfo> {
        return try {
            val response = api.login(LoginRequest(email, password))
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()!!.data!!
                tokenManager.saveTokens(data.accessToken, "")  // Refresh token comes from cookie
                tokenManager.saveUserInfo(
                    userId = data.user.id,
                    tenantId = data.user.tenantId,
                    userName = "${data.user.firstName} ${data.user.lastName}",
                    role = data.user.role
                )
                Result.success(data.user)
            } else {
                Result.failure(Exception("Identifiants invalides"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        tokenManager.clearAll()
    }

    val isLoggedIn: Boolean get() = tokenManager.isLoggedIn
    val userName: String? get() = tokenManager.userName
    val userRole: String? get() = tokenManager.userRole
    val tenantId: String? get() = tokenManager.tenantId

    // ==========================================================================
    // Articles (with offline cache)
    // ==========================================================================

    /**
     * Fetch articles from API and cache locally.
     */
    suspend fun refreshArticles(): Result<List<CachedArticle>> {
        return try {
            val response = api.getArticles(page = 1, limit = 200)
            if (response.isSuccessful && response.body()?.success == true) {
                val articles = response.body()!!.data
                val cached = articles.map { article ->
                    CachedArticle(
                        id = article.id,
                        name = article.name,
                        sku = article.sku,
                        unitPrice = article.unitPrice,
                        currentStock = article.currentStock,
                        unit = article.unit,
                        categoryName = article.category?.name
                    )
                }
                db.cachedArticleDao().clearAll()
                db.cachedArticleDao().insertAll(cached)
                Result.success(cached)
            } else {
                Result.failure(Exception("Erreur de chargement des articles"))
            }
        } catch (e: Exception) {
            // Return cached data on network failure
            val cached = db.cachedArticleDao().getAll()
            if (cached.isNotEmpty()) {
                Result.success(cached)
            } else {
                Result.failure(e)
            }
        }
    }

    /**
     * Get articles from local cache (reactive Flow).
     */
    fun getArticlesFlow(): Flow<List<CachedArticle>> {
        return db.cachedArticleDao().getAllFlow()
    }

    fun searchArticlesFlow(query: String): Flow<List<CachedArticle>> {
        return db.cachedArticleDao().searchFlow(query)
    }

    // ==========================================================================
    // POS Transactions (offline-first)
    // ==========================================================================

    /**
     * Save a transaction locally then attempt to sync.
     */
    suspend fun createTransaction(
        cartItems: List<CartItem>,
        invoiceId: String
    ): String {
        val tenantId = tokenManager.tenantId ?: throw Exception("Tenant non configuré")
        val uuid = UUID.randomUUID().toString()

        val items = cartItems.map { item ->
            PosTransactionItem(
                articleId = item.article.id,
                quantity = item.quantity,
                unitPrice = item.article.unitPrice
            )
        }

        val totalAmount = cartItems.sumOf { it.total }

        val itemsJson = gson.toJson(items)

        val pending = PendingTransaction(
            transactionUuid = uuid,
            tenantId = tenantId,
            invoiceId = invoiceId,
            itemsJson = itemsJson,
            totalAmount = totalAmount,
            timestamp = Instant.now().toString()
        )

        db.pendingTransactionDao().insert(pending)

        // Try immediate sync
        try {
            syncTransaction(pending)
        } catch (_: Exception) {
            // Will be retried by the sync worker
        }

        return uuid
    }

    /**
     * Sync a single pending transaction to the server.
     */
    private suspend fun syncTransaction(tx: PendingTransaction) {
        db.pendingTransactionDao().updateStatus(tx.transactionUuid, "SYNCING")

        val items: List<PosTransactionItem> = gson.fromJson(
            tx.itemsJson,
            Array<PosTransactionItem>::class.java
        ).toList()

        val request = PosTransactionRequest(
            tenantId = tx.tenantId,
            transactionUuid = tx.transactionUuid,
            invoiceId = tx.invoiceId,
            items = items,
            totalAmount = tx.totalAmount,
            timestamp = tx.timestamp
        )

        val response = api.postTransaction(request)

        if (response.isSuccessful) {
            db.pendingTransactionDao().updateStatus(tx.transactionUuid, "SYNCED")
        } else {
            val errorBody = response.errorBody()?.string() ?: "Erreur ${response.code()}"
            db.pendingTransactionDao().incrementRetry(tx.transactionUuid, errorBody)
        }
    }

    /**
     * Sync all pending transactions.
     */
    suspend fun syncAllPending(): Int {
        val pending = db.pendingTransactionDao().getByStatus("PENDING")
        var synced = 0

        for (tx in pending) {
            if (tx.retryCount > 10) continue // Skip permanently failed

            try {
                syncTransaction(tx)
                synced++
            } catch (e: Exception) {
                db.pendingTransactionDao().incrementRetry(
                    tx.transactionUuid,
                    e.message ?: "Erreur réseau"
                )
            }
        }

        return synced
    }

    fun getPendingTransactionsFlow(): Flow<List<PendingTransaction>> {
        return db.pendingTransactionDao().getAllFlow()
    }

    fun getPendingCountFlow(): Flow<Int> {
        return db.pendingTransactionDao().getPendingCountFlow()
    }

    /**
     * Clean old synced transactions (older than 7 days).
     */
    suspend fun cleanOldTransactions() {
        val sevenDaysAgo = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000
        db.pendingTransactionDao().cleanSynced(sevenDaysAgo)
    }
}
