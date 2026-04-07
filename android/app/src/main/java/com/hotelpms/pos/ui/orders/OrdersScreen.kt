package com.hotelpms.pos.ui.orders

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.hotelpms.pos.BuildConfig
import com.hotelpms.pos.domain.model.Article
import com.hotelpms.pos.domain.model.Establishment
import com.hotelpms.pos.domain.model.Order
import com.hotelpms.pos.domain.model.QrCodeData
import com.hotelpms.pos.ui.receipt.InvoiceReceiptScreen
import com.hotelpms.pos.ui.receipt.ReceiptScreen
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(
    userRole: String = "",
    establishment: Establishment? = null,
    onNewOrder: (() -> Unit)? = null,
    viewModel: OrdersViewModel = hiltViewModel()
) {
    val uiState = viewModel.uiState
    var receiptOrder by remember { mutableStateOf<Order?>(null) }

    // Receipt dialog — use InvoiceReceiptScreen for orders with invoices (supports thermal invoice printing)
    if (receiptOrder != null && establishment != null) {
        if (receiptOrder!!.invoiceId != null) {
            InvoiceReceiptScreen(
                order = receiptOrder!!,
                establishment = establishment,
                onDismiss = { receiptOrder = null }
            )
        } else {
            ReceiptScreen(
                order = receiptOrder!!,
                establishment = establishment,
                onDismiss = { receiptOrder = null }
            )
        }
    }

    // Merge invoices dialog
    if (uiState.showMergeDialog) {
        MergeInvoicesDialog(
            viewModel = viewModel,
            uiState = uiState
        )
    }

    // QR Code payment dialog
    if (uiState.showQrCode && uiState.qrCodeData != null) {
        QrCodePaymentDialog(
            qrData = uiState.qrCodeData!!,
            onDismiss = {
                viewModel.dismissQrCode()
                if (uiState.simulationSuccess) viewModel.fetchOrders()
            },
            onSimulatePayment = { invoiceId -> viewModel.simulatePayment(invoiceId) },
            isSimulating = uiState.isSimulating,
            simulationSuccess = uiState.simulationSuccess
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (uiState.viewMode == "menu") "Menu" else "Commandes",
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp
                    )
                },
                actions = {
                    // Merge invoices button (orders view only)
                    if (uiState.viewMode == "orders") {
                        IconButton(onClick = { viewModel.showMergeDialog() }) {
                            Icon(Icons.Default.MergeType, contentDescription = "Regrouper factures")
                        }
                    }
                    // Toggle between menu and orders list
                    IconButton(onClick = {
                        viewModel.setViewMode(if (uiState.viewMode == "menu") "orders" else "menu")
                    }) {
                        Icon(
                            if (uiState.viewMode == "menu") Icons.Default.List else Icons.Default.Restaurant,
                            contentDescription = if (uiState.viewMode == "menu") "Voir commandes" else "Voir menu"
                        )
                    }
                    IconButton(onClick = {
                        if (uiState.viewMode == "menu") viewModel.fetchArticles() else viewModel.fetchOrders()
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafraîchir")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = TerreFon,
                    titleContentColor = SableOuidah,
                    actionIconContentColor = SableOuidah
                )
            )
        },
        bottomBar = {
            // Cart summary bar (only in menu mode with items in cart)
            if (uiState.viewMode == "menu" && uiState.cart.isNotEmpty()) {
                CartBottomBar(
                    itemCount = uiState.cartItemCount,
                    total = uiState.cartTotal,
                    isCreating = uiState.isCreating,
                    cart = uiState.cart,
                    onAdd = { viewModel.addToCart(it) },
                    onRemove = { viewModel.removeFromCart(it) },
                    onCheckout = { viewModel.submitOrder() }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(SableOuidah)
        ) {
            // Error/Success snackbars
            if (uiState.error != null) {
                Snackbar(
                    modifier = Modifier.padding(8.dp),
                    action = { TextButton(onClick = { viewModel.clearError() }) { Text("OK", color = Color.White) } },
                    containerColor = RougeDahomey
                ) { Text(uiState.error, color = Color.White) }
            }
            if (uiState.successMessage != null) {
                Snackbar(
                    modifier = Modifier.padding(8.dp),
                    action = { TextButton(onClick = { viewModel.clearSuccess() }) { Text("OK", color = Color.White) } },
                    containerColor = VertBeninois
                ) { Text(uiState.successMessage, color = Color.White) }
            }

            if (uiState.viewMode == "menu") {
                MenuView(viewModel = viewModel, uiState = uiState)
            } else {
                OrdersListView(viewModel = viewModel, uiState = uiState, userRole = userRole, onReceipt = { receiptOrder = it })
            }
        }
    }
}

// =============================================================================
// MENU VIEW — Restaurant menu card layout
// =============================================================================

@Composable
private fun MenuView(viewModel: OrdersViewModel, uiState: OrdersUiState) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Table number + payment method row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CremeGanvie)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = uiState.tableNumber,
                onValueChange = { viewModel.setTableNumber(it) },
                label = { Text("Table", fontSize = 12.sp, color = BronzeAbomey) },
                modifier = Modifier.width(80.dp),
                singleLine = true,
                textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, color = TerreFon),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = TerreFon,
                    unfocusedTextColor = TerreFon,
                    cursorColor = RougeDahomey,
                    focusedBorderColor = RougeDahomey,
                    unfocusedBorderColor = BronzeAbomey,
                    focusedLabelColor = RougeDahomey,
                    unfocusedLabelColor = BronzeAbomey
                )
            )

            // Payment method chips
            val methods = listOf("CASH" to "Espèces", "MOOV_MONEY" to "Flooz", "MIXX_BY_YAS" to "Yas", "FEDAPAY" to "FedaPay")
            methods.forEach { (value, label) ->
                FilterChip(
                    selected = uiState.paymentMethod == value,
                    onClick = { viewModel.setPaymentMethod(value) },
                    label = { Text(label, fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = OrBeninois.copy(alpha = 0.2f),
                        selectedLabelColor = TerreFon
                    )
                )
            }
        }

        // Order notes
        OutlinedTextField(
            value = uiState.orderNotes,
            onValueChange = { viewModel.setOrderNotes(it) },
            placeholder = { Text("Instructions cuisine (ex: sans piment, bien cuit...)", fontSize = 12.sp) },
            leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null, tint = BronzeAbomey, modifier = Modifier.size(18.dp)) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            singleLine = false,
            maxLines = 2,
            textStyle = LocalTextStyle.current.copy(fontSize = 13.sp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = TerreFon,
                unfocusedTextColor = TerreFon,
                cursorColor = RougeDahomey,
                focusedBorderColor = RougeDahomey,
                unfocusedBorderColor = BronzeAbomey,
                focusedLabelColor = RougeDahomey,
                unfocusedLabelColor = BronzeAbomey
            ),
            shape = RoundedCornerShape(8.dp)
        )

        // Category tabs: Restaurant / Boissons
        TabRow(
            selectedTabIndex = if (uiState.menuTab == "Restaurant") 0 else 1,
            containerColor = TerreFon,
            contentColor = OrBeninois
        ) {
            Tab(
                selected = uiState.menuTab == "Restaurant",
                onClick = { viewModel.setMenuTab("Restaurant") },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Restaurant, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Restaurant", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                },
                selectedContentColor = OrBeninois,
                unselectedContentColor = SableOuidah.copy(alpha = 0.7f)
            )
            Tab(
                selected = uiState.menuTab == "Boissons",
                onClick = { viewModel.setMenuTab("Boissons") },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocalBar, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Boissons", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                },
                selectedContentColor = OrBeninois,
                unselectedContentColor = SableOuidah.copy(alpha = 0.7f)
            )
        }

        // Search bar
        OutlinedTextField(
            value = uiState.menuSearchQuery,
            onValueChange = { viewModel.setMenuSearchQuery(it) },
            placeholder = { Text("Rechercher un article...", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = BronzeAbomey, modifier = Modifier.size(20.dp)) },
            trailingIcon = {
                if (uiState.menuSearchQuery.isNotEmpty()) {
                    IconButton(onClick = { viewModel.setMenuSearchQuery("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "Effacer", tint = BronzeAbomey, modifier = Modifier.size(18.dp))
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontSize = 14.sp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = TerreFon,
                unfocusedTextColor = TerreFon,
                cursorColor = RougeDahomey,
                focusedBorderColor = RougeDahomey,
                unfocusedBorderColor = BronzeAbomey,
                focusedLabelColor = RougeDahomey,
                unfocusedLabelColor = BronzeAbomey
            ),
            shape = RoundedCornerShape(8.dp)
        )

        // Menu grid
        if (uiState.isLoadingArticles) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RougeDahomey)
            }
        } else if (uiState.menuArticles.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        if (uiState.menuTab == "Restaurant") Icons.Default.Restaurant else Icons.Default.LocalBar,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = BronzeAbomey
                    )
                    Spacer(Modifier.height(8.dp))
                    Text("Aucun article", fontSize = 16.sp, color = BronzeAbomey)
                }
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(uiState.menuArticles, key = { it.id }) { article ->
                    val cartQty = uiState.cart.find { it.article.id == article.id }?.quantity ?: 0
                    MenuCard(
                        article = article,
                        cartQuantity = cartQty,
                        onAdd = { viewModel.addToCart(article) },
                        onRemove = { viewModel.removeFromCart(article.id) }
                    )
                }
            }
        }
    }
}

