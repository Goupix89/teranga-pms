package com.hotelpms.pos.ui.approvals

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Approval
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ApprovalsUiState(
    val approvals: List<Approval> = emptyList(),
    val filteredApprovals: List<Approval> = emptyList(),
    val selectedFilter: String = "ALL",
    val userRole: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class ApprovalsViewModel @Inject constructor(
    private val api: PmsApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(ApprovalsUiState())
        private set

    private val establishmentId: String
        get() = tokenManager.establishmentId ?: ""

    init {
        uiState = uiState.copy(userRole = tokenManager.establishmentRole ?: "")
        fetchApprovals()
    }

    fun fetchApprovals() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = api.getApprovals(establishmentId)
                if (response.success) {
                    val approvals = response.data
                    uiState = uiState.copy(
                        approvals = approvals,
                        isLoading = false
                    )
                    applyFilter(uiState.selectedFilter)
                } else {
                    uiState = uiState.copy(isLoading = false, error = "Impossible de charger les approbations")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de chargement")
            }
        }
    }

    fun setFilter(filter: String) {
        uiState = uiState.copy(selectedFilter = filter)
        applyFilter(filter)
    }

    private fun applyFilter(filter: String) {
        val filtered = when (filter) {
            "PENDING" -> uiState.approvals.filter { it.status == "PENDING" }
            "APPROVED" -> uiState.approvals.filter { it.status == "APPROVED" }
            "REJECTED" -> uiState.approvals.filter { it.status == "REJECTED" }
            else -> uiState.approvals
        }
        uiState = uiState.copy(filteredApprovals = filtered)
    }

    fun approve(id: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val response = api.approveRequest(id)
                if (response.success) {
                    uiState = uiState.copy(
                        isLoading = false,
                        successMessage = "Demande approuv\u00e9e"
                    )
                    fetchApprovals()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur d'approbation")
            }
        }
    }

    fun reject(id: String, reason: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val response = api.rejectRequest(id, mapOf("reason" to reason))
                if (response.success) {
                    uiState = uiState.copy(
                        isLoading = false,
                        successMessage = "Demande rejet\u00e9e"
                    )
                    fetchApprovals()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de rejet")
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
