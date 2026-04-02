package com.hotelpms.pos.data.remote

import com.hotelpms.pos.domain.model.*
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface PmsApiService {

    // Auth
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/auth/refresh")
    suspend fun refresh(): Response<RefreshResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    // Articles
    @GET("api/articles")
    suspend fun getArticles(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 200,
        @Query("menuOnly") menuOnly: Boolean = false
    ): Response<ArticlesResponse>

    // POS Transactions
    @POST("api/pos/transactions")
    suspend fun postTransaction(
        @Body request: PosTransactionRequest
    ): Response<PosTransactionResponse>

    // Establishments
    @GET("api/establishments")
    suspend fun getEstablishments(): EstablishmentsResponse

    // Rooms
    @GET("api/rooms")
    suspend fun getRooms(@Query("establishmentId") establishmentId: String): RoomsResponse

    @POST("api/rooms")
    suspend fun createRoom(@Body room: Map<String, Any>): GenericResponse

    // Reservations
    @GET("api/reservations")
    suspend fun getReservations(@Query("establishmentId") establishmentId: String? = null): ReservationsResponse

    @POST("api/reservations")
    suspend fun createReservation(@Body body: HashMap<String, Any>): CreateReservationResponse

    @PATCH("api/reservations/{id}/dates")
    suspend fun updateReservationDates(@Path("id") id: String, @Body body: ReservationDatesRequest): GenericResponse

    @POST("api/reservations/{id}/check-in")
    suspend fun checkIn(@Path("id") id: String): GenericResponse

    @POST("api/reservations/{id}/check-out")
    suspend fun checkOut(@Path("id") id: String): GenericResponse

    // Reservation receipt PDF
    @Streaming
    @GET("api/reservations/{id}/receipt")
    suspend fun getReservationReceipt(@Path("id") id: String): Response<ResponseBody>

    // Orders
    @GET("api/orders")
    suspend fun getOrders(
        @Query("establishmentId") establishmentId: String? = null,
        @Query("status") status: String? = null
    ): OrdersResponse

    @GET("api/orders/kitchen/{establishmentId}")
    suspend fun getKitchenOrders(@Path("establishmentId") establishmentId: String): Response<List<Order>>

    @POST("api/orders")
    suspend fun createOrder(@Body body: CreateOrderRequest): Response<GenericResponse>

    // Invoices - QR code
    @GET("api/invoices/{id}/qrcode")
    suspend fun getInvoiceQrCode(
        @Path("id") id: String,
        @Query("paymentMethod") paymentMethod: String? = null
    ): Response<QrCodeResponse>

    // Simulate payment (dev/test)
    @POST("api/invoices/{id}/simulate-payment")
    suspend fun simulatePayment(@Path("id") id: String): Response<GenericResponse>

    @PATCH("api/orders/{id}/status")
    suspend fun updateOrderStatus(@Path("id") id: String, @Body body: OrderStatusRequest): GenericResponse

    // Cleaning
    @GET("api/cleaning")
    suspend fun getCleaningSessions(@Query("establishmentId") establishmentId: String): CleaningResponse

    @POST("api/cleaning/clock-in")
    suspend fun clockIn(@Body body: ClockInRequest): GenericResponse

    @POST("api/cleaning/{id}/clock-out")
    suspend fun clockOut(@Path("id") id: String): GenericResponse

    // Approvals
    @GET("api/approvals")
    suspend fun getApprovals(@Query("establishmentId") establishmentId: String? = null): ApprovalsResponse

    @POST("api/approvals/{id}/approve")
    suspend fun approveRequest(@Path("id") id: String): GenericResponse

    @POST("api/approvals/{id}/reject")
    suspend fun rejectRequest(@Path("id") id: String, @Body body: Map<String, String>): GenericResponse

    // Stock
    @GET("api/stock-movements")
    suspend fun getStockMovements(@Query("establishmentId") establishmentId: String? = null): StockMovementsResponse

    @POST("api/stock-movements")
    suspend fun createStockMovement(@Body body: CreateStockMovementRequest): GenericResponse

    // Articles management
    @POST("api/articles")
    suspend fun createArticle(@Body body: Map<String, Any>): GenericResponse

    // Receipt PDF
    @Streaming
    @GET("api/orders/{id}/receipt")
    suspend fun getOrderReceipt(@Path("id") id: String): Response<ResponseBody>

    // Invoice PDF
    @Streaming
    @GET("api/invoices/{id}/pdf")
    suspend fun getInvoicePdf(@Path("id") id: String): Response<ResponseBody>

    // Invoices - merge
    @GET("api/invoices/by-table/{tableNumber}")
    suspend fun getInvoicesByTable(@Path("tableNumber") tableNumber: String): Response<GenericResponse>

    @POST("api/invoices/merge")
    suspend fun mergeInvoices(@Body body: MergeInvoicesRequest): Response<GenericResponse>

    // Notifications
    @GET("api/notifications")
    suspend fun getNotifications(
        @Query("unread") unread: Boolean? = null,
        @Query("limit") limit: Int = 50
    ): Response<NotificationsResponse>

    @GET("api/notifications/unread-count")
    suspend fun getUnreadCount(): Response<UnreadCountResponse>

    @POST("api/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): Response<GenericResponse>

    @POST("api/notifications/read-all")
    suspend fun markAllNotificationsRead(): Response<GenericResponse>

    // Push notifications - register FCM device token
    @POST("api/notifications/device-token")
    suspend fun registerDeviceToken(@Body body: Map<String, String>): Response<GenericResponse>

    // Push notifications - remove FCM device token
    @HTTP(method = "DELETE", path = "api/notifications/device-token", hasBody = true)
    suspend fun removeDeviceToken(@Body body: Map<String, String>): Response<GenericResponse>
}
