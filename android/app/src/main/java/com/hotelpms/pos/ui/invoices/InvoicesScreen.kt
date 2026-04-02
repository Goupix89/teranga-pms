package com.hotelpms.pos.ui.invoices

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Establishment
import com.hotelpms.pos.domain.model.Invoice
import com.hotelpms.pos.ui.receipt.InvoiceReceiptScreen
import com.hotelpms.pos.domain.model.Order
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicesScreen(
    establishment: Establishment? = null,
    viewModel: InvoicesViewModel = hiltViewModel()
) {
    val uiState = viewModel.uiState
    var receiptInvoice by remember { mutableStateOf<Invoice?>(null) }

    // Invoice receipt dialog
    if (receiptInvoice != null && establishment != null) {
        val inv = receiptInvoice!!
        // Build a minimal Order-like object to pass to InvoiceReceiptScreen
        val pseudoOrder = Order(
            id = inv.id,
            orderNumber = inv.invoiceNumber,
            tableNumber = null,
            status = inv.status,
            totalAmount = inv.totalAmount,
            paymentMethod = inv.paymentMethod,
            invoiceId = inv.id,
            items = null,
            createdBy = inv.createdBy,
            createdAt = inv.createdAt
        )
        InvoiceReceiptScreen(
            order = pseudoOrder,
            establishment = establishment,
            onDismiss = { receiptInvoice = null }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Factures", fontWeight = FontWeight.Bold, fontSize = 22.sp)
                },
                actions = {
                    IconButton(onClick = { viewModel.fetchInvoices() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafraichir")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = TerreFon,
                    titleContentColor = SableOuidah,
                    actionIconContentColor = SableOuidah
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(SableOuidah)
        ) {
            // Search bar
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                placeholder = { Text("Rechercher une facture...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                singleLine = true
            )

            // Status filter tabs
            val filterTabs = listOf(
                "Toutes" to null,
                "Emises" to "ISSUED",
                "Payees" to "PAID",
                "Fusionnees" to "MERGED",
                "Annulees" to "CANCELLED"
            )

            ScrollableTabRow(
                selectedTabIndex = filterTabs.indexOfFirst { it.second == uiState.statusFilter }
                    .coerceAtLeast(0),
                containerColor = CremeGanvie,
                contentColor = TerreFon,
                edgePadding = 8.dp,
                indicator = {}
            ) {
                filterTabs.forEach { (label, status) ->
                    Tab(
                        selected = uiState.statusFilter == status,
                        onClick = { viewModel.setStatusFilter(status) },
                        text = {
                            Text(
                                text = label,
                                fontWeight = if (uiState.statusFilter == status) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 13.sp
                            )
                        }
                    )
                }
            }

            // Error
            if (uiState.error != null) {
                Snackbar(
                    modifier = Modifier.padding(8.dp),
                    action = { TextButton(onClick = { viewModel.clearError() }) { Text("OK", color = Color.White) } },
                    containerColor = RougeDahomey
                ) { Text(uiState.error, color = Color.White) }
            }

            // Content
            if (uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = RougeDahomey)
                }
            } else if (uiState.filteredInvoices.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Receipt,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = BronzeAbomey
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("Aucune facture", fontSize = 16.sp, color = BronzeAbomey)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.filteredInvoices, key = { it.id }) { invoice ->
                        InvoiceCard(
                            invoice = invoice,
                            onViewPdf = { receiptInvoice = invoice }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InvoiceCard(
    invoice: Invoice,
    onViewPdf: () -> Unit
) {
    val statusColor = getInvoiceStatusColor(invoice.status)
    val statusLabel = getInvoiceStatusLabel(invoice.status)

    val currencyFormat = remember {
        NumberFormat.getNumberInstance(Locale.FRANCE).apply {
            maximumFractionDigits = 0
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CremeGanvie),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            Box(modifier = Modifier.fillMaxWidth().height(4.dp).background(statusColor))

            Column(modifier = Modifier.padding(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = invoice.invoiceNumber,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = TerreFon
                        )
                        if (invoice.reservation?.guestName != null) {
                            Text(
                                text = invoice.reservation.guestName,
                                fontSize = 12.sp,
                                color = BronzeAbomey
                            )
                        }
                        val orderNums = invoice.orders?.mapNotNull { it.orderNumber }?.joinToString(", ")
                        if (!orderNums.isNullOrBlank()) {
                            Text(
                                text = "Cmd: $orderNums",
                                fontSize = 11.sp,
                                color = BronzeAbomey,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                    Surface(color = statusColor.copy(alpha = 0.2f), shape = MaterialTheme.shapes.small) {
                        Text(
                            text = statusLabel,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = statusColor,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))
                HorizontalDivider(color = Color.LightGray.copy(alpha = 0.5f))
                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "${currencyFormat.format(invoice.totalAmount)} FCFA",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = TerreFon
                        )
                        val dateStr = formatInvoiceDate(invoice.createdAt)
                        if (dateStr.isNotEmpty()) {
                            Text(dateStr, fontSize = 11.sp, color = BronzeAbomey)
                        }
                        if (invoice.paymentMethod != null) {
                            Text(
                                text = getPaymentLabel(invoice.paymentMethod),
                                fontSize = 11.sp,
                                color = BronzeAbomey
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        // PDF / Print button
                        IconButton(onClick = onViewPdf, modifier = Modifier.size(36.dp)) {
                            Icon(
                                Icons.Default.Receipt,
                                contentDescription = "Voir facture",
                                tint = RougeDahomey,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }

                // Notes
                if (!invoice.notes.isNullOrBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = invoice.notes,
                        fontSize = 11.sp,
                        color = BronzeAbomey,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

private fun getInvoiceStatusColor(status: String): Color = when (status) {
    "DRAFT" -> Color.Gray
    "ISSUED" -> OrBeninois
    "PAID" -> VertBeninois
    "MERGED" -> Color(0xFF42A5F5)
    "CANCELLED" -> RougeDahomey
    else -> BronzeAbomey
}

private fun getInvoiceStatusLabel(status: String): String = when (status) {
    "DRAFT" -> "Brouillon"
    "ISSUED" -> "Emise"
    "PAID" -> "Payee"
    "MERGED" -> "Fusionnee"
    "CANCELLED" -> "Annulee"
    else -> status
}

private fun getPaymentLabel(method: String?): String = when (method) {
    "CASH" -> "Especes"
    "MOOV_MONEY" -> "Flooz"
    "MIXX_BY_YAS" -> "Yas"
    "CARD" -> "Carte"
    "MOBILE_MONEY" -> "Mobile Money"
    "BANK_TRANSFER" -> "Virement"
    "FEDAPAY" -> "FedaPay"
    else -> method ?: ""
}

private fun formatInvoiceDate(dateString: String?): String {
    if (dateString == null) return ""
    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
        )
        formats.forEach { it.timeZone = TimeZone.getTimeZone("UTC") }
        val date = formats.firstNotNullOfOrNull { fmt ->
            try { fmt.parse(dateString) } catch (_: Exception) { null }
        }
        if (date != null) {
            val displayFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.FRANCE)
            displayFormat.timeZone = TimeZone.getTimeZone("Africa/Lome")
            displayFormat.format(date)
        } else dateString
    } catch (_: Exception) { dateString }
}
