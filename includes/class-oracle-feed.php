<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Oracle Feed — AJAX Infinite Scroll  (Module 3)
 *  Digital Tabernacle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Handles:
 *   • AJAX endpoint for paginated scripture loading (wp_ajax / no_priv)
 *   • REST API endpoint for /digital-tabernacle/v1/scriptures
 *   • Shortcode [oracle_feed] for frontend rendering
 * ═══════════════════════════════════════════════════════════════════════════
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class DT_Oracle_Feed {

    public static function init() {
        add_action( 'wp_ajax_dt_load_scriptures',        array( __CLASS__, 'ajax_load' ) );
        add_action( 'wp_ajax_nopriv_dt_load_scriptures', array( __CLASS__, 'ajax_load' ) );

        add_shortcode( 'oracle_feed', array( __CLASS__, 'shortcode' ) );
    }

    /* ══════════════════════════════════════════════════════════════════
       SHORTCODE: [oracle_feed count="10" visualizer="true"]
       ══════════════════════════════════════════════════════════════════ */

    public static function shortcode( $atts ) {
        $a = shortcode_atts( array(
            'count'      => 10,
            'visualizer' => 'true',
        ), $atts, 'oracle_feed' );

        ob_start();
        ?>
        <div id="oracle-feed"
             class="dt-oracle-feed"
             data-per-page="<?php echo absint( $a['count'] ); ?>"
             data-visualizer="<?php echo esc_attr( $a['visualizer'] ); ?>">

            <!-- ── Infinite Scroll Container ── -->
            <div class="oracle-scroll-container">
                <?php echo self::render_page( 1, absint( $a['count'] ) ); ?>
            </div>

            <!-- ── Loading sentinel (Intersection Observer) ── -->
            <div class="oracle-scroll-sentinel" aria-hidden="true">
                <div class="oracle-loading-sigil">
                    <span class="sigil-pulse">☥</span>
                    <span class="sigil-text">Channeling the Oracle…</span>
                </div>
            </div>

            <!-- ── Audio-Reactive Visualizer Canvas ── -->
            <?php if ( $a['visualizer'] === 'true' ) : ?>
            <canvas id="oracle-visualizer"
                    class="dt-oracle-visualizer"
                    width="800" height="200"></canvas>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /* ── Render a page of scripture cards ──────────────────────────── */

    public static function render_page( $page, $per_page ) {
        $query = new WP_Query( array(
            'post_type'      => DT_Scripture_CPT::POST_TYPE,
            'posts_per_page' => $per_page,
            'paged'          => $page,
            'orderby'        => 'date',
            'order'          => 'DESC',
            'post_status'    => 'publish',
        ) );

        if ( ! $query->have_posts() ) {
            return '<div class="oracle-end">— End of the Scrolls —</div>';
        }

        $html = '';
        while ( $query->have_posts() ) {
            $query->the_post();
            $html .= self::render_card( get_the_ID() );
        }
        wp_reset_postdata();
        return $html;
    }

    /* ── Single scripture card ────────────────────────────────────── */

    public static function render_card( $post_id ) {
        $headline  = get_post_meta( $post_id, 'news_headline',    true );
        $track_url = get_post_meta( $post_id, 'dj_track_url',     true );
        $bounty    = get_post_meta( $post_id, 'token_bounty',     true );
        $song_id   = get_post_meta( $post_id, 'on_chain_song_id', true );
        $thumb     = get_the_post_thumbnail_url( $post_id, 'medium' );
        $excerpt   = get_the_excerpt( $post_id );
        $date      = get_the_date( 'M j, Y', $post_id );
        $link      = get_permalink( $post_id );

        ob_start();
        ?>
        <article class="oracle-card"
                 data-song-id="<?php echo esc_attr( $song_id ); ?>"
                 data-track-url="<?php echo esc_url( $track_url ); ?>"
                 data-bounty="<?php echo esc_attr( $bounty ); ?>">

            <?php if ( $thumb ) : ?>
            <div class="oracle-card__image">
                <img src="<?php echo esc_url( $thumb ); ?>"
                     alt="<?php echo esc_attr( get_the_title( $post_id ) ); ?>"
                     loading="lazy" />
                <div class="oracle-card__glow"></div>
            </div>
            <?php endif; ?>

            <div class="oracle-card__body">
                <?php if ( $headline ) : ?>
                <div class="oracle-card__headline">
                    <span class="headline-prefix">⚡ BREAKING:</span>
                    <?php echo esc_html( $headline ); ?>
                </div>
                <?php endif; ?>

                <h3 class="oracle-card__title">
                    <a href="<?php echo esc_url( $link ); ?>">
                        <?php echo esc_html( get_the_title( $post_id ) ); ?>
                    </a>
                </h3>

                <?php if ( $excerpt ) : ?>
                <p class="oracle-card__excerpt"><?php echo esc_html( $excerpt ); ?></p>
                <?php endif; ?>

                <div class="oracle-card__meta">
                    <time class="oracle-card__date">📅 <?php echo esc_html( $date ); ?></time>

                    <?php if ( $bounty ) : ?>
                    <span class="oracle-card__bounty">
                        💰 <?php echo esc_html( $bounty ); ?> $PROPHET
                    </span>
                    <?php endif; ?>
                </div>

                <div class="oracle-card__actions">
                    <?php if ( $track_url ) : ?>
                    <button class="dt-play-btn oracle-card__play"
                            data-track="<?php echo esc_url( $track_url ); ?>"
                            data-song-id="<?php echo esc_attr( $song_id ); ?>">
                        ▸ Listen
                    </button>
                    <?php endif; ?>

                    <button class="dt-harvest-btn oracle-card__harvest"
                            data-song-id="<?php echo esc_attr( $song_id ); ?>"
                            disabled>
                        ☥ Harvest Tokens
                    </button>

                    <button class="dt-share-btn oracle-card__share"
                            data-title="<?php echo esc_attr( get_the_title( $post_id ) ); ?>"
                            data-url="<?php echo esc_url( $link ); ?>"
                            data-excerpt="<?php echo esc_attr( $excerpt ); ?>">
                        📣 Evangelize
                    </button>
                </div>
            </div>
        </article>
        <?php
        return ob_get_clean();
    }

    /* ══════════════════════════════════════════════════════════════════
       AJAX: Load more scriptures
       ══════════════════════════════════════════════════════════════════ */

    public static function ajax_load() {
        check_ajax_referer( 'dt_oracle_feed', 'nonce' );

        $page     = absint( $_POST['page'] ?? 1 );
        $per_page = absint( $_POST['per_page'] ?? 10 );

        $html = self::render_page( $page, $per_page );

        wp_send_json_success( array(
            'html'    => $html,
            'hasMore' => ! empty( trim( strip_tags( $html ) ) ) && strpos( $html, 'oracle-end' ) === false,
        ) );
    }

    /* ══════════════════════════════════════════════════════════════════
       REST API: GET /digital-tabernacle/v1/scriptures
       ══════════════════════════════════════════════════════════════════ */

    public static function rest_scriptures( $request ) {
        $page     = $request->get_param( 'page' )     ?: 1;
        $per_page = $request->get_param( 'per_page' ) ?: 10;

        $query = new WP_Query( array(
            'post_type'      => DT_Scripture_CPT::POST_TYPE,
            'posts_per_page' => $per_page,
            'paged'          => $page,
            'orderby'        => 'date',
            'order'          => 'DESC',
            'post_status'    => 'publish',
        ) );

        $items = array();
        while ( $query->have_posts() ) {
            $query->the_post();
            $id = get_the_ID();
            $items[] = array(
                'id'             => $id,
                'title'          => get_the_title(),
                'excerpt'        => get_the_excerpt(),
                'date'           => get_the_date( 'c' ),
                'link'           => get_permalink(),
                'thumbnail'      => get_the_post_thumbnail_url( $id, 'medium' ),
                'news_headline'  => get_post_meta( $id, 'news_headline',   true ),
                'dj_track_url'   => get_post_meta( $id, 'dj_track_url',    true ),
                'token_bounty'   => get_post_meta( $id, 'token_bounty',    true ),
                'on_chain_song_id' => get_post_meta( $id, 'on_chain_song_id', true ),
            );
        }
        wp_reset_postdata();

        return new WP_REST_Response( array(
            'scriptures' => $items,
            'total'      => $query->found_posts,
            'pages'      => $query->max_num_pages,
            'page'       => (int) $page,
        ), 200 );
    }
}

DT_Oracle_Feed::init();
