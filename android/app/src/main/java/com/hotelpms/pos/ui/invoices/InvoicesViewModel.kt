package com.hotelpms.pos.ui.invoices

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Invoice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class InvoicesUiState(
    val invoices: List<Invoice> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val statusFilter: String? = null,
    val searchQuery: String = ""
) {
    val filteredInvoices: List<Invoice>
        get() {
            var result = invoices
            if (statusFilter != null) {
                result = result.filter { it.status == statusFilter }
            }
            if (searchQuery.isNotBlank()) {
                val q = searchQuery.lowercase()
                result = result.filter {
                    it.invoiceNumber.lowercase().contains(q) ||
                    it.notes?.lowercase()?.contains(q) == true ||
                    it.reservation?.guestName?.lowercase()?.contains(q) == true
                }
            }
            return result
        }
}

@HiltViewModel
class InvoicesViewModel @Inject constructor(
    private val apiService: PmsApiService
) : ViewModel() {

    var uiState by mutableStateOf(InvoicesUiState())
        private set

    init {
        fetchInvoices()
    }

    fun fetchInvoices() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = apiService.getInvoices()
                if (response.isSuccessful && response.body()?.success == true) {
                    uiState = uiState.copy(
                        isLoading = false,
                        invoices = response.body()!!.data
                    )
                } else {
                    uiState = uiState.copy(isLoading = false, error = "Erreur de chargement")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur reseau")
            }
        }
    }

    fun setStatusFilter(status: String?) {
        uiState = uiState.copy(statusFilter = status)
    }

    fun setSearchQuery(query: String) {
        uiState = uiState.copy(searchQuery = query)
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }
}
