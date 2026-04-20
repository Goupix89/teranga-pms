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
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.hotelpms.pos.BuildConfig
import com.hotelpms.pos.domain.model.Article
import com.hotelpms.pos.domain.model.Establishment
import com.hotelpms.pos.domain.model.Order
import com.hotelpms.pos.domain.model.OwnerInfo
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

    // DAF (financial controller) cannot create orders — force orders list view
    val canCreate = userRole in listOf("OWNER", "MANAGER", "MAITRE_HOTEL", "SERVER", "POS", "SUPERADMIN")
    LaunchedEffect(canCreate) {
        if (!canCreate && uiState.viewMode == "menu") {
            viewModel.setViewMode("orders")
        }
    }

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

    // Cash-in dialog (payment method after order creation)
    if (uiState.cashInOrder != null) {
        CashInDialog(
            order = uiState.cashInOrder!!,
            isCashingIn = uiState.isCashingIn,
            userRole = userRole,
            onDismiss = { viewModel.dismissCashInDialog() },
            onConfirm = { method, paidAt -> viewModel.cashIn(uiState.cashInOrder!!.id, method, paidAt) }
        )
    }

    // Add-items dialog (append articles to an open order)
    if (uiState.addItemsOrder != null) {
        AddItemsDialog(
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
            },
            onSimulatePayment = { invoiceId -> viewModel.simulatePayment(invoiceId) },
            isSimulating = uiState.isSimulating,
            simulationSuccess = uiState.simulationSuccess || uiState.paymentConfirmed,
            paymentConfirmed = uiState.paymentConfirmed
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
                    // Toggle between menu and orders list — hidden for roles that can't create
                    if (canCreate) {
                        IconButton(onClick = {
                            viewModel.setViewMode(if (uiState.viewMode == "menu") "orders" else "menu")
                        }) {
                            Icon(
                                if (uiState.viewMode == "menu") Icons.Default.List else Icons.Default.Restaurant,
                                contentDescription = if (uiState.viewMode == "menu") "Voir commandes" else "Voir menu"
                            )
                        }
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
                    isVoucher = uiState.isVoucher,
                    owners = uiState.owners,
                    selectedOwnerId = uiState.voucherOwnerId,
                    onToggleVoucher = { viewModel.toggleVoucher() },
                    onSelectOwner = { viewModel.setVoucherOwner(it) },
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
                MenuView(viewModel = viewModel, uiState = uiState, userRole = userRole)
            } else {
                OrdersListView(viewModel = viewModel, uiState = uiState, userRole = userRole, onReceipt = { receiptOrder = it })
            }
        }
    }
}

