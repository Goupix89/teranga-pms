package com.hotelpms.pos.ui.orders

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.OrderSyncService
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.*
import com.hotelpms.pos.domain.model.RestaurantTable
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CartEntry(
    val article: Article,
    val quantity: Int
) {
    val total: Double get() = article.unitPrice * quantity
}

data class OrdersUiState(
    val orders: List<Order> = emptyList(),
    val articles: List<Article> = emptyList(),
    val cart: List<CartEntry> = emptyList(),
    val isLoading: Boolean = false,
    val isLoadingArticles: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
    val statusFilter: String? = null,
    val myOrdersOnly: Boolean = false,
    val menuTab: String = "Tous", // "Tous" + dynamic category names
    val categories: List<ArticleCategory> = emptyList(),
    val viewMode: String = "menu", // "menu" or "orders"
    val tableNumber: String = "",
    val paymentMethod: String = "CASH",
    val orderNotes: String = "",
    val isVoucher: Boolean = false,
    val voucherOwnerId: String = "",
    val voucherOwnerName: String = "",
    val owners: List<com.hotelpms.pos.domain.model.OwnerInfo> = emptyList(),
    // Server attribution (POS only: pick which server the order is for)
    val establishmentServers: List<com.hotelpms.pos.domain.model.EstablishmentServer> = emptyList(),
    val selectedServerId: String = "",
    // Operation date offset in days (0 = today, 1 = yesterday, -1 = 14 days ago for supervisors)
    val operationDateOffset: Int = 0,
    val menuSearchQuery: String = "",
    val qrCodeData: QrCodeData? = null,
    val showQrCode: Boolean = false,
    val pollingInvoiceId: String? = null,
    val paymentConfirmed: Boolean = false,
    val isCreating: Boolean = false,
    val isSimulating: Boolean = false,
    val simulationSuccess: Boolean = false,
    // Restaurant tables
    val restaurantTables: List<RestaurantTable> = emptyList(),
    // Merge invoices
    val showMergeDialog: Boolean = false,
    val mergeTableQuery: String = "",
    val mergeableInvoices: List<Map<String, Any>> = emptyList(),
    val isMerging: Boolean = false,
    val isFetchingMergeable: Boolean = false,
    // Cash-in (encaisser after order)
    val cashInOrder: Order? = null,
    val isCashingIn: Boolean = false,
    // Add-items (append articles to an open order)
    val addItemsOrder: Order? = null,
    val addItemsCart: List<CartEntry> = emptyList(),
    val addItemsSearchQuery: String = "",
    val addItemsTab: String = "Tous",
    val isAddingItems: Boolean = false
) {
    val filteredOrders: List<Order>
        get() = if (statusFilter == null) {
            orders
        } else {
            orders.filter { it.status == statusFilter }
        }

    val menuTabs: List<String>
        get() = listOf("Tous") + categories.map { it.name }

    val menuArticles: List<Article>
        get() {
            val query = menuSearchQuery.trim().lowercase()
            return articles.filter { article ->
                val catName = article.category?.name
                val matchesTab = menuTab == "Tous" || catName == menuTab
                val matchesSearch = query.isEmpty() || article.name.lowercase().contains(query)
                matchesTab && article.isApproved && matchesSearch
            }
        }

    val cartTotal: Double
        get() = cart.sumOf { it.total }

    val cartItemCount: Int
        get() = cart.sumOf { it.quantity }

    val addItemsTotal: Double
        get() = addItemsCart.sumOf { it.total }

    val addItemsCount: Int
        get() = addItemsCart.sumOf { it.quantity }

    val addItemsMenuArticles: List<Article>
        get() {
            val query = addItemsSearchQuery.trim().lowercase()
            return articles.filter { article ->
                val catName = article.category?.name
                val matchesTab = addItemsTab == "Tous" || catName == addItemsTab
                val matchesSearch = query.isEmpty() || article.name.lowercase().contains(query)
                matchesTab && article.isApproved && matchesSearch
            }
        }
}

