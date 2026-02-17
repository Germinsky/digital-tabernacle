<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Scripture Custom Post Type — Module 3
 *  Digital Tabernacle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Registers the "scriptures" CPT (Prophecies / Oracle Newswire).
 *  Meta fields: news_headline, dj_track_url, token_bounty, prophecy_date
 * ═══════════════════════════════════════════════════════════════════════════
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class DT_Scripture_CPT {

    const POST_TYPE = 'scriptures';

    /**
     * Register CPT + meta boxes
     */
    public static function register() {
        add_action( 'init',           array( __CLASS__, 'register_post_type' ) );
        add_action( 'add_meta_boxes', array( __CLASS__, 'add_meta_boxes' ) );
        add_action( 'save_post',      array( __CLASS__, 'save_meta' ) );
    }

    /* ── CPT registration ──────────────────────────────────────────── */

    public static function register_post_type() {
        $labels = array(
            'name'               => 'Scriptures',
            'singular_name'      => 'Scripture',
            'menu_name'          => '📜 Scriptures',
            'add_new'            => 'New Prophecy',
            'add_new_item'       => 'Add New Scripture',
            'edit_item'          => 'Edit Scripture',
            'all_items'          => 'All Scriptures',
            'search_items'       => 'Search Scriptures',
            'not_found'          => 'No scriptures found',
            'not_found_in_trash' => 'No scriptures in the void',
        );

        register_post_type( self::POST_TYPE, array(
            'labels'              => $labels,
            'public'              => true,
            'has_archive'         => true,
            'rewrite'             => array( 'slug' => 'scriptures' ),
            'menu_icon'           => 'dashicons-book-alt',
            'supports'            => array( 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ),
            'show_in_rest'        => true,         // Gutenberg + REST API
            'rest_base'           => 'scriptures',
            'taxonomies'          => array( 'category', 'post_tag' ),
            'capability_type'     => 'post',
            'map_meta_cap'        => true,
        ) );

        // Register custom taxonomy: "Book" (e.g. Genesis, Revelation…)
        register_taxonomy( 'scripture_book', self::POST_TYPE, array(
            'labels' => array(
                'name'          => 'Books',
                'singular_name' => 'Book',
                'menu_name'     => 'Scripture Books',
            ),
            'hierarchical' => true,
            'show_in_rest' => true,
            'rewrite'      => array( 'slug' => 'book' ),
        ) );
    }

    /* ── Meta boxes ────────────────────────────────────────────────── */

    public static function add_meta_boxes() {
        add_meta_box(
            'dt_scripture_meta',
            '⛧ Oracle Metadata',
            array( __CLASS__, 'render_meta_box' ),
            self::POST_TYPE,
            'normal',
            'high'
        );
    }

    public static function render_meta_box( $post ) {
        wp_nonce_field( 'dt_scripture_meta', 'dt_scripture_nonce' );

        $headline    = get_post_meta( $post->ID, 'news_headline',  true );
        $track_url   = get_post_meta( $post->ID, 'dj_track_url',   true );
        $bounty      = get_post_meta( $post->ID, 'token_bounty',   true );
        $prophecy_dt = get_post_meta( $post->ID, 'prophecy_date',  true );
        $song_id     = get_post_meta( $post->ID, 'on_chain_song_id', true );
        ?>
        <style>
            .dt-meta-field { margin-bottom: 14px; }
            .dt-meta-field label { display: block; font-weight: 600; margin-bottom: 4px; color: #d4af37; }
            .dt-meta-field input, .dt-meta-field textarea { width: 100%; padding: 6px; }
        </style>

        <div class="dt-meta-field">
            <label>📰 News Headline</label>
            <input type="text" name="news_headline" value="<?php echo esc_attr( $headline ); ?>"
                   placeholder="Breaking: Oracle reveals new frequency…" />
        </div>

        <div class="dt-meta-field">
            <label>🎵 DJ Track URL</label>
            <input type="url" name="dj_track_url" value="<?php echo esc_url( $track_url ); ?>"
                   placeholder="https://digitalprophets.blog/wp-content/uploads/track.mp3" />
        </div>

        <div class="dt-meta-field">
            <label>💰 Token Bounty (reward amount)</label>
            <input type="number" step="0.01" name="token_bounty" value="<?php echo esc_attr( $bounty ); ?>"
                   placeholder="10" />
        </div>

        <div class="dt-meta-field">
            <label>🔗 On-Chain Song ID</label>
            <input type="number" name="on_chain_song_id" value="<?php echo esc_attr( $song_id ); ?>"
                   placeholder="1" />
        </div>

        <div class="dt-meta-field">
            <label>📅 Prophecy Date</label>
            <input type="date" name="prophecy_date" value="<?php echo esc_attr( $prophecy_dt ); ?>" />
        </div>
        <?php
    }

    /* ── Save meta ─────────────────────────────────────────────────── */

    public static function save_meta( $post_id ) {
        if ( ! isset( $_POST['dt_scripture_nonce'] ) ) return;
        if ( ! wp_verify_nonce( $_POST['dt_scripture_nonce'], 'dt_scripture_meta' ) ) return;
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;

        $fields = array(
            'news_headline'    => 'sanitize_text_field',
            'dj_track_url'     => 'esc_url_raw',
            'token_bounty'     => 'sanitize_text_field',
            'prophecy_date'    => 'sanitize_text_field',
            'on_chain_song_id' => 'absint',
        );

        foreach ( $fields as $key => $sanitize ) {
            if ( isset( $_POST[ $key ] ) ) {
                update_post_meta( $post_id, $key, call_user_func( $sanitize, $_POST[ $key ] ) );
            }
        }
    }

    /* ── REST API field exposure ───────────────────────────────────── */

    public static function register_rest_fields() {
        $meta_keys = array( 'news_headline', 'dj_track_url', 'token_bounty', 'prophecy_date', 'on_chain_song_id' );

        foreach ( $meta_keys as $key ) {
            register_post_meta( self::POST_TYPE, $key, array(
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => '__return_true',
            ) );
        }
    }
}

// Expose meta in REST
add_action( 'init', array( 'DT_Scripture_CPT', 'register_rest_fields' ) );
