<?php
/**
 * Plugin Name: Teranga PMS — BA Book Everything Sync
 * Description: Synchronise automatiquement les réservations BA Book Everything (avec FedaPay) vers Teranga PMS.
 * Version: 1.0.0
 * Author: Teranga PMS
 * Text Domain: teranga-ba-sync
 * Requires Plugins: ba-book-everything
 */

if (!defined('ABSPATH')) exit;

// =============================================================================
// SETTINGS PAGE
// =============================================================================

add_action('admin_menu', function () {
    add_options_page(
        'Teranga BA Sync',
        'Teranga BA Sync',
        'manage_options',
        'teranga-ba-sync',
        'teranga_ba_sync_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('teranga_ba_sync', 'teranga_ba_api_url');
    register_setting('teranga_ba_sync', 'teranga_ba_api_key');
    register_setting('teranga_ba_sync', 'teranga_ba_sync_on');       // babe_order_paid or babe_order_completed
    register_setting('teranga_ba_sync', 'teranga_ba_room_mapping');   // JSON mapping BA item ID → room number
    register_setting('teranga_ba_sync', 'teranga_ba_log_enabled');
});

function teranga_ba_sync_settings_page() {
    $room_mapping = get_option('teranga_ba_room_mapping', '{}');
    ?>
    <div class="wrap">
        <h1>Teranga PMS — Synchronisation BA Book Everything</h1>
        <form method="post" action="options.php">
            <?php settings_fields('teranga_ba_sync'); ?>
            <table class="form-table">
                <tr>
                    <th>URL API Teranga PMS</th>
                    <td><input type="url" name="teranga_ba_api_url" value="<?php echo esc_attr(get_option('teranga_ba_api_url')); ?>" class="regular-text" placeholder="https://api.votre-hotel.teranga.app" /></td>
                </tr>
                <tr>
                    <th>Clé API Teranga</th>
                    <td><input type="text" name="teranga_ba_api_key" value="<?php echo esc_attr(get_option('teranga_ba_api_key')); ?>" class="regular-text" placeholder="tpms_..." /></td>
                </tr>
                <tr>
                    <th>Synchroniser au moment de</th>
                    <td>
                        <select name="teranga_ba_sync_on">
                            <option value="babe_order_paid" <?php selected(get_option('teranga_ba_sync_on', 'babe_order_paid'), 'babe_order_paid'); ?>>Paiement reçu (babe_order_paid)</option>
                            <option value="babe_order_completed" <?php selected(get_option('teranga_ba_sync_on'), 'babe_order_completed'); ?>>Commande complétée (babe_order_completed)</option>
                        </select>
                        <p class="description">« Paiement reçu » est recommandé pour FedaPay — la sync se fait dès la confirmation du paiement.</p>
                    </td>
                </tr>
                <tr>
                    <th>Mapping chambres (JSON)</th>
                    <td>
                        <textarea name="teranga_ba_room_mapping" rows="6" class="large-text code" placeholder='{"123": "101", "456": "102"}'><?php echo esc_textarea($room_mapping); ?></textarea>
                        <p class="description">
                            Associez chaque ID d'objet BA Book Everything au numéro de chambre dans Teranga PMS.<br>
                            Format : <code>{"ID_BA": "NUMERO_CHAMBRE", ...}</code><br>
                            Trouvez les IDs dans <strong>BA Book Everything → All Items</strong> (colonne ID).
                        </p>
                    </td>
                </tr>
                <tr>
                    <th>Activer les logs</th>
                    <td>
                        <label>
                            <input type="checkbox" name="teranga_ba_log_enabled" value="1" <?php checked(get_option('teranga_ba_log_enabled'), '1'); ?> />
                            Journaliser les synchronisations dans <code>wp-content/debug.log</code>
                        </label>
                    </td>
                </tr>
            </table>
            <?php submit_button('Enregistrer'); ?>
        </form>

        <hr />
        <h2>Configuration du webhook FedaPay</h2>
        <p>Pour la double sécurité, configurez aussi ce webhook dans votre <a href="https://app.fedapay.com" target="_blank">dashboard FedaPay</a> :</p>
        <code><?php echo esc_html(get_option('teranga_ba_api_url', 'https://api.votre-hotel.teranga.app')); ?>/api/webhooks/fedapay</code>

        <hr />
        <h2>Dernières synchronisations</h2>
        <?php
        $logs = get_option('teranga_ba_sync_log', []);
        if (empty($logs)) {
            echo '<p>Aucune synchronisation enregistrée.</p>';
        } else {
            echo '<table class="widefat striped"><thead><tr><th>Date</th><th>Commande BA</th><th>Chambre</th><th>Client</th><th>Statut</th></tr></thead><tbody>';
            foreach (array_reverse(array_slice($logs, -20)) as $log) {
                printf(
                    '<tr><td>%s</td><td>#%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
                    esc_html($log['date']),
                    esc_html($log['order_id']),
                    esc_html($log['room']),
                    esc_html($log['guest']),
                    esc_html($log['status'])
                );
            }
            echo '</tbody></table>';
        }
        ?>
    </div>
    <?php
}

// =============================================================================
// HOOK — Sync on payment or completion
// =============================================================================

// Register both hooks, but only the selected one will do work
add_action('babe_order_paid', 'teranga_ba_sync_order', 10, 2);
add_action('babe_order_completed', 'teranga_ba_sync_order_completed', 10, 1);

function teranga_ba_sync_order_completed($order_id) {
    teranga_ba_sync_order($order_id, 0);
}

function teranga_ba_sync_order($order_id, $amount = 0) {
    $sync_on = get_option('teranga_ba_sync_on', 'babe_order_paid');
    $current_hook = current_action();

    // Only process if this is the configured hook
    if ($current_hook !== $sync_on) return;

    $api_url = rtrim(get_option('teranga_ba_api_url', ''), '/');
    $api_key = get_option('teranga_ba_api_key', '');

    if (empty($api_url) || empty($api_key)) {
        teranga_ba_log("Sync ignorée pour commande #$order_id : plugin non configuré");
        return;
    }

    // Check if already synced (prevent duplicates)
    $synced = get_post_meta($order_id, '_teranga_synced', true);
    if ($synced) {
        teranga_ba_log("Commande #$order_id déjà synchronisée, ignorée");
        return;
    }

    // Get order data
    $order_meta = teranga_ba_get_order_data($order_id);
    if (!$order_meta) {
        teranga_ba_log("Commande #$order_id : impossible de lire les données");
        return;
    }

    // Get room mapping
    $room_mapping = json_decode(get_option('teranga_ba_room_mapping', '{}'), true) ?: [];

    // Get order items (bookings)
    $order_items = teranga_ba_get_order_items($order_id);

    foreach ($order_items as $item) {
        $booking_id = $item['booking_id'] ?? '';
        $room_number = $room_mapping[$booking_id] ?? $room_mapping[strval($booking_id)] ?? '';

        if (empty($room_number)) {
            teranga_ba_log("Commande #$order_id : pas de mapping pour l'objet BA #$booking_id");
            continue;
        }

        // Get FedaPay transaction reference and amount
        $payment_token = get_post_meta($order_id, '_payment_token_id', true);
        $payment_method_name = get_post_meta($order_id, '_payment_method', true);

        // Get the actual amount paid (may be a deposit / partial payment)
        $order_amount = 0;
        if ($amount > 0) {
            $order_amount = floatval($amount);
        } else {
            // Try to get from order meta
            $meta_amount = get_post_meta($order_id, '_order_total', true);
            if (!$meta_amount) $meta_amount = get_post_meta($order_id, '_total_amount', true);
            if (!$meta_amount) $meta_amount = get_post_meta($order_id, '_babe_order_total', true);
            $order_amount = floatval($meta_amount);
        }

        $data = [
            'room'                  => $room_number,
            'start'                 => $item['date_from'] ?? '',
            'end'                   => $item['date_to'] ?? '',
            'guest'                 => trim(($order_meta['first_name'] ?? '') . ' ' . ($order_meta['last_name'] ?? '')),
            'guestEmail'            => $order_meta['email'] ?? '',
            'guestPhone'            => $order_meta['phone'] ?? '',
            'numberOfGuests'        => $item['guests_total'] ?? 1,
            'source'                => 'CHANNEL_MANAGER',
            'paymentMethod'         => 'FEDAPAY',
            'externalRef'           => 'ba_order_' . $order_id,
            'fedapayTransactionId'  => $payment_token ?: ('ba_' . $order_id),
        ];

        // Include actual amount paid (supports partial/deposit payments)
        if ($order_amount > 0) {
            $data['amountPaid'] = $order_amount;
        }

        // Validate required fields
        if (empty($data['start']) || empty($data['end']) || empty($data['guest'])) {
            teranga_ba_log("Commande #$order_id : données incomplètes (dates ou client manquant)");
            continue;
        }

        // Send to Teranga PMS
        $response = wp_remote_post("$api_url/api/external-bookings", [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Api-Key'    => $api_key,
            ],
            'body'    => wp_json_encode($data),
            'timeout' => 30,
        ]);

        $status_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        $sync_status = 'ERREUR';
        if (is_wp_error($response)) {
            teranga_ba_log("Commande #$order_id → Erreur réseau : " . $response->get_error_message());
            $sync_status = 'ERREUR: ' . $response->get_error_message();
        } elseif ($status_code === 201 && !empty($body['success'])) {
            teranga_ba_log("Commande #$order_id → Synchronisée ! Réservation Teranga: " . ($body['data']['id'] ?? ''));
            $sync_status = 'OK — ' . ($body['data']['paymentStatus'] ?? 'PAID');

            // Mark as synced
            update_post_meta($order_id, '_teranga_synced', true);
            update_post_meta($order_id, '_teranga_reservation_id', $body['data']['id'] ?? '');
            update_post_meta($order_id, '_teranga_invoice_id', $body['data']['invoiceId'] ?? '');
        } else {
            $error = $body['error'] ?? $body['message'] ?? "HTTP $status_code";
            teranga_ba_log("Commande #$order_id → Erreur API : $error");
            $sync_status = 'ERREUR: ' . $error;
        }

        // Save to sync log (keep last 50)
        $logs = get_option('teranga_ba_sync_log', []);
        $logs[] = [
            'date'     => current_time('Y-m-d H:i:s'),
            'order_id' => $order_id,
            'room'     => $room_number,
            'guest'    => $data['guest'],
            'status'   => $sync_status,
        ];
        update_option('teranga_ba_sync_log', array_slice($logs, -50));
    }
}

