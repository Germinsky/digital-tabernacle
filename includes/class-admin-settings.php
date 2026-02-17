<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Admin Settings — Digital Tabernacle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  WordPress admin page under "⛧ Tabernacle" for configuring:
 *   • ProphetCore contract address
 *   • Base RPC URL
 *   • Daily Prophecy NFT address
 *   • Evangelist handle
 *   • Base reward amount
 * ═══════════════════════════════════════════════════════════════════════════
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class DT_Admin_Settings {

    const OPTION_KEY = 'dt_options';
    const PAGE_SLUG  = 'digital-tabernacle';

    public static function init() {
        add_action( 'admin_menu',    array( __CLASS__, 'add_menu' ) );
        add_action( 'admin_init',    array( __CLASS__, 'register_settings' ) );
    }

    /* ── Admin menu ────────────────────────────────────────────────── */

    public static function add_menu() {
        add_menu_page(
            'Digital Tabernacle',             // Page title
            '⛧ Tabernacle',                  // Menu title
            'manage_options',                 // Capability
            self::PAGE_SLUG,                  // Slug
            array( __CLASS__, 'render_page' ),
            'dashicons-book-alt',             // Icon
            30                                // Position
        );
    }

    /* ── Register settings ─────────────────────────────────────────── */

    public static function register_settings() {
        register_setting( self::PAGE_SLUG, self::OPTION_KEY, array(
            'sanitize_callback' => array( __CLASS__, 'sanitize' ),
        ) );

        // Section: Web3
        add_settings_section(
            'dt_web3_section',
            '🔗 Web3 / Base L2 Configuration',
            function () {
                echo '<p style="color:#888;">Configure the ProphetCore smart contract and Base Network connection.</p>';
            },
            self::PAGE_SLUG
        );

        self::add_field( 'prophet_core_address', 'ProphetCore Contract Address', 'dt_web3_section',
            'The deployed ProphetCore.sol address on Base (0x…)' );

        self::add_field( 'base_rpc_url', 'Base RPC URL', 'dt_web3_section',
            'https://mainnet.base.org (or your Alchemy/Infura endpoint)' );

        self::add_field( 'daily_prophecy_addr', 'Daily Prophecy NFT Address', 'dt_web3_section',
            'ERC-1155 contract for daily prophecy mints' );

        // Section: Social
        add_settings_section(
            'dt_social_section',
            '📣 Evangelist / Social',
            function () {
                echo '<p style="color:#888;">Configure social sharing and Farcaster integration.</p>';
            },
            self::PAGE_SLUG
        );

        self::add_field( 'evangelist_handle', 'Twitter/X Handle', 'dt_social_section',
            '@DjDigitalProfitz' );
    }

    /* ── Helper: add a text field ──────────────────────────────────── */

    private static function add_field( $key, $label, $section, $placeholder = '' ) {
        add_settings_field(
            'dt_' . $key,
            $label,
            function () use ( $key, $placeholder ) {
                $opts = get_option( self::OPTION_KEY, array() );
                $val  = $opts[ $key ] ?? '';
                printf(
                    '<input type="text" name="%s[%s]" value="%s" placeholder="%s"
                            style="width:100%%;max-width:500px;padding:6px;font-family:monospace;" />',
                    self::OPTION_KEY,
                    esc_attr( $key ),
                    esc_attr( $val ),
                    esc_attr( $placeholder )
                );
            },
            self::PAGE_SLUG,
            $section
        );
    }

    /* ── Sanitize ──────────────────────────────────────────────────── */

    public static function sanitize( $input ) {
        $clean = array();

        $clean['prophet_core_address'] = sanitize_text_field( $input['prophet_core_address'] ?? '' );
        $clean['base_rpc_url']         = esc_url_raw( $input['base_rpc_url'] ?? 'https://mainnet.base.org' );
        $clean['daily_prophecy_addr']  = sanitize_text_field( $input['daily_prophecy_addr'] ?? '' );
        $clean['evangelist_handle']    = sanitize_text_field( $input['evangelist_handle'] ?? '@DjDigitalProfitz' );

        return $clean;
    }

    /* ── Render page ───────────────────────────────────────────────── */

    public static function render_page() {
        if ( ! current_user_can( 'manage_options' ) ) return;
        ?>
        <div class="wrap">
            <h1 style="display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:1.8em;">⛧</span>
                Digital Tabernacle — The Grand Architect
            </h1>
            <p style="color:#888;font-family:monospace;font-size:13px;">
                Configure the 4 modules: Proof-of-Listening, ProphetCore Contract, Oracle Feed, Evangelist Protocol
            </p>

            <form method="post" action="options.php">
                <?php
                settings_fields( self::PAGE_SLUG );
                do_settings_sections( self::PAGE_SLUG );
                submit_button( 'Save Tabernacle Settings' );
                ?>
            </form>

            <hr style="border-color:#333;margin:2rem 0;" />

            <h2>📜 Shortcodes</h2>
            <table class="widefat" style="max-width:700px;">
                <thead>
                    <tr><th>Shortcode</th><th>Description</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>[oracle_feed count="10" visualizer="true"]</code></td>
                        <td>Infinite-scroll Oracle Feed with audio-reactive visualizer</td>
                    </tr>
                </tbody>
            </table>

            <hr style="border-color:#333;margin:2rem 0;" />

            <h2>🏗️ Module Status</h2>
            <table class="widefat" style="max-width:700px;">
                <thead>
                    <tr><th>Module</th><th>Status</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1. Proof of Listening (PoL)</td>
                        <td>✅ Active — hooks into Sonaar Audio Player</td>
                    </tr>
                    <tr>
                        <td>2. ProphetCore Smart Contract</td>
                        <td>⚙️ Deploy on Base L2 → enter address above</td>
                    </tr>
                    <tr>
                        <td>3. Oracle Feed + Audio Visualizer</td>
                        <td>✅ Active — use <code>[oracle_feed]</code> shortcode</td>
                    </tr>
                    <tr>
                        <td>4. Viral Evangelist + Farcaster Frames</td>
                        <td>✅ Active — auto-injects on Scripture pages</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <?php
    }
}

DT_Admin_Settings::init();
