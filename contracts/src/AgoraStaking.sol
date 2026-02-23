// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title AgoraStaking — Stake $AGORA for in-game revenue multiplier
/// @notice Tiered staking: 10M (+5%), 100M (+15%), 1B (+30%), 10B (+50%)
///         1% burn on unstake. Unstaking has a 30-second cooldown.
/// @dev Uses Ownable2Step for safe ownership transfer. Pausable for emergencies.
///      $AGORA is a standard Clanker ERC20 — no fee-on-transfer, no rebasing.
contract AgoraStaking is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ──────────────────────────────────────────────────────────────────

    IERC20 public immutable AGORA;

    struct StakeInfo {
        uint256 amount;
        uint256 unstakingAmount;
        uint256 unstakeAt; // timestamp when unstaking completes
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    uint256 public totalUnstaking; // tracks tokens in cooldown — prevents rescue drain
    uint256 public totalBurned;

    // ─── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant BURN_BPS = 100; // 1% burn on unstake
    uint256 public constant UNSTAKE_COOLDOWN = 30; // 30 seconds

    // Staking tier thresholds (18 decimals)
    uint256 public constant TIER_1 = 10_000_000 ether;    // 10M  → +5%
    uint256 public constant TIER_2 = 100_000_000 ether;    // 100M → +15%
    uint256 public constant TIER_3 = 1_000_000_000 ether;  // 1B   → +30%
    uint256 public constant TIER_4 = 10_000_000_000 ether; // 10B  → +50%

    // Bonus basis points per tier
    uint256 public constant BONUS_1 = 500;  // +5%
    uint256 public constant BONUS_2 = 1500; // +15%
    uint256 public constant BONUS_3 = 3000; // +30%
    uint256 public constant BONUS_4 = 5000; // +50%

    // ─── Events ─────────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 totalUserStake);
    event UnstakeInitiated(address indexed user, uint256 amount, uint256 completeAt);
    event UnstakeClaimed(address indexed user, uint256 received, uint256 burned);

    // ─── Errors ─────────────────────────────────────────────────────────────────

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientStake();
    error UnstakePending();
    error NoUnstakePending();
    error CooldownNotComplete();

    // ─── Constructor ────────────────────────────────────────────────────────────

    constructor(address _agora, address _owner) Ownable(_owner) {
        if (_agora == address(0)) revert ZeroAddress();
        AGORA = IERC20(_agora);
    }

    // ─── External Functions ─────────────────────────────────────────────────────

    /// @notice Stake $AGORA tokens. Can be called even with an active unstake.
    /// @param amount Amount of $AGORA to stake (18 decimals)
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        AGORA.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender].amount += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount, stakes[msg.sender].amount);
    }

    /// @notice Initiate unstaking with 30s cooldown
    /// @param amount Amount to unstake
    function initiateUnstake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (stakes[msg.sender].amount < amount) revert InsufficientStake();
        if (stakes[msg.sender].unstakingAmount > 0) revert UnstakePending();

        stakes[msg.sender].amount -= amount;
        stakes[msg.sender].unstakingAmount = amount;
        stakes[msg.sender].unstakeAt = block.timestamp + UNSTAKE_COOLDOWN;
        totalStaked -= amount;
        totalUnstaking += amount;

        emit UnstakeInitiated(msg.sender, amount, stakes[msg.sender].unstakeAt);
    }

    /// @notice Claim unstaked tokens after cooldown (1% burned)
    function claimUnstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        if (info.unstakingAmount == 0) revert NoUnstakePending();
        if (block.timestamp < info.unstakeAt) revert CooldownNotComplete();

        uint256 total = info.unstakingAmount;
        uint256 burnAmount = (total * BURN_BPS) / 10_000;
        uint256 received = total - burnAmount;

        // Effects before interactions
        info.unstakingAmount = 0;
        info.unstakeAt = 0;
        totalUnstaking -= total;

        // Burn by sending to address(0xdead) — $AGORA is a Clanker token, no burn() method
        if (burnAmount > 0) {
            AGORA.safeTransfer(address(0xdead), burnAmount);
            totalBurned += burnAmount;
        }

        AGORA.safeTransfer(msg.sender, received);

        emit UnstakeClaimed(msg.sender, received, burnAmount);
    }

    // ─── View Functions ─────────────────────────────────────────────────────────

    /// @notice Get staking tier (0 = none, 1-4 = tier levels)
    function getStakeTier(address user) external view returns (uint8) {
        uint256 amt = stakes[user].amount;
        if (amt >= TIER_4) return 4;
        if (amt >= TIER_3) return 3;
        if (amt >= TIER_2) return 2;
        if (amt >= TIER_1) return 1;
        return 0;
    }

    /// @notice Get bonus in basis points (0, 500, 1500, 3000, 5000)
    function getStakeBonus(address user) external view returns (uint256) {
        uint256 amt = stakes[user].amount;
        if (amt >= TIER_4) return BONUS_4;
        if (amt >= TIER_3) return BONUS_3;
        if (amt >= TIER_2) return BONUS_2;
        if (amt >= TIER_1) return BONUS_1;
        return 0;
    }

    /// @notice Full stake info for a user
    function getUserStake(address user) external view returns (
        uint256 staked,
        uint256 unstaking,
        uint256 unstakeAt,
        uint8 tier,
        uint256 bonusBps
    ) {
        StakeInfo storage info = stakes[user];
        staked = info.amount;
        unstaking = info.unstakingAmount;
        unstakeAt = info.unstakeAt;

        if (staked >= TIER_4) { tier = 4; bonusBps = BONUS_4; }
        else if (staked >= TIER_3) { tier = 3; bonusBps = BONUS_3; }
        else if (staked >= TIER_2) { tier = 2; bonusBps = BONUS_2; }
        else if (staked >= TIER_1) { tier = 1; bonusBps = BONUS_1; }
        else { tier = 0; bonusBps = 0; }
    }

    /// @notice Total committed tokens (staked + in cooldown)
    function totalCommitted() external view returns (uint256) {
        return totalStaked + totalUnstaking;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Pause all staking/unstaking in case of emergency
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause staking/unstaking
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Rescue stuck tokens (not staked or unstaking $AGORA)
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        if (token == address(AGORA)) {
            // Guard: cannot rescue staked or unstaking tokens
            uint256 committed = totalStaked + totalUnstaking;
            uint256 balance = AGORA.balanceOf(address(this));
            require(balance >= committed, "Balance invariant broken");
            uint256 excess = balance - committed;
            require(amount <= excess, "Cannot rescue committed tokens");
        }
        IERC20(token).safeTransfer(owner(), amount);
    }
}
