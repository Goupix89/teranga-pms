package com.hotelpms.pos.ui.pos

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.CachedArticle
import com.hotelpms.pos.domain.model.CartItem
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PosScreen(
    onLogout: () -> Unit,
    viewModel: PosViewModel = hiltViewModel()
) {
    val state = viewModel.uiState
    val articles by viewModel.articles.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val cartTotal by viewModel.cartTotal.collectAsState()
    val cartCount by viewModel.cartItemCount.collectAsState()
    val pendingCount by viewModel.pendingCount.collectAsState()

    var showInvoiceDialog by remember { mutableStateOf(false) }
    var invoiceId by remember { mutableStateOf("") }

    val currencyFormat = remember { NumberFormat.getNumberInstance(Locale.FRANCE) }

    // Snackbar for messages
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
                title = { Text("Point de Vente") },
                actions = {
                    // Pending sync indicator
                    if (pendingCount > 0) {
                        Badge(
                            modifier = Modifier.padding(end = 8.dp),
                            containerColor = MaterialTheme.colorScheme.error
                        ) {
                            Text("$pendingCount")
                        }
                        IconButton(onClick = { viewModel.syncPending() }) {
                            Icon(Icons.Default.Sync, contentDescription = "Synchroniser")
                        }
                    }

                    IconButton(onClick = { viewModel.refreshArticles() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafraîchir")
                    }

                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Déconnexion")
                    }
                }
            )
        }
    ) { padding ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // LEFT: Article grid
            Column(
                modifier = Modifier
                    .weight(0.6f)
                    .fillMaxHeight()
                    .padding(8.dp)
            ) {
                // Search bar
                OutlinedTextField(
                    value = state.searchQuery,
                    onValueChange = { viewModel.onSearchQueryChange(it) },
                    placeholder = { Text("Rechercher un article...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(8.dp))

                if (state.isLoadingArticles) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 150.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(articles) { article ->
                            ArticleCard(
                                article = article,
                                onAdd = { viewModel.addToCart(article) },
                                currencyFormat = currencyFormat
                            )
                        }
                    }
                }
            }

            // Divider
            VerticalDivider()

            // RIGHT: Cart
            Column(
                modifier = Modifier
                    .weight(0.4f)
                    .fillMaxHeight()
                    .padding(8.dp)
            ) {
                Text(
                    "Panier ($cartCount)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(8.dp))

                if (cartItems.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.ShoppingCart,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                            )
                            Text(
                                "Panier vide",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(cartItems) { item ->
                            CartItemRow(
                                item = item,
                                onQuantityChange = { viewModel.updateQuantity(item.article.id, it) },
                                onRemove = { viewModel.removeFromCart(item.article.id) },
                                currencyFormat = currencyFormat
                            )
                        }
                    }
                }

                Divider(modifier = Modifier.padding(vertical = 8.dp))

                // Total
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Total", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        "${currencyFormat.format(cartTotal)} XOF",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { viewModel.clearCart() },
                        modifier = Modifier.weight(1f),
                        enabled = cartItems.isNotEmpty()
                    ) {
                        Text("Vider")
                    }

                    Button(
                        onClick = { showInvoiceDialog = true },
                        modifier = Modifier.weight(1f),
                        enabled = cartItems.isNotEmpty() && !state.isProcessing
                    ) {
                        if (state.isProcessing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Icon(Icons.Default.Payment, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Encaisser")
                        }
                    }
                }
            }
        }

        // Invoice ID dialog
        if (showInvoiceDialog) {
            AlertDialog(
                onDismissRequest = { showInvoiceDialog = false },
                title = { Text("N° de facture") },
                text = {
                    OutlinedTextField(
                        value = invoiceId,
                        onValueChange = { invoiceId = it },
                        label = { Text("ID Facture") },
                        singleLine = true
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showInvoiceDialog = false
                            viewModel.processTransaction(invoiceId)
                            invoiceId = ""
                        },
                        enabled = invoiceId.isNotBlank()
                    ) {
                        Text("Valider")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showInvoiceDialog = false }) {
                        Text("Annuler")
                    }
                }
            )
        }
    }
}

@Composable
fun ArticleCard(
    article: CachedArticle,
    onAdd: () -> Unit,
    currencyFormat: NumberFormat
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onAdd() },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = article.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            article.categoryName?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${currencyFormat.format(article.unitPrice)} XOF",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "Stock: ${article.currentStock}",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (article.currentStock <= 5)
                        MaterialTheme.colorScheme.error
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun CartItemRow(
    item: CartItem,
    onQuantityChange: (Int) -> Unit,
    onRemove: () -> Unit,
    currencyFormat: NumberFormat
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.article.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${currencyFormat.format(item.article.unitPrice)} × ${item.quantity} = ${currencyFormat.format(item.total)} XOF",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Quantity controls
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { onQuantityChange(item.quantity - 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Remove, contentDescription = "Moins", modifier = Modifier.size(16.dp))
                }

                Text(
                    text = "${item.quantity}",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )

                IconButton(
                    onClick = { onQuantityChange(item.quantity + 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Plus", modifier = Modifier.size(16.dp))
                }

                IconButton(
                    onClick = onRemove,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Supprimer",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
fun VerticalDivider() {
    Divider(
        modifier = Modifier
            .fillMaxHeight()
            .width(1.dp)
    )
}
