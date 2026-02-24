// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Minimal interface for the Uniswap V4 community router (z0r0z/v4-router)
/// deployed at 0x00000000000044a361Ae3cAc094c9D1b14Eece97
interface IV4Router {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        bool zeroForOne,
        PoolKey calldata poolKey,
        bytes calldata hookData,
        address receiver,
        uint256 deadline
    ) external payable returns (int256);
}

/// @title AgoraAgentSubV2 — USDC Subscription with Auto Buy & Burn via Uniswap V4
/// @notice Pay USDC monthly to host an x402 agent. 50% stays as USDC in treasury,
///         50% is swapped to $AGORA via Uniswap V4 and burned.
///         Three tiers: Starter ($10/mo), Pro ($25/mo), Enterprise ($50/mo).
/// @dev USDC has 6 decimals. Swap uses Uniswap V4 community router on Base.
///      AGORA (0x1Ea...) < USDC (0x833...), so AGORA = currency0, USDC = currency1.
///      Swapping USDC → AGORA means zeroForOne = false.
contract AgoraAgentSubV2 is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ──────────────────────────────────────────────────────────────────

    IERC20 public immutable USDC;
    IERC20 public immutable AGORA;
    IV4Router public immutable SWAP_ROUTER;

    address public treasury;

    /// @notice Uniswap V4 pool key for the AGORA/USDC pool.
    ///         Set at construction, updateable by owner if pool changes.
    IV4Router.PoolKey public swapPoolKey;

    struct Subscription {
        uint8 tier;         // 0=none, 1=starter, 2=pro, 3=enterprise
        uint256 expiresAt;  // timestamp when subscription ends
        string agentName;   // subdomain slug (e.g. "my-agent")
        address payTo;      // x402 revenue destination wallet
    }

    mapping(address => Subscription) public subs;
    mapping(bytes32 => address) public nameOwner; // keccak256(name) => owner
    uint256 public totalBurned;                   // total $AGORA burned (18 decimals)
    uint256 public totalUsdcCollected;            // total USDC collected (6 decimals)
    uint256 public totalActiveSubscriptions;

    // Tier costs in USDC (6 decimals)
    uint256[4] public tierCosts = [
        0,           // tier 0: none
        10e6,        // tier 1: Starter — $10/mo
        25e6,        // tier 2: Pro — $25/mo
        50e6         // tier 3: Enterprise — $50/mo
    ];

    uint256 public constant SUB_DURATION = 30 days;
    uint256 public constant BURN_BPS = 5000; // 50% swapped to AGORA and burned
    uint256 public constant MAX_NAME_LENGTH = 63;
    uint256 public constant MAX_PREPAID_DURATION = 365 days;
    address public constant DEAD = address(0xdead);

    // Minimum slippage protection: accept at least 1 wei of AGORA from swap
    // Owner can set a higher minimum via setMinSwapOut if needed
    uint256 public minSwapOut = 1;

    // ─── Events ─────────────────────────────────────────────────────────────────

    event Subscribed(
        address indexed user,
        uint8 tier,
        string agentName,
        address payTo,
        uint256 expiresAt,
        uint256 usdcToTreasury,
        uint256 agoraBurned
    );
    event Renewed(address indexed user, uint8 tier, uint256 newExpiresAt, uint256 usdcToTreasury, uint256 agoraBurned);
    event AgentConfigUpdated(address indexed user, string newAgentName, address newPayTo);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event TierCostUpdated(uint8 tier, uint256 newCostUsdc);
    event PoolKeyUpdated();
    event NameReleased(address indexed user, string agentName);

    // ─── Errors ─────────────────────────────────────────────────────────────────

    error InvalidTier();
    error EmptyAgentName();
    error NameTooLong();
    error InvalidNameChar();
    error NameTaken();
    error ZeroAddress();
    error NotSubscribed();
    error SubscriptionExpired();
    error MaxPrepaidExceeded();
    error InvalidPoolKey();

    // ─── Constructor ────────────────────────────────────────────────────────────

    /// @param _usdc USDC token address (6 decimals)
    /// @param _agora $AGORA token address (18 decimals)
    /// @param _swapRouter Uniswap V4 community router address
    /// @param _treasury Treasury wallet for USDC revenue
    /// @param _poolKey V4 PoolKey for the AGORA/USDC pool
    /// @param _owner Contract owner
    constructor(
        address _usdc,
        address _agora,
        address _swapRouter,
        address _treasury,
        IV4Router.PoolKey memory _poolKey,
        address _owner
    ) Ownable(_owner) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_agora == address(0)) revert ZeroAddress();
        if (_swapRouter == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_poolKey.currency0 == address(0) || _poolKey.currency1 == address(0)) revert InvalidPoolKey();

        USDC = IERC20(_usdc);
        AGORA = IERC20(_agora);
        SWAP_ROUTER = IV4Router(_swapRouter);
        treasury = _treasury;
        swapPoolKey = _poolKey;
    }

    // ─── External Functions ─────────────────────────────────────────────────────

    /// @notice Subscribe to a tier — first time or upgrade/downgrade
    /// @param tier 1=Starter ($10), 2=Pro ($25), 3=Enterprise ($50)
    /// @param agentName Subdomain slug (lowercase a-z, 0-9, hyphens, 1-63 chars)
    /// @param payTo Wallet to receive x402 revenue
    function subscribe(uint8 tier, string calldata agentName, address payTo) external nonReentrant whenNotPaused {
        if (tier == 0 || tier > 3) revert InvalidTier();
        if (payTo == address(0)) revert ZeroAddress();
        _validateName(agentName);

        bytes32 nameHash = keccak256(bytes(agentName));
        address currentNameOwner = nameOwner[nameHash];
        if (currentNameOwner != address(0) && currentNameOwner != msg.sender) revert NameTaken();

        uint256 cost = tierCosts[tier];
        (uint256 toTreasury, uint256 agoraBurned) = _processPayment(cost);

        // Calculate expiry
        uint256 expiresAt;
        Subscription storage existing = subs[msg.sender];
        if (existing.expiresAt > block.timestamp) {
            expiresAt = existing.expiresAt + SUB_DURATION;
        } else {
            expiresAt = block.timestamp + SUB_DURATION;
            if (existing.tier == 0) {
                totalActiveSubscriptions++;
            }
        }
        if (expiresAt > block.timestamp + MAX_PREPAID_DURATION) revert MaxPrepaidExceeded();

        // Release old name if changing
        if (bytes(existing.agentName).length > 0) {
            bytes32 oldHash = keccak256(bytes(existing.agentName));
            if (oldHash != nameHash) {
                delete nameOwner[oldHash];
            }
        }

        nameOwner[nameHash] = msg.sender;

        subs[msg.sender] = Subscription({
            tier: tier,
            expiresAt: expiresAt,
            agentName: agentName,
            payTo: payTo
        });

        emit Subscribed(msg.sender, tier, agentName, payTo, expiresAt, toTreasury, agoraBurned);
    }

    /// @notice Renew existing subscription (same tier)
    function renew() external nonReentrant whenNotPaused {
        Subscription storage sub = subs[msg.sender];
        if (sub.tier == 0) revert NotSubscribed();

        uint256 cost = tierCosts[sub.tier];
        (uint256 toTreasury, uint256 agoraBurned) = _processPayment(cost);

        if (sub.expiresAt > block.timestamp) {
            sub.expiresAt += SUB_DURATION;
        } else {
            sub.expiresAt = block.timestamp + SUB_DURATION;
        }
        if (sub.expiresAt > block.timestamp + MAX_PREPAID_DURATION) revert MaxPrepaidExceeded();

        emit Renewed(msg.sender, sub.tier, sub.expiresAt, toTreasury, agoraBurned);
    }

    /// @notice Update agent configuration (name and payTo)
    function updateAgent(string calldata agentName, address payTo) external whenNotPaused {
        Subscription storage sub = subs[msg.sender];
        if (sub.tier == 0) revert NotSubscribed();
        if (sub.expiresAt <= block.timestamp) revert SubscriptionExpired();
        if (payTo == address(0)) revert ZeroAddress();
        _validateName(agentName);

        bytes32 nameHash = keccak256(bytes(agentName));
        address currentNameOwner = nameOwner[nameHash];
        if (currentNameOwner != address(0) && currentNameOwner != msg.sender) revert NameTaken();

        bytes32 oldHash = keccak256(bytes(sub.agentName));
        if (oldHash != nameHash) {
            delete nameOwner[oldHash];
            nameOwner[nameHash] = msg.sender;
        }

        sub.agentName = agentName;
        sub.payTo = payTo;

        emit AgentConfigUpdated(msg.sender, agentName, payTo);
    }

    /// @notice Release your agent name
    function releaseName() external {
        Subscription storage sub = subs[msg.sender];
        if (bytes(sub.agentName).length == 0) revert NotSubscribed();

        bytes32 nameHash = keccak256(bytes(sub.agentName));
        string memory oldName = sub.agentName;
        delete nameOwner[nameHash];
        sub.agentName = "";

        emit NameReleased(msg.sender, oldName);
    }

    // ─── View Functions ─────────────────────────────────────────────────────────

    function isActive(address user) external view returns (bool) {
        return subs[user].expiresAt > block.timestamp;
    }

    function getSubscription(address user) external view returns (
        uint8 tier,
        uint256 expiresAt,
        string memory agentName,
        address payTo,
        bool active
    ) {
        Subscription storage sub = subs[user];
        tier = sub.tier;
        expiresAt = sub.expiresAt;
        agentName = sub.agentName;
        payTo = sub.payTo;
        active = sub.expiresAt > block.timestamp;
    }

    function getTierCost(uint8 tier) external view returns (uint256) {
        if (tier > 3) revert InvalidTier();
        return tierCosts[tier];
    }

    function isNameAvailable(string calldata name) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(name));
        address owner_ = nameOwner[nameHash];
        if (owner_ == address(0)) return true;
        return subs[owner_].expiresAt <= block.timestamp;
    }

    function getPoolKey() external view returns (
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks
    ) {
        IV4Router.PoolKey storage pk = swapPoolKey;
        return (pk.currency0, pk.currency1, pk.fee, pk.tickSpacing, pk.hooks);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function setTierCost(uint8 tier, uint256 cost) external onlyOwner {
        if (tier == 0 || tier > 3) revert InvalidTier();
        tierCosts[tier] = cost;
        emit TierCostUpdated(tier, cost);
    }

    /// @notice Update the V4 pool key (e.g. if pool migrates or fee changes)
    function setPoolKey(IV4Router.PoolKey calldata _poolKey) external onlyOwner {
        if (_poolKey.currency0 == address(0) || _poolKey.currency1 == address(0)) revert InvalidPoolKey();
        swapPoolKey = _poolKey;
        emit PoolKeyUpdated();
    }

    function setMinSwapOut(uint256 _minSwapOut) external onlyOwner {
        minSwapOut = _minSwapOut;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Rescue stuck tokens. Cannot rescue USDC or AGORA.
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(USDC) && token != address(AGORA), "Cannot rescue core tokens");
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    function _validateName(string calldata name) internal pure {
        uint256 len = bytes(name).length;
        if (len == 0) revert EmptyAgentName();
        if (len > MAX_NAME_LENGTH) revert NameTooLong();

        bytes memory b = bytes(name);
        if (b[0] == 0x2d || b[len - 1] == 0x2d) revert InvalidNameChar();

        for (uint256 i; i < len; ++i) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x2d;
            if (!valid) revert InvalidNameChar();
        }
    }

    /// @dev Process USDC payment: 50% to treasury, 50% swapped to $AGORA via V4 and burned
    /// @return toTreasury USDC sent to treasury (6 decimals)
    /// @return agoraBurned $AGORA bought and burned (18 decimals)
    function _processPayment(uint256 cost) internal returns (uint256 toTreasury, uint256 agoraBurned) {
        // Pull USDC from sender
        USDC.safeTransferFrom(msg.sender, address(this), cost);
        totalUsdcCollected += cost;

        toTreasury = cost / 2;
        uint256 swapAmount = cost - toTreasury; // handles odd amounts

        // 50% USDC to treasury
        if (toTreasury > 0) {
            USDC.safeTransfer(treasury, toTreasury);
        }

        // 50% USDC → swap to $AGORA via Uniswap V4 → burn
        if (swapAmount > 0) {
            // Approve V4 router to pull USDC from this contract
            USDC.forceApprove(address(SWAP_ROUTER), swapAmount);

            // Track AGORA burned by checking dead address balance
            uint256 deadBefore = AGORA.balanceOf(DEAD);

            // Swap USDC (currency1) → AGORA (currency0), so zeroForOne = false
            SWAP_ROUTER.swapExactTokensForTokens(
                swapAmount,
                minSwapOut,
                false, // zeroForOne: false because USDC is currency1, AGORA is currency0
                swapPoolKey,
                "", // hookData
                DEAD, // receiver: burn address
                block.timestamp
            );

            agoraBurned = AGORA.balanceOf(DEAD) - deadBefore;
            totalBurned += agoraBurned;
        }
    }
}