// =============================================================================
// HANDLE CANCELLATIONS — Optional: update Teranga PMS
// =============================================================================

add_action('babe_order_canceled', function ($order_id) {
    $reservation_id = get_post_meta($order_id, '_teranga_reservation_id', true);
    if (empty($reservation_id)) return;

    $api_url = rtrim(get_option('teranga_ba_api_url', ''), '/');
    $api_key = get_option('teranga_ba_api_key', '');

    if (empty($api_url) || empty($api_key)) return;

    // Cancel the reservation in Teranga PMS
    wp_remote_request("$api_url/api/external-bookings/$reservation_id/cancel", [
        'method'  => 'POST',
        'headers' => [
            'Content-Type' => 'application/json',
            'X-Api-Key'    => $api_key,
        ],
        'timeout' => 15,
    ]);

    teranga_ba_log("Commande #$order_id annulée → Annulation envoyée pour réservation Teranga $reservation_id");
});

// =============================================================================
// WEBHOOK — Receive payment notifications from Teranga PMS
// =============================================================================

add_action('rest_api_init', function () {
    register_rest_route('teranga-ba-sync/v1', '/payment-webhook', [
        'methods'             => 'POST',
        'callback'            => 'teranga_ba_handle_payment_webhook',
        'permission_callback' => '__return_true', // Public endpoint
    ]);
});