@HiltViewModel
class OrdersViewModel @Inject constructor(
    private val apiService: PmsApiService,
    private val tokenManager: TokenManager,
    private val orderSyncService: OrderSyncService
) : ViewModel() {

    var uiState by mutableStateOf(OrdersUiState())
        private set

    private var paymentPollingJob: Job? = null

    init {
        fetchOrders()
        fetchArticles()
        fetchCategories()
        fetchRestaurantTables()
        fetchEstablishmentServers()
        startRealtimeSync()
    }

    fun fetchEstablishmentServers() {
        viewModelScope.launch {
            val estId = tokenManager.establishmentId ?: return@launch
            try {
                val response = apiService.getEstablishmentServers(estId)
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        establishmentServers = response.body()?.data ?: emptyList()
                    )
                }
            } catch (_: Exception) {}
        }
    }

    fun setSelectedServer(serverId: String) {
        uiState = uiState.copy(selectedServerId = serverId)
    }

    fun setOperationDateOffset(offset: Int) {
        uiState = uiState.copy(operationDateOffset = offset)
    }

    private fun operationDateIso(): String? {
        val offset = uiState.operationDateOffset
        if (offset == 0) return null
        val cal = java.util.Calendar.getInstance()
        val daysBack = if (offset < 0) 14 else offset
        cal.add(java.util.Calendar.DAY_OF_YEAR, -daysBack)
        return java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(cal.time)
    }

    fun fetchCategories() {
        viewModelScope.launch {
            try {
                val response = apiService.getCategories()
                if (response.isSuccessful) {
                    uiState = uiState.copy(categories = response.body()?.data ?: emptyList())
                }
            } catch (_: Exception) { }
        }
    }

    private fun startRealtimeSync() {
        // SSE for instant push
        orderSyncService.connect()
        orderSyncService.orderEvents
            .onEach { event ->
                if (event == "ORDER_UPDATE") {
                    fetchOrders()
                }
            }
            .launchIn(viewModelScope)

        // Polling every 5s as reliable fallback
        viewModelScope.launch {
            while (isActive) {
                delay(5000)
                fetchOrdersSilent()
            }
        }
    }

    private fun fetchOrdersSilent() {
        viewModelScope.launch {
            try {
                // forUserId matches createdById OR serverId so servers see POS-entered orders assigned to them.
                val forUserId = if (uiState.myOrdersOnly) tokenManager.userId else null
                val response = apiService.getOrders(forUserId = forUserId)
                if (response.data != uiState.orders) {
                    uiState = uiState.copy(orders = response.data)
                }
            } catch (_: Exception) { }
        }
    }

    override fun onCleared() {
        super.onCleared()
        orderSyncService.disconnect()
    }

    fun fetchOrders() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val forUserId = if (uiState.myOrdersOnly) tokenManager.userId else null
                val response = apiService.getOrders(forUserId = forUserId)
                uiState = uiState.copy(
                    orders = response.data,
                    isLoading = false
                )
            } catch (e: Exception) {
                uiState = uiState.copy(
                    isLoading = false,
                    error = e.message ?: "Erreur de chargement des commandes"
                )
            }
        }
    }

    fun toggleMyOrders() {
        uiState = uiState.copy(myOrdersOnly = !uiState.myOrdersOnly)
        fetchOrders()
    }

    fun fetchArticles() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoadingArticles = true)
            try {
                val response = apiService.getArticles(
                    menuOnly = true,
                    establishmentId = tokenManager.establishmentId
                )
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        articles = response.body()?.data ?: emptyList(),
                        isLoadingArticles = false
                    )
                }
            } catch (_: Exception) {
                uiState = uiState.copy(isLoadingArticles = false)
            }
        }
    }

    fun fetchRestaurantTables() {
        viewModelScope.launch {
            try {
                val response = apiService.getRestaurantTables()
                uiState = uiState.copy(
                    restaurantTables = response.data
                )
            } catch (_: Exception) { }
        }
    }

    fun setViewMode(mode: String) {
        uiState = uiState.copy(viewMode = mode)
    }

    fun setMenuTab(tab: String) {
        uiState = uiState.copy(menuTab = tab)
    }

    fun setMenuSearchQuery(query: String) {
        uiState = uiState.copy(menuSearchQuery = query)
    }

    fun setTableNumber(table: String) {
        uiState = uiState.copy(tableNumber = table)
    }

    fun setPaymentMethod(method: String) {
        uiState = uiState.copy(paymentMethod = method)
    }

    fun setOrderNotes(notes: String) {
        uiState = uiState.copy(orderNotes = notes)
    }

    fun toggleVoucher() {
        val newValue = !uiState.isVoucher
        uiState = uiState.copy(isVoucher = newValue, voucherOwnerId = "", voucherOwnerName = "")
        if (newValue && uiState.owners.isEmpty()) {
            fetchOwners()
        }
    }

    fun setVoucherOwner(ownerId: String) {
        val owner = uiState.owners.find { it.id == ownerId }
        uiState = uiState.copy(
            voucherOwnerId = ownerId,
            voucherOwnerName = owner?.name ?: ""
        )
    }

    private fun fetchOwners() {
        viewModelScope.launch {
            try {
                val response = apiService.getOwners()
                if (response.isSuccessful) {
                    uiState = uiState.copy(owners = response.body()?.data ?: emptyList())
                }
            } catch (_: Exception) {}
        }
    }

    fun addToCart(article: Article) {
        val existing = uiState.cart.find { it.article.id == article.id }
        val newCart = if (existing != null) {
            uiState.cart.map {
                if (it.article.id == article.id) it.copy(quantity = it.quantity + 1) else it
            }
        } else {
            uiState.cart + CartEntry(article, 1)
        }
        uiState = uiState.copy(cart = newCart)
    }

    fun removeFromCart(articleId: String) {
        val existing = uiState.cart.find { it.article.id == articleId } ?: return
        val newCart = if (existing.quantity > 1) {
            uiState.cart.map {
                if (it.article.id == articleId) it.copy(quantity = it.quantity - 1) else it
            }
        } else {
            uiState.cart.filter { it.article.id != articleId }
        }
        uiState = uiState.copy(cart = newCart)
    }

    fun clearCart() {
        uiState = uiState.copy(cart = emptyList(), tableNumber = "", orderNotes = "")
    }

    fun setStatusFilter(status: String?) {
        uiState = uiState.copy(statusFilter = status)
    }

    fun updateOrderStatus(orderId: String, newStatus: String) {
        viewModelScope.launch {
            try {
                apiService.updateOrderStatus(
                    id = orderId,
                    body = OrderStatusRequest(status = newStatus)
                )
                val statusLabel = when (newStatus) {
                    "SERVED" -> "Commande marquée comme servie"
                    "CANCELLED" -> "Commande annulée"
                    else -> "Statut mis à jour"
                }
                uiState = uiState.copy(successMessage = statusLabel)
                fetchOrders()
            } catch (e: Exception) {
                uiState = uiState.copy(
                    error = e.message ?: "Erreur lors de la mise à jour du statut"
                )
            }
        }
    }

    fun submitOrder() {
        if (uiState.cart.isEmpty()) return
        viewModelScope.launch {
            uiState = uiState.copy(isCreating = true, error = null)
            try {
                val estId = tokenManager.establishmentId ?: return@launch
                val tab = uiState.menuTab
                val orderType = when {
                    tab.equals("Loisirs", ignoreCase = true) || tab.equals("Loisir", ignoreCase = true) -> "LEISURE"
                    tab.equals("Location", ignoreCase = true) -> "LOCATION"
                    else -> "RESTAURANT"
                }
                val request = CreateOrderRequest(
                    establishmentId = estId,
                    idempotencyKey = java.util.UUID.randomUUID().toString(),
                    tableNumber = uiState.tableNumber.ifBlank { null },
                    orderType = orderType,
                    isVoucher = uiState.isVoucher,
                    voucherOwnerId = if (uiState.isVoucher) uiState.voucherOwnerId.ifBlank { null } else null,
                    voucherOwnerName = if (uiState.isVoucher) uiState.voucherOwnerName.ifBlank { null } else null,
                    paymentMethod = null,
                    notes = uiState.orderNotes.ifBlank { null },
                    serverId = uiState.selectedServerId.ifBlank { null },
                    operationDate = operationDateIso(),
                    items = uiState.cart.map { entry ->
                        CreateOrderItem(
                            articleId = entry.article.id,
                            quantity = entry.quantity,
                            unitPrice = entry.article.unitPrice
                        )
                    }
                )
                val response = apiService.createOrder(request)
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        isCreating = false,
                        successMessage = "Commande créée — encaissez après le service",
                        cart = emptyList(),
                        tableNumber = "",
                        orderNotes = "",
                        isVoucher = false,
                        voucherOwnerId = "",
                        voucherOwnerName = "",
                        selectedServerId = "",
                        operationDateOffset = 0,
                        viewMode = "orders"
                    )
                    fetchOrders()
                } else {
                    uiState = uiState.copy(isCreating = false, error = "Erreur lors de la création")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isCreating = false, error = e.message ?: "Erreur réseau")
            }
        }
    }

    fun fetchQrCode(invoiceId: String, paymentMethod: String? = null) {
        viewModelScope.launch {
            try {
                val response = apiService.getInvoiceQrCode(invoiceId, paymentMethod)
                if (response.isSuccessful && response.body()?.data != null) {
                    uiState = uiState.copy(
                        qrCodeData = response.body()!!.data,
                        showQrCode = true,
                        pollingInvoiceId = invoiceId,
                        paymentConfirmed = false
                    )
                    startPaymentPolling(invoiceId)
                }
            } catch (_: Exception) { }
        }
    }

    private fun startPaymentPolling(invoiceId: String) {
        paymentPollingJob?.cancel()
        paymentPollingJob = viewModelScope.launch {
            while (isActive) {
                delay(3000)
                try {
                    val res = apiService.getPaymentStatus(invoiceId)
                    if (res.isSuccessful && res.body()?.data?.paid == true) {
                        uiState = uiState.copy(
                            paymentConfirmed = true,
                            simulationSuccess = true,
                            successMessage = "Paiement reçu !"
                        )
                        fetchOrders()
                        break
                    }
                } catch (_: Exception) { }
            }
        }
    }

    fun dismissQrCode() {
        paymentPollingJob?.cancel()
        paymentPollingJob = null
        uiState = uiState.copy(
            showQrCode = false,
            qrCodeData = null,
            simulationSuccess = false,
            paymentConfirmed = false,
            pollingInvoiceId = null
        )
    }

    fun simulatePayment(invoiceId: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isSimulating = true)
            try {
                val response = apiService.simulatePayment(invoiceId)
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        isSimulating = false,
                        simulationSuccess = true,
                        successMessage = "Paiement simulé avec succès"
                    )
                } else {
                    uiState = uiState.copy(
                        isSimulating = false,
                        error = "Erreur lors de la simulation"
                    )
                }
            } catch (e: Exception) {
                uiState = uiState.copy(
                    isSimulating = false,
                    error = e.message ?: "Erreur réseau"
                )
            }
        }
    }

    // =============================================
    // Merge invoices by table
    // =============================================

    fun showMergeDialog() {
        uiState = uiState.copy(showMergeDialog = true, mergeTableQuery = "", mergeableInvoices = emptyList())
    }

    fun dismissMergeDialog() {
        uiState = uiState.copy(showMergeDialog = false, mergeableInvoices = emptyList(), mergeTableQuery = "")
    }

    fun setMergeTableQuery(table: String) {
        uiState = uiState.copy(mergeTableQuery = table)
    }

    @Suppress("UNCHECKED_CAST")
    fun fetchMergeableInvoices() {
        val table = uiState.mergeTableQuery.trim()
        if (table.isBlank()) return
        viewModelScope.launch {
            uiState = uiState.copy(isFetchingMergeable = true)
            try {
                val response = apiService.getInvoicesByTable(table)
                if (response.isSuccessful) {
                    val data = response.body()?.data
                    val list = (data as? List<*>)?.filterIsInstance<Map<String, Any>>() ?: emptyList()
                    uiState = uiState.copy(mergeableInvoices = list, isFetchingMergeable = false)
                } else {
                    uiState = uiState.copy(isFetchingMergeable = false, error = "Erreur recherche")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isFetchingMergeable = false, error = e.message)
            }
        }
    }

    fun mergeInvoices(invoiceIds: List<String>) {
        if (invoiceIds.size < 2) {
            uiState = uiState.copy(error = "Au moins 2 factures requises")
            return
        }
        viewModelScope.launch {
            uiState = uiState.copy(isMerging = true)
            try {
                val body = MergeInvoicesRequest(
                    invoiceIds = invoiceIds,
                    tableNumber = uiState.mergeTableQuery.ifBlank { null }
                )
                val response = apiService.mergeInvoices(body)
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        isMerging = false,
                        showMergeDialog = false,
                        mergeableInvoices = emptyList(),
                        successMessage = "Factures regroupées avec succès"
                    )
                    fetchOrders()
                } else {
                    uiState = uiState.copy(isMerging = false, error = "Erreur lors du regroupement")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isMerging = false, error = e.message ?: "Erreur")
            }
        }
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }

    fun clearSuccess() {
        uiState = uiState.copy(successMessage = null)
    }

    // =============================================
    // Cash-in (encaisser après la commande)
    // =============================================

    fun showCashInDialog(order: Order) {
        uiState = uiState.copy(cashInOrder = order)
    }

    fun dismissCashInDialog() {
        uiState = uiState.copy(cashInOrder = null, isCashingIn = false)
    }

    // =============================================
    // Add items to an open order
    // =============================================

    fun showAddItemsDialog(order: Order) {
        uiState = uiState.copy(
            addItemsOrder = order,
            addItemsCart = emptyList(),
            addItemsSearchQuery = "",
            addItemsTab = "Tous"
        )
    }

    fun dismissAddItemsDialog() {
        uiState = uiState.copy(
            addItemsOrder = null,
            addItemsCart = emptyList(),
            addItemsSearchQuery = "",
            isAddingItems = false
        )
    }

    fun setAddItemsSearchQuery(query: String) {
        uiState = uiState.copy(addItemsSearchQuery = query)
    }

    fun setAddItemsTab(tab: String) {
        uiState = uiState.copy(addItemsTab = tab)
    }

    fun addItemsIncrement(article: Article) {
        val existing = uiState.addItemsCart.find { it.article.id == article.id }
        val newCart = if (existing != null) {
            uiState.addItemsCart.map {
                if (it.article.id == article.id) it.copy(quantity = it.quantity + 1) else it
            }
        } else {
            uiState.addItemsCart + CartEntry(article, 1)
        }
        uiState = uiState.copy(addItemsCart = newCart)
    }

    fun addItemsDecrement(articleId: String) {
        val existing = uiState.addItemsCart.find { it.article.id == articleId } ?: return
        val newCart = if (existing.quantity > 1) {
            uiState.addItemsCart.map {
                if (it.article.id == articleId) it.copy(quantity = it.quantity - 1) else it
            }
        } else {
            uiState.addItemsCart.filter { it.article.id != articleId }
        }
        uiState = uiState.copy(addItemsCart = newCart)
    }

    fun submitAddItems() {
        val order = uiState.addItemsOrder ?: return
        if (uiState.addItemsCart.isEmpty()) {
            uiState = uiState.copy(error = "Ajoutez au moins un article")
            return
        }
        viewModelScope.launch {
            uiState = uiState.copy(isAddingItems = true)
            try {
                val body = AddOrderItemsRequest(
                    items = uiState.addItemsCart.map { entry ->
                        CreateOrderItem(
                            articleId = entry.article.id,
                            quantity = entry.quantity,
                            unitPrice = entry.article.unitPrice
                        )
                    },
                    idempotencyKey = java.util.UUID.randomUUID().toString()
                )
                val response = apiService.addOrderItems(order.id, body)
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        isAddingItems = false,
                        addItemsOrder = null,
                        addItemsCart = emptyList(),
                        addItemsSearchQuery = "",
                        successMessage = "Articles ajoutés — cuisine notifiée"
                    )
                    fetchOrders()
                } else {
                    val errMsg = try {
                        response.errorBody()?.string() ?: "Erreur lors de l'ajout"
                    } catch (_: Exception) { "Erreur lors de l'ajout" }
                    uiState = uiState.copy(isAddingItems = false, error = errMsg)
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isAddingItems = false, error = e.message ?: "Erreur réseau")
            }
        }
    }

    fun cashIn(orderId: String, method: String, paidAt: String? = null) {
        // Async methods (FedaPay, mobile money) require client-side confirmation.
        // The invoice is paid via FedaPay checkout + webhook, or a customer-scanned
        // QR + manual reconciliation — never synchronously from /cashin.
        val asyncMethods = setOf("FEDAPAY", "MOBILE_MONEY", "MOOV_MONEY", "MIXX_BY_YAS")
        if (method in asyncMethods) {
            val order = uiState.cashInOrder
            val invoiceId = order?.invoiceId
            if (invoiceId.isNullOrBlank()) {
                uiState = uiState.copy(error = "Aucune facture liée à cette commande")
                return
            }
            // Dismiss the cash-in modal and hand off to the QR code flow.
            uiState = uiState.copy(cashInOrder = null, isCashingIn = false)
            fetchQrCode(invoiceId, method)
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isCashingIn = true)
            try {
                val response = apiService.cashInOrder(orderId, CashInRequest(method = method, paidAt = paidAt))
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        isCashingIn = false,
                        cashInOrder = null,
                        successMessage = "Paiement encaissé"
                    )
                    fetchOrders()
                } else {
                    val errMsg = try {
                        response.errorBody()?.string() ?: "Erreur lors de l'encaissement"
                    } catch (_: Exception) { "Erreur lors de l'encaissement" }
                    uiState = uiState.copy(isCashingIn = false, error = errMsg)
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isCashingIn = false, error = e.message ?: "Erreur réseau")
            }
        }
    }
}
