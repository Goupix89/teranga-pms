package com.hotelpms.pos.ui.approvals

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Approval
import com.hotelpms.pos.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApprovalsScreen(
    viewModel: ApprovalsViewModel = hiltViewModel()
) {
    val state = viewModel.uiState
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    LaunchedEffect(state.successMessage) {
        state.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccess()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (state.userRole.uppercase() in listOf("DAF", "OWNER")) "Approbations"
                        else "Mes demandes"
                    )
                },
                actions = {
                    IconButton(onClick = { viewModel.fetchApprovals() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafra\u00eechir")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Filter tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChipItem("ALL", "Toutes", state.selectedFilter) { viewModel.setFilter(it) }
                FilterChipItem("PENDING", "En attente", state.selectedFilter) { viewModel.setFilter(it) }
                FilterChipItem("APPROVED", "Approuv\u00e9es", state.selectedFilter) { viewModel.setFilter(it) }
                FilterChipItem("REJECTED", "Rejet\u00e9es", state.selectedFilter) { viewModel.setFilter(it) }
            }

            if (state.isLoading && state.approvals.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (state.filteredApprovals.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inbox,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Aucune demande",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(state.filteredApprovals) { approval ->
                        ApprovalCard(
                            approval = approval,
                            isDaf = state.userRole.uppercase() in listOf("DAF", "OWNER"),
                            isLoading = state.isLoading,
                            onApprove = { viewModel.approve(approval.id) },
                            onReject = { reason -> viewModel.reject(approval.id, reason) }
                        )
                    }
                    item { Spacer(modifier = Modifier.height(16.dp)) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterChipItem(
    value: String,
    label: String,
    selected: String,
    onClick: (String) -> Unit
) {
    FilterChip(
        selected = selected == value,
        onClick = { onClick(value) },
        label = { Text(label) },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = OrBeninois.copy(alpha = 0.2f),
            selectedLabelColor = OrBeninoisDark
        )
    )
}

@Composable
private fun ApprovalCard(
    approval: Approval,
    isDaf: Boolean,
    isLoading: Boolean,
    onApprove: () -> Unit,
    onReject: (String) -> Unit
) {
    var showRejectDialog by remember { mutableStateOf(false) }
    var showApproveDialog by remember { mutableStateOf(false) }
    var rejectReason by remember { mutableStateOf("") }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: type + status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = translateType(approval.type),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                StatusBadge(approval.status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Requester
            approval.requestedBy?.let { user ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        "Demand\u00e9 par ${user.firstName} ${user.lastName}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Date
            approval.createdAt?.let { date ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.CalendarToday,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        formatDate(date),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Payload summary
            approval.payload?.let { payload ->
                Spacer(modifier = Modifier.height(4.dp))
                val summary = payload.entries.take(3).joinToString(", ") { "${it.key}: ${it.value}" }
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Rejection reason if rejected
            if (approval.status == "REJECTED" && !approval.reason.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Motif : ${approval.reason}",
                    style = MaterialTheme.typography.bodySmall,
                    color = RougeDahomey
                )
            }

            // Action buttons for DAF on pending approvals
            if (isDaf && approval.status == "PENDING") {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { showRejectDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = RougeDahomey),
                        enabled = !isLoading
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Rejeter")
                    }
                    Button(
                        onClick = { showApproveDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = VertBeninois),
                        enabled = !isLoading
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Approuver")
                    }
                }
            }
        }
    }

    // Approve confirmation dialog
    if (showApproveDialog) {
        AlertDialog(
            onDismissRequest = { showApproveDialog = false },
            title = { Text("Confirmer l'approbation") },
            text = { Text("Voulez-vous approuver cette demande de ${translateType(approval.type).lowercase()} ?") },
            confirmButton = {
                TextButton(onClick = {
                    showApproveDialog = false
                    onApprove()
                }) {
                    Text("Approuver", color = VertBeninois)
                }
            },
            dismissButton = {
                TextButton(onClick = { showApproveDialog = false }) {
                    Text("Annuler")
                }
            }
        )
    }

    // Reject dialog with reason
    if (showRejectDialog) {
        AlertDialog(
            onDismissRequest = { showRejectDialog = false },
            title = { Text("Rejeter la demande") },
            text = {
                Column {
                    Text("Veuillez indiquer le motif du rejet :")
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = rejectReason,
                        onValueChange = { rejectReason = it },
                        label = { Text("Motif") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showRejectDialog = false
                        onReject(rejectReason)
                        rejectReason = ""
                    },
                    enabled = rejectReason.isNotBlank()
                ) {
                    Text("Rejeter", color = RougeDahomey)
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showRejectDialog = false
                    rejectReason = ""
                }) {
                    Text("Annuler")
                }
            }
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (color, label) = when (status) {
        "PENDING" -> Pair(OrBeninois, "En attente")
        "APPROVED" -> Pair(VertBeninois, "Approuv\u00e9e")
        "REJECTED" -> Pair(RougeDahomey, "Rejet\u00e9e")
        else -> Pair(BronzeAbomey, status)
    }

    Surface(
        color = color.copy(alpha = 0.15f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

private fun translateType(type: String): String {
    return when (type) {
        "ROOM_CREATION" -> "Cr\u00e9ation chambre"
        "STOCK_MOVEMENT" -> "Mouvement stock"
        "RESERVATION_MODIFICATION" -> "Modification r\u00e9servation"
        else -> type.replace("_", " ")
    }
}

private fun formatDate(isoString: String): String {
    return try {
        val datePart = isoString.substringBefore("T")
        val parts = datePart.split("-")
        if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else datePart
    } catch (e: Exception) {
        isoString
    }
}