function teranga_ba_handle_payment_webhook($request) {
    $data = $request->get_json_params();

    if (empty($data['event']) || $data['event'] !== 'payment.completed') {
        return new WP_REST_Response(['received' => true, 'action' => 'ignored'], 200);
    }

    $external_ref = $data['externalRef'] ?? '';
    teranga_ba_log("Webhook paiement reçu : $external_ref — Montant: " . ($data['amount'] ?? 0));

    // Extract BA order ID from externalRef (format: ba_order_XXX)
    if (preg_match('/^ba_order_(\d+)$/', $external_ref, $matches)) {
        $order_id = intval($matches[1]);

        // Mark the BA order as paid
        update_post_meta($order_id, '_teranga_payment_status', 'PAID');
        update_post_meta($order_id, '_teranga_payment_method', $data['paymentMethod'] ?? 'FEDAPAY');
        update_post_meta($order_id, '_teranga_payment_amount', $data['amount'] ?? 0);
        update_post_meta($order_id, '_teranga_paid_at', $data['paidAt'] ?? current_time('c'));

        teranga_ba_log("Commande BA #$order_id marquée comme payée via Teranga PMS");

        return new WP_REST_Response([
            'received' => true,
            'action'   => 'order_updated',
            'orderId'  => $order_id,
        ], 200);
    }

    return new WP_REST_Response(['received' => true, 'action' => 'no_match'], 200);
}

