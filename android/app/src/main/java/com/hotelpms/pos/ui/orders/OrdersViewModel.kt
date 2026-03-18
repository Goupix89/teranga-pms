package com.hotelpms.pos.ui.orders

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Article
import com.hotelpms.pos.domain.model.CreateOrderItem
import com.hotelpms.pos.domain.model.CreateOrderRequest
import com.hotelpms.pos.domain.model.Order
import com.hotelpms.pos.domain.model.OrderStatusRequest
import com.hotelpms.pos.domain.model.QrCodeData
import dagger.hilt.android.lifecycle.HiltViewModel
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
    val menuTab: String = "Restaurant", // "Restaurant" or "Boissons"
    val viewMode: String = "menu", // "menu" or "orders"
    val tableNumber: String = "",
    val paymentMethod: String = "CASH",
    val qrCodeData: QrCodeData? = null,
    val showQrCode: Boolean = false,
    val isCreating: Boolean = false,
    val isSimulating: Boolean = false,
    val simulationSuccess: Boolean = false
) {
    val filteredOrders: List<Order>
        get() = if (statusFilter == null) {
            orders
        } else {
            orders.filter { it.status == statusFilter }
        }

    val menuArticles: List<Article>
        get() {
            val foodCategories = listOf("Restaurant", "Nourriture")
            return articles.filter { article ->
                val catName = article.category?.name
                val matchesTab = if (menuTab == "Restaurant") {
                    catName in foodCategories
                } else {
                    catName == menuTab
                }
                matchesTab && article.isApproved
            }
        }

    val cartTotal: Double
        get() = cart.sumOf { it.total }

    val cartItemCount: Int
        get() = cart.sumOf { it.quantity }
}

@HiltViewModel
class OrdersViewModel @Inject constructor(
    private val apiService: PmsApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(OrdersUiState())
        private set

    init {
        fetchOrders()
        fetchArticles()
    }

    fun fetchOrders() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = apiService.getOrders()
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

    fun fetchArticles() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoadingArticles = true)
            try {
                val response = apiService.getArticles(menuOnly = true)
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

    fun setViewMode(mode: String) {
        uiState = uiState.copy(viewMode = mode)
    }

    fun setMenuTab(tab: String) {
        uiState = uiState.copy(menuTab = tab)
    }

    fun setTableNumber(table: String) {
        uiState = uiState.copy(tableNumber = table)
    }

    fun setPaymentMethod(method: String) {
        uiState = uiState.copy(paymentMethod = method)
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
        uiState = uiState.copy(cart = emptyList(), tableNumber = "")
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
                val request = CreateOrderRequest(
                    establishmentId = estId,
                    tableNumber = uiState.tableNumber,
                    paymentMethod = uiState.paymentMethod,
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
                    val body = response.body()
                    val invoiceId = (body?.data as? Map<*, *>)?.get("invoiceId") as? String
                    uiState = uiState.copy(
                        isCreating = false,
                        successMessage = "Commande créée — facture générée",
                        cart = emptyList(),
                        tableNumber = "",
                        viewMode = "orders"
                    )
                    fetchOrders()
                    if (invoiceId != null) {
                        fetchQrCode(invoiceId)
                    }
                } else {
                    uiState = uiState.copy(isCreating = false, error = "Erreur lors de la création")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isCreating = false, error = e.message ?: "Erreur réseau")
            }
        }
    }

    fun fetchQrCode(invoiceId: String) {
        viewModelScope.launch {
            try {
                val response = apiService.getInvoiceQrCode(invoiceId)
                if (response.isSuccessful && response.body()?.data != null) {
                    uiState = uiState.copy(
                        qrCodeData = response.body()!!.data,
                        showQrCode = true
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

    fun clearError() {
        uiState = uiState.copy(error = null)
    }

    fun clearSuccess() {
        uiState = uiState.copy(successMessage = null)
    }
}
