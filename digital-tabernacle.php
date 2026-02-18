<?php
/**
 * Plugin Name: Digital Tabernacle — The Grand Architect
 * Plugin URI:  https://digitalprophets.blog
 * Description: Cyber-Cathedral ecosystem: Proof-of-Listening rewards, ProphetCore Web3 streak mechanics on Base L2, Infinite Scroll Oracle Feed, Farcaster Frames, and audio-reactive Three.js visualizers. Built for DjDigitalProfitz.
 * Version:     1.0.0
 * Author:      DjDigitalProfitz × Digital Prophets
 * Author URI:  https://digitalprophets.blog
 * License:     MIT
 * Text Domain: digital-tabernacle
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

define( 'DT_VERSION',    '1.0.0' );
define( 'DT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'DT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'DT_BASE_CHAIN', 8453 );

/* ═══════════════════════════════════════════════════════════════════════════
   INCLUDES
   ═══════════════════════════════════════════════════════════════════════════ */

require_once DT_PLUGIN_DIR . 'includes/class-scripture-cpt.php';
require_once DT_PLUGIN_DIR . 'includes/class-oracle-feed.php';
require_once DT_PLUGIN_DIR . 'includes/class-farcaster-frame.php';
require_once DT_PLUGIN_DIR . 'includes/class-admin-settings.php';

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════════════════ */

add_action( 'init', 'dt_boot' );

function dt_boot() {
    DT_Scripture_CPT::register();
    DT_Oracle_Feed::init();
    DT_Farcaster_Frame::init();
}

// Admin settings need admin_menu + admin_init hooks — call early
DT_Admin_Settings::init();

add_action( 'wp_enqueue_scripts', 'dt_enqueue_frontend' );

function dt_enqueue_frontend() {
    $opts = dt_get_options();

    // ── CSS ───────────────────────────────────────────────────────────
    wp_enqueue_style(
        'digital-tabernacle',
        DT_PLUGIN_URL . 'assets/css/tabernacle.css',
        array(),
        DT_VERSION
    );

    // ── Three.js (CDN — UMD global build, sets window.THREE) ──────────
    wp_enqueue_script(
        'three-js',
        'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.min.js',
        array(),
        '0.170.0',
        true
    );

    // ── Proof of Listening (Module 1) ─────────────────────────────────
    wp_enqueue_script(
        'dt-proof-of-listening',
        DT_PLUGIN_URL . 'assets/js/proof-of-listening.js',
        array(),
        DT_VERSION,
        true
    );

    wp_localize_script( 'dt-proof-of-listening', 'TabernaclePoL', array(
        'propheticThreshold' => 0.9,
        'cheatWindow'        => 5,   // seconds — skip detection
        'contractAddress'    => $opts['prophet_core_address'],
        'chainId'            => DT_BASE_CHAIN,
    ) );

    // ── Oracle Feed infinite scroll (Module 3) ────────────────────────
    wp_enqueue_script(
        'dt-oracle-feed',
        DT_PLUGIN_URL . 'assets/js/oracle-feed.js',
        array( 'three-js' ),
        DT_VERSION,
        true
    );

    wp_localize_script( 'dt-oracle-feed', 'OracleFeed', array(
        'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'dt_oracle_feed' ),
        'restUrl'  => rest_url( 'digital-tabernacle/v1' ),
        'restNonce'=> wp_create_nonce( 'wp_rest' ),
    ) );

    // ── Evangelist — social sharing (Module 4) ────────────────────────
    wp_enqueue_script(
        'dt-evangelist',
        DT_PLUGIN_URL . 'assets/js/evangelist.js',
        array(),
        DT_VERSION,
        true
    );

    // ── Web3 Tabernacle — ethers.js bridge (Modules 1+2) ─────────────
    //    ethers v6 only ships ES modules — use v5 UMD for WP compat
    wp_enqueue_script(
        'ethers-js',
        'https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js',
        array(),
        '5.7.2',
        true
    );

    wp_enqueue_script(
        'dt-web3-tabernacle',
        DT_PLUGIN_URL . 'assets/js/web3-tabernacle.js',
        array( 'ethers-js', 'dt-proof-of-listening' ),
        DT_VERSION,
        true
    );

    wp_localize_script( 'dt-web3-tabernacle', 'TabernacleWeb3', array(
        'prophetCoreAddress' => $opts['prophet_core_address'],
        'prophetCoreABI'     => dt_get_prophet_core_abi(),
        'baseChainId'        => DT_BASE_CHAIN,
        'baseRpcUrl'         => $opts['base_rpc_url'] ?: 'https://mainnet.base.org',
    ) );
}

