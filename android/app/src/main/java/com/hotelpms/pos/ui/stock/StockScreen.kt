package com.hotelpms.pos.ui.stock

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.hotelpms.pos.domain.model.Article
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockScreen(
    viewModel: StockViewModel = hiltViewModel()
) {
    val state = viewModel.uiState
    val snackbarHostState = remember { SnackbarHostState() }
    var showMovementDialog by remember { mutableStateOf(false) }
    var showArticleDialog by remember { mutableStateOf(false) }
    val currencyFormat = remember {
        NumberFormat.getNumberInstance(Locale.FRANCE).apply {
            maximumFractionDigits = 0
        }
    }

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
                title = { Text("Stock") },
                actions = {
                    if (state.userRole.uppercase() in listOf("MANAGER", "DAF", "OWNER")) {
                        IconButton(onClick = { showArticleDialog = true }) {
                            Icon(Icons.Default.AddBox, contentDescription = "Nouvel article")
                        }
                    }
                    IconButton(onClick = { viewModel.fetchArticles() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafra\u00eechir")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showMovementDialog = true },
                containerColor = RougeDahomey
            ) {
                Icon(Icons.Default.SwapVert, contentDescription = "Nouveau mouvement", tint = Color.White)
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search bar
            OutlinedTextField(
                value = state.searchQuery,
                onValueChange = { viewModel.onSearchQueryChange(it) },
                placeholder = { Text("Rechercher un article...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                singleLine = true
            )

            if (state.isLoading && state.articles.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (state.filteredArticles.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inventory2,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Aucun article trouv\u00e9",
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
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(state.filteredArticles) { article ->
                        ArticleStockCard(article = article, currencyFormat = currencyFormat)
                    }
                    item { Spacer(modifier = Modifier.height(80.dp)) }
                }
            }
        }
    }

    // Movement dialog
    if (showMovementDialog) {
        StockMovementDialog(
            articles = state.articles,
            onDismiss = { showMovementDialog = false },
            onCreate = { articleId, type, quantity, reason ->
                showMovementDialog = false
                viewModel.createStockMovement(articleId, type, quantity, reason)
            }
        )
    }

    // Create article dialog
    if (showArticleDialog) {
        CreateArticleDialog(
            onDismiss = { showArticleDialog = false },
            onCreate = { name, sku, price, stock, unit, description, imageUrl ->
                showArticleDialog = false
                viewModel.createArticle(name, sku, price, stock, unit, description, imageUrl)
            }
        )
    }
}

@Composable
private fun ArticleStockCard(article: Article, currencyFormat: NumberFormat) {
    val isLowStock = article.currentStock <= 5 // approximate minimum stock threshold

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = article.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (isLowStock) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            color = RougeDahomey.copy(alpha = 0.15f),
                            shape = MaterialTheme.shapes.small
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Warning,
                                    contentDescription = null,
                                    modifier = Modifier.size(12.dp),
                                    tint = RougeDahomey
                                )
                                Spacer(modifier = Modifier.width(2.dp))
                                Text(
                                    "Stock bas",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = RougeDahomey,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
                article.sku?.let { sku ->
                    Text(
                        text = "SKU : $sku",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                article.category?.let { cat ->
                    Text(
                        text = cat.name,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${article.currentStock} ${article.unit}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isLowStock) RougeDahomey else VertBeninois
                )
                Text(
                    text = "${currencyFormat.format(article.unitPrice)} FCFA",
                    style = MaterialTheme.typography.bodySmall,
                    color = OrBeninoisDark
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StockMovementDialog(
    articles: List<Article>,
    onDismiss: () -> Unit,
    onCreate: (String, String, Int, String?) -> Unit
) {
    var selectedArticleId by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf("PURCHASE") }
    var quantity by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var articleDropdownExpanded by remember { mutableStateOf(false) }
    var typeDropdownExpanded by remember { mutableStateOf(false) }

    val selectedArticle = articles.find { it.id == selectedArticleId }
    val movementTypes = listOf(
        "PURCHASE" to "Achat",
        "SALE" to "Vente",
        "ADJUSTMENT" to "Ajustement",
        "LOSS" to "Perte",
        "RETURN" to "Retour"
    )
    val selectedTypeLabel = movementTypes.find { it.first == selectedType }?.second ?: selectedType

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouveau mouvement de stock") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Article selector
                ExposedDropdownMenuBox(
                    expanded = articleDropdownExpanded,
                    onExpandedChange = { articleDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedArticle?.name ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Article") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = articleDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = articleDropdownExpanded,
                        onDismissRequest = { articleDropdownExpanded = false }
                    ) {
                        articles.forEach { article ->
                            DropdownMenuItem(
                                text = { Text("${article.name} (${article.currentStock} ${article.unit})") },
                                onClick = {
                                    selectedArticleId = article.id
                                    articleDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                // Type selector
                ExposedDropdownMenuBox(
                    expanded = typeDropdownExpanded,
                    onExpandedChange = { typeDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedTypeLabel,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Type de mouvement") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = typeDropdownExpanded,
                        onDismissRequest = { typeDropdownExpanded = false }
                    ) {
                        movementTypes.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    selectedType = value
                                    typeDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it },
                    label = { Text("Quantit\u00e9") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Motif (optionnel)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onCreate(
                        selectedArticleId,
                        selectedType,
                        quantity.toIntOrNull() ?: 0,
                        reason.ifBlank { null }
                    )
                },
                enabled = selectedArticleId.isNotBlank() && (quantity.toIntOrNull() ?: 0) > 0
            ) {
                Text("Cr\u00e9er")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}

@Composable
private fun CreateArticleDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String, Double, Int, String, String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var sku by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var stock by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("pi\u00e8ce") }
    var description by remember { mutableStateOf("") }
    var imageUrl by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouvel article") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = sku,
                    onValueChange = { sku = it },
                    label = { Text("SKU") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = price,
                    onValueChange = { price = it },
                    label = { Text("Prix unitaire (FCFA)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = stock,
                    onValueChange = { stock = it },
                    label = { Text("Stock initial") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = unit,
                    onValueChange = { unit = it },
                    label = { Text("Unit\u00e9") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optionnel)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                OutlinedTextField(
                    value = imageUrl,
                    onValueChange = { imageUrl = it },
                    label = { Text("URL de l'image (optionnel)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onCreate(
                        name,
                        sku,
                        price.toDoubleOrNull() ?: 0.0,
                        stock.toIntOrNull() ?: 0,
                        unit,
                        description,
                        imageUrl
                    )
                },
                enabled = name.isNotBlank() && sku.isNotBlank() && price.isNotBlank()
            ) {
                Text("Cr\u00e9er")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}
