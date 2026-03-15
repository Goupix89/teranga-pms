package com.hotelpms.pos.domain.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

// =============================================================================
// API Models
// =============================================================================

data class LoginRequest(val email: String, val password: String)

data class LoginResponse(
    val success: Boolean,
    val data: LoginData?
)

data class LoginData(
    val accessToken: String,
    val user: UserInfo
)

data class UserInfo(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val role: String,
    val tenantId: String,
    val tenantSlug: String
)

data class RefreshResponse(
    val success: Boolean,
    val data: RefreshData?
)

data class RefreshData(val accessToken: String)

data class Article(
    val id: String,
    val name: String,
    val sku: String?,
    val unitPrice: Double,
    val currentStock: Int,
    val unit: String,
    val category: CategoryRef?
)

data class CategoryRef(val id: String, val name: String)

data class ArticlesResponse(
    val success: Boolean,
    val data: List<Article>,
    val meta: PaginationMeta?
)

data class PaginationMeta(
    val total: Int,
    val page: Int,
    val totalPages: Int
)

// =============================================================================
// POS Transaction
// =============================================================================

data class PosTransactionRequest(
    val tenantId: String,
    val transactionUuid: String,
    val invoiceId: String,
    val items: List<PosTransactionItem>,
    val totalAmount: Double,
    val timestamp: String
)

data class PosTransactionItem(
    val articleId: String,
    val quantity: Int,
    val unitPrice: Double
)

data class PosTransactionResponse(
    val success: Boolean,
    val id: String?,
    val status: String?
)

// =============================================================================
// Room DB Entities (Offline Storage)
// =============================================================================

@Entity(tableName = "pending_transactions")
data class PendingTransaction(
    @PrimaryKey
    val transactionUuid: String = UUID.randomUUID().toString(),
    val tenantId: String,
    val invoiceId: String,
    val itemsJson: String,
    val totalAmount: Double,
    val timestamp: String,
    val syncStatus: String = "PENDING", // PENDING, SYNCING, SYNCED, FAILED
    val retryCount: Int = 0,
    val lastError: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_articles")
data class CachedArticle(
    @PrimaryKey
    val id: String,
    val name: String,
    val sku: String?,
    val unitPrice: Double,
    val currentStock: Int,
    val unit: String,
    val categoryName: String?,
    val cachedAt: Long = System.currentTimeMillis()
)

// =============================================================================
// Cart (In-Memory)
// =============================================================================

data class CartItem(
    val article: CachedArticle,
    val quantity: Int
) {
    val total: Double get() = article.unitPrice * quantity
}
