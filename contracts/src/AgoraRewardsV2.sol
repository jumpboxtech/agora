// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title AgoraRewardsV2 — Sybil-resistant $AGORA reward distribution
/// @notice V2 adds on-chain caps, cooldowns, and FID binding to prevent sybil attacks.
///
/// Changes from V1:
///   - FID included in signature hash (ties ticket to Farcaster identity)
///   - Per-claim amount cap (maxClaimAmount)
///   - Daily cap per wallet (dailyWalletCap) tracked by epoch day
///   - Daily cap per FID (dailyFidCap) tracked by epoch day
///   - Lifetime cap per wallet (lifetimeCap)
///   - Cooldown between claims per wallet (claimCooldown)
///   - All limits owner-configurable via setLimits()
///
/// Signature: keccak256(abi.encode(player, amount, nonce, fid, chainId, contract))
contract AgoraRewardsV2 is Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable AGORA;
    address public signer;

    // ─── Replay Protection ──────────────────────────────────────────────────
    mapping(uint256 => bool) public usedNonces;

    // ─── Tracking ───────────────────────────────────────────────────────────
    mapping(address => uint256) public totalClaimed;
    uint256 public totalDistributed;
    uint256 public totalClaims;

    // ─── Sybil Protection ───────────────────────────────────────────────────
    /// @notice Amount claimed per wallet per epoch day
    mapping(address => mapping(uint256 => uint256)) public walletClaimedDay;
    /// @notice Amount claimed per FID per epoch day
    mapping(uint256 => mapping(uint256 => uint256)) public fidClaimedDay;
    /// @notice Timestamp of last claim per wallet (for cooldown)
    mapping(address => uint256) public lastClaimTime;

    // ─── Configurable Limits ────────────────────────────────────────────────
    uint256 public maxClaimAmount;
    uint256 public dailyWalletCap;
    uint256 public dailyFidCap;
    uint256 public lifetimeCap;
    uint256 public claimCooldown;

    // ─── Errors ─────────────────────────────────────────────────────────────
    error ZeroAddress();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error ZeroAmount();
    error InsufficientPool();
    error ExceedsMaxClaim();
    error DailyWalletCapReached();
    error DailyFidCapReached();
    error LifetimeCapReached();
    error CooldownActive();

    // ─── Events ─────────────────────────────────────────────────────────────
    event Claimed(address indexed player, uint256 amount, uint256 nonce, uint256 fid);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event PoolWithdrawn(address indexed to, uint256 amount);
    event LimitsUpdated(uint256 maxClaimAmount, uint256 dailyWalletCap, uint256 dailyFidCap, uint256 lifetimeCap, uint256 claimCooldown);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(
        address _agora,
        address _signer,
        address _owner,
        uint256 _maxClaimAmount,
        uint256 _dailyWalletCap,
        uint256 _dailyFidCap,
        uint256 _lifetimeCap,
        uint256 _claimCooldown
    ) Ownable(_owner) {
        if (_agora == address(0) || _signer == address(0)) revert ZeroAddress();
        AGORA = IERC20(_agora);
        signer = _signer;
        maxClaimAmount = _maxClaimAmount;
        dailyWalletCap = _dailyWalletCap;
        dailyFidCap = _dailyFidCap;
        lifetimeCap = _lifetimeCap;
        claimCooldown = _claimCooldown;
    }

    // ─── Claim ──────────────────────────────────────────────────────────────

    /// @notice Claim $AGORA rewards using a server-signed ticket
    /// @param amount    Token amount in wei (18 decimals)
    /// @param nonce     Unique claim identifier (server-generated, one-time use)
    /// @param fid       Farcaster ID bound to this ticket
    /// @param signature ECDSA signature from the authorized signer
    function claim(uint256 amount, uint256 nonce, uint256 fid, bytes calldata signature) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (amount > maxClaimAmount) revert ExceedsMaxClaim();
        if (usedNonces[nonce]) revert NonceAlreadyUsed();

        // Verify signature (V2: includes fid)
        bytes32 messageHash = keccak256(
            abi.encode(msg.sender, amount, nonce, fid, block.chainid, address(this))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ECDSA.recover(ethSignedHash, signature);
        if (recovered != signer) revert InvalidSignature();

        // Check pool balance
        if (AGORA.balanceOf(address(this)) < amount) revert InsufficientPool();

        // Epoch day for daily caps
        uint256 epochDay = block.timestamp / 86400;

        // Daily wallet cap
        if (walletClaimedDay[msg.sender][epochDay] + amount > dailyWalletCap) revert DailyWalletCapReached();

        // Daily FID cap
        if (fidClaimedDay[fid][epochDay] + amount > dailyFidCap) revert DailyFidCapReached();

        // Lifetime cap
        if (totalClaimed[msg.sender] + amount > lifetimeCap) revert LifetimeCapReached();

        // Cooldown (skip on first claim when lastClaimTime is 0)
        uint256 last = lastClaimTime[msg.sender];
        if (last != 0 && block.timestamp - last < claimCooldown) revert CooldownActive();

        // Update state
        usedNonces[nonce] = true;
        walletClaimedDay[msg.sender][epochDay] += amount;
        fidClaimedDay[fid][epochDay] += amount;
        totalClaimed[msg.sender] += amount;
        totalDistributed += amount;
        totalClaims++;
        lastClaimTime[msg.sender] = block.timestamp;

        // Transfer
        AGORA.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount, nonce, fid);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /// @notice Current pool balance available for distribution
    function poolBalance() external view returns (uint256) {
        return AGORA.balanceOf(address(this));
    }

    /// @notice How much a wallet can still claim today
    function dailyWalletRemaining(address wallet) external view returns (uint256) {
        uint256 epochDay = block.timestamp / 86400;
        uint256 claimed = walletClaimedDay[wallet][epochDay];
        return claimed >= dailyWalletCap ? 0 : dailyWalletCap - claimed;
    }

    /// @notice How much a FID can still claim today
    function dailyFidRemaining(uint256 fid) external view returns (uint256) {
        uint256 epochDay = block.timestamp / 86400;
        uint256 claimed = fidClaimedDay[fid][epochDay];
        return claimed >= dailyFidCap ? 0 : dailyFidCap - claimed;
    }

    /// @notice How much a wallet can still claim (lifetime)
    function lifetimeRemaining(address wallet) external view returns (uint256) {
        uint256 claimed = totalClaimed[wallet];
        return claimed >= lifetimeCap ? 0 : lifetimeCap - claimed;
    }

    /// @notice Seconds until a wallet's cooldown expires (0 if ready)
    function cooldownRemaining(address wallet) external view returns (uint256) {
        uint256 last = lastClaimTime[wallet];
        if (last == 0) return 0;
        uint256 elapsed = block.timestamp - last;
        return elapsed >= claimCooldown ? 0 : claimCooldown - elapsed;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    /// @notice Update the authorized claim signer
    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    /// @notice Update all configurable limits
    function setLimits(
        uint256 _maxClaimAmount,
        uint256 _dailyWalletCap,
        uint256 _dailyFidCap,
        uint256 _lifetimeCap,
        uint256 _claimCooldown
    ) external onlyOwner {
        maxClaimAmount = _maxClaimAmount;
        dailyWalletCap = _dailyWalletCap;
        dailyFidCap = _dailyFidCap;
        lifetimeCap = _lifetimeCap;
        claimCooldown = _claimCooldown;
        emit LimitsUpdated(_maxClaimAmount, _dailyWalletCap, _dailyFidCap, _lifetimeCap, _claimCooldown);
    }

    /// @notice Withdraw $AGORA from the pool (rebalancing / emergency)
    function withdrawPool(uint256 amount) external onlyOwner {
        AGORA.safeTransfer(owner(), amount);
        emit PoolWithdrawn(owner(), amount);
    }

    /// @notice Pause all claims
    function pause() external onlyOwner { _pause(); }
    /// @notice Unpause claims
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Rescue non-AGORA tokens accidentally sent to this contract
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(AGORA), "Cannot rescue AGORA");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
