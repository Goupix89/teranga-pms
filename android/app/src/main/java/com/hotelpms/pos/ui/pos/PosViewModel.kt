package com.hotelpms.pos.ui.pos

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.OrderSyncService
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.data.repository.PosRepository
import com.hotelpms.pos.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PosUiState(
    val isLoadingArticles: Boolean = false,
    val isProcessing: Boolean = false,
    val searchQuery: String = "",
    val tableNumber: String = "",
    val paymentMethod: String = "CASH",
    val notes: String = "",
    val error: String? = null,
    val successMessage: String? = null,
    // QR code payment
    val qrCodeData: QrCodeData? = null,
    val showQrCode: Boolean = false,
    val isSimulating: Boolean = false,
    val simulationSuccess: Boolean = false
)

@HiltViewModel
class PosViewModel @Inject constructor(
    private val repository: PosRepository,
    private val apiService: PmsApiService,
    private val tokenManager: TokenManager,
    private val orderSyncService: OrderSyncService
) : ViewModel() {

    var uiState by mutableStateOf(PosUiState())
        private set

    // Articles from local cache
    private val _searchQuery = MutableStateFlow("")
    val articles: StateFlow<List<CachedArticle>> = _searchQuery
        .debounce(300)
        .flatMapLatest { query ->
            try {
                if (query.isBlank()) {
                    repository.getArticlesFlow()
                } else {
                    repository.searchArticlesFlow(query)
                }
            } catch (_: Exception) {
                kotlinx.coroutines.flow.flowOf(emptyList())
            }
        }
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Cart
    private val _cartItems = MutableStateFlow<List<CartItem>>(emptyList())
    val cartItems: StateFlow<List<CartItem>> = _cartItems.asStateFlow()

    val cartTotal: StateFlow<Double> = _cartItems
        .map { items -> items.sumOf { it.total } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val cartItemCount: StateFlow<Int> = _cartItems
        .map { items -> items.sumOf { it.quantity } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // Pending sync count
    val pendingCount: StateFlow<Int> = repository.getPendingCountFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    init {
        refreshArticles()
        try {
            startRealtimeSync()
        } catch (_: Exception) {
            // SSE sync is optional — don't crash if it fails
        }
    }

    private fun startRealtimeSync() {
        try {
            orderSyncService.connect()
        } catch (_: Exception) { }
        orderSyncService.orderEvents
            .onEach { event ->
                if (event == "ORDER_UPDATE") {
                    refreshArticles()
                }
            }
            .launchIn(viewModelScope)
    }

    override fun onCleared() {
        super.onCleared()
        orderSyncService.disconnect()
    }

    fun refreshArticles() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoadingArticles = true)
            repository.refreshArticles()
            uiState = uiState.copy(isLoadingArticles = false)
        }
    }

    fun onSearchQueryChange(query: String) {
        uiState = uiState.copy(searchQuery = query)
        _searchQuery.value = query
    }

    fun setTableNumber(table: String) {
        uiState = uiState.copy(tableNumber = table)
    }

    fun setPaymentMethod(method: String) {
        uiState = uiState.copy(paymentMethod = method)
    }

    fun setNotes(notes: String) {
        uiState = uiState.copy(notes = notes)
    }

    // Cart operations
    fun addToCart(article: CachedArticle) {
        val current = _cartItems.value.toMutableList()
        val existingIndex = current.indexOfFirst { it.article.id == article.id }
        val nextQty = if (existingIndex >= 0) current[existingIndex].quantity + 1 else 1
        if (article.trackStock && nextQty > article.currentStock) {
            uiState = uiState.copy(
                error = "Stock insuffisant pour ${article.name} (${article.currentStock} disponible)"
            )
            return
        }
        if (existingIndex >= 0) {
            val existing = current[existingIndex]
            current[existingIndex] = existing.copy(quantity = nextQty)
        } else {
            current.add(CartItem(article = article, quantity = 1))
        }
        _cartItems.value = current
    }

    fun removeFromCart(articleId: String) {
        _cartItems.value = _cartItems.value.filter { it.article.id != articleId }
    }

    fun updateQuantity(articleId: String, quantity: Int) {
        if (quantity <= 0) {
            removeFromCart(articleId)
            return
        }
        _cartItems.value = _cartItems.value.map { item ->
            if (item.article.id == articleId) item.copy(quantity = quantity) else item
        }
    }

    fun clearCart() {
        _cartItems.value = emptyList()
        uiState = uiState.copy(tableNumber = "", notes = "")
    }

    // ==========================================================================
    // Create order via /orders API (same as web POS)
    // ==========================================================================

    fun submitOrder() {
        val items = _cartItems.value
        if (items.isEmpty()) {
            uiState = uiState.copy(error = "Le panier est vide")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isProcessing = true, error = null)
            try {
                val estId = tokenManager.establishmentId ?: return@launch
                val request = CreateOrderRequest(
                    establishmentId = estId,
                    tableNumber = uiState.tableNumber.ifBlank { null },
                    paymentMethod = uiState.paymentMethod,
                    items = items.map { entry ->
                        CreateOrderItem(
                            articleId = entry.article.id,
                            quantity = entry.quantity,
                            unitPrice = entry.article.unitPrice
                        )
                    },
                    notes = uiState.notes.ifBlank { null }
                )
                val response = apiService.createOrder(request)
                if (response.isSuccessful) {
                    val body = response.body()
                    val invoiceId = (body?.data as? Map<*, *>)?.get("invoiceId") as? String
                    val savedPaymentMethod = uiState.paymentMethod
                    clearCart()
                    uiState = uiState.copy(
                        isProcessing = false,
                        successMessage = "Commande creee"
                    )
                    // Fetch QR code for non-cash payments
                    if (invoiceId != null && savedPaymentMethod != "CASH") {
                        fetchQrCode(invoiceId, savedPaymentMethod)
                    }
                } else {
                    uiState = uiState.copy(isProcessing = false, error = "Erreur lors de la creation")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isProcessing = false, error = e.message ?: "Erreur reseau")
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
                        simulationSuccess = false
                    )
                }
            } catch (_: Exception) { }
        }
    }

    fun dismissQrCode() {
        uiState = uiState.copy(showQrCode = false, qrCodeData = null, simulationSuccess = false)
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
                        successMessage = "Paiement confirme"
                    )
                } else {
                    uiState = uiState.copy(isSimulating = false, error = "Erreur simulation")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isSimulating = false, error = e.message ?: "Erreur")
            }
        }
    }

    fun syncPending() {
        viewModelScope.launch {
            try {
                val count = repository.syncAllPending()
                if (count > 0) {
                    uiState = uiState.copy(successMessage = "$count transaction(s) synchronisee(s)")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(error = "Erreur de synchronisation: ${e.message}")
            }
        }
    }

    fun clearError() { uiState = uiState.copy(error = null) }
    fun clearSuccess() { uiState = uiState.copy(successMessage = null) }
}