// =============================================================================
// HELPERS
// =============================================================================

function teranga_ba_get_order_data($order_id) {
    return [
        'first_name' => get_post_meta($order_id, 'first_name', true),
        'last_name'  => get_post_meta($order_id, 'last_name', true),
        'email'      => get_post_meta($order_id, 'email', true),
        'phone'      => get_post_meta($order_id, 'phone', true),
    ];
}

function teranga_ba_get_order_items($order_id) {
    global $wpdb;
    $items = [];

    // BA Book Everything stores order items in its custom table
    $table = $wpdb->prefix . 'babe_order_items';

    // Check if custom table exists
    if ($wpdb->get_var("SHOW TABLES LIKE '$table'") === $table) {
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE order_id = %d",
            $order_id
        ), ARRAY_A);

        $meta_table = $wpdb->prefix . 'babe_order_itemmeta';

        foreach ($rows as $row) {
            $item_id = $row['order_item_id'];
            $metas = $wpdb->get_results($wpdb->prepare(
                "SELECT meta_key, meta_value FROM $meta_table WHERE order_item_id = %d",
                $item_id
            ), ARRAY_A);

            $meta_map = [];
            foreach ($metas as $m) {
                $meta_map[$m['meta_key']] = maybe_unserialize($m['meta_value']);
            }

            // Calculate total guests from guests array
            $guests_arr = $meta_map['guests'] ?? [];
            $guests_total = is_array($guests_arr) ? array_sum($guests_arr) : 1;

            $items[] = [
                'booking_id'   => $row['booking_obj_id'] ?? '',
                'date_from'    => isset($meta_map['date_from']) ? date('Y-m-d', strtotime($meta_map['date_from'])) : '',
                'date_to'      => isset($meta_map['date_to']) ? date('Y-m-d', strtotime($meta_map['date_to'])) : '',
                'guests_total' => max(1, $guests_total),
            ];
        }
    }

    // Fallback: use order-level meta if no items found
    if (empty($items)) {
        $start = get_post_meta($order_id, '_order_start', true);
        $end = get_post_meta($order_id, '_order_end', true);

        if ($start && $end) {
            $items[] = [
                'booking_id'   => '',
                'date_from'    => date('Y-m-d', strtotime($start)),
                'date_to'      => date('Y-m-d', strtotime($end)),
                'guests_total' => 1,
            ];
        }
    }

    return $items;
}

function teranga_ba_log($message) {
    if (get_option('teranga_ba_log_enabled') === '1') {
        error_log('[Teranga BA Sync] ' . $message);
    }
}
