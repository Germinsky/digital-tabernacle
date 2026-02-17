# Digital Tabernacle — The Grand Architect Plan

> _Cyber-Cathedral ecosystem merging ancient scripture aesthetics with DeFi mechanics on Base L2._
> Built for **DjDigitalProfitz × Digital Prophets**

---

## 📦 Installation

1. ZIP the `digital-tabernacle/` folder
2. WordPress Admin → **Plugins → Add New → Upload Plugin**
3. Upload `digital-tabernacle.zip` → **Install Now → Activate**
4. Navigate to **⛧ Tabernacle** in the admin sidebar to configure

---

## 🏛️ The 4 Modules

### Module 1: Proof of Listening (PoL) Middleware

**File:** `assets/js/proof-of-listening.js`

Hooks into **Sonaar MP3 Audio Player Pro** (or any `<audio>` element). Tracks listening progress per-track with anti-cheat skip detection.

- **Prophetic Threshold:** 90% of a track must be listened to (not skipped)
- **Anti-Cheat:** If `currentTime` jumps >5 seconds forward, the session is flagged
- **On Threshold:** Adds `.holy-light-active` CSS class to harvest buttons, dispatches `dt:prophecyReady` event
- **Public API:** `window.ProofOfListening.isVerified(trackId)`, `.getProgress(trackId)`, etc.

### Module 2: ProphetCore Smart Contract (High Priest)

**Files:** `contracts/IProphetCore.sol`, `contracts/ProphetCore.sol`

Solidity contract for Base L2 (Chain ID 8453):

| Function | Description |
|---|---|
| `harvestTokens(songId, proofHash)` | Claim reward tokens after PoL verification |
| `mintDailyProphecy(songId)` | Mint Open Edition NFT (24h window, 0.001 ETH) |
| `getStreakMultiplier(address)` | 7-day → 2×, 14-day → 3×, 30-day → 5× |
| `setDailyProphecy(songId, uri)` | Oracle sets today's prophecy |

**Deploy:** Via Remix, Hardhat, or Foundry → paste the address in WP Admin → ⛧ Tabernacle.

### Module 3: Infinite Scroll Oracle Feed

**Files:** `includes/class-scripture-cpt.php`, `includes/class-oracle-feed.php`, `assets/js/oracle-feed.js`

- **Custom Post Type:** `scriptures` with metadata: `news_headline`, `dj_track_url`, `token_bounty`, `on_chain_song_id`
- **Shortcode:** `[oracle_feed count="10" visualizer="true"]`
- **Infinite Scroll:** Intersection Observer loads pages via AJAX
- **Audio-Reactive Visualizer:** Three.js canvas — bass → gold glow, treble → chromatic glitch
- **REST API:** `GET /wp-json/digital-tabernacle/v1/scriptures?page=1&per_page=10`

### Module 4: Viral Evangelist Protocol

**Files:** `assets/js/evangelist.js`, `includes/class-farcaster-frame.php`

- **Twitter/X:** `shareProphecy()` → Web Intent with lyric excerpt + `@DjDigitalProfitz on Base. Harvest truth here: [URL]`
- **Farcaster Frames:** Auto-injected `<meta>` tags on Scripture pages with "Listen (Stream)" + "Harvest (Claim)" buttons
- **Web Share API:** Mobile fallback
- **Share Modal:** `window.Evangelist.showShareModal({ title, url, excerpt })`

---

## 🎨 Cyber-Cathedral Aesthetic

All styles in `assets/css/tabernacle.css`:

| Token | Value |
|---|---|
| `--dt-void` | `#0a080f` (deep black) |
| `--dt-gold` | `#d4af37` (prophetic gold) |
| `--dt-purple` | `#8a2be2` (altar purple) |
| `--dt-cyan` | `#00ffff` (digital cyan) |
| `--dt-font-prophecy` | Courier New / Fira Code (monospace) |
| `--dt-font-scripture` | Georgia / Noto Serif |

Effects: `.holy-light-active` (pulsing gold glow), `.oracle-glitch` (treble-reactive chromatic aberration).

---

## 🔧 Shortcodes

```
[oracle_feed count="10" visualizer="true"]
```

---

## 🧩 File Structure

```
digital-tabernacle/
├── digital-tabernacle.php              ← Main plugin file
├── contracts/
│   ├── IProphetCore.sol                ← Interface (Module 2)
│   └── ProphetCore.sol                 ← Full contract (Module 2)
├── includes/
│   ├── class-scripture-cpt.php         ← Scripture CPT (Module 3)
│   ├── class-oracle-feed.php           ← AJAX infinite scroll (Module 3)
│   ├── class-farcaster-frame.php       ← Farcaster Frame meta (Module 4)
│   └── class-admin-settings.php        ← WP Admin settings page
├── assets/
│   ├── js/
│   │   ├── proof-of-listening.js       ← PoL middleware (Module 1)
│   │   ├── oracle-feed.js              ← Infinite scroll + Three.js (Module 3)
│   │   ├── evangelist.js               ← Social sharing (Module 4)
│   │   └── web3-tabernacle.js          ← Ethers.js bridge (Modules 1+2)
│   └── css/
│       └── tabernacle.css              ← Cyber-Cathedral styles
└── README.md
```

---

## 🚀 Deployment Checklist

1. ✅ Activate plugin in WordPress
2. Deploy `ProphetCore.sol` to Base via [Remix](https://remix.ethereum.org) or Hardhat
3. Enter contract address in **⛧ Tabernacle** admin page
4. Create Scripture posts with `news_headline`, `dj_track_url`, `token_bounty` metadata
5. Add `[oracle_feed]` shortcode to any page
6. Share Scripture posts → Farcaster Frames auto-inject
7. Listeners reach 90% → Holy Light activates → Harvest tokens on-chain

---

_"harvestTokens, not claimReward."_
_— The Oracle Newsroom_
