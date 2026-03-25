package com.hotelpms.pos.domain.printer

import com.hotelpms.pos.domain.model.Establishment
import com.hotelpms.pos.domain.model.Order
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Formats an Order into ESC/POS byte data for thermal printing.
 */
object ReceiptFormatter {

    private val currencyFormat = NumberFormat.getNumberInstance(Locale.FRANCE).apply {
        maximumFractionDigits = 0
    }

    private val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.FRANCE).apply {
        timeZone = TimeZone.getTimeZone("Africa/Lome")
    }

    private val paymentLabels = mapOf(
        "CASH" to "Especes",
        "CARD" to "Carte bancaire",
        "BANK_TRANSFER" to "Virement",
        "MOBILE_MONEY" to "Mobile Money",
        "MOOV_MONEY" to "Flooz (Moov Money)",
        "MIXX_BY_YAS" to "Yas (MTN)",
        "OTHER" to "Autre"
    )

    fun formatReceipt(order: Order, establishment: Establishment, cols: Int = 32): ByteArray {
        val esc = EscPosCommands
        val buf = mutableListOf<Byte>()

        fun add(vararg arrays: ByteArray) {
            arrays.forEach { buf.addAll(it.toList()) }
        }

        // Init
        add(esc.INIT)

        // Header - establishment info
        add(esc.ALIGN_CENTER, esc.DOUBLE_HEIGHT, esc.BOLD_ON)
        add(esc.text(establishment.name + "\n"))
        add(esc.BOLD_OFF, esc.NORMAL_SIZE)

        establishment.address?.let { add(esc.text(it + "\n")) }
        val cityLine = listOfNotNull(establishment.city, establishment.country).joinToString(", ")
        if (cityLine.isNotEmpty()) add(esc.text(cityLine + "\n"))
        establishment.phone?.let { add(esc.text("Tel: $it\n")) }

        add(esc.line(), esc.separator(cols))

        // Order info
        add(esc.BOLD_ON)
        add(esc.text("Recu N. ${order.orderNumber ?: order.id.take(8)}\n"))
        add(esc.BOLD_OFF, esc.ALIGN_LEFT)

        order.createdAt?.let {
            try {
                val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                isoFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = isoFormat.parse(it)
                date?.let { d -> add(esc.text("Date: ${dateFormat.format(d)}\n")) }
            } catch (_: Exception) {
                add(esc.text("Date: $it\n"))
            }
        }
        order.tableNumber?.let { add(esc.text("Table: $it\n")) }
        order.createdBy?.let { add(esc.text("Serveur: ${it.firstName} ${it.lastName}\n")) }

        add(esc.separator(cols))

        // Items
        order.items?.forEach { item ->
            val name = item.article?.name ?: "Article"
            val qty = item.quantity
            val subtotal = (qty * item.unitPrice).toLong()
            val left = "${qty}x $name"
            val right = "${currencyFormat.format(subtotal)}"

            val maxLeft = cols - right.length - 1
            val truncated = if (left.length > maxLeft) left.take(maxLeft - 2) + ".." else left
            val padding = cols - truncated.length - right.length
            val line = truncated + " ".repeat(maxOf(1, padding)) + right

            add(esc.text(line + "\n"))
        }

        add(esc.separator(cols))

        // Total
        add(esc.BOLD_ON, esc.ALIGN_RIGHT)
        add(esc.text("TOTAL: ${currencyFormat.format(order.totalAmount.toLong())} FCFA\n"))
        add(esc.BOLD_OFF, esc.ALIGN_LEFT)

        // Payment method
        order.paymentMethod?.let {
            val label = paymentLabels[it] ?: it
            add(esc.text("Paiement: $label\n"))
        }

        add(esc.line())

        // Footer
        add(esc.ALIGN_CENTER)
        add(esc.text("Merci de votre visite !\n"))
        add(esc.line())

        // Feed and cut
        add(esc.feedLines(4), esc.CUT_PAPER)

        return buf.toByteArray()
    }
}