// =============================================================================
// MENU CARD — Individual item card
// =============================================================================

@Composable
private fun MenuCard(
    article: Article,
    cartQuantity: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CremeGanvie),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column {
            // Image
            if (article.imageUrl != null) {
                val fullUrl = if (article.imageUrl.startsWith("http")) article.imageUrl
                    else "${BuildConfig.API_BASE_URL}${article.imageUrl}"
                AsyncImage(
                    model = fullUrl,
                    contentDescription = article.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp)
                        .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(80.dp)
                        .background(
                            if (article.category?.name == "Restaurant") RougeDahomey.copy(alpha = 0.1f)
                            else OrBeninois.copy(alpha = 0.1f)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        if (article.category?.name == "Restaurant") Icons.Default.Restaurant else Icons.Default.LocalBar,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = if (article.category?.name == "Restaurant") RougeDahomey else OrBeninois
                    )
                }
            }

            Column(modifier = Modifier.padding(10.dp)) {
                // Name
                Text(
                    text = article.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = TerreFon,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                // Description
                if (article.description != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = article.description,
                        fontSize = 11.sp,
                        color = BronzeAbomey,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 14.sp
                    )
                }

                Spacer(Modifier.height(6.dp))

                // Price + quantity controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatFcfa(article.unitPrice),
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = RougeDahomey
                    )

                    if (cartQuantity > 0) {
                        // Quantity controls
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            IconButton(
                                onClick = onRemove,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    Icons.Default.Remove,
                                    contentDescription = "Retirer",
                                    modifier = Modifier.size(16.dp),
                                    tint = RougeDahomey
                                )
                            }
                            Surface(
                                color = OrBeninois.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = "$cartQuantity",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = TerreFon,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 2.dp)
                                )
                            }
                            IconButton(
                                onClick = onAdd,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    Icons.Default.Add,
                                    contentDescription = "Ajouter",
                                    modifier = Modifier.size(16.dp),
                                    tint = VertBeninois
                                )
                            }
                        }
                    } else {
                        // Add button
                        FilledTonalButton(
                            onClick = onAdd,
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            colors = ButtonDefaults.filledTonalButtonColors(
                                containerColor = VertBeninois.copy(alpha = 0.15f),
                                contentColor = VertBeninois
                            )
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(2.dp))
                            Text("Ajouter", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// CART BOTTOM BAR
// =============================================================================

@Composable
private fun CartBottomBar(
    itemCount: Int,
    total: Double,
    isCreating: Boolean,
    cart: List<CartEntry> = emptyList(),
    onAdd: (Article) -> Unit = {},
    onRemove: (String) -> Unit = {},
    onCheckout: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Surface(
        color = TerreFon,
        shadowElevation = 8.dp
    ) {
        Column {
            // Expandable cart items
            if (expanded && cart.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Récapitulatif", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = OrBeninois)
                        IconButton(onClick = { expanded = false }, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.ExpandMore, contentDescription = "Réduire", tint = SableOuidah, modifier = Modifier.size(20.dp))
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    HorizontalDivider(color = SableOuidah.copy(alpha = 0.2f))
                    Spacer(Modifier.height(4.dp))
                    cart.forEach { entry ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = entry.article.name,
                                fontSize = 13.sp,
                                color = SableOuidah,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                IconButton(onClick = { onRemove(entry.article.id) }, modifier = Modifier.size(24.dp)) {
                                    Icon(Icons.Default.Remove, contentDescription = "Retirer", tint = RougeDahomey, modifier = Modifier.size(16.dp))
                                }
                                Text(
                                    text = "${entry.quantity}",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SableOuidah
                                )
                                IconButton(onClick = { onAdd(entry.article) }, modifier = Modifier.size(24.dp)) {
                                    Icon(Icons.Default.Add, contentDescription = "Ajouter", tint = VertBeninois, modifier = Modifier.size(16.dp))
                                }
                                Text(
                                    text = formatFcfa(entry.total),
                                    fontSize = 12.sp,
                                    color = OrBeninois,
                                    modifier = Modifier.width(70.dp),
                                    textAlign = TextAlign.End
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    HorizontalDivider(color = SableOuidah.copy(alpha = 0.2f))
                }
            }

            // Main bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (expanded) Icons.Default.ExpandMore else Icons.Default.ExpandLess,
                        contentDescription = null,
                        tint = SableOuidah.copy(alpha = 0.6f),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "$itemCount article${if (itemCount > 1) "s" else ""}",
                            fontSize = 12.sp,
                            color = SableOuidah.copy(alpha = 0.7f)
                        )
                        Text(
                            text = formatFcfa(total),
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = OrBeninois
                        )
                    }
                }

                Button(
                    onClick = onCheckout,
                    enabled = !isCreating,
                    colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
                ) {
                    if (isCreating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Commander", fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}

// =============================================================================
// ORDERS LIST VIEW — Existing orders
// =============================================================================

@Composable
private fun OrdersListView(
    viewModel: OrdersViewModel,
    uiState: OrdersUiState,
    userRole: String,
    onReceipt: (Order) -> Unit = {}
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Filter tabs
        val filterTabs = listOf(
            "Toutes" to null,
            "En attente" to "PENDING",
            "En cours" to "IN_PROGRESS",
            "Prêtes" to "READY",
            "Servies" to "SERVED"
        )

        ScrollableTabRow(
            selectedTabIndex = filterTabs.indexOfFirst { it.second == uiState.statusFilter }
                .coerceAtLeast(0),
            containerColor = CremeGanvie,
            contentColor = TerreFon,
            edgePadding = 8.dp,
            indicator = {}
        ) {
            filterTabs.forEachIndexed { _, (label, status) ->
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

        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RougeDahomey)
            }
        } else if (uiState.filteredOrders.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = "Aucune commande", fontSize = 16.sp, color = BronzeAbomey)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(uiState.filteredOrders, key = { it.id }) { order ->
                    OrderCard(
                        order = order,
                        userRole = userRole,
                        onMarkServed = { viewModel.updateOrderStatus(it, "SERVED") },
                        onCancel = { viewModel.updateOrderStatus(it, "CANCELLED") },
                        onShowQr = { invoiceId, pm -> viewModel.fetchQrCode(invoiceId, pm) },
                        onReceipt = { onReceipt(order) }
                    )
                }
            }
        }
    }
}

// =============================================================================
// ORDER CARD
// =============================================================================

@Composable
private fun OrderCard(
    order: Order,
    userRole: String,
    onMarkServed: (String) -> Unit,
    onCancel: (String) -> Unit,
    onShowQr: (String, String?) -> Unit = { _, _ -> },
    onReceipt: () -> Unit = {}
) {
    val statusColor = getStatusColor(order.status)
    val statusLabel = getStatusLabel(order.status)

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
                    Column {
                        Text(
                            text = order.orderNumber ?: "---",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = TerreFon
                        )
                        if (order.tableNumber != null) {
                            Text("Table ${order.tableNumber}", fontSize = 12.sp, color = BronzeAbomey)
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
                HorizontalDivider(color = Outline)
                Spacer(Modifier.height(8.dp))

                order.items?.take(3)?.forEach { item ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 1.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${item.quantity}x ${item.article?.name ?: "Article"}",
                            fontSize = 13.sp, color = TerreFon,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                if ((order.items?.size ?: 0) > 3) {
                    Text("+${(order.items?.size ?: 0) - 3} autre(s)", fontSize = 12.sp, color = BronzeAbomey)
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(formatFcfa(order.totalAmount), fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TerreFon)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val timeStr = formatOrderTime(order.createdAt)
                            if (timeStr.isNotEmpty()) {
                                Text(timeStr, fontSize = 11.sp, color = BronzeAbomey)
                            }
                            if (order.paymentMethod != null) {
                                Text(" · ${getPaymentLabel(order.paymentMethod)}", fontSize = 11.sp, color = BronzeAbomey)
                            }
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        // Receipt button
                        IconButton(onClick = onReceipt, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Receipt, contentDescription = "Recu", tint = BronzeAbomey, modifier = Modifier.size(20.dp))
                        }
                        if (order.invoiceId != null) {
                            IconButton(onClick = { onShowQr(order.invoiceId!!, order.paymentMethod) }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.QrCode, contentDescription = "QR code", tint = RougeDahomey, modifier = Modifier.size(20.dp))
                            }
                        }
                        if (order.status == "READY" && userRole in listOf("SERVER", "SUPERADMIN")) {
                            Button(
                                onClick = { onMarkServed(order.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = VertBeninois),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                            ) {
                                Text("Servie", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
                            }
                        }
                        if (order.status !in listOf("CANCELLED", "SERVED") && userRole in listOf("MANAGER", "DAF", "OWNER", "SUPERADMIN")) {
                            OutlinedButton(
                                onClick = { onCancel(order.id) },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = RougeDahomey),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                            ) {
                                Text("Annuler", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// QR CODE DIALOG
// =============================================================================

@Composable
private fun QrCodePaymentDialog(
    qrData: QrCodeData,
    onDismiss: () -> Unit,
    onSimulatePayment: ((String) -> Unit)? = null,
    isSimulating: Boolean = false,
    simulationSuccess: Boolean = false
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = CremeGanvie),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("QR Code de paiement", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TerreFon)
                Spacer(Modifier.height(8.dp))
                Text(qrData.invoice?.invoiceNumber ?: "", fontSize = 14.sp, color = BronzeAbomey)
                Spacer(Modifier.height(4.dp))
                Text(formatFcfa(qrData.invoice?.totalAmount ?: 0.0), fontWeight = FontWeight.Bold, fontSize = 24.sp, color = RougeDahomey)
                Text("Paiement par ${qrData.paymentLabel ?: ""}", fontSize = 13.sp, color = BronzeAbomey)
                Spacer(Modifier.height(16.dp))

                val qrBitmap = remember(qrData.qrCode) {
                    try {
                        val base64Part = qrData.qrCode.substringAfter("base64,")
                        val bytes = Base64.decode(base64Part, Base64.DEFAULT)
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    } catch (_: Exception) { null }
                }

                if (qrBitmap != null) {
                    Image(
                        bitmap = qrBitmap.asImageBitmap(),
                        contentDescription = "QR Code",
                        modifier = Modifier.size(250.dp).background(Color.White, MaterialTheme.shapes.medium).padding(12.dp)
                    )
                } else {
                    Box(
                        modifier = Modifier.size(250.dp).background(Color.White, MaterialTheme.shapes.medium),
                        contentAlignment = Alignment.Center
                    ) { Text("QR code indisponible", color = Color.Gray, fontSize = 12.sp) }
                }

                Spacer(Modifier.height(12.dp))
                if (qrData.fedapayCheckoutUrl != null) {
                    Text(
                        "Scannez le QR code ou appuyez sur le bouton ci-dessous pour payer via FedaPay.",
                        fontSize = 11.sp, color = BronzeAbomey, textAlign = TextAlign.Center
                    )
                } else {
                    Text(
                        "Le client doit scanner ce QR code avec son application ${qrData.paymentLabel ?: ""} pour effectuer le paiement.",
                        fontSize = 11.sp, color = BronzeAbomey, textAlign = TextAlign.Center
                    )
                }
                Spacer(Modifier.height(16.dp))

                // FedaPay checkout button
                if (qrData.fedapayCheckoutUrl != null) {
                    val uriHandler = LocalUriHandler.current
                    Button(
                        onClick = { uriHandler.openUri(qrData.fedapayCheckoutUrl) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E88E5)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("\uD83D\uDCB3 Payer avec FedaPay", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                }

                if (simulationSuccess) {
                    // Payment confirmed
                    Surface(
                        color = VertBeninois.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = VertBeninois, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Paiement reçu !", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = VertBeninois)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }

                // Simulate payment button
                if (!simulationSuccess && onSimulatePayment != null && qrData.invoice?.id != null) {
                    Button(
                        onClick = { onSimulatePayment(qrData.invoice.id) },
                        enabled = !isSimulating,
                        colors = ButtonDefaults.buttonColors(containerColor = VertBeninois),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isSimulating) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Simuler le paiement client", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                }

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Fermer", color = Color.White, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

// =============================================================================
// MERGE INVOICES DIALOG
// =============================================================================

@Composable
private fun MergeInvoicesDialog(
    viewModel: OrdersViewModel,
    uiState: OrdersUiState
) {
    val invoices = uiState.mergeableInvoices
    var selectedIds by remember { mutableStateOf<Set<String>>(emptySet()) }

    // Auto-select all when invoices load
    LaunchedEffect(invoices) {
        selectedIds = invoices.mapNotNull { it["id"] as? String }.toSet()
    }

    Dialog(onDismissRequest = { viewModel.dismissMergeDialog() }) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            colors = CardDefaults.cardColors(containerColor = CremeGanvie),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    "Regrouper les factures",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = TerreFon
                )
                Spacer(Modifier.height(12.dp))

                // Table search
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = uiState.mergeTableQuery,
                        onValueChange = { viewModel.setMergeTableQuery(it) },
                        label = { Text("N° Table") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    Button(
                        onClick = { viewModel.fetchMergeableInvoices() },
                        enabled = uiState.mergeTableQuery.isNotBlank() && !uiState.isFetchingMergeable,
                        colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey)
                    ) {
                        if (uiState.isFetchingMergeable) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                when {
                    uiState.isFetchingMergeable -> {
                        Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = RougeDahomey)
                        }
                    }
                    invoices.isEmpty() && uiState.mergeTableQuery.isNotBlank() -> {
                        Text(
                            "Aucune facture ouverte pour cette table",
                            fontSize = 13.sp, color = BronzeAbomey,
                            modifier = Modifier.padding(vertical = 16.dp)
                        )
                    }
                    invoices.size == 1 -> {
                        Text(
                            "Une seule facture — il en faut au moins 2",
                            fontSize = 13.sp, color = OrBeninois,
                            modifier = Modifier.padding(vertical = 16.dp)
                        )
                    }
                    invoices.size >= 2 -> {
                        // Invoice list with checkboxes
                        LazyColumn(modifier = Modifier.heightIn(max = 250.dp)) {
                            items(invoices, key = { (it["id"] as? String) ?: "" }) { inv ->
                                val invId = inv["id"] as? String ?: return@items
                                val invNumber = inv["invoiceNumber"] as? String ?: "---"
                                val invTotal = (inv["totalAmount"] as? Number)?.toDouble() ?: 0.0

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selectedIds = if (invId in selectedIds) selectedIds - invId else selectedIds + invId
                                        }
                                        .padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = invId in selectedIds,
                                        onCheckedChange = {
                                            selectedIds = if (it) selectedIds + invId else selectedIds - invId
                                        }
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(invNumber, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TerreFon)
                                    }
                                    Text(formatFcfa(invTotal), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = RougeDahomey)
                                }
                            }
                        }

                        Spacer(Modifier.height(12.dp))

                        // Total + merge button
                        val selectedTotal = invoices
                            .filter { (it["id"] as? String) in selectedIds }
                            .sumOf { (it["totalAmount"] as? Number)?.toDouble() ?: 0.0 }

                        Surface(
                            color = OrBeninois.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("${selectedIds.size} facture(s)", fontSize = 12.sp, color = BronzeAbomey)
                                    Text(formatFcfa(selectedTotal), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TerreFon)
                                }
                                Button(
                                    onClick = { viewModel.mergeInvoices(selectedIds.toList()) },
                                    enabled = selectedIds.size >= 2 && !uiState.isMerging,
                                    colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey)
                                ) {
                                    if (uiState.isMerging) {
                                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                                        Spacer(Modifier.width(8.dp))
                                    }
                                    Text("Regrouper", fontWeight = FontWeight.Bold, color = Color.White)
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { viewModel.dismissMergeDialog() },
                    colors = ButtonDefaults.buttonColors(containerColor = BronzeAbomey),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Fermer", color = Color.White)
                }
            }
        }
    }
}

// =============================================================================
// HELPERS
// =============================================================================

private fun getStatusColor(status: String): Color = when (status) {
    "PENDING" -> OrBeninois
    "IN_PROGRESS" -> RougeDahomeyLight
    "READY" -> VertBeninois
    "SERVED" -> BronzeAbomey
    "CANCELLED" -> Color.Gray
    else -> BronzeAbomey
}

private fun getStatusLabel(status: String): String = when (status) {
    "PENDING" -> "En attente"
    "IN_PROGRESS" -> "En cours"
    "READY" -> "Prête"
    "SERVED" -> "Servie"
    "CANCELLED" -> "Annulée"
    else -> status
}

private fun formatFcfa(amount: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale.FRANCE).apply {
        maximumFractionDigits = 0
        minimumFractionDigits = 0
    }
    return "${formatter.format(amount)} FCFA"
}

private fun getPaymentLabel(method: String?): String = when (method) {
    "MOOV_MONEY" -> "Flooz"
    "MIXX_BY_YAS" -> "Yas"
    "CASH" -> "Espèces"
    "CARD" -> "Carte"
    "MOBILE_MONEY" -> "Mobile Money"
    "FEDAPAY" -> "FedaPay"
    "BANK_TRANSFER" -> "Virement"
    else -> method ?: ""
}

private fun formatOrderTime(dateString: String?): String {
    if (dateString == null) return ""
    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.getDefault())
        )
        formats.forEach { it.timeZone = TimeZone.getTimeZone("UTC") }
        var date: Date? = null
        for (fmt in formats) {
            try { date = fmt.parse(dateString); if (date != null) break } catch (_: Exception) {}
        }
        if (date == null) return ""
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
    } catch (_: Exception) { "" }
}