/* ─── REST API routes ──────────────────────────────────────────────────── */

add_action( 'rest_api_init', function () {
    register_rest_route( 'digital-tabernacle/v1', '/scriptures', array(
        'methods'  => 'GET',
        'callback' => array( 'DT_Oracle_Feed', 'rest_scriptures' ),
        'permission_callback' => '__return_true',
        'args' => array(
            'page'     => array( 'default' => 1, 'sanitize_callback' => 'absint' ),
            'per_page' => array( 'default' => 10, 'sanitize_callback' => 'absint' ),
        ),
    ) );
} );

/* ─── Helper: get plugin options ───────────────────────────────────────── */

function dt_get_options() {
    return wp_parse_args( get_option( 'dt_options', array() ), array(
        'prophet_core_address' => '0x0000000000000000000000000000000000000000',
        'base_rpc_url'         => 'https://mainnet.base.org',
        'daily_prophecy_addr'  => '0x0000000000000000000000000000000000000000',
        'evangelist_handle'    => '@DjDigitalProfitz',
    ) );
}

/* ─── Helper: ABI for ProphetCore (minimal) ────────────────────────────── */

function dt_get_prophet_core_abi() {
    return json_encode( array(
        array(
            'name'            => 'harvestTokens',
            'type'            => 'function',
            'stateMutability' => 'nonpayable',
            'inputs'          => array(
                array( 'name' => 'songId',    'type' => 'uint256' ),
                array( 'name' => 'proofHash', 'type' => 'bytes32' ),
            ),
            'outputs'         => array(),
        ),
        array(
            'name'            => 'mintDailyProphecy',
            'type'            => 'function',
            'stateMutability' => 'payable',
            'inputs'          => array(
                array( 'name' => 'songId', 'type' => 'uint256' ),
            ),
            'outputs'         => array(
                array( 'name' => 'tokenId', 'type' => 'uint256' ),
            ),
        ),
        array(
            'name'            => 'getStreakMultiplier',
            'type'            => 'function',
            'stateMutability' => 'view',
            'inputs'          => array(
                array( 'name' => 'disciple', 'type' => 'address' ),
            ),
            'outputs'         => array(
                array( 'name' => '', 'type' => 'uint256' ),
            ),
        ),
        array(
            'name'            => 'currentStreak',
            'type'            => 'function',
            'stateMutability' => 'view',
            'inputs'          => array(
                array( 'name' => '', 'type' => 'address' ),
            ),
            'outputs'         => array(
                array( 'name' => '', 'type' => 'uint256' ),
            ),
        ),
        array(
            'name'            => 'lastListenTimestamp',
            'type'            => 'function',
            'stateMutability' => 'view',
            'inputs'          => array(
                array( 'name' => '', 'type' => 'address' ),
            ),
            'outputs'         => array(
                array( 'name' => '', 'type' => 'uint256' ),
            ),
        ),
        array(
            'name'            => 'dailyProphecy',
            'type'            => 'function',
            'stateMutability' => 'view',
            'inputs'          => array(),
            'outputs'         => array(
                array( 'name' => 'songId',   'type' => 'uint256' ),
                array( 'name' => 'expiresAt','type' => 'uint256' ),
                array( 'name' => 'totalMinted','type' => 'uint256' ),
            ),
        ),
    ) );
}
