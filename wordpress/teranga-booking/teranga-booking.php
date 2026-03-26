<?php
/**
 * Plugin Name: Teranga Booking — Réservation avec FedaPay
 * Description: Formulaire de réservation hôtelière connecté à Teranga PMS avec paiement FedaPay.
 * Version: 1.0.0
 * Author: Teranga PMS
 * Text Domain: teranga-booking
 */

if (!defined('ABSPATH')) exit;

// =============================================================================
// SETTINGS PAGE
// =============================================================================

add_action('admin_menu', function () {
    add_options_page(
        'Teranga Booking',
        'Teranga Booking',
        'manage_options',
        'teranga-booking',
        'teranga_booking_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('teranga_booking', 'teranga_api_url');
    register_setting('teranga_booking', 'teranga_api_key');
    register_setting('teranga_booking', 'teranga_fedapay_public_key');
    register_setting('teranga_booking', 'teranga_fedapay_secret_key');
    register_setting('teranga_booking', 'teranga_fedapay_env'); // sandbox or live
    register_setting('teranga_booking', 'teranga_success_page');
});

function teranga_booking_settings_page() {
    ?>
    <div class="wrap">
        <h1>Teranga Booking — Configuration</h1>
        <form method="post" action="options.php">
            <?php settings_fields('teranga_booking'); ?>
            <table class="form-table">
                <tr>
                    <th>URL API Teranga PMS</th>
                    <td><input type="url" name="teranga_api_url" value="<?php echo esc_attr(get_option('teranga_api_url')); ?>" class="regular-text" placeholder="https://api.votre-hotel.teranga.app" /></td>
                </tr>
                <tr>
                    <th>Clé API Teranga</th>
                    <td><input type="text" name="teranga_api_key" value="<?php echo esc_attr(get_option('teranga_api_key')); ?>" class="regular-text" placeholder="tpms_..." /></td>
                </tr>
                <tr>
                    <th>Clé publique FedaPay</th>
                    <td><input type="text" name="teranga_fedapay_public_key" value="<?php echo esc_attr(get_option('teranga_fedapay_public_key')); ?>" class="regular-text" placeholder="pk_live_..." /></td>
                </tr>
                <tr>
                    <th>Clé secrète FedaPay</th>
                    <td><input type="password" name="teranga_fedapay_secret_key" value="<?php echo esc_attr(get_option('teranga_fedapay_secret_key')); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th>Environnement FedaPay</th>
                    <td>
                        <select name="teranga_fedapay_env">
                            <option value="sandbox" <?php selected(get_option('teranga_fedapay_env', 'sandbox'), 'sandbox'); ?>>Sandbox (test)</option>
                            <option value="live" <?php selected(get_option('teranga_fedapay_env'), 'live'); ?>>Live (production)</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th>Page de confirmation</th>
                    <td><input type="text" name="teranga_success_page" value="<?php echo esc_attr(get_option('teranga_success_page', '/reservation-confirmee')); ?>" class="regular-text" placeholder="/reservation-confirmee" /></td>
                </tr>
            </table>
            <?php submit_button('Enregistrer'); ?>
        </form>

        <hr />
        <h2>Webhook FedaPay</h2>
        <p>Configurez cette URL comme webhook dans votre <a href="https://app.fedapay.com" target="_blank">dashboard FedaPay</a> :</p>
        <code><?php echo esc_html(get_option('teranga_api_url', 'https://api.votre-hotel.teranga.app')); ?>/api/webhooks/fedapay</code>

        <hr />
        <h2>Shortcode</h2>
        <p>Utilisez le shortcode <code>[teranga_booking]</code> dans une page pour afficher le formulaire de réservation.</p>
    </div>
    <?php
}

// =============================================================================
// ENQUEUE SCRIPTS
// =============================================================================

add_action('wp_enqueue_scripts', function () {
    if (!has_shortcode(get_post()->post_content ?? '', 'teranga_booking')) return;

    $fedapay_env = get_option('teranga_fedapay_env', 'sandbox');
    wp_enqueue_script('fedapay-checkout', 'https://cdn.fedapay.com/checkout.js?v=1.1.7', [], null, true);

    wp_enqueue_script(
        'teranga-booking',
        plugin_dir_url(__FILE__) . 'teranga-booking.js',
        ['fedapay-checkout'],
        '1.0.0',
        true
    );

    wp_localize_script('teranga-booking', 'TerangaBooking', [
        'ajaxUrl'       => admin_url('admin-ajax.php'),
        'nonce'         => wp_create_nonce('teranga_booking'),
        'fedapayKey'    => get_option('teranga_fedapay_public_key', ''),
        'fedapayEnv'    => $fedapay_env,
        'successPage'   => get_option('teranga_success_page', '/reservation-confirmee'),
    ]);

    wp_enqueue_style('teranga-booking', plugin_dir_url(__FILE__) . 'teranga-booking.css', [], '1.0.0');
});

// =============================================================================
// SHORTCODE — Booking Form
// =============================================================================

add_shortcode('teranga_booking', function () {
    ob_start();
    ?>
    <div id="teranga-booking-form" class="teranga-booking">
        <h3>Réserver une chambre</h3>
        <form id="teranga-form">
            <div class="teranga-row">
                <div class="teranga-field">
                    <label for="tb-guest">Nom complet *</label>
                    <input type="text" id="tb-guest" name="guest" required />
                </div>
            </div>
            <div class="teranga-row">
                <div class="teranga-field">
                    <label for="tb-email">Email</label>
                    <input type="email" id="tb-email" name="guestEmail" />
                </div>
                <div class="teranga-field">
                    <label for="tb-phone">Téléphone</label>
                    <input type="tel" id="tb-phone" name="guestPhone" />
                </div>
            </div>
            <div class="teranga-row">
                <div class="teranga-field">
                    <label for="tb-room">Chambre (numéro) *</label>
                    <input type="text" id="tb-room" name="room" required placeholder="101" />
                </div>
                <div class="teranga-field">
                    <label for="tb-guests">Nombre de personnes</label>
                    <input type="number" id="tb-guests" name="numberOfGuests" value="1" min="1" max="10" />
                </div>
            </div>
            <div class="teranga-row">
                <div class="teranga-field">
                    <label for="tb-checkin">Arrivée *</label>
                    <input type="date" id="tb-checkin" name="start" required />
                </div>
                <div class="teranga-field">
                    <label for="tb-checkout">Départ *</label>
                    <input type="date" id="tb-checkout" name="end" required />
                </div>
            </div>
            <div class="teranga-row">
                <button type="submit" class="teranga-btn" id="teranga-submit">
                    Payer et réserver avec FedaPay
                </button>
            </div>
            <div id="teranga-message" class="teranga-message" style="display:none;"></div>
        </form>
    </div>
    <?php
    return ob_get_clean();
});

// =============================================================================
// AJAX — Create booking via Teranga API
// =============================================================================

add_action('wp_ajax_teranga_create_booking', 'teranga_create_booking');
add_action('wp_ajax_nopriv_teranga_create_booking', 'teranga_create_booking');

function teranga_create_booking() {
    check_ajax_referer('teranga_booking', 'nonce');

    $api_url = rtrim(get_option('teranga_api_url', ''), '/');
    $api_key = get_option('teranga_api_key', '');

    if (empty($api_url) || empty($api_key)) {
        wp_send_json_error(['message' => 'Plugin non configuré. Contactez l\'administrateur.']);
    }

    $data = [
        'room'              => sanitize_text_field($_POST['room'] ?? ''),
        'start'             => sanitize_text_field($_POST['start'] ?? ''),
        'end'               => sanitize_text_field($_POST['end'] ?? ''),
        'guest'             => sanitize_text_field($_POST['guest'] ?? ''),
        'guestEmail'        => sanitize_email($_POST['guestEmail'] ?? ''),
        'guestPhone'        => sanitize_text_field($_POST['guestPhone'] ?? ''),
        'numberOfGuests'    => intval($_POST['numberOfGuests'] ?? 1),
        'source'            => 'CHANNEL_MANAGER',
        'paymentMethod'     => 'FEDAPAY',
        'fedapayTransactionId' => sanitize_text_field($_POST['fedapayTransactionId'] ?? ''),
        'externalRef'       => sanitize_text_field($_POST['externalRef'] ?? ''),
    ];

    // Remove empty optional fields
    $data = array_filter($data, function ($v) { return $v !== '' && $v !== 0; });

    $response = wp_remote_post("$api_url/api/external-bookings", [
        'headers' => [
            'Content-Type' => 'application/json',
            'X-Api-Key'    => $api_key,
        ],
        'body'    => wp_json_encode($data),
        'timeout' => 30,
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error(['message' => 'Erreur de connexion au serveur de réservation.']);
    }

    $status = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($status === 201 && !empty($body['success'])) {
        wp_send_json_success([
            'message'       => 'Réservation confirmée !',
            'reservationId' => $body['data']['id'] ?? '',
            'invoiceId'     => $body['data']['invoiceId'] ?? '',
            'paymentStatus' => $body['data']['paymentStatus'] ?? 'PENDING',
        ]);
    } else {
        $error = $body['error'] ?? $body['message'] ?? 'Erreur lors de la réservation.';
        wp_send_json_error(['message' => $error]);
    }
}
