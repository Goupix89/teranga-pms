package com.hotelpms.pos.ui.stock

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Article
import com.hotelpms.pos.domain.model.ArticleCategory
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
    var editingArticle by remember { mutableStateOf<Article?>(null) }
    var deletingArticle by remember { mutableStateOf<Article?>(null) }
    val canEdit = state.userRole.uppercase() in listOf("MANAGER", "DAF", "OWNER", "SUPERADMIN")
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
                        ArticleStockCard(
                            article = article,
                            currencyFormat = currencyFormat,
                            canEdit = canEdit,
                            onEdit = { editingArticle = article },
                            onDelete = { deletingArticle = article }
                        )
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
        ArticleFormDialog(
            title = "Nouvel article",
            categories = state.categories,
            onDismiss = { showArticleDialog = false },
            onSave = { name, sku, price, stock, minimumStock, trackStock, unit, description, imageUrl, categoryId ->
                showArticleDialog = false
                viewModel.createArticle(name, sku, price, stock, minimumStock, trackStock, unit, description, imageUrl, categoryId)
            }
        )
    }

    // Edit article dialog
    if (editingArticle != null) {
        ArticleFormDialog(
            title = "Modifier l'article",
            article = editingArticle,
            categories = state.categories,
            onDismiss = { editingArticle = null },
            onSave = { name, sku, price, stock, minimumStock, trackStock, unit, description, imageUrl, categoryId ->
                val id = editingArticle!!.id
                editingArticle = null
                viewModel.updateArticle(id, name, sku, price, stock, minimumStock, trackStock, unit, description, imageUrl, categoryId)
            }
        )
    }

    // Delete confirmation dialog
    if (deletingArticle != null) {
        AlertDialog(
            onDismissRequest = { deletingArticle = null },
            title = { Text("Supprimer l'article") },
            text = { Text("Voulez-vous vraiment supprimer \"${deletingArticle!!.name}\" ? L'article sera desactive.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        val id = deletingArticle!!.id
                        deletingArticle = null
                        viewModel.deactivateArticle(id)
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = RougeDahomey)
                ) { Text("Supprimer") }
            },
            dismissButton = {
                TextButton(onClick = { deletingArticle = null }) { Text("Annuler") }
            }
        )
    }
}

@Composable
private fun ArticleStockCard(
    article: Article,
    currencyFormat: NumberFormat,
    canEdit: Boolean = false,
    onEdit: () -> Unit = {},
    onDelete: () -> Unit = {}
) {
    val isLowStock = article.trackStock && article.minimumStock > 0 && article.currentStock <= article.minimumStock

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
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
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
                                Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(12.dp), tint = RougeDahomey)
                                Spacer(modifier = Modifier.width(2.dp))
                                Text("Stock bas", style = MaterialTheme.typography.labelSmall, color = RougeDahomey, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                article.sku?.let { sku ->
                    Text(text = "SKU : $sku", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                article.category?.let { cat ->
                    Text(text = cat.name, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                if (article.trackStock) {
                    Text(
                        text = "${article.currentStock} ${article.unit}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (isLowStock) RougeDahomey else VertBeninois
                    )
                } else {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.small
                    ) {
                        Text(
                            text = "Non suivi",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Text(
                    text = "${currencyFormat.format(article.unitPrice)} FCFA",
                    style = MaterialTheme.typography.bodySmall,
                    color = OrBeninoisDark
                )
                if (canEdit) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                        IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Edit, contentDescription = "Modifier", modifier = Modifier.size(18.dp), tint = OrBeninois)
                        }
                        IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Delete, contentDescription = "Supprimer", modifier = Modifier.size(18.dp), tint = RougeDahomey)
                        }
                    }
                }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleFormDialog(
    title: String,
    article: Article? = null,
    categories: List<ArticleCategory> = emptyList(),
    onDismiss: () -> Unit,
    onSave: (String, String, Double, Int, Int, Boolean, String, String, String, String?) -> Unit
) {
    var name by remember { mutableStateOf(article?.name ?: "") }
    var sku by remember { mutableStateOf(article?.sku ?: "") }
    var price by remember { mutableStateOf(article?.unitPrice?.let { if (it > 0) it.toInt().toString() else "" } ?: "") }
    var trackStock by remember { mutableStateOf(article?.trackStock ?: false) }
    var stock by remember { mutableStateOf(article?.currentStock?.toString() ?: "") }
    var minimumStock by remember { mutableStateOf(article?.minimumStock?.toString() ?: "") }
    var unit by remember { mutableStateOf(article?.unit ?: "piece") }
    var description by remember { mutableStateOf(article?.description ?: "") }
    var imageUrl by remember { mutableStateOf(article?.imageUrl ?: "") }
    var selectedCategoryId by remember { mutableStateOf(article?.category?.id) }
    var categoryExpanded by remember { mutableStateOf(false) }

    val selectedCategory = categories.find { it.id == selectedCategoryId }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .fillMaxHeight(0.8f),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Fermer")
                    }
                }

                HorizontalDivider()

                // Form fields
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Nom *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    // Category selector
                    if (categories.isNotEmpty()) {
                        ExposedDropdownMenuBox(
                            expanded = categoryExpanded,
                            onExpandedChange = { categoryExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = selectedCategory?.name ?: "Sans categorie",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Categorie") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                                modifier = Modifier.fillMaxWidth().menuAnchor()
                            )
                            ExposedDropdownMenu(
                                expanded = categoryExpanded,
                                onDismissRequest = { categoryExpanded = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Sans categorie") },
                                    onClick = { selectedCategoryId = null; categoryExpanded = false }
                                )
                                categories.forEach { cat ->
                                    DropdownMenuItem(
                                        text = { Text(cat.name) },
                                        onClick = { selectedCategoryId = cat.id; categoryExpanded = false }
                                    )
                                }
                            }
                        }
                    }

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
                        label = { Text("Prix (FCFA) *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = unit,
                        onValueChange = { unit = it },
                        label = { Text("Unite") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Checkbox(
                                    checked = trackStock,
                                    onCheckedChange = { trackStock = it }
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "Suivre le stock",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        "Activez pour les boissons et produits en inventaire. Laissez desactive pour les plats prepares.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            if (trackStock) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    OutlinedTextField(
                                        value = stock,
                                        onValueChange = { stock = it },
                                        label = { Text("Stock initial") },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true
                                    )
                                    OutlinedTextField(
                                        value = minimumStock,
                                        onValueChange = { minimumStock = it },
                                        label = { Text("Stock min.") },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true
                                    )
                                }
                            }
                        }
                    }
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Description") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                    OutlinedTextField(
                        value = imageUrl,
                        onValueChange = { imageUrl = it },
                        label = { Text("URL de l'image") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                HorizontalDivider()

                // Action buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(onClick = onDismiss) {
                        Text("Annuler")
                    }
                    Spacer(Modifier.width(12.dp))
                    Button(
                        onClick = {
                            onSave(
                                name, sku,
                                price.toDoubleOrNull() ?: 0.0,
                                if (trackStock) stock.toIntOrNull() ?: 0 else 0,
                                if (trackStock) minimumStock.toIntOrNull() ?: 0 else 0,
                                trackStock,
                                unit, description, imageUrl,
                                selectedCategoryId
                            )
                        },
                        enabled = name.isNotBlank() && price.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey)
                    ) {
                        Text(if (article != null) "Enregistrer" else "Creer", color = Color.White)
                    }
                }
            }
        }
    }
}
