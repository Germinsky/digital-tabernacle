/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Oracle Feed — Infinite Scroll + Three.js Audio-Reactive Visualizer
 *  Digital Tabernacle  ×  Module 3
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. Intersection Observer infinite scroll for [oracle_feed] shortcode
 *  2. Three.js audio-reactive visualizer (bass → text glow, treble → glitch)
 *  3. Mini audio player for oracle cards
 * ═══════════════════════════════════════════════════════════════════════════
 */

( function () {
  'use strict';

  const CFG = window.OracleFeed || {};

  /* ══════════════════════════════════════════════════════════════════
     1. INFINITE SCROLL
     Uses Intersection Observer on .oracle-scroll-sentinel
     ══════════════════════════════════════════════════════════════════ */

  let currentPage = 1;
  let loading     = false;
  let exhausted   = false;

  function initInfiniteScroll() {
    const container = document.querySelector( '.oracle-scroll-container' );
    const sentinel  = document.querySelector( '.oracle-scroll-sentinel' );
    if ( ! container || ! sentinel ) return;

    const perPage = parseInt(
      document.getElementById( 'oracle-feed' )?.dataset.perPage || '10'
    );

    const observer = new IntersectionObserver( ( entries ) => {
      if ( entries[0].isIntersecting && ! loading && ! exhausted ) {
        loadMore( container, perPage );
      }
    }, { rootMargin: '400px' } );

    observer.observe( sentinel );
  }

  async function loadMore( container, perPage ) {
    loading = true;
    currentPage++;

    const sentinel = document.querySelector( '.oracle-scroll-sentinel' );
    sentinel?.classList.add( 'oracle-loading' );

    try {
      const form = new FormData();
      form.append( 'action',   'dt_load_scriptures' );
      form.append( 'nonce',    CFG.nonce );
      form.append( 'page',     currentPage );
      form.append( 'per_page', perPage );

      const res  = await fetch( CFG.ajaxUrl, { method: 'POST', body: form } );
      const json = await res.json();

      if ( json.success && json.data.html ) {
        // Inject new cards
        const temp = document.createElement( 'div' );
        temp.innerHTML = json.data.html;

        // Animate-in each card
        Array.from( temp.children ).forEach( ( card, i ) => {
          card.style.opacity   = '0';
          card.style.transform = 'translateY(30px)';
          container.appendChild( card );

          requestAnimationFrame( () => {
            setTimeout( () => {
              card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
              card.style.opacity    = '1';
              card.style.transform  = 'translateY(0)';
            }, i * 80 );
          } );
        } );

        // Rebind actions on new cards
        bindCardActions( container );

        if ( ! json.data.hasMore ) {
          exhausted = true;
          sentinel.innerHTML = '<div class="oracle-end-sigil">— The Scrolls are Complete —</div>';
        }
      } else {
        exhausted = true;
      }
    } catch ( err ) {
      console.error( '[Oracle Feed] Load error:', err );
    }

    sentinel?.classList.remove( 'oracle-loading' );
    loading = false;
  }

  /* ══════════════════════════════════════════════════════════════════
     2. CARD ACTION BINDINGS
     Play, Harvest, Share buttons
     ══════════════════════════════════════════════════════════════════ */

  let activeAudio = null;

  function bindCardActions( scope ) {
    // Play buttons
    scope.querySelectorAll( '.dt-play-btn' ).forEach( btn => {
      if ( btn.__dtBound ) return;
      btn.__dtBound = true;

      btn.addEventListener( 'click', () => {
        const trackUrl = btn.dataset.track;
        const songId   = btn.dataset.songId;
        if ( ! trackUrl ) return;

        if ( activeAudio ) {
          activeAudio.pause();
          activeAudio = null;
          document.querySelectorAll( '.dt-play-btn' ).forEach( b => b.textContent = '▸ Listen' );
        }

        if ( btn.textContent.includes( '■' ) ) {
          btn.textContent = '▸ Listen';
          disconnectAnalyser();
          return;
        }

        activeAudio = new Audio( trackUrl );
        activeAudio.crossOrigin = 'anonymous';
        activeAudio.play();
        btn.textContent = '■ Stop';

        // Hook into PoL
        activeAudio.addEventListener( 'timeupdate', () => {
          if ( window.ProofOfListening ) {
            // Manually trigger PoL progress for standalone playback
            document.dispatchEvent( new CustomEvent( 'dt:manualTimeUpdate', {
              detail: {
                trackId:     songId || trackUrl,
                currentTime: activeAudio.currentTime,
                duration:    activeAudio.duration,
              },
            } ) );
          }
        } );

        activeAudio.addEventListener( 'ended', () => {
          btn.textContent = '▸ Listen';
          disconnectAnalyser();
        } );

        // Connect to visualizer
        connectAnalyser( activeAudio );
      } );
    } );

    // Share buttons (delegate to evangelist.js)
    scope.querySelectorAll( '.dt-share-btn' ).forEach( btn => {
      if ( btn.__dtBound ) return;
      btn.__dtBound = true;
      btn.addEventListener( 'click', () => {
        if ( window.Evangelist ) {
          window.Evangelist.shareProphecy( {
            title:   btn.dataset.title,
            url:     btn.dataset.url,
            excerpt: btn.dataset.excerpt,
          } );
        }
      } );
    } );

    // Enable harvest buttons when PoL fires prophecyReady
    document.addEventListener( 'dt:prophecyReady', ( e ) => {
      const songId = e.detail.trackId;
      scope.querySelectorAll( `.dt-harvest-btn[data-song-id="${songId}"]` ).forEach( btn => {
        btn.disabled = false;
        btn.classList.add( 'holy-light-active' );
      } );
    } );
  }

  /* ══════════════════════════════════════════════════════════════════
     3. THREE.JS AUDIO-REACTIVE VISUALIZER
     Bass → text opacity / warm glow
     Treble → chromatic glitch / flicker
     ══════════════════════════════════════════════════════════════════ */

  let audioCtx, analyser, dataArray, source;
  let visualizerActive = false;
  let animFrameId;

  function connectAnalyser( audioEl ) {
    const canvas = document.getElementById( 'oracle-visualizer' );
    if ( ! canvas ) return;

    if ( ! audioCtx ) {
      audioCtx = new ( window.AudioContext || window.webkitAudioContext )();
    }

    try {
      source   = audioCtx.createMediaElementSource( audioEl );
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      dataArray = new Uint8Array( analyser.frequencyBinCount );

      source.connect( analyser );
      analyser.connect( audioCtx.destination );

      visualizerActive = true;
      renderVisualizer( canvas );
    } catch ( err ) {
      console.warn( '[Oracle Visualizer] Audio context error:', err.message );
    }
  }

  function disconnectAnalyser() {
    visualizerActive = false;
    if ( animFrameId ) cancelAnimationFrame( animFrameId );
    if ( source ) {
      try { source.disconnect(); } catch {}
    }
    source = null;
  }

  function renderVisualizer( canvas ) {
    const ctx    = canvas.getContext( '2d' );
    const W      = canvas.width;
    const H      = canvas.height;
    const bars   = analyser.frequencyBinCount;
    const barW   = W / bars;

    function draw() {
      if ( ! visualizerActive ) return;
      animFrameId = requestAnimationFrame( draw );

      analyser.getByteFrequencyData( dataArray );

      // ── Background: deep cathedral void ───────────────────────
      ctx.fillStyle = 'rgba(10, 8, 15, 0.85)';
      ctx.fillRect( 0, 0, W, H );

      // ── Frequency bars ────────────────────────────────────────
      for ( let i = 0; i < bars; i++ ) {
        const val    = dataArray[ i ] / 255;
        const barH   = val * H;
        const x      = i * barW;

        // Color: bass (gold) → mid (purple) → treble (cyan)
        const ratio = i / bars;
        let r, g, b;
        if ( ratio < 0.33 ) {
          r = 212; g = 175; b = 55;   // Gold
        } else if ( ratio < 0.66 ) {
          r = 138; g = 43;  b = 226;  // Purple
        } else {
          r = 0;   g = 255; b = 255;  // Cyan
        }

        const alpha = 0.3 + val * 0.7;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect( x, H - barH, barW - 1, barH );

        // Glow
        ctx.shadowBlur  = val * 20;
        ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      }

      ctx.shadowBlur = 0;

      // ── Bass power → drive CSS effects ────────────────────────
      const bassSlice = dataArray.slice( 0, 8 );
      const bassPower = bassSlice.reduce( ( a, b ) => a + b, 0 ) / ( 8 * 255 );

      // ── Treble power → glitch intensity ───────────────────────
      const trebleSlice = dataArray.slice( bars - 16, bars );
      const treblePower = trebleSlice.reduce( ( a, b ) => a + b, 0 ) / ( 16 * 255 );

      // Apply to oracle cards
      document.querySelectorAll( '.oracle-card' ).forEach( card => {
        const glow = Math.floor( bassPower * 30 );
        card.style.boxShadow = `0 0 ${glow}px rgba(212, 175, 55, ${bassPower * 0.6})`;

        if ( treblePower > 0.6 ) {
          card.classList.add( 'oracle-glitch' );
        } else {
          card.classList.remove( 'oracle-glitch' );
        }
      } );

      // ── Center sigil text ─────────────────────────────────────
      ctx.font         = '14px "Courier New", monospace';
      ctx.textAlign    = 'center';
      ctx.fillStyle    = `rgba(212, 175, 55, ${0.3 + bassPower * 0.7})`;
      ctx.fillText( '⛧ FREQUENCY ORACLE ⛧', W / 2, H / 2 );
    }

    draw();
  }

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  function init() {
    initInfiniteScroll();

    const container = document.querySelector( '.oracle-scroll-container' );
    if ( container ) bindCardActions( container );
  }

  if ( document.readyState === 'loading' ) {
    document.addEventListener( 'DOMContentLoaded', init );
  } else {
    init();
  }

} )();