// =============================================================================
// MENU VIEW — Restaurant menu card layout
// =============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MenuView(viewModel: OrdersViewModel, uiState: OrdersUiState, userRole: String) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Table number row — payment method is chosen at cash-in time
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CremeGanvie)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Table dropdown
            Box(modifier = Modifier.weight(1f)) {
                var tableExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = tableExpanded,
                    onExpandedChange = { tableExpanded = it }
                ) {
                    OutlinedTextField(
                        value = if (uiState.tableNumber.isBlank()) "— Table —" else "Table ${uiState.tableNumber}",
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        singleLine = true,
                        textStyle = LocalTextStyle.current.copy(fontSize = 13.sp, color = TerreFon),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = tableExpanded) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TerreFon,
                            unfocusedTextColor = TerreFon,
                            focusedBorderColor = RougeDahomey,
                            unfocusedBorderColor = BronzeAbomey
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = tableExpanded,
                        onDismissRequest = { tableExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("— Sans table —", fontSize = 13.sp) },
                            onClick = {
                                viewModel.setTableNumber("")
                                tableExpanded = false
                            }
                        )
                        uiState.restaurantTables.forEach { table ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        "${table.number}${table.label?.let { " — $it" } ?: ""} (${table.capacity}p)",
                                        fontSize = 13.sp
                                    )
                                },
                                onClick = {
                                    viewModel.setTableNumber(table.number)
                                    tableExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        // Server attribution (POS only) — assigns the order to a given server
        if (userRole == "POS" && uiState.establishmentServers.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CremeGanvie)
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    var serverExpanded by remember { mutableStateOf(false) }
                    val selectedLabel = uiState.establishmentServers
                        .find { it.id == uiState.selectedServerId }
                        ?.let { "${it.firstName} ${it.lastName}" }
                        ?: "— Serveur attribué (optionnel) —"
                    ExposedDropdownMenuBox(
                        expanded = serverExpanded,
                        onExpandedChange = { serverExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = selectedLabel,
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth(),
                            singleLine = true,
                            textStyle = LocalTextStyle.current.copy(fontSize = 13.sp, color = TerreFon),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = serverExpanded) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TerreFon,
                                unfocusedTextColor = TerreFon,
                                focusedBorderColor = RougeDahomey,
                                unfocusedBorderColor = BronzeAbomey
                            )
                        )
                        ExposedDropdownMenu(
                            expanded = serverExpanded,
                            onDismissRequest = { serverExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("— Aucun (commande POS) —", fontSize = 13.sp) },
                                onClick = {
                                    viewModel.setSelectedServer("")
                                    serverExpanded = false
                                }
                            )
                            uiState.establishmentServers.forEach { srv ->
                                val suffix = if (srv.role == "MAITRE_HOTEL") " (Maître d'hôtel)" else ""
                                DropdownMenuItem(
                                    text = { Text("${srv.firstName} ${srv.lastName}$suffix", fontSize = 13.sp) },
                                    onClick = {
                                        viewModel.setSelectedServer(srv.id)
                                        serverExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // Operation date — allow backdating an order for yesterday's sales
        run {
            val isSupervisor = userRole == "OWNER" || userRole == "DAF" || userRole == "MANAGER" || userRole == "SUPERADMIN"
            val options = buildList {
                add(0 to "Aujourd'hui")
                add(1 to "Hier")
                add(2 to "Avant-hier")
                add(3 to "Il y a 3j")
                if (isSupervisor) add(-1 to "Il y a 14j")
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CremeGanvie)
                    .padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(
                    "Date de l'opération",
                    fontSize = 11.sp,
                    color = BronzeAbomey,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    options.forEach { (value, label) ->
                        val isSel = uiState.operationDateOffset == value
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clickable { viewModel.setOperationDateOffset(value) },
                            color = if (isSel) OrBeninois.copy(alpha = 0.2f) else Color.Transparent,
                            shape = RoundedCornerShape(6.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSel) OrBeninois else BronzeAbomey.copy(alpha = 0.3f)
                            )
                        ) {
                            Text(
                                label,
                                modifier = Modifier.padding(vertical = 6.dp, horizontal = 2.dp),
                                fontSize = 10.sp,
                                fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                color = TerreFon,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
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

        // Dynamic category tabs based on fetched categories
        val tabs = uiState.menuTabs
        val selectedIndex = tabs.indexOf(uiState.menuTab).let { if (it < 0) 0 else it }
        ScrollableTabRow(
            selectedTabIndex = selectedIndex,
            containerColor = TerreFon,
            contentColor = OrBeninois,
            edgePadding = 4.dp
        ) {
            tabs.forEach { tabName ->
                val icon = when (tabName) {
                    "Tous" -> Icons.Default.List
                    "Restaurant", "Nourriture" -> Icons.Default.Restaurant
                    "Boissons", "Bar" -> Icons.Default.LocalBar
                    "Loisirs", "Loisir" -> Icons.Default.SportsEsports
                    "Location" -> Icons.Default.Key
                    else -> Icons.Default.Category
                }
                Tab(
                    selected = uiState.menuTab == tabName,
                    onClick = { viewModel.setMenuTab(tabName) },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(tabName, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    },
                    selectedContentColor = OrBeninois,
                    unselectedContentColor = SableOuidah.copy(alpha = 0.7f)
                )
            }
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
                        when (uiState.menuTab) {
                            "Restaurant", "Nourriture" -> Icons.Default.Restaurant
                            "Boissons", "Bar" -> Icons.Default.LocalBar
                            "Loisirs", "Loisir" -> Icons.Default.SportsEsports
                            "Location" -> Icons.Default.Key
                            else -> Icons.Default.Category
                        },
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
    var showDetail by remember { mutableStateOf(false) }

    // Article detail dialog
    if (showDetail) {
        ArticleDetailDialog(
            article = article,
            cartQuantity = cartQuantity,
            onAdd = onAdd,
            onRemove = onRemove,
            onDismiss = { showDetail = false }
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { showDetail = true },
        colors = CardDefaults.cardColors(containerColor = CremeGanvie),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column {
            // Image — aspect ratio preserved
            if (article.imageUrl != null) {
                val fullUrl = if (article.imageUrl.startsWith("http")) article.imageUrl
                    else "${BuildConfig.API_BASE_URL}${article.imageUrl}"
                AsyncImage(
                    model = fullUrl,
                    contentDescription = article.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f)
                        .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)),
                    contentScale = ContentScale.Fit
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f)
                        .background(
                            when (article.category?.name) {
                                "Restaurant" -> RougeDahomey.copy(alpha = 0.1f)
                                "Loisirs", "Loisir" -> Color(0xFF9C27B0).copy(alpha = 0.1f)
                                "Location" -> Color(0xFF00796B).copy(alpha = 0.1f)
                                else -> OrBeninois.copy(alpha = 0.1f)
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        when (article.category?.name) {
                            "Restaurant" -> Icons.Default.Restaurant
                            "Loisirs", "Loisir" -> Icons.Default.SportsEsports
                            "Location" -> Icons.Default.Key
                            else -> Icons.Default.LocalBar
                        },
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = when (article.category?.name) {
                            "Restaurant" -> RougeDahomey
                            "Loisirs", "Loisir" -> Color(0xFF9C27B0)
                            "Location" -> Color(0xFF00796B)
                            else -> OrBeninois
                        }
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
// ARTICLE DETAIL DIALOG
// =============================================================================

@Composable
private fun ArticleDetailDialog(
    article: Article,
    cartQuantity: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = CremeGanvie),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column {
                // Close button
                Box(modifier = Modifier.fillMaxWidth()) {
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Fermer", tint = BronzeAbomey)
                    }
                }

                // Full image
                if (article.imageUrl != null) {
                    val fullUrl = if (article.imageUrl.startsWith("http")) article.imageUrl
                        else "${BuildConfig.API_BASE_URL}${article.imageUrl}"
                    AsyncImage(
                        model = fullUrl,
                        contentDescription = article.name,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 180.dp, max = 280.dp),
                        contentScale = ContentScale.Fit
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(140.dp)
                            .background(
                                when (article.category?.name) {
                                    "Restaurant" -> RougeDahomey.copy(alpha = 0.1f)
                                    "Loisirs", "Loisir" -> Color(0xFF9C27B0).copy(alpha = 0.1f)
                                    "Location" -> Color(0xFF00796B).copy(alpha = 0.1f)
                                    else -> OrBeninois.copy(alpha = 0.1f)
                                }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            when (article.category?.name) {
                                "Restaurant" -> Icons.Default.Restaurant
                                "Loisirs", "Loisir" -> Icons.Default.SportsEsports
                                "Location" -> Icons.Default.Key
                                else -> Icons.Default.LocalBar
                            },
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = when (article.category?.name) {
                                "Restaurant" -> RougeDahomey
                                "Loisirs", "Loisir" -> Color(0xFF9C27B0)
                                "Location" -> Color(0xFF00796B)
                                else -> OrBeninois
                            }
                        )
                    }
                }

                Column(modifier = Modifier.padding(16.dp)) {
                    // Name
                    Text(
                        text = article.name,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = TerreFon
                    )

                    Spacer(Modifier.height(4.dp))

                    // Category badge
                    if (article.category?.name != null) {
                        Surface(
                            color = when (article.category.name) {
                                "Restaurant" -> RougeDahomey.copy(alpha = 0.1f)
                                "Boissons", "Bar" -> OrBeninois.copy(alpha = 0.1f)
                                "Loisirs", "Loisir" -> Color(0xFF9C27B0).copy(alpha = 0.1f)
                                "Location" -> Color(0xFF00796B).copy(alpha = 0.1f)
                                else -> BronzeAbomey.copy(alpha = 0.1f)
                            },
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = article.category.name,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = when (article.category.name) {
                                    "Restaurant" -> RougeDahomey
                                    "Boissons", "Bar" -> OrBeninois
                                    "Loisirs", "Loisir" -> Color(0xFF9C27B0)
                                    "Location" -> Color(0xFF00796B)
                                    else -> BronzeAbomey
                                },
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    // Price
                    Text(
                        text = formatFcfa(article.unitPrice),
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = RougeDahomey
                    )

                    // Description
                    if (!article.description.isNullOrBlank()) {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = article.description,
                            fontSize = 14.sp,
                            color = BronzeAbomey,
                            lineHeight = 20.sp
                        )
                    }

                    // Stock info
                    if (article.currentStock > 0) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "En stock : ${article.currentStock} ${article.unit}",
                            fontSize = 12.sp,
                            color = VertBeninois
                        )
                    }

                    Spacer(Modifier.height(16.dp))

                    // Add / quantity controls
                    if (cartQuantity > 0) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            FilledTonalButton(
                                onClick = onRemove,
                                colors = ButtonDefaults.filledTonalButtonColors(
                                    containerColor = RougeDahomey.copy(alpha = 0.1f),
                                    contentColor = RougeDahomey
                                )
                            ) {
                                Icon(Icons.Default.Remove, contentDescription = "Retirer", modifier = Modifier.size(20.dp))
                            }
                            Spacer(Modifier.width(16.dp))
                            Surface(
                                color = OrBeninois.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = "$cartQuantity",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp,
                                    color = TerreFon,
                                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp)
                                )
                            }
                            Spacer(Modifier.width(16.dp))
                            FilledTonalButton(
                                onClick = onAdd,
                                colors = ButtonDefaults.filledTonalButtonColors(
                                    containerColor = VertBeninois.copy(alpha = 0.15f),
                                    contentColor = VertBeninois
                                )
                            ) {
                                Icon(Icons.Default.Add, contentDescription = "Ajouter", modifier = Modifier.size(20.dp))
                            }
                        }
                    } else {
                        Button(
                            onClick = onAdd,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = VertBeninois,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Ajouter au panier", fontWeight = FontWeight.Bold, fontSize = 15.sp)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CartBottomBar(
    itemCount: Int,
    total: Double,
    isCreating: Boolean,
    cart: List<CartEntry> = emptyList(),
    isVoucher: Boolean = false,
    owners: List<OwnerInfo> = emptyList(),
    selectedOwnerId: String = "",
    onToggleVoucher: () -> Unit = {},
    onSelectOwner: (String) -> Unit = {},
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
                    Spacer(Modifier.height(4.dp))
                    // Bon Propriétaire toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Bon Propriétaire", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (isVoucher) Color(0xFFD97706) else SableOuidah)
                            Text("Exclu du CA", fontSize = 10.sp, color = SableOuidah.copy(alpha = 0.5f))
                        }
                        Switch(
                            checked = isVoucher,
                            onCheckedChange = { onToggleVoucher() },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.White,
                                checkedTrackColor = Color(0xFFD97706)
                            )
                        )
                    }
                    // Owner dropdown when voucher is active
                    if (isVoucher && owners.isNotEmpty()) {
                        Spacer(Modifier.height(6.dp))
                        var ownerExpanded by remember { mutableStateOf(false) }
                        val selectedOwner = owners.find { it.id == selectedOwnerId }
                        ExposedDropdownMenuBox(
                            expanded = ownerExpanded,
                            onExpandedChange = { ownerExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = selectedOwner?.name ?: "Sélectionner le propriétaire",
                                onValueChange = {},
                                readOnly = true,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor(),
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = ownerExpanded) },
                                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp, color = SableOuidah),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color(0xFFD97706),
                                    unfocusedBorderColor = SableOuidah.copy(alpha = 0.3f)
                                ),
                                singleLine = true
                            )
                            ExposedDropdownMenu(
                                expanded = ownerExpanded,
                                onDismissRequest = { ownerExpanded = false }
                            ) {
                                owners.forEach { owner ->
                                    DropdownMenuItem(
                                        text = { Text(owner.name, fontSize = 13.sp) },
                                        onClick = {
                                            onSelectOwner(owner.id)
                                            ownerExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
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
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "$itemCount article${if (itemCount > 1) "s" else ""}",
                                fontSize = 12.sp,
                                color = SableOuidah.copy(alpha = 0.7f)
                            )
                            if (isVoucher) {
                                Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(4.dp)) {
                                    Text("Bon", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD97706), modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                }
                            }
                        }
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
        // "Mes commandes" toggle
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.Start
        ) {
            FilterChip(
                selected = uiState.myOrdersOnly,
                onClick = { viewModel.toggleMyOrders() },
                label = { Text("Mes commandes", fontSize = 13.sp) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = RougeDahomey.copy(alpha = 0.15f),
                    selectedLabelColor = RougeDahomey
                )
            )
        }

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
                        onCashIn = { viewModel.showCashInDialog(order) },
                        onAddItems = { viewModel.showAddItemsDialog(order) },
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
    onCashIn: () -> Unit = {},
    onAddItems: () -> Unit = {},
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
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = order.orderNumber ?: "---",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = TerreFon
                            )
                            if (order.isVoucher) {
                                Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(4.dp)) {
                                    Text(
                                        text = if (order.voucherOwnerName != null) "Bon — ${order.voucherOwnerName}" else "Bon",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFD97706),
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
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

                // Server / creator attribution
                val serverName = order.server?.let { "${it.firstName} ${it.lastName}" }
                val creatorName = order.createdBy?.let { "${it.firstName} ${it.lastName}" }
                val sameAsCreator = order.server?.id != null && order.server.id == order.createdBy?.id
                if (serverName != null && !sameAsCreator) {
                    Text(
                        text = "Serveur $serverName${creatorName?.let { " · saisie $it" } ?: ""}",
                        fontSize = 11.sp,
                        color = BronzeAbomey
                    )
                } else if (creatorName != null) {
                    Text("Par $creatorName", fontSize = 11.sp, color = BronzeAbomey)
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
                        val canAddItems = order.status !in listOf("CANCELLED", "SERVED") &&
                            userRole in listOf("SERVER", "MAITRE_HOTEL", "MANAGER", "OWNER", "POS", "SUPERADMIN")
                        if (canAddItems) {
                            OutlinedButton(
                                onClick = onAddItems,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = TerreFon),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Ajouter", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                        val canCashIn = order.status !in listOf("CANCELLED", "SERVED") &&
                            order.invoiceId != null &&
                            userRole in listOf("SERVER", "MAITRE_HOTEL", "MANAGER", "DAF", "OWNER", "POS", "SUPERADMIN")
                        if (canCashIn) {
                            Button(
                                onClick = onCashIn,
                                colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Icon(Icons.Default.Payments, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color.White)
                                Spacer(Modifier.width(4.dp))
                                Text("Encaisser", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
                            }
                        }
                        if (order.status == "READY" && userRole in listOf("SERVER", "SUPERADMIN")) {
                            OutlinedButton(
                                onClick = { onMarkServed(order.id) },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = VertBeninois),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text("Servie", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                        if (order.status !in listOf("CANCELLED", "SERVED") && userRole in listOf("MANAGER", "DAF", "OWNER", "SUPERADMIN")) {
                            OutlinedButton(
                                onClick = { onCancel(order.id) },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = RougeDahomey),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
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
    simulationSuccess: Boolean = false,
    paymentConfirmed: Boolean = false
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

                // Waiting for payment indicator
                if (!simulationSuccess && !paymentConfirmed && qrData.fedapayCheckoutUrl != null) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), color = BronzeAbomey, strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("En attente du paiement...", fontSize = 12.sp, color = BronzeAbomey)
                    }
                }

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

                if (simulationSuccess || paymentConfirmed) {
                    // Payment confirmed
                    Surface(
                        color = VertBeninois.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = VertBeninois, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("Paiement reçu !", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = VertBeninois)
                            }
                            if (paymentConfirmed) {
                                Spacer(Modifier.height(4.dp))
                                Text("Confirmé par FedaPay", fontSize = 12.sp, color = VertBeninois.copy(alpha = 0.7f))
                            }
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
// CASH-IN DIALOG — chose payment method after the order
// =============================================================================

@Composable
private fun CashInDialog(
    order: Order,
    isCashingIn: Boolean,
    userRole: String,
    onDismiss: () -> Unit,
    onConfirm: (String, String?) -> Unit
) {
    var selected by remember { mutableStateOf("CASH") }
    // 0 = today, 1 = yesterday, 2 = day before, 3 = 3 days ago, -1 = earlier (supervisor)
    var dateOffset by remember { mutableStateOf(0) }
    val isSupervisor = userRole == "OWNER" || userRole == "DAF" || userRole == "MANAGER" || userRole == "SUPERADMIN"
    val methods = listOf(
        "CASH" to "Espèces",
        "MOBILE_MONEY" to "Mobile Money",
        "MOOV_MONEY" to "Flooz",
        "MIXX_BY_YAS" to "Yas",
        "CARD" to "Carte",
        "FEDAPAY" to "FedaPay",
        "BANK_TRANSFER" to "Virement",
        "OTHER" to "Autre"
    )

    fun buildPaidAtIso(): String? {
        if (dateOffset == 0) return null
        val cal = Calendar.getInstance()
        val daysBack = if (dateOffset < 0) 14 else dateOffset
        cal.add(Calendar.DAY_OF_YEAR, -daysBack)
        // Keep current time-of-day (payment occurred "around now" on that business date)
        val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(cal.time)
        return iso
    }

    Dialog(onDismissRequest = { if (!isCashingIn) onDismiss() }) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            colors = CardDefaults.cardColors(containerColor = CremeGanvie),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    "Encaisser la commande",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = TerreFon
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    order.orderNumber ?: "---",
                    fontSize = 13.sp,
                    color = BronzeAbomey
                )
                if (order.tableNumber != null) {
                    Text("Table ${order.tableNumber}", fontSize = 12.sp, color = BronzeAbomey)
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    formatFcfa(order.totalAmount),
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = RougeDahomey
                )

                Spacer(Modifier.height(16.dp))
                Text("Méthode de paiement", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TerreFon)
                Spacer(Modifier.height(8.dp))

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    methods.forEach { (value, label) ->
                        val isSelected = selected == value
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !isCashingIn) { selected = value },
                            color = if (isSelected) OrBeninois.copy(alpha = 0.15f) else Color.Transparent,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) OrBeninois else BronzeAbomey.copy(alpha = 0.3f)
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = isSelected,
                                    onClick = null,
                                    colors = RadioButtonDefaults.colors(selectedColor = RougeDahomey)
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    label,
                                    fontSize = 14.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = TerreFon
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))
                Text("Date de l'opération", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TerreFon)
                Spacer(Modifier.height(6.dp))
                val dateOptions = buildList {
                    add(0 to "Aujourd'hui")
                    add(1 to "Hier")
                    add(2 to "Avant-hier")
                    add(3 to "Il y a 3j")
                    if (isSupervisor) add(-1 to "Il y a 14j")
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    dateOptions.forEach { (value, label) ->
                        val isSel = dateOffset == value
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clickable(enabled = !isCashingIn) { dateOffset = value },
                            color = if (isSel) OrBeninois.copy(alpha = 0.2f) else Color.Transparent,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSel) OrBeninois else BronzeAbomey.copy(alpha = 0.3f)
                            )
                        ) {
                            Text(
                                label,
                                modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp),
                                fontSize = 11.sp,
                                fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                color = TerreFon,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
                if (!isSupervisor) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Rétrodatage >15j réservé aux superviseurs",
                        fontSize = 10.sp,
                        color = BronzeAbomey,
                        fontWeight = FontWeight.Normal
                    )
                }

                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        enabled = !isCashingIn,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = BronzeAbomey)
                    ) {
                        Text("Annuler", fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { onConfirm(selected, buildPaidAtIso()) },
                        enabled = !isCashingIn,
                        colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey)
                    ) {
                        if (isCashingIn) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Confirmer", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }
        }
    }
}

