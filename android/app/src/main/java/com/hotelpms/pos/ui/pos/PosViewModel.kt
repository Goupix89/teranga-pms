package com.hotelpms.pos.ui.pos

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.repository.PosRepository
import com.hotelpms.pos.domain.model.CachedArticle
import com.hotelpms.pos.domain.model.CartItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PosUiState(
    val isLoadingArticles: Boolean = false,
    val isProcessing: Boolean = false,
    val searchQuery: String = "",
    val error: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class PosViewModel @Inject constructor(
    private val repository: PosRepository
) : ViewModel() {

    var uiState by mutableStateOf(PosUiState())
        private set

    // Articles from local cache
    private val _searchQuery = MutableStateFlow("")
    val articles: StateFlow<List<CachedArticle>> = _searchQuery
        .debounce(300)
        .flatMapLatest { query ->
            if (query.isBlank()) {
                repository.getArticlesFlow()
            } else {
                repository.searchArticlesFlow(query)
            }
        }
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

    // ==========================================================================
    // Cart operations
    // ==========================================================================

    fun addToCart(article: CachedArticle) {
        val current = _cartItems.value.toMutableList()
        val existingIndex = current.indexOfFirst { it.article.id == article.id }

        if (existingIndex >= 0) {
            val existing = current[existingIndex]
            current[existingIndex] = existing.copy(quantity = existing.quantity + 1)
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
            if (item.article.id == articleId) item.copy(quantity = quantity)
            else item
        }
    }

    fun clearCart() {
        _cartItems.value = emptyList()
    }

    // ==========================================================================
    // Process transaction
    // ==========================================================================

    fun processTransaction(invoiceId: String) {
        val items = _cartItems.value
        if (items.isEmpty()) {
            uiState = uiState.copy(error = "Le panier est vide")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isProcessing = true, error = null)

            try {
                val uuid = repository.createTransaction(
                    cartItems = items,
                    invoiceId = invoiceId
                )
                clearCart()
                uiState = uiState.copy(
                    isProcessing = false,
                    successMessage = "Transaction enregistrée ($uuid)"
                )
            } catch (e: Exception) {
                uiState = uiState.copy(
                    isProcessing = false,
                    error = e.message ?: "Erreur lors du traitement"
                )
            }
        }
    }

    fun syncPending() {
        viewModelScope.launch {
            try {
                val count = repository.syncAllPending()
                if (count > 0) {
                    uiState = uiState.copy(successMessage = "$count transaction(s) synchronisée(s)")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(error = "Erreur de synchronisation: ${e.message}")
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
