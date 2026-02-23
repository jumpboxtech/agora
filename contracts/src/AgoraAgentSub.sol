// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title AgoraAgentSub — Agent Launchpad Subscription
/// @notice Pay $AGORA monthly to host a real x402 agent on shared infrastructure.
///         50% of payment is burned, 50% goes to treasury.
///         Three tiers: Starter (50M/mo), Pro (100M/mo), Enterprise (250M/mo).
/// @dev Uses Ownable2Step for safe ownership transfer. Agent names are unique on-chain.
///      $AGORA is a standard Clanker ERC20 — no fee-on-transfer, no rebasing.
contract AgoraAgentSub is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ──────────────────────────────────────────────────────────────────

    IERC20 public immutable AGORA;
    address public treasury;

    struct Subscription {
        uint8 tier;         // 0=none, 1=starter, 2=pro, 3=enterprise
        uint256 expiresAt;  // timestamp when subscription ends
        string agentName;   // subdomain slug (e.g. "my-agent")
        address payTo;      // x402 revenue destination wallet
    }

    mapping(address => Subscription) public subs;
    mapping(bytes32 => address) public nameOwner; // keccak256(name) => owner
    uint256 public totalBurned;
    uint256 public totalActiveSubscriptions;

    // Tier costs (18 decimals) — fixed token amounts
    uint256[4] public tierCosts = [
        0,                          // tier 0: none
        50_000_000 ether,           // tier 1: Starter — 50M $AGORA/mo
        100_000_000 ether,          // tier 2: Pro — 100M $AGORA/mo
        250_000_000 ether           // tier 3: Enterprise — 250M $AGORA/mo
    ];

    uint256 public constant SUB_DURATION = 30 days;
    uint256 public constant BURN_BPS = 5000; // 50% burned
    uint256 public constant MAX_NAME_LENGTH = 63; // DNS label limit
    uint256 public constant MAX_PREPAID_DURATION = 365 days;

    // ─── Events ─────────────────────────────────────────────────────────────────

    event Subscribed(
        address indexed user,
        uint8 tier,
        string agentName,
        address payTo,
        uint256 expiresAt,
        uint256 burned,
        uint256 toTreasury
    );
    event Renewed(address indexed user, uint8 tier, uint256 newExpiresAt, uint256 burned, uint256 toTreasury);
    event AgentConfigUpdated(address indexed user, string newAgentName, address newPayTo);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event TierCostUpdated(uint8 tier, uint256 newCost);
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

    // ─── Constructor ────────────────────────────────────────────────────────────

    constructor(address _agora, address _treasury, address _owner) Ownable(_owner) {
        if (_agora == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        AGORA = IERC20(_agora);
        treasury = _treasury;
    }

    // ─── External Functions ─────────────────────────────────────────────────────

    /// @notice Subscribe to a tier — first time or upgrade/downgrade
    /// @param tier 1=Starter, 2=Pro, 3=Enterprise
    /// @param agentName Subdomain slug (lowercase a-z, 0-9, hyphens, 1-63 chars)
    /// @param payTo Wallet to receive x402 revenue
    function subscribe(uint8 tier, string calldata agentName, address payTo) external nonReentrant whenNotPaused {
        if (tier == 0 || tier > 3) revert InvalidTier();
        if (payTo == address(0)) revert ZeroAddress();
        _validateName(agentName);

        // Enforce name uniqueness
        bytes32 nameHash = keccak256(bytes(agentName));
        address currentNameOwner = nameOwner[nameHash];
        if (currentNameOwner != address(0) && currentNameOwner != msg.sender) revert NameTaken();

        uint256 cost = tierCosts[tier];
        (uint256 burned, uint256 toTreasury) = _processPayment(cost);

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

        // Claim new name
        nameOwner[nameHash] = msg.sender;

        subs[msg.sender] = Subscription({
            tier: tier,
            expiresAt: expiresAt,
            agentName: agentName,
            payTo: payTo
        });

        emit Subscribed(msg.sender, tier, agentName, payTo, expiresAt, burned, toTreasury);
    }

    /// @notice Renew existing subscription (same tier)
    function renew() external nonReentrant whenNotPaused {
        Subscription storage sub = subs[msg.sender];
        if (sub.tier == 0) revert NotSubscribed();

        uint256 cost = tierCosts[sub.tier];
        (uint256 burned, uint256 toTreasury) = _processPayment(cost);

        // Extend from current expiry or now, whichever is later
        if (sub.expiresAt > block.timestamp) {
            sub.expiresAt += SUB_DURATION;
        } else {
            sub.expiresAt = block.timestamp + SUB_DURATION;
        }
        if (sub.expiresAt > block.timestamp + MAX_PREPAID_DURATION) revert MaxPrepaidExceeded();

        emit Renewed(msg.sender, sub.tier, sub.expiresAt, burned, toTreasury);
    }

    /// @notice Update agent configuration (name and payTo)
    function updateAgent(string calldata agentName, address payTo) external whenNotPaused {
        Subscription storage sub = subs[msg.sender];
        if (sub.tier == 0) revert NotSubscribed();
        if (sub.expiresAt <= block.timestamp) revert SubscriptionExpired();
        if (payTo == address(0)) revert ZeroAddress();
        _validateName(agentName);

        // Enforce name uniqueness
        bytes32 nameHash = keccak256(bytes(agentName));
        address currentNameOwner = nameOwner[nameHash];
        if (currentNameOwner != address(0) && currentNameOwner != msg.sender) revert NameTaken();

        // Release old name
        bytes32 oldHash = keccak256(bytes(sub.agentName));
        if (oldHash != nameHash) {
            delete nameOwner[oldHash];
            nameOwner[nameHash] = msg.sender;
        }

        sub.agentName = agentName;
        sub.payTo = payTo;

        emit AgentConfigUpdated(msg.sender, agentName, payTo);
    }

    /// @notice Release your agent name (useful if subscription expired)
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

    /// @notice Check if a user's subscription is currently active
    function isActive(address user) external view returns (bool) {
        return subs[user].expiresAt > block.timestamp;
    }

    /// @notice Get full subscription info
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

    /// @notice Get cost for a specific tier
    function getTierCost(uint8 tier) external view returns (uint256) {
        if (tier > 3) revert InvalidTier();
        return tierCosts[tier];
    }

    /// @notice Check if a name is available
    function isNameAvailable(string calldata name) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(name));
        address owner_ = nameOwner[nameHash];
        if (owner_ == address(0)) return true;
        // Name is also available if owner's subscription expired
        return subs[owner_].expiresAt <= block.timestamp;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Update treasury address
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    /// @notice Update tier cost
    function setTierCost(uint8 tier, uint256 cost) external onlyOwner {
        if (tier == 0 || tier > 3) revert InvalidTier();
        tierCosts[tier] = cost;
        emit TierCostUpdated(tier, cost);
    }

    /// @notice Pause subscriptions in case of emergency
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause subscriptions
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Rescue stuck tokens. Cannot rescue $AGORA (no $AGORA should sit in contract).
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(AGORA), "Cannot rescue AGORA");
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    /// @dev Validate agent name: 1-63 chars, lowercase a-z, 0-9, hyphens, no leading/trailing hyphen
    function _validateName(string calldata name) internal pure {
        uint256 len = bytes(name).length;
        if (len == 0) revert EmptyAgentName();
        if (len > MAX_NAME_LENGTH) revert NameTooLong();

        bytes memory b = bytes(name);
        // No leading or trailing hyphen
        if (b[0] == 0x2d || b[len - 1] == 0x2d) revert InvalidNameChar();

        for (uint256 i; i < len; ++i) {
            bytes1 c = b[i];
            // a-z (0x61-0x7a), 0-9 (0x30-0x39), hyphen (0x2d)
            bool valid = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x2d;
            if (!valid) revert InvalidNameChar();
        }
    }

    /// @dev Process payment: 50% burn to 0xdead, 50% to treasury
    /// @return burned Amount sent to 0xdead
    /// @return toTreasury Amount sent to treasury
    function _processPayment(uint256 cost) internal returns (uint256 burned, uint256 toTreasury) {
        AGORA.safeTransferFrom(msg.sender, address(this), cost);

        burned = (cost * BURN_BPS) / 10_000;
        toTreasury = cost - burned;

        // Burn by sending to dead address (Clanker tokens have no burn())
        if (burned > 0) {
            AGORA.safeTransfer(address(0xdead), burned);
            totalBurned += burned;
        }

        if (toTreasury > 0) {
            AGORA.safeTransfer(treasury, toTreasury);
        }
    }
}
