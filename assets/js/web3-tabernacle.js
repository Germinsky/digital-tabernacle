/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Web3 Tabernacle — Ethers.js Bridge
 *  Digital Tabernacle × Base L2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Connects to MetaMask / injected provider, bridges to ProphetCore.sol.
 *  Listens for dt:prophecyReady events from PoL to enable harvesting.
 *
 *  Exposed global: window.TabernacleContract
 * ═══════════════════════════════════════════════════════════════════════════
 */

( function () {
  'use strict';

  const CFG = window.TabernacleWeb3 || {};

  const BASE_CHAIN_ID    = parseInt( CFG.baseChainId ) || 8453;
  const BASE_RPC_URL     = CFG.baseRpcUrl || 'https://mainnet.base.org';
  const CONTRACT_ADDRESS = CFG.prophetCoreAddress || '0x0000000000000000000000000000000000000000';

  let abi;
  try {
    abi = typeof CFG.prophetCoreABI === 'string'
      ? JSON.parse( CFG.prophetCoreABI )
      : CFG.prophetCoreABI || [];
  } catch {
    abi = [];
  }

  let provider    = null;
  let signer      = null;
  let contract    = null;
  let userAddress = null;

  /* ══════════════════════════════════════════════════════════════════
     WALLET CONNECTION
     ══════════════════════════════════════════════════════════════════ */

  async function connectWallet() {
    if ( typeof window.ethereum === 'undefined' ) {
      alert( '⛧ Install MetaMask or a Web3 wallet to enter the Tabernacle.' );
      return null;
    }

    try {
      // Request accounts
      const accounts = await window.ethereum.request( { method: 'eth_requestAccounts' } );
      userAddress = accounts[0];

      // Create ethers provider + signer
      provider = new ethers.BrowserProvider( window.ethereum );
      signer   = await provider.getSigner();

      // Ensure correct chain
      await switchToBase();

      // Create contract instance
      contract = new ethers.Contract( CONTRACT_ADDRESS, abi, signer );

      console.log( '[Web3 Tabernacle] Connected:', userAddress );
      document.dispatchEvent( new CustomEvent( 'dt:walletConnected', {
        detail: { address: userAddress },
      } ) );

      // Update UI
      updateWalletUI( userAddress );
      await loadDiscipleInfo();

      return userAddress;
    } catch ( err ) {
      console.error( '[Web3 Tabernacle] Connection failed:', err );
      return null;
    }
  }

  async function switchToBase() {
    const chainIdHex = '0x' + BASE_CHAIN_ID.toString( 16 );

    try {
      await window.ethereum.request( {
        method: 'wallet_switchEthereumChain',
        params: [ { chainId: chainIdHex } ],
      } );
    } catch ( err ) {
      // Chain not added → add it
      if ( err.code === 4902 ) {
        await window.ethereum.request( {
          method: 'wallet_addEthereumChain',
          params: [ {
            chainId:   chainIdHex,
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls:        [ BASE_RPC_URL ],
            blockExplorerUrls: [ 'https://basescan.org' ],
          } ],
        } );
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     HARVEST TOKENS  —  Called when PoL fires dt:prophecyReady
     ══════════════════════════════════════════════════════════════════ */

  async function harvestTokens( songId, proofHash ) {
    if ( ! contract ) {
      const addr = await connectWallet();
      if ( ! addr ) return;
    }

    try {
      console.log( '[Web3 Tabernacle] Harvesting tokens for song', songId );

      // Convert proofHash to bytes32
      const proof = ethers.zeroPadValue(
        ethers.toBeHex( BigInt( proofHash ) || 0n ),
        32
      );

      const tx = await contract.harvestTokens( songId, proof );
      console.log( '[Web3 Tabernacle] Tx sent:', tx.hash );

      showTxToast( 'Harvesting…', tx.hash );

      const receipt = await tx.wait();
      console.log( '[Web3 Tabernacle] Harvest confirmed:', receipt );

      showTxToast( '✦ Tokens Harvested!', tx.hash );

      // Reset PoL for this track
      if ( window.ProofOfListening ) {
        window.ProofOfListening.resetTrack( songId );
      }

      // Reload disciple info
      await loadDiscipleInfo();

    } catch ( err ) {
      console.error( '[Web3 Tabernacle] Harvest error:', err );
      alert( `Harvest failed: ${err.reason || err.message}` );
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MINT DAILY PROPHECY
     ══════════════════════════════════════════════════════════════════ */

  async function mintDailyProphecy( songId ) {
    if ( ! contract ) {
      const addr = await connectWallet();
      if ( ! addr ) return;
    }

    try {
      // Get current mint price (0.001 ETH default)
      let mintPrice;
      try {
        mintPrice = await contract.mintPrice();
      } catch {
        mintPrice = ethers.parseEther( '0.001' );
      }

      const tx = await contract.mintDailyProphecy( songId, {
        value: mintPrice,
      } );

      showTxToast( 'Minting prophecy…', tx.hash );

      const receipt = await tx.wait();
      console.log( '[Web3 Tabernacle] Prophecy minted:', receipt );

      showTxToast( '✦ Daily Prophecy Minted!', tx.hash );

      await loadDiscipleInfo();

    } catch ( err ) {
      console.error( '[Web3 Tabernacle] Mint error:', err );
      alert( `Mint failed: ${err.reason || err.message}` );
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DISCIPLE INFO  —  Read streak, multiplier, etc.
     ══════════════════════════════════════════════════════════════════ */

  async function loadDiscipleInfo() {
    if ( ! contract || ! userAddress ) return null;

    try {
      const info = await contract.getDiscipleInfo( userAddress );
      const data = {
        streak:     Number( info.currentStreak ),
        lastListen: Number( info.lastListenTimestamp ),
        harvested:  ethers.formatEther( info.totalHarvested ),
        multiplier: Number( info.multiplier ),
      };

      document.dispatchEvent( new CustomEvent( 'dt:discipleInfo', {
        detail: data,
      } ) );

      updateStreakUI( data );
      return data;
    } catch ( err ) {
      console.warn( '[Web3 Tabernacle] Could not load disciple info:', err.message );
      return null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DAILY PROPHECY INFO  —  Read current prophecy
     ══════════════════════════════════════════════════════════════════ */

  async function getDailyProphecy() {
    if ( ! contract ) return null;

    try {
      const [ songId, expiresAt, totalMinted ] = await contract.dailyProphecy();
      return {
        songId:      Number( songId ),
        expiresAt:   Number( expiresAt ),
        totalMinted: Number( totalMinted ),
        isActive:    Date.now() / 1000 < Number( expiresAt ),
      };
    } catch {
      return null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UI HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function updateWalletUI( address ) {
    document.querySelectorAll( '.dt-wallet-address' ).forEach( el => {
      el.textContent = address.slice( 0, 6 ) + '…' + address.slice( -4 );
    } );
    document.querySelectorAll( '.dt-connect-wallet' ).forEach( btn => {
      btn.textContent = '✦ Connected';
      btn.disabled = true;
    } );
  }

  function updateStreakUI( data ) {
    document.querySelectorAll( '.dt-streak-badge' ).forEach( el => {
      el.innerHTML = `
        <span class="streak-fire">🔥</span>
        <span>${data.streak}-day streak (${data.multiplier}× multiplier)</span>
      `;

      el.classList.remove( 'streak-7', 'streak-14', 'streak-30' );
      if ( data.streak >= 30 ) el.classList.add( 'streak-30' );
      else if ( data.streak >= 14 ) el.classList.add( 'streak-14' );
      else if ( data.streak >= 7 ) el.classList.add( 'streak-7' );
    } );

    document.querySelectorAll( '.dt-total-harvested' ).forEach( el => {
      el.textContent = `${data.harvested} $PROPHET harvested`;
    } );
  }

  function showTxToast( message, txHash ) {
    const toast = document.createElement( 'div' );
    toast.className = 'dt-toast';
    toast.innerHTML = `${message} <a href="https://basescan.org/tx/${txHash}" target="_blank" style="color:#00ffff;margin-left:8px;">View ↗</a>`;
    document.body.appendChild( toast );
    requestAnimationFrame( () => toast.classList.add( 'dt-toast--show' ) );
    setTimeout( () => {
      toast.classList.remove( 'dt-toast--show' );
      setTimeout( () => toast.remove(), 300 );
    }, 5000 );
  }

  /* ══════════════════════════════════════════════════════════════════
     EVENT LISTENERS
     ══════════════════════════════════════════════════════════════════ */

  // ── PoL fires prophecyReady → enable & bind harvest buttons
  document.addEventListener( 'dt:prophecyReady', ( e ) => {
    const { trackId, proofHash } = e.detail;

    document.querySelectorAll( '.dt-harvest-btn' ).forEach( btn => {
      const songId = btn.dataset.songId;
      if ( songId && ( songId === trackId || songId === String( trackId ) ) ) {
        btn.disabled = false;
        btn.classList.add( 'holy-light-active' );

        // Remove old listeners
        const newBtn = btn.cloneNode( true );
        btn.parentNode.replaceChild( newBtn, btn );

        newBtn.addEventListener( 'click', () => {
          harvestTokens( songId, proofHash );
        } );
      }
    } );
  } );

  // ── Connect wallet buttons
  document.addEventListener( 'click', ( e ) => {
    if ( e.target.closest( '.dt-connect-wallet' ) ) {
      e.preventDefault();
      connectWallet();
    }
  } );

  // ── Account / chain change handlers
  if ( window.ethereum ) {
    window.ethereum.on?.( 'accountsChanged', ( accts ) => {
      if ( accts.length === 0 ) {
        userAddress = null;
        contract = null;
      } else {
        userAddress = accts[0];
        connectWallet();
      }
    } );

    window.ethereum.on?.( 'chainChanged', () => {
      window.location.reload();
    } );
  }

  /* ══════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════ */

  window.TabernacleContract = {
    connectWallet,
    harvestTokens,
    mintDailyProphecy,
    getDailyProphecy,
    loadDiscipleInfo,
    getAddress()  { return userAddress; },
    isConnected() { return !! userAddress; },
  };

} )();
