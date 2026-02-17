// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IProphetCore.sol";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ProphetCore — The High Priest Contract
 *  Digital Tabernacle on Base L2  (Chain ID 8453)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  • Proof-of-Listening reward harvesting with streak multipliers
 *  • Daily Prophecy — 24-hour Open Edition mint (ERC-1155)
 *  • 7-day streak → 2×, 14-day → 3×, 30-day → 5× reward multiplier
 *  • Anti-cheat: proof hashes verified on-chain
 *  • Ownable: Oracle sets daily prophecy, base reward
 *
 *  Deploy on Base L2 via Remix / Hardhat / Foundry.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ── Minimal ERC-1155 interface for daily prophecy mints ──────────────── */

interface IERC1155Mintable {
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external;
}

/* ── Minimal ERC-20 interface for reward token ────────────────────────── */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account)           external view returns (uint256);
}

contract ProphetCore is IProphetCore {

    /* ═══════════ STATE ═══════════ */

    address public owner;
    address public oracle;         // Address allowed to set daily prophecy

    IERC20           public rewardToken;      // $PROPHET or any ERC-20
    IERC1155Mintable public prophecyNFT;      // ERC-1155 for daily edition mints

    uint256 public baseReward = 10 ether;     // 10 tokens (18 decimals)
    uint256 public mintPrice  = 0.001 ether;  // 0.001 ETH on Base

    // ── Disciple tracking ────────────────────────────────────────────
    mapping(address => uint256) public override currentStreak;
    mapping(address => uint256) public override lastListenTimestamp;
    mapping(address => uint256) public          totalHarvested;

    // ── Anti-replay: proofHash → used ────────────────────────────────
    mapping(bytes32 => bool) public usedProofs;

    // ── Daily Prophecy ───────────────────────────────────────────────
    DailyProphecyInfo internal _dailyProphecy;
    uint256 public nextTokenId = 1;

    // ── Constants ────────────────────────────────────────────────────
    uint256 constant ONE_DAY      = 86400;
    uint256 constant STREAK_7     = 7;
    uint256 constant STREAK_14    = 14;
    uint256 constant STREAK_30    = 30;

    /* ═══════════ MODIFIERS ═══════════ */

    modifier onlyOwner()  { require(msg.sender == owner,  "Not owner");  _; }
    modifier onlyOracle() { require(msg.sender == oracle || msg.sender == owner, "Not oracle"); _; }

    /* ═══════════ CONSTRUCTOR ═══════════ */

    constructor(
        address _rewardToken,
        address _prophecyNFT,
        address _oracle
    ) {
        owner       = msg.sender;
        oracle      = _oracle;
        rewardToken = IERC20(_rewardToken);
        prophecyNFT = IERC1155Mintable(_prophecyNFT);
    }

    /* ═══════════════════════════════════════════════════════════════════
       HARVEST TOKENS  (Module 1 + 2 integration)
       Called after Proof-of-Listening reaches 90 % on the frontend.
       ═══════════════════════════════════════════════════════════════════ */

    function harvestTokens(uint256 songId, bytes32 proofHash) external override {
        require(proofHash != bytes32(0),    "Invalid proof");
        require(!usedProofs[proofHash],     "Proof already used");

        usedProofs[proofHash] = true;

        // ── Update streak ────────────────────────────────────────────
        _updateStreak(msg.sender);

        // ── Calculate reward with multiplier ─────────────────────────
        uint256 multiplier = getStreakMultiplier(msg.sender);
        uint256 reward     = baseReward * multiplier;

        // ── Transfer reward tokens ───────────────────────────────────
        require(
            rewardToken.balanceOf(address(this)) >= reward,
            "Tabernacle treasury depleted"
        );
        require(
            rewardToken.transfer(msg.sender, reward),
            "Harvest transfer failed"
        );

        totalHarvested[msg.sender] += reward;

        emit TokensHarvested(msg.sender, songId, reward, currentStreak[msg.sender]);
    }

    /* ═══════════════════════════════════════════════════════════════════
       STREAK MANAGEMENT
       A "day" = any listen within 24–48 h of the last listen.
       If > 48 h elapsed, streak resets to 1.
       ═══════════════════════════════════════════════════════════════════ */

    function _updateStreak(address disciple) internal {
        uint256 last = lastListenTimestamp[disciple];
        uint256 elapsed = block.timestamp - last;

        if (last == 0) {
            // First ever listen
            currentStreak[disciple] = 1;
        } else if (elapsed >= ONE_DAY && elapsed < 2 * ONE_DAY) {
            // Within the streak window → increment
            currentStreak[disciple] += 1;
        } else if (elapsed >= 2 * ONE_DAY) {
            // Streak broken → reset
            currentStreak[disciple] = 1;
        }
        // else: same day, no change

        lastListenTimestamp[disciple] = block.timestamp;

        emit StreakUpdated(
            disciple,
            currentStreak[disciple],
            getStreakMultiplier(disciple)
        );
    }

    /* ═══════════════════════════════════════════════════════════════════
       STREAK MULTIPLIER
       7-day  → 2×
       14-day → 3×
       30-day → 5×
       default → 1×
       ═══════════════════════════════════════════════════════════════════ */

    function getStreakMultiplier(address disciple) public view override returns (uint256) {
        uint256 streak = currentStreak[disciple];
        if (streak >= STREAK_30) return 5;
        if (streak >= STREAK_14) return 3;
        if (streak >= STREAK_7)  return 2;
        return 1;
    }

    /* ═══════════════════════════════════════════════════════════════════
       DAILY PROPHECY — Open Edition, 24-hour mint window
       Oracle calls setDailyProphecy() with a songId & metadata URI.
       Anyone can mintDailyProphecy() during the window.
       ═══════════════════════════════════════════════════════════════════ */

    function setDailyProphecy(
        uint256 songId,
        string calldata metadataURI
    ) external override onlyOracle {
        _dailyProphecy = DailyProphecyInfo({
            songId:      songId,
            expiresAt:   block.timestamp + ONE_DAY,
            totalMinted: 0,
            metadataURI: metadataURI
        });

        emit DailyProphecySet(songId, _dailyProphecy.expiresAt);
    }

    function mintDailyProphecy(uint256 songId) external payable override returns (uint256 tokenId) {
        require(_dailyProphecy.songId == songId,           "Wrong prophecy songId");
        require(block.timestamp <= _dailyProphecy.expiresAt, "Prophecy window expired");
        require(msg.value >= mintPrice,                      "Insufficient offering");

        tokenId = nextTokenId++;
        _dailyProphecy.totalMinted += 1;

        // Mint ERC-1155
        prophecyNFT.mint(msg.sender, tokenId, 1, "");

        // Update streak as well (listening + minting = double devotion)
        _updateStreak(msg.sender);

        emit DailyProphecyMinted(msg.sender, tokenId, songId, block.timestamp);
    }

    function dailyProphecy() external view override returns (
        uint256 songId,
        uint256 expiresAt,
        uint256 totalMinted
    ) {
        return (
            _dailyProphecy.songId,
            _dailyProphecy.expiresAt,
            _dailyProphecy.totalMinted
        );
    }

    /* ═══════════════════════════════════════════════════════════════════
       VIEW HELPERS
       ═══════════════════════════════════════════════════════════════════ */

    function getDiscipleInfo(address disciple) external view override returns (DiscipleInfo memory) {
        return DiscipleInfo({
            currentStreak:       currentStreak[disciple],
            lastListenTimestamp: lastListenTimestamp[disciple],
            totalHarvested:      totalHarvested[disciple],
            multiplier:          getStreakMultiplier(disciple)
        });
    }

    /* ═══════════════════════════════════════════════════════════════════
       ADMIN / ORACLE
       ═══════════════════════════════════════════════════════════════════ */

    function setBaseReward(uint256 amount) external override onlyOwner {
        baseReward = amount;
    }

    function setMintPrice(uint256 price) external onlyOwner {
        mintPrice = price;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function setRewardToken(address _token) external onlyOwner {
        rewardToken = IERC20(_token);
    }

    function setProphecyNFT(address _nft) external onlyOwner {
        prophecyNFT = IERC1155Mintable(_nft);
    }

    /// @notice Withdraw accumulated ETH from mint fees
    function withdrawOfferings() external onlyOwner {
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "Withdraw failed");
    }

    /// @notice Withdraw any ERC-20 tokens accidentally sent
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    receive() external payable {}
}
