package com.hotelpms.pos.ui.stock

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Article
import com.hotelpms.pos.domain.model.CreateStockMovementRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StockUiState(
    val articles: List<Article> = emptyList(),
    val filteredArticles: List<Article> = emptyList(),
    val searchQuery: String = "",
    val userRole: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class StockViewModel @Inject constructor(
    private val api: PmsApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(StockUiState())
        private set

    private val establishmentId: String
        get() = tokenManager.establishmentId ?: ""

    init {
        uiState = uiState.copy(userRole = tokenManager.establishmentRole ?: "")
        fetchArticles()
    }

    fun fetchArticles() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = api.getArticles()
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.success) {
                        uiState = uiState.copy(
                            articles = body.data,
                            isLoading = false
                        )
                        applySearch(uiState.searchQuery)
                    } else {
                        uiState = uiState.copy(isLoading = false, error = "Impossible de charger les articles")
                    }
                } else {
                    uiState = uiState.copy(isLoading = false, error = "Erreur serveur: ${response.code()}")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de chargement")
            }
        }
    }

    fun onSearchQueryChange(query: String) {
        uiState = uiState.copy(searchQuery = query)
        applySearch(query)
    }

    private fun applySearch(query: String) {
        val filtered = if (query.isBlank()) {
            uiState.articles
        } else {
            val lower = query.lowercase()
            uiState.articles.filter {
                it.name.lowercase().contains(lower) ||
                        (it.sku?.lowercase()?.contains(lower) == true) ||
                        (it.category?.name?.lowercase()?.contains(lower) == true)
            }
        }
        uiState = uiState.copy(filteredArticles = filtered)
    }

    fun createStockMovement(
        articleId: String,
        type: String,
        quantity: Int,
        reason: String?
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val request = CreateStockMovementRequest(
                    articleId = articleId,
                    type = type,
                    quantity = quantity,
                    reason = reason,
                    establishmentId = establishmentId
                )
                val response = api.createStockMovement(request)
                if (response.success) {
                    val msg = if (uiState.userRole.uppercase() == "MANAGER") {
                        "Soumis \u00e0 validation DAF"
                    } else {
                        "Mouvement enregistr\u00e9"
                    }
                    uiState = uiState.copy(isLoading = false, successMessage = msg)
                    fetchArticles()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de cr\u00e9ation")
            }
        }
    }

    fun createArticle(
        name: String,
        sku: String,
        unitPrice: Double,
        currentStock: Int,
        unit: String,
        description: String,
        imageUrl: String
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val body = mutableMapOf<String, Any>(
                    "name" to name,
                    "sku" to sku,
                    "unitPrice" to unitPrice,
                    "currentStock" to currentStock,
                    "unit" to unit,
                    "establishmentId" to establishmentId
                )
                if (description.isNotBlank()) body["description"] = description
                if (imageUrl.isNotBlank()) body["imageUrl"] = imageUrl

                val response = api.createArticle(body)
                if (response.success) {
                    uiState = uiState.copy(isLoading = false, successMessage = "Article cr\u00e9\u00e9")
                    fetchArticles()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de cr\u00e9ation")
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
