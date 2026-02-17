/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Viral Evangelist Protocol — Module 4
 *  Digital Tabernacle × DjDigitalProfitz
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  • shareProphecy()  → Twitter/X Web Intent with lyric excerpt
 *  • shareToFarcaster() → Warpcast compose URL
 *  • Copy link / Web Share API fallback
 *
 *  Exposed global: window.Evangelist
 * ═══════════════════════════════════════════════════════════════════════════
 */

( function () {
  'use strict';

  const HANDLE = '@DjDigitalProfitz';

  /* ══════════════════════════════════════════════════════════════════
     SHARE PROPHECY — Twitter / X Web Intent
     Format:
       "[Lyric Excerpt] - @DjDigitalProfitz on Base.
        Harvest truth here: [URL]"
     ══════════════════════════════════════════════════════════════════ */

  function shareProphecy( { title, url, excerpt } = {} ) {
    const lyric = excerpt
      ? `"${truncate( excerpt, 120 )}"`
      : `"${truncate( title, 120 )}"`;

    const text = `${lyric} — ${HANDLE} on Base.\n\nHarvest truth here:`;

    const intentUrl = buildTwitterIntent( text, url );
    openPopup( intentUrl, 'Share Prophecy' );
  }

  function buildTwitterIntent( text, url ) {
    const params = new URLSearchParams( {
      text: text,
      url:  url || window.location.href,
      hashtags: 'DigitalProphets,Base,Web3Music',
    } );
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     FARCASTER / WARPCAST SHARING
     ══════════════════════════════════════════════════════════════════ */

  function shareToFarcaster( { title, url, excerpt } = {} ) {
    const text = excerpt
      ? `⛧ ${truncate( excerpt, 200 )} — ${HANDLE}`
      : `⛧ ${truncate( title, 200 )} — ${HANDLE}`;

    const castUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent( text )}&embeds[]=${encodeURIComponent( url || window.location.href )}`;
    openPopup( castUrl, 'Cast Prophecy' );
  }

  /* ══════════════════════════════════════════════════════════════════
     WEB SHARE API (Mobile fallback)
     ══════════════════════════════════════════════════════════════════ */

  async function nativeShare( { title, url, excerpt } = {} ) {
    if ( navigator.share ) {
      try {
        await navigator.share( {
          title: title || 'Digital Prophets — Harvest Truth',
          text:  excerpt || title,
          url:   url || window.location.href,
        } );
        return true;
      } catch {
        // User cancelled — fall through to Twitter
      }
    }
    shareProphecy( { title, url, excerpt } );
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     COPY LINK
     ══════════════════════════════════════════════════════════════════ */

  async function copyProphecyLink( url ) {
    const link = url || window.location.href;
    try {
      await navigator.clipboard.writeText( link );
      showToast( '✦ Prophecy link copied to clipboard' );
      return true;
    } catch {
      // Fallback for older browsers
      const ta = document.createElement( 'textarea' );
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild( ta );
      ta.select();
      document.execCommand( 'copy' );
      document.body.removeChild( ta );
      showToast( '✦ Prophecy link copied' );
      return true;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SHARE MODAL  (optional UI)
     ══════════════════════════════════════════════════════════════════ */

  function showShareModal( data ) {
    // Remove existing
    document.getElementById( 'dt-share-modal' )?.remove();

    const modal = document.createElement( 'div' );
    modal.id = 'dt-share-modal';
    modal.className = 'dt-share-modal';
    modal.innerHTML = `
      <div class="dt-share-modal__backdrop"></div>
      <div class="dt-share-modal__content">
        <h3 class="dt-share-modal__title">📣 Evangelize This Prophecy</h3>
        <div class="dt-share-modal__buttons">
          <button class="dt-share-modal__btn dt-share--twitter">
            𝕏 Share on X / Twitter
          </button>
          <button class="dt-share-modal__btn dt-share--farcaster">
            🟣 Cast on Farcaster
          </button>
          <button class="dt-share-modal__btn dt-share--copy">
            📋 Copy Link
          </button>
        </div>
        <button class="dt-share-modal__close">✕</button>
      </div>
    `;

    document.body.appendChild( modal );
    requestAnimationFrame( () => modal.classList.add( 'dt-share-modal--open' ) );

    // Bind buttons
    modal.querySelector( '.dt-share--twitter' )
      .addEventListener( 'click', () => { shareProphecy( data ); closeModal(); } );
    modal.querySelector( '.dt-share--farcaster' )
      .addEventListener( 'click', () => { shareToFarcaster( data ); closeModal(); } );
    modal.querySelector( '.dt-share--copy' )
      .addEventListener( 'click', () => { copyProphecyLink( data.url ); closeModal(); } );

    modal.querySelector( '.dt-share-modal__backdrop' )
      .addEventListener( 'click', closeModal );
    modal.querySelector( '.dt-share-modal__close' )
      .addEventListener( 'click', closeModal );

    function closeModal() {
      modal.classList.remove( 'dt-share-modal--open' );
      setTimeout( () => modal.remove(), 300 );
    }
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */

  function truncate( str, max ) {
    if ( ! str ) return '';
    return str.length > max ? str.slice( 0, max - 1 ) + '…' : str;
  }

  function openPopup( url, title ) {
    const w = 600, h = 400;
    const left = ( screen.width - w ) / 2;
    const top  = ( screen.height - h ) / 2;
    window.open( url, title, `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no` );
  }

  function showToast( msg ) {
    const toast = document.createElement( 'div' );
    toast.className = 'dt-toast';
    toast.textContent = msg;
    document.body.appendChild( toast );
    requestAnimationFrame( () => toast.classList.add( 'dt-toast--show' ) );
    setTimeout( () => {
      toast.classList.remove( 'dt-toast--show' );
      setTimeout( () => toast.remove(), 300 );
    }, 2500 );
  }

  /* ══════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════ */

  window.Evangelist = {
    shareProphecy,
    shareToFarcaster,
    nativeShare,
    copyProphecyLink,
    showShareModal,
  };

} )();
