// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title AgoraRewards — Signature-gated $AGORA reward distribution
/// @notice Players earn $AGORA for verified in-game actions. The game server signs
///         claim tickets off-chain; players submit them to receive real tokens.
///
/// Flow:
///   1. Owner funds the pool by transferring $AGORA to this contract
///   2. Player completes action → server signs (player, amount, nonce, chainId, contract)
///   3. Player calls claim(amount, nonce, signature) → tokens transferred
///   4. Each nonce is one-time use (anti-replay)
///
/// Security:
///   - Ownable2Step (two-step ownership transfer)
///   - Pausable (emergency stop)
///   - Signer rotation via setSigner()
///   - Chain ID + contract address in signature (cross-chain replay safe)
///   - Pool balance check prevents over-distribution
///   - Owner can withdraw pool for rebalancing (withdrawPool)
///   - Non-AGORA token rescue (rescueTokens)
contract AgoraRewards is Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable AGORA;
    address public signer;

    mapping(uint256 => bool) public usedNonces;
    mapping(address => uint256) public totalClaimed;
    uint256 public totalDistributed;
    uint256 public totalClaims;

    // ─── Errors ──────────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error ZeroAmount();
    error InsufficientPool();

    // ─── Events ──────────────────────────────────────────────────────────────

    event Claimed(address indexed player, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event PoolWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _agora, address _signer, address _owner) Ownable(_owner) {
        if (_agora == address(0) || _signer == address(0)) revert ZeroAddress();
        AGORA = IERC20(_agora);
        signer = _signer;
    }

    // ─── Claim ───────────────────────────────────────────────────────────────

    /// @notice Claim $AGORA rewards using a server-signed ticket
    /// @param amount  Token amount in wei (18 decimals)
    /// @param nonce   Unique claim identifier (server-generated, one-time use)
    /// @param signature  ECDSA signature from the authorized signer
    function claim(uint256 amount, uint256 nonce, bytes calldata signature) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (usedNonces[nonce]) revert NonceAlreadyUsed();

        // Reconstruct the message the signer should have signed
        bytes32 messageHash = keccak256(
            abi.encode(msg.sender, amount, nonce, block.chainid, address(this))
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ECDSA.recover(ethSignedHash, signature);
        if (recovered != signer) revert InvalidSignature();

        // Check pool
        if (AGORA.balanceOf(address(this)) < amount) revert InsufficientPool();

        // Mark nonce, update tracking
        usedNonces[nonce] = true;
        totalClaimed[msg.sender] += amount;
        totalDistributed += amount;
        totalClaims++;

        // Transfer
        AGORA.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount, nonce);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @notice Current pool balance available for distribution
    function poolBalance() external view returns (uint256) {
        return AGORA.balanceOf(address(this));
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Update the authorized claim signer
    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, _signer);
        signer = _signer;
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
