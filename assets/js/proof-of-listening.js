/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PROOF OF LISTENING (PoL) — Module 1
 *  Digital Tabernacle × DjDigitalProfitz
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Hooks into Sonaar MP3 Audio Player Pro events.
 *  Tracks listening progress per-track with anti-cheat skip detection.
 *  At 90 % ("Prophetic Threshold") → unlocks harvestTokens() & holy glow.
 *
 *  Exposed global:  window.ProofOfListening
 * ═══════════════════════════════════════════════════════════════════════════
 */

( function () {
  'use strict';

  /* ── Config from wp_localize_script ─────────────────────────────── */
  const CFG = window.TabernaclePoL || {};
  const THRESHOLD  = parseFloat( CFG.propheticThreshold ) || 0.9;
  const CHEAT_GAP  = parseFloat( CFG.cheatWindow )        || 5; // seconds

  /* ── Per-track listening state ──────────────────────────────────── */
  const tracks = new Map();   // trackId → { listened, duration, lastTime, cheatFlag, verified }

  function getTrack( id, duration ) {
    if ( ! tracks.has( id ) ) {
      tracks.set( id, {
        listened:   0,
        duration:   duration || 0,
        lastTime:   0,
        cheatFlag:  false,
        verified:   false,
        startedAt:  Date.now(),
      } );
    }
    return tracks.get( id );
  }

  /* ══════════════════════════════════════════════════════════════════
     ANTI-CHEAT: Skip Detection
     If currentTime jumps more than CHEAT_GAP seconds forward from the
     last recorded time, flag the session.  The on-chain harvestTokens
     call sends a proofHash that incorporates the cheat flag — the
     contract can decide whether to accept or reject.
     ══════════════════════════════════════════════════════════════════ */

  function detectSkip( track, currentTime ) {
    const delta = currentTime - track.lastTime;
    if ( delta > CHEAT_GAP && track.lastTime > 0 ) {
      track.cheatFlag = true;
      console.warn( '[PoL] Skip detected — jumped', delta.toFixed(1), 's' );
    }
    track.lastTime = currentTime;
  }

  /* ══════════════════════════════════════════════════════════════════
     PROGRESS TRACKING
     Called on every timeupdate (≈ 4× / sec).  Accumulates unique
     seconds listened.  When ratio ≥ THRESHOLD → fire prophecyReady.
     ══════════════════════════════════════════════════════════════════ */

  function onTimeUpdate( trackId, currentTime, duration ) {
    const t = getTrack( trackId, duration );
    if ( t.verified ) return;                                // already qualified

    detectSkip( t, currentTime );

    // Accumulate listened seconds (only forward, max 1 s per tick)
    const increment = Math.min( currentTime - ( t.lastTime - ( currentTime - t.lastTime ) ), 1 );
    if ( increment > 0 && increment <= 1.5 ) {
      t.listened += increment;
    }

    // Clamp
    if ( t.duration > 0 && t.listened > t.duration ) {
      t.listened = t.duration;
    }

    const ratio = t.duration > 0 ? t.listened / t.duration : 0;

    // Broadcast progress (for HUD, progress bars, etc.)
    document.dispatchEvent( new CustomEvent( 'dt:listeningProgress', {
      detail: { trackId, ratio, cheat: t.cheatFlag },
    } ) );

    if ( ratio >= THRESHOLD && ! t.cheatFlag ) {
      t.verified = true;
      fireProphecyReady( trackId, t );
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PROPHECY READY — Threshold met, enable harvest
     ══════════════════════════════════════════════════════════════════ */

  function fireProphecyReady( trackId, track ) {
    console.log( '[PoL] ✦ Prophetic Threshold reached for track', trackId );

    // 1. Add holy-light glow to harvest buttons
    document.querySelectorAll( '.dt-harvest-btn, .harvest-tokens-btn' )
      .forEach( btn => btn.classList.add( 'holy-light-active' ) );

    // 2. Dispatch event for Web3 bridge to enable harvestTokens()
    document.dispatchEvent( new CustomEvent( 'dt:prophecyReady', {
      detail: {
        trackId,
        listenedSeconds: track.listened,
        duration:        track.duration,
        proofHash:       generateProofHash( trackId, track ),
      },
    } ) );
  }

  /* ── Proof hash: keccak256( trackId ∥ listenedSeconds ∥ startedAt ∥ !cheat ) */
  function generateProofHash( trackId, track ) {
    // Client-side hash — real verification is on-chain / off-chain oracle
    const data = `${trackId}|${Math.floor( track.listened )}|${track.startedAt}|${!track.cheatFlag}`;
    return sha256( data );
  }

  /* ── Minimal SHA-256 (Web Crypto fallback to simple hash) ─────── */
  function sha256( str ) {
    // Synchronous fallback — for display only; real hash is built on-chain
    let hash = 0;
    for ( let i = 0; i < str.length; i++ ) {
      const c = str.charCodeAt( i );
      hash = ( ( hash << 5 ) - hash ) + c;
      hash |= 0;
    }
    return '0x' + Math.abs( hash ).toString( 16 ).padStart( 64, '0' );
  }

  /* ══════════════════════════════════════════════════════════════════
     SONAAR AUDIO PLAYER INTEGRATION
     Sonaar fires events on its custom audio element.  We detect it
     by looking for the iron-audio-player or srp_player globals.
     ══════════════════════════════════════════════════════════════════ */

  function hookSonaar() {
    // Strategy 1: MutationObserver — wait for Sonaar's <audio> element
    const observer = new MutationObserver( () => {
      const audioEls = document.querySelectorAll(
        'audio, .iron-audioplayer audio, .srp_player audio, [data-srp] audio'
      );
      audioEls.forEach( attachAudioListeners );
    } );
    observer.observe( document.body, { childList: true, subtree: true } );

    // Strategy 2: Direct lookup (if already rendered)
    document.querySelectorAll( 'audio' ).forEach( attachAudioListeners );

    // Strategy 3: Sonaar custom events (srp_player API)
    document.addEventListener( 'bpmAudioPlay',      onSonaarPlay );
    document.addEventListener( 'bpmAudioTimeUpdate', onSonaarTimeUpdate );
    document.addEventListener( 'bpmAudioPause',      onSonaarPause );
    document.addEventListener( 'bpmAudioEnd',        onSonaarEnd );

    // Strategy 4: Interval poll for srp_player global
    const poll = setInterval( () => {
      const player = window.srp_player || window.iron_audio_player;
      if ( player ) {
        clearInterval( poll );
        attachSrpPlayer( player );
      }
    }, 1000 );
    setTimeout( () => clearInterval( poll ), 30000 ); // give up after 30 s
  }

  const attachedAudios = new WeakSet();

  function attachAudioListeners( audio ) {
    if ( attachedAudios.has( audio ) ) return;
    attachedAudios.add( audio );

    let trackId = resolveTrackId( audio );

    audio.addEventListener( 'timeupdate', () => {
      trackId = trackId || resolveTrackId( audio );
      onTimeUpdate( trackId, audio.currentTime, audio.duration );
    } );

    audio.addEventListener( 'play', () => {
      trackId = trackId || resolveTrackId( audio );
      console.log( '[PoL] ▸ Track playing:', trackId );
    } );

    audio.addEventListener( 'ended', () => {
      console.log( '[PoL] ■ Track ended:', trackId );
    } );
  }

  /* ── Sonaar custom event handlers ──────────────────────────────── */

  function onSonaarPlay( e ) {
    const d = e.detail || {};
    const trackId = d.trackId || d.id || 'sonaar-track';
    getTrack( trackId, d.duration || 0 );
  }

  function onSonaarTimeUpdate( e ) {
    const d = e.detail || {};
    const trackId    = d.trackId || d.id || 'sonaar-track';
    const current    = d.currentTime || 0;
    const duration   = d.duration    || 0;
    onTimeUpdate( trackId, current, duration );
  }

  function onSonaarPause() { /* pause doesn't affect PoL */ }
  function onSonaarEnd()   { /* reset handled in getTrack */ }

  /* ── SRP Player API hook ───────────────────────────────────────── */

  function attachSrpPlayer( player ) {
    if ( typeof player.on === 'function' ) {
      player.on( 'timeupdate', ( data ) => {
        const id  = data.trackId || data.id || 'srp-track';
        onTimeUpdate( id, data.currentTime, data.duration );
      } );
    }
  }

  /* ── Resolve a sensible track ID from <audio> context ──────────── */

  function resolveTrackId( audio ) {
    // Try data attributes
    const parent = audio.closest( '[data-track-id], [data-srp-track], .srp_player_item' );
    if ( parent ) {
      return parent.dataset.trackId || parent.dataset.srpTrack || parent.id || 'track-unknown';
    }
    // Fallback: use src filename
    try {
      const url = new URL( audio.currentSrc || audio.src );
      return url.pathname.split( '/' ).pop().replace( /\.\w+$/, '' );
    } catch {
      return 'track-' + Math.random().toString( 36 ).slice( 2, 8 );
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PUBLIC API — window.ProofOfListening
     ══════════════════════════════════════════════════════════════════ */

  window.ProofOfListening = {
    /** Check if a specific track is verified (≥90 % listened, no cheat) */
    isVerified( trackId ) {
      const t = tracks.get( trackId );
      return t ? t.verified : false;
    },

    /** Get listening progress 0–1 for a track */
    getProgress( trackId ) {
      const t = tracks.get( trackId );
      if ( ! t || ! t.duration ) return 0;
      return Math.min( t.listened / t.duration, 1 );
    },

    /** Check if any track is verified */
    hasAnyVerified() {
      for ( const [ , t ] of tracks ) {
        if ( t.verified ) return true;
      }
      return false;
    },

    /** Get all verified track IDs */
    getVerifiedTracks() {
      const ids = [];
      for ( const [ id, t ] of tracks ) {
        if ( t.verified ) ids.push( id );
      }
      return ids;
    },

    /** Get proof hash for a verified track */
    getProofHash( trackId ) {
      const t = tracks.get( trackId );
      if ( ! t || ! t.verified ) return null;
      return generateProofHash( trackId, t );
    },

    /** Reset state for a track (e.g. after successful harvest) */
    resetTrack( trackId ) {
      tracks.delete( trackId );
      document.querySelectorAll( '.dt-harvest-btn, .harvest-tokens-btn' )
        .forEach( btn => btn.classList.remove( 'holy-light-active' ) );
    },
  };

  /* ── Initialise ─────────────────────────────────────────────────── */
  if ( document.readyState === 'loading' ) {
    document.addEventListener( 'DOMContentLoaded', hookSonaar );
  } else {
    hookSonaar();
  }

} )();
