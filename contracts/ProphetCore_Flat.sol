// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ProphetCore — FLATTENED FOR REMIX DEPLOYMENT
 *  Digital Tabernacle on Base L2  (Chain ID 8453)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Deploy steps:
 *   1. Open https://remix.ethereum.org
 *   2. Create file → paste this entire file
 *   3. Compile: Solidity 0.8.20+, EVM target "paris", optimizer ON (200 runs)
 *   4. Deploy tab → Environment: "Injected Provider - MetaMask"
 *   5. Switch MetaMask to Base network (Chain 8453)
 *   6. Constructor args:
 *        _rewardToken  = your ERC-20 token address (or 0x0…0 as placeholder)
 *        _prophecyNFT  = your ERC-1155 address     (or 0x0…0 as placeholder)
 *        _oracle       = your wallet address
 *   7. Deploy → confirm in MetaMask
 *   8. Copy deployed address → paste into WP Admin → ⛧ Tabernacle
 * ═══════════════════════════════════════════════════════════════════════════
 */


// ═══════════════════════════════════════════════════════════════════════════
//  IProphetCore — High Priest Interface
// ═══════════════════════════════════════════════════════════════════════════

interface IProphetCore {

    /* ═══════════ EVENTS ═══════════ */

    event TokensHarvested(
        address indexed disciple,
        uint256 indexed songId,
        uint256 reward,
        uint256 streak
    );

    event DailyProphecyMinted(
        address indexed disciple,
        uint256 indexed tokenId,
        uint256 indexed songId,
        uint256 timestamp
    );

    event DailyProphecySet(
        uint256 indexed songId,
        uint256 expiresAt
    );

    event StreakUpdated(
        address indexed disciple,
        uint256 newStreak,
        uint256 multiplier
    );

    /* ═══════════ STRUCTS ═══════════ */

    struct DailyProphecyInfo {
        uint256 songId;
        uint256 expiresAt;
        uint256 totalMinted;
        string  metadataURI;
    }

    struct DiscipleInfo {
        uint256 currentStreak;
        uint256 lastListenTimestamp;
        uint256 totalHarvested;
        uint256 multiplier;
    }

    /* ═══════════ CORE FUNCTIONS ═══════════ */

    function harvestTokens(uint256 songId, bytes32 proofHash) external;
    function mintDailyProphecy(uint256 songId) external payable returns (uint256 tokenId);

    /* ═══════════ VIEW FUNCTIONS ═══════════ */

    function currentStreak(address disciple) external view returns (uint256);
    function lastListenTimestamp(address disciple) external view returns (uint256);
    function getStreakMultiplier(address disciple) external view returns (uint256);

    function dailyProphecy() external view returns (
        uint256 songId,
        uint256 expiresAt,
        uint256 totalMinted
    );

    function getDiscipleInfo(address disciple) external view returns (DiscipleInfo memory);

    /* ═══════════ ORACLE FUNCTIONS ═══════════ */

    function setDailyProphecy(uint256 songId, string calldata metadataURI) external;
    function setBaseReward(uint256 amount) external;
}


// ═══════════════════════════════════════════════════════════════════════════
//  Minimal interfaces
// ═══════════════════════════════════════════════════════════════════════════

interface IERC1155Mintable {
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account)           external view returns (uint256);
}


// ═══════════════════════════════════════════════════════════════════════════
//  ProphetCore — The High Priest Contract
// ═══════════════════════════════════════════════════════════════════════════

contract ProphetCore is IProphetCore {

    /* ═══════════ STATE ═══════════ */

    address public owner;
    address public oracle;

    IERC20           public rewardToken;
    IERC1155Mintable public prophecyNFT;

    uint256 public baseReward = 10 ether;
    uint256 public mintPrice  = 0.001 ether;

    mapping(address => uint256) public override currentStreak;
    mapping(address => uint256) public override lastListenTimestamp;
    mapping(address => uint256) public          totalHarvested;

    mapping(bytes32 => bool) public usedProofs;

    DailyProphecyInfo internal _dailyProphecy;
    uint256 public nextTokenId = 1;

    uint256 constant ONE_DAY   = 86400;
    uint256 constant STREAK_7  = 7;
    uint256 constant STREAK_14 = 14;
    uint256 constant STREAK_30 = 30;

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

    /* ═══════════ HARVEST TOKENS ═══════════ */

    function harvestTokens(uint256 songId, bytes32 proofHash) external override {
        require(proofHash != bytes32(0),    "Invalid proof");
        require(!usedProofs[proofHash],     "Proof already used");

        usedProofs[proofHash] = true;

        _updateStreak(msg.sender);

        uint256 multiplier = getStreakMultiplier(msg.sender);
        uint256 reward     = baseReward * multiplier;

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

    /* ═══════════ STREAK MANAGEMENT ═══════════ */

    function _updateStreak(address disciple) internal {
        uint256 last = lastListenTimestamp[disciple];
        uint256 elapsed = block.timestamp - last;

        if (last == 0) {
            currentStreak[disciple] = 1;
        } else if (elapsed >= ONE_DAY && elapsed < 2 * ONE_DAY) {
            currentStreak[disciple] += 1;
        } else if (elapsed >= 2 * ONE_DAY) {
            currentStreak[disciple] = 1;
        }

        lastListenTimestamp[disciple] = block.timestamp;

        emit StreakUpdated(
            disciple,
            currentStreak[disciple],
            getStreakMultiplier(disciple)
        );
    }

    /* ═══════════ STREAK MULTIPLIER ═══════════ */

    function getStreakMultiplier(address disciple) public view override returns (uint256) {
        uint256 streak = currentStreak[disciple];
        if (streak >= STREAK_30) return 5;
        if (streak >= STREAK_14) return 3;
        if (streak >= STREAK_7)  return 2;
        return 1;
    }

    /* ═══════════ DAILY PROPHECY ═══════════ */

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
        require(_dailyProphecy.songId == songId,             "Wrong prophecy songId");
        require(block.timestamp <= _dailyProphecy.expiresAt, "Prophecy window expired");
        require(msg.value >= mintPrice,                      "Insufficient offering");

        tokenId = nextTokenId++;
        _dailyProphecy.totalMinted += 1;

        prophecyNFT.mint(msg.sender, tokenId, 1, "");

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

    /* ═══════════ VIEW HELPERS ═══════════ */

    function getDiscipleInfo(address disciple) external view override returns (DiscipleInfo memory) {
        return DiscipleInfo({
            currentStreak:       currentStreak[disciple],
            lastListenTimestamp: lastListenTimestamp[disciple],
            totalHarvested:      totalHarvested[disciple],
            multiplier:          getStreakMultiplier(disciple)
        });
    }

    /* ═══════════ ADMIN / ORACLE ═══════════ */

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

    function withdrawOfferings() external onlyOwner {
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "Withdraw failed");
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    receive() external payable {}
}