// =============================================================================
// ADD-ITEMS DIALOG — append articles to an existing open order
// =============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddItemsDialog(
    viewModel: OrdersViewModel,
    uiState: OrdersUiState
) {
    val order = uiState.addItemsOrder ?: return
    val tabs = uiState.menuTabs
    val selectedTabIndex = tabs.indexOf(uiState.addItemsTab).let { if (it < 0) 0 else it }

    Dialog(
        onDismissRequest = { if (!uiState.isAddingItems) viewModel.dismissAddItemsDialog() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.95f)
                .padding(8.dp),
            colors = CardDefaults.cardColors(containerColor = CremeGanvie),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(TerreFon)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Ajouter des articles",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = OrBeninois
                        )
                        Text(
                            "${order.orderNumber ?: "---"}${order.tableNumber?.let { " • Table $it" } ?: ""}",
                            fontSize = 12.sp,
                            color = SableOuidah
                        )
                    }
                    IconButton(
                        onClick = { viewModel.dismissAddItemsDialog() },
                        enabled = !uiState.isAddingItems
                    ) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Fermer",
                            tint = OrBeninois
                        )
                    }
                }

                // Category tabs
                ScrollableTabRow(
                    selectedTabIndex = selectedTabIndex,
                    containerColor = TerreFon,
                    contentColor = OrBeninois,
                    edgePadding = 4.dp
                ) {
                    tabs.forEach { tabName ->
                        val icon = when (tabName) {
                            "Tous" -> Icons.Default.List
                            "Restaurant", "Nourriture" -> Icons.Default.Restaurant
                            "Boissons", "Bar" -> Icons.Default.LocalBar
                            "Loisirs", "Loisir" -> Icons.Default.SportsEsports
                            "Location" -> Icons.Default.Key
                            else -> Icons.Default.Category
                        }
                        Tab(
                            selected = uiState.addItemsTab == tabName,
                            onClick = { viewModel.setAddItemsTab(tabName) },
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(tabName, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                            },
                            selectedContentColor = OrBeninois,
                            unselectedContentColor = SableOuidah.copy(alpha = 0.7f)
                        )
                    }
                }

                // Search bar
                OutlinedTextField(
                    value = uiState.addItemsSearchQuery,
                    onValueChange = { viewModel.setAddItemsSearchQuery(it) },
                    placeholder = { Text("Rechercher un article...", fontSize = 13.sp) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = BronzeAbomey, modifier = Modifier.size(20.dp))
                    },
                    trailingIcon = {
                        if (uiState.addItemsSearchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.setAddItemsSearchQuery("") }) {
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
                        unfocusedBorderColor = BronzeAbomey
                    ),
                    shape = RoundedCornerShape(8.dp)
                )

                // Articles grid (fills remaining space above the cart footer)
                val articles = uiState.addItemsMenuArticles
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    if (articles.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    Icons.Default.Category,
                                    contentDescription = null,
                                    modifier = Modifier.size(40.dp),
                                    tint = BronzeAbomey
                                )
                                Spacer(Modifier.height(6.dp))
                                Text("Aucun article", fontSize = 14.sp, color = BronzeAbomey)
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
                            items(articles, key = { it.id }) { article ->
                                val cartQty = uiState.addItemsCart.find { it.article.id == article.id }?.quantity ?: 0
                                MenuCard(
                                    article = article,
                                    cartQuantity = cartQty,
                                    onAdd = { viewModel.addItemsIncrement(article) },
                                    onRemove = { viewModel.addItemsDecrement(article.id) }
                                )
                            }
                        }
                    }
                }

                // Cart summary + actions
                Surface(
                    color = TerreFon,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        if (uiState.addItemsCart.isNotEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 140.dp)
                                    .verticalScroll(rememberScrollState())
                            ) {
                                uiState.addItemsCart.forEach { entry ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                entry.article.name,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = OrBeninois,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Text(
                                                formatFcfa(entry.total),
                                                fontSize = 11.sp,
                                                color = SableOuidah
                                            )
                                        }
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                                        ) {
                                            IconButton(
                                                onClick = { viewModel.addItemsDecrement(entry.article.id) },
                                                modifier = Modifier.size(28.dp),
                                                enabled = !uiState.isAddingItems
                                            ) {
                                                Icon(
                                                    Icons.Default.Remove,
                                                    contentDescription = "Retirer",
                                                    modifier = Modifier.size(16.dp),
                                                    tint = OrBeninois
                                                )
                                            }
                                            Surface(
                                                color = OrBeninois.copy(alpha = 0.2f),
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    "${entry.quantity}",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp,
                                                    color = OrBeninois,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                                )
                                            }
                                            IconButton(
                                                onClick = { viewModel.addItemsIncrement(entry.article) },
                                                modifier = Modifier.size(28.dp),
                                                enabled = !uiState.isAddingItems
                                            ) {
                                                Icon(
                                                    Icons.Default.Add,
                                                    contentDescription = "Ajouter",
                                                    modifier = Modifier.size(16.dp),
                                                    tint = VertBeninois
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                            Divider(color = SableOuidah.copy(alpha = 0.3f))
                            Spacer(Modifier.height(8.dp))
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    "${uiState.addItemsCount} article(s)",
                                    fontSize = 11.sp,
                                    color = SableOuidah
                                )
                                Text(
                                    formatFcfa(uiState.addItemsTotal),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    color = OrBeninois
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(
                                    onClick = { viewModel.dismissAddItemsDialog() },
                                    enabled = !uiState.isAddingItems,
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = SableOuidah)
                                ) {
                                    Text("Annuler", fontWeight = FontWeight.Bold)
                                }
                                Button(
                                    onClick = { viewModel.submitAddItems() },
                                    enabled = !uiState.isAddingItems && uiState.addItemsCart.isNotEmpty(),
                                    colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey)
                                ) {
                                    if (uiState.isAddingItems) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(16.dp),
                                            color = Color.White,
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(Modifier.width(8.dp))
                                    }
                                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Ajouter", fontWeight = FontWeight.Bold, color = Color.White)
                                }
                            }
                        }
                    }
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
