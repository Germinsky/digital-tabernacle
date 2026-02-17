<?php
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Farcaster Frame — Module 4
 *  Digital Tabernacle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Injects Farcaster Frame <meta> tags on Scripture single pages.
 *  Buttons: "Listen (Stream)" + "Harvest (Claim)"
 *
 *  Farcaster Frame spec:
 *    fc:frame             → vNext
 *    fc:frame:image       → featured image
 *    fc:frame:button:1    → Listen (link to track)
 *    fc:frame:button:2    → Harvest (link to mint/claim page)
 *    fc:frame:post_url    → endpoint for frame actions
 * ═══════════════════════════════════════════════════════════════════════════
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class DT_Farcaster_Frame {

    public static function init() {
        add_action( 'wp_head', array( __CLASS__, 'inject_frame_meta' ), 1 );
    }

    /**
     * Inject Farcaster Frame meta tags on single scripture posts
     */
    public static function inject_frame_meta() {
        if ( ! is_singular( DT_Scripture_CPT::POST_TYPE ) ) return;

        global $post;
        $opts = dt_get_options();

        $title      = get_the_title( $post->ID );
        $headline   = get_post_meta( $post->ID, 'news_headline',    true ) ?: $title;
        $track_url  = get_post_meta( $post->ID, 'dj_track_url',     true );
        $song_id    = get_post_meta( $post->ID, 'on_chain_song_id', true );
        $thumb      = get_the_post_thumbnail_url( $post->ID, 'large' );
        $permalink  = get_permalink( $post->ID );
        $site_url   = home_url();

        // Fallback image
        if ( ! $thumb ) {
            $thumb = DT_PLUGIN_URL . 'assets/images/tabernacle-frame-default.png';
        }

        // Harvest URL → site + query param for the contract interaction page
        $harvest_url = add_query_arg( array(
            'action'  => 'harvest',
            'song_id' => $song_id,
        ), $site_url );

        ?>
<!-- ═══ Farcaster Frame — Digital Tabernacle ═══ -->
<meta property="fc:frame"                content="vNext" />
<meta property="fc:frame:image"          content="<?php echo esc_url( $thumb ); ?>" />
<meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
<meta property="fc:frame:post_url"       content="<?php echo esc_url( rest_url( 'digital-tabernacle/v1/frame-action' ) ); ?>" />

<!-- Button 1: Listen (Stream) -->
<meta property="fc:frame:button:1"       content="▸ Listen (Stream)" />
<meta property="fc:frame:button:1:action" content="link" />
<meta property="fc:frame:button:1:target" content="<?php echo esc_url( $track_url ?: $permalink ); ?>" />

<!-- Button 2: Harvest (Claim) -->
<meta property="fc:frame:button:2"       content="☥ Harvest (Claim)" />
<meta property="fc:frame:button:2:action" content="link" />
<meta property="fc:frame:button:2:target" content="<?php echo esc_url( $harvest_url ); ?>" />

<!-- Open Graph fallbacks -->
<meta property="og:title"       content="⛧ <?php echo esc_attr( $headline ); ?>" />
<meta property="og:description" content="<?php echo esc_attr( get_the_excerpt( $post->ID ) ); ?>" />
<meta property="og:image"       content="<?php echo esc_url( $thumb ); ?>" />
<meta property="og:url"         content="<?php echo esc_url( $permalink ); ?>" />
<meta property="og:type"        content="article" />

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image" />
<meta name="twitter:title"       content="⛧ <?php echo esc_attr( $headline ); ?>" />
<meta name="twitter:description" content="<?php echo esc_attr( get_the_excerpt( $post->ID ) ); ?>" />
<meta name="twitter:image"       content="<?php echo esc_url( $thumb ); ?>" />
<meta name="twitter:site"        content="<?php echo esc_attr( $opts['evangelist_handle'] ); ?>" />
<!-- ═══ / Farcaster Frame ═══ -->
        <?php
    }
}

DT_Farcaster_Frame::init();

/* ═══════════════════════════════════════════════════════════════════════════
   Farcaster Frame Action REST Endpoint
   POST /digital-tabernacle/v1/frame-action
   Handles button presses from Farcaster clients
   ═══════════════════════════════════════════════════════════════════════════ */

add_action( 'rest_api_init', function () {
    register_rest_route( 'digital-tabernacle/v1', '/frame-action', array(
        'methods'             => 'POST',
        'callback'            => 'dt_handle_frame_action',
        'permission_callback' => '__return_true',
    ) );
} );

function dt_handle_frame_action( $request ) {
    $body = $request->get_json_params();

    // Farcaster sends:  untrustedData.buttonIndex, untrustedData.fid, trustedData.messageBytes
    $button_index = $body['untrustedData']['buttonIndex'] ?? null;
    $fid          = $body['untrustedData']['fid']         ?? null;

    // Log the interaction for analytics
    if ( function_exists( 'do_action' ) ) {
        do_action( 'dt_farcaster_interaction', $button_index, $fid, $body );
    }

    // Return a new frame (or redirect)
    $response_html = '<!DOCTYPE html><html><head>';
    $response_html .= '<meta property="fc:frame" content="vNext" />';
    $response_html .= '<meta property="fc:frame:image" content="' . esc_url( DT_PLUGIN_URL . 'assets/images/tabernacle-frame-default.png' ) . '" />';

    if ( $button_index == 1 ) {
        // Listen pressed — show "Now streaming" frame
        $response_html .= '<meta property="fc:frame:button:1" content="✦ Streaming…" />';
        $response_html .= '<meta property="fc:frame:button:1:action" content="link" />';
        $response_html .= '<meta property="fc:frame:button:1:target" content="' . esc_url( home_url() ) . '" />';
    } elseif ( $button_index == 2 ) {
        // Harvest pressed — show harvest confirmation
        $response_html .= '<meta property="fc:frame:button:1" content="☥ Harvest Confirmed — Visit site" />';
        $response_html .= '<meta property="fc:frame:button:1:action" content="link" />';
        $response_html .= '<meta property="fc:frame:button:1:target" content="' . esc_url( home_url() ) . '" />';
    }

    $response_html .= '</head><body></body></html>';

    return new WP_REST_Response( $response_html, 200, array(
        'Content-Type' => 'text/html',
    ) );
}
