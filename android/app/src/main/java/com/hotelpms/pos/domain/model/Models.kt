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

data class ArticleCategory(
    val id: String,
    val name: String,
    val _count: ArticleCategoryCount? = null
)

data class ArticleCategoryCount(val articles: Int = 0)

data class CategoriesResponse(
    val success: Boolean,
    val data: List<ArticleCategory>
)

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
// Restaurant Tables
// =============================================================================

data class RestaurantTable(
    val id: String,
    val number: String,
    val label: String? = null,
    val capacity: Int = 4,
    val isActive: Boolean = true
)

data class RestaurantTablesResponse(
    val success: Boolean,
    val data: List<RestaurantTable>
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
    val room: Room? = null,
    val invoiceId: String? = null,
    val invoices: List<ReservationInvoice>? = null,
    val paymentMethod: String? = null
)

data class ReservationInvoice(
    val id: String,
    val invoiceNumber: String,
    val status: String,
    val totalAmount: Double,
    val paymentMethod: String? = null
)

data class ReservationsResponse(
    val success: Boolean,
    val data: List<Reservation>
)

data class ReservationDatesRequest(
    val checkIn: String,
    val checkOut: String
)

data class CreateReservationResponse(
    val success: Boolean,
    val data: ReservationCreated? = null,
    val message: String? = null
)

data class ReservationCreated(
    val id: String,
    val invoiceId: String? = null,
    val paymentMethod: String? = null
)

// =============================================================================
// Orders
// =============================================================================

data class OwnerInfo(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val name: String
)

data class OwnersResponse(
    val success: Boolean,
    val data: List<OwnerInfo>
)

data class Order(
    val id: String,
    val orderNumber: String? = null,
    val tableNumber: String? = null,
    val orderType: String? = "RESTAURANT",
    val isVoucher: Boolean = false,
    val voucherOwnerName: String? = null,
    val status: String,
    val totalAmount: Double,
    val paymentMethod: String? = null,
    val invoiceId: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    val notes: String? = null,
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
    val idempotencyKey: String? = null,
    val tableNumber: String? = null,
    val orderType: String? = "RESTAURANT",
    val isVoucher: Boolean = false,
    val voucherOwnerId: String? = null,
    val voucherOwnerName: String? = null,
    val paymentMethod: String? = null,
    val items: List<CreateOrderItem>,
    val notes: String? = null,
    val startTime: String? = null,
    val endTime: String? = null
)

data class PaymentStatusResponse(
    val success: Boolean,
    val data: PaymentStatusData? = null
)

data class PaymentStatusData(
    val invoiceId: String,
    val status: String,
    val paid: Boolean,
    val paidAt: String? = null,
    val totalAmount: Double? = null
)

data class QrCodeResponse(
    val success: Boolean,
    val data: QrCodeData? = null
)

data class QrCodeData(
    val qrCode: String,
    val invoice: QrInvoiceInfo? = null,
    val paymentMethod: String? = null,
    val paymentLabel: String? = null,
    val fedapayCheckoutUrl: String? = null
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
// Notifications
// =============================================================================

data class Notification(
    val id: String,
    val type: String,
    val title: String,
    val body: String? = null,
    val isRead: Boolean = false,
    val data: Map<String, Any>? = null,
    val createdAt: String? = null
)

data class NotificationsResponse(
    val success: Boolean,
    val data: List<Notification>,
    val unreadCount: Int? = null
)

data class UnreadCountResponse(
    val success: Boolean,
    val data: UnreadCountData? = null
)

data class UnreadCountData(
    val count: Int
)

// =============================================================================
// Invoices
// =============================================================================

data class Invoice(
    val id: String,
    val invoiceNumber: String,
    val status: String,
    val subtotal: Double = 0.0,
    val taxRate: Double = 0.0,
    val taxAmount: Double = 0.0,
    val totalAmount: Double = 0.0,
    val paymentMethod: String? = null,
    val currency: String? = "XOF",
    val notes: String? = null,
    val createdAt: String? = null,
    val orders: List<InvoiceOrderRef>? = null,
    val createdBy: UserSummary? = null,
    val reservation: InvoiceReservationRef? = null,
    val _count: InvoiceCount? = null
)

data class InvoiceOrderRef(
    val id: String,
    val orderNumber: String? = null,
    val establishmentId: String? = null
)

data class InvoiceReservationRef(
    val id: String,
    val guestName: String? = null
)

data class InvoiceCount(
    val payments: Int = 0,
    val items: Int = 0
)

data class InvoicesResponse(
    val success: Boolean,
    val data: List<Invoice>,
    val meta: PaginationMeta? = null
)

data class MergeInvoicesRequest(
    val invoiceIds: List<String>,
    val tableNumber: String? = null
)

// =============================================================================
// Dashboard Config (Widget Preferences)
// =============================================================================

data class DashboardWidgetConfig(
    val id: String,
    val enabled: Boolean = true,
    val order: Int = 0,
    val size: String = "md"  // sm, md, lg
)

data class DashboardConfigResponse(
    val success: Boolean,
    val data: DashboardConfigData? = null
)

data class DashboardConfigData(
    val id: String? = null,
    val userId: String? = null,
    val widgets: List<DashboardWidgetConfig> = emptyList()
)

data class DashboardConfigSaveRequest(
    val widgets: List<DashboardWidgetConfig>
)

// =============================================================================
// Reports
// =============================================================================

data class DailyReportResponse(
    val success: Boolean,
    val data: DailyReportData? = null
)

data class DailyReportData(
    val date: String,
    val totalEncaisse: Double = 0.0,
    val voucherTotal: Double = 0.0,
    val voucherCount: Int = 0,
    val totalOrders: Int = 0,
    val byMethod: Map<String, PaymentMethodTotal> = emptyMap(),
    val byStatus: Map<String, Int> = emptyMap()
)

data class PaymentMethodTotal(
    val count: Int = 0,
    val total: Double = 0.0
)

data class RevenueSummaryResponse(
    val success: Boolean,
    val data: RevenueSummaryData? = null
)

data class RevenueSummaryData(
    val today: RevenueBucket = RevenueBucket(),
    val week: RevenueBucket = RevenueBucket(),
    val month: RevenueBucket = RevenueBucket()
)

data class RevenueBucket(
    val total: Double = 0.0,
    val count: Int = 0
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
    val sku: String? = null,
    val unitPrice: Double = 0.0,
    val currentStock: Int = 0,
    val unit: String = "piece",
    val categoryName: String? = null,
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
