package com.hotelpms.pos.ui.offline

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.repository.PosRepository
import com.hotelpms.pos.domain.model.PendingTransaction
import com.hotelpms.pos.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class OfflineQueueUiState(
    val syncing: Boolean = false,
    val message: String? = null,
    val error: String? = null
)

@HiltViewModel
class OfflineQueueViewModel @Inject constructor(
    private val repository: PosRepository
) : ViewModel() {
    var uiState by mutableStateOf(OfflineQueueUiState())
        private set

    val transactions: StateFlow<List<PendingTransaction>> = repository
        .getPendingTransactionsFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun forceSync() {
        viewModelScope.launch {
            uiState = uiState.copy(syncing = true, error = null, message = null)
            try {
                val count = repository.syncAllPending()
                uiState = uiState.copy(
                    syncing = false,
                    message = if (count > 0) "$count transaction(s) synchronisée(s)" else "Rien à synchroniser"
                )
            } catch (e: Exception) {
                uiState = uiState.copy(syncing = false, error = e.message ?: "Erreur de synchronisation")
            }
        }
    }

    fun clearMessage() { uiState = uiState.copy(message = null, error = null) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfflineQueueScreen(viewModel: OfflineQueueViewModel = hiltViewModel()) {
    val transactions by viewModel.transactions.collectAsState()
    val state = viewModel.uiState
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }
    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    val pending = transactions.filter { it.syncStatus == "PENDING" || it.syncStatus == "SYNCING" }
    val failed = transactions.filter { it.syncStatus == "FAILED" || it.retryCount > 10 }
    val synced = transactions.filter { it.syncStatus == "SYNCED" }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("File hors-ligne") },
                actions = {
                    IconButton(
                        onClick = { viewModel.forceSync() },
                        enabled = !state.syncing
                    ) {
                        if (state.syncing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Synchroniser")
                        }
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatCard("En attente", pending.size, Color(0xFFF59E0B), Modifier.weight(1f))
                    StatCard("En échec", failed.size, Color(0xFFEF4444), Modifier.weight(1f))
                    StatCard("Synchronisées", synced.size, Color(0xFF10B981), Modifier.weight(1f))
                }
            }

            if (pending.isEmpty() && failed.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Outlined.CloudOff,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Aucune transaction en attente",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (pending.isNotEmpty()) {
                item { SectionHeader("En attente de synchronisation") }
                items(pending) { tx -> TxCard(tx) }
            }

            if (failed.isNotEmpty()) {
                item { SectionHeader("Échecs — intervention requise", color = Color(0xFFEF4444)) }
                items(failed) { tx -> TxCard(tx) }
            }

            if (synced.isNotEmpty()) {
                item {
                    SectionHeader(
                        "Historique (${synced.size})",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                items(synced.take(30)) { tx -> TxCard(tx, faded = true) }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: Int, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.1f))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = label,
                fontSize = 11.sp,
                color = color,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "$value",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = color
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String, color: Color = BronzeAbomey) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier.padding(top = 8.dp)
    )
}

@Composable
private fun TxCard(tx: PendingTransaction, faded: Boolean = false) {
    val fmt = remember { NumberFormat.getNumberInstance(Locale.FRANCE).apply { maximumFractionDigits = 0 } }
    val timeFmt = remember { SimpleDateFormat("dd/MM HH:mm", Locale.FRANCE) }
    val parsedTime = try {
        Date.from(java.time.Instant.parse(tx.timestamp))
    } catch (_: Exception) {
        null
    }

    val statusColor = when (tx.syncStatus) {
        "SYNCED" -> Color(0xFF10B981)
        "SYNCING" -> Color(0xFF3B82F6)
        "FAILED" -> Color(0xFFEF4444)
        else -> Color(0xFFF59E0B)
    }
    val statusLabel = when (tx.syncStatus) {
        "SYNCED" -> "Synchronisé"
        "SYNCING" -> "En cours…"
        "FAILED" -> "Échec"
        else -> "En attente"
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (faded) 0.6f else 1f),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Facture ${tx.invoiceId.take(8)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        "${fmt.format(tx.totalAmount)} FCFA",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = RougeDahomey
                    )
                    parsedTime?.let {
                        Text(
                            "Saisi le ${timeFmt.format(it)}",
                            fontSize = 11.sp,
                            color = BronzeAbomey
                        )
                    }
                    if (tx.retryCount > 0) {
                        Text(
                            "${tx.retryCount} tentative${if (tx.retryCount > 1) "s" else ""}",
                            fontSize = 11.sp,
                            color = Color(0xFFF59E0B)
                        )
                    }
                    tx.lastError?.takeIf { it.isNotBlank() }?.let { err ->
                        Text(
                            err,
                            fontSize = 11.sp,
                            color = Color(0xFFEF4444)
                        )
                    }
                }
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        statusLabel,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = statusColor
                    )
                }
            }
        }
    }
}

