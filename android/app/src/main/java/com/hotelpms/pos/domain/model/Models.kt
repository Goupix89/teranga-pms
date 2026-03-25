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
    val description: String? = null,
    val imageUrl: String? = null,
    val isApproved: Boolean = true,
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
// Establishment
// =============================================================================

data class Establishment(
    val id: String,
    val name: String,
    val address: String? = null,
    val city: String? = null,
    val country: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val currency: String? = "XOF",
    val currentUserRole: String? = null
)

data class EstablishmentsResponse(
    val success: Boolean,
    val data: List<Establishment>
)

// =============================================================================
// Rooms
// =============================================================================

data class Room(
    val id: String,
    val number: String,
    val floor: Int,
    val type: String,
    val status: String,
    val pricePerNight: Double,
    val maxOccupancy: Int,
    val amenities: List<String>? = null
)

data class RoomsResponse(
    val success: Boolean,
    val data: List<Room>
)

// =============================================================================
// Reservations
// =============================================================================

data class Reservation(
    val id: String,
    val roomId: String,
    val guestName: String,
    val guestEmail: String? = null,
    val guestPhone: String? = null,
    val checkIn: String,
    val checkOut: String,
    val status: String,
    val numberOfGuests: Int,
    val totalPrice: Double? = null,
    val room: Room? = null
)

data class ReservationsResponse(
    val success: Boolean,
    val data: List<Reservation>
)

data class ReservationDatesRequest(
    val checkIn: String,
    val checkOut: String
)

// =============================================================================
// Orders
// =============================================================================

data class Order(
    val id: String,
    val orderNumber: String? = null,
    val tableNumber: String? = null,
    val status: String,
    val totalAmount: Double,
    val paymentMethod: String? = null,
    val invoiceId: String? = null,
    val items: List<OrderItem>? = null,
    val createdBy: UserSummary? = null,
    val createdAt: String? = null
)

data class OrderItem(
    val id: String,
    val articleId: String,
    val quantity: Int,
    val unitPrice: Double,
    val totalPrice: Double,
    val article: ArticleInfo? = null
)

data class ArticleInfo(
    val id: String,
    val name: String
)

data class UserSummary(
    val id: String,
    val firstName: String,
    val lastName: String
)

data class OrdersResponse(
    val success: Boolean,
    val data: List<Order>
)

data class OrderStatusRequest(
    val status: String
)

data class CreateOrderRequest(
    val establishmentId: String,
    val tableNumber: String,
    val paymentMethod: String? = null,
    val items: List<CreateOrderItem>
)

data class QrCodeResponse(
    val success: Boolean,
    val data: QrCodeData? = null
)

data class QrCodeData(
    val qrCode: String,
    val invoice: QrInvoiceInfo? = null,
    val paymentMethod: String? = null,
    val paymentLabel: String? = null
)

data class QrInvoiceInfo(
    val id: String,
    val invoiceNumber: String,
    val totalAmount: Double,
    val status: String,
    val currency: String? = "XOF"
)

data class CreateOrderItem(
    val articleId: String,
    val quantity: Int,
    val unitPrice: Double
)

// =============================================================================
// Cleaning
// =============================================================================

data class CleaningSession(
    val id: String,
    val roomId: String,
    val cleanerId: String,
    val status: String,
    val clockInAt: String,
    val clockOutAt: String? = null,
    val durationMinutes: Int? = null,
    val notes: String? = null,
    val room: Room? = null,
    val cleaner: UserSummary? = null
)

data class CleaningResponse(
    val success: Boolean,
    val data: List<CleaningSession>
)

data class ClockInRequest(
    val establishmentId: String,
    val roomId: String,
    val notes: String? = null
)

// =============================================================================
// Approvals
// =============================================================================

data class Approval(
    val id: String,
    val type: String,
    val status: String,
    val payload: Map<String, Any>? = null,
    val targetId: String? = null,
    val reason: String? = null,
    val requestedBy: UserSummary? = null,
    val reviewedBy: UserSummary? = null,
    val reviewedAt: String? = null,
    val createdAt: String? = null
)

data class ApprovalsResponse(
    val success: Boolean,
    val data: List<Approval>
)

// =============================================================================
// Stock Movements
// =============================================================================

data class StockMovement(
    val id: String,
    val articleId: String,
    val type: String,
    val quantity: Int,
    val reason: String? = null,
    val article: ArticleInfo? = null,
    val createdAt: String? = null
)

data class StockMovementsResponse(
    val success: Boolean,
    val data: List<StockMovement>
)

data class CreateStockMovementRequest(
    val articleId: String,
    val type: String,
    val quantity: Int,
    val reason: String? = null,
    val establishmentId: String
)

// =============================================================================
// Dashboard Stats
// =============================================================================

data class DashboardStats(
    val totalRooms: Int = 0,
    val availableRooms: Int = 0,
    val occupiedRooms: Int = 0,
    val cleaningRooms: Int = 0,
    val todayOrders: Int = 0,
    val pendingOrders: Int = 0,
    val todayRevenue: Double = 0.0,
    val pendingApprovals: Int = 0,
    val activeSessions: Int = 0
)

// =============================================================================
// Generic Response
// =============================================================================

data class GenericResponse(
    val success: Boolean,
    val message: String? = null,
    val data: Any? = null
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
    val description: String? = null,
    val imageUrl: String? = null,
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
