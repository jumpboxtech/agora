// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AgoraLaunchpad} from "./AgoraLaunchpad.sol";
import {AgoraEndpointRegistry} from "./AgoraEndpointRegistry.sol";
import {IAgoraAgentSub} from "./interfaces/IAgoraAgentSub.sol";
import {IV3SwapRouter} from "./interfaces/IV3SwapRouter.sol";

/// @title AgoraRouter — x402 payment router with dual payment mode
/// @notice Routes $AGORA payments through agent bonding curves (mode 0) or directly
///         to agent payTo addresses (mode 1). Per-endpoint configuration.
///         Pre-graduation: bonding curve buy. Post-graduation: Uniswap V3 swap.
///         Nonce-based replay protection with on-chain receipts for verification.
contract AgoraRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Structs ─────────────────────────────────────────────────────────────────

    struct Receipt {
        address payer;
        address agent;
        uint256 curveId;        // 0 if direct payment
        uint256 agoraAmount;
        uint256 tokensReceived; // 0 if direct payment
        uint256 fee;
        uint256 blockNumber;
        bool viaUniswap;
        bool directPayment;
    }

    // ─── Immutables ──────────────────────────────────────────────────────────────

    AgoraLaunchpad public immutable launchpad;
    AgoraEndpointRegistry public immutable endpointRegistry;
    IAgoraAgentSub public immutable agentSub;
    IV3SwapRouter public immutable swapRouter;
    IERC20 public immutable agora;

    // ─── State ───────────────────────────────────────────────────────────────────

    address public admin;
    address public pendingAdmin;
    uint256 public totalPayments;
    uint256 public totalVolumeAgora;

    mapping(bytes16 => Receipt) public receipts;
    mapping(bytes16 => bool) public nonceUsed;

    // ─── Events ──────────────────────────────────────────────────────────────────

    event PaymentProcessed(
        bytes16 indexed nonce,
        address indexed payer,
        address indexed agent,
        uint256 agoraAmount,
        uint256 tokensReceived,
        uint256 fee,
        bool directPayment,
        bool viaUniswap
    );

    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed newAdmin);

    // ─── Errors ──────────────────────────────────────────────────────────────────

    error NonceUsed();
    error ZeroAmount();
    error BelowMinimum();
    error EndpointNotActive();
    error NoCurve();
    error NotAdmin();
    error NotPendingAdmin();

    // ─── Modifiers ───────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────────

    constructor(
        address launchpad_,
        address endpointRegistry_,
        address agentSub_,
        address swapRouter_,
        address agora_,
        address admin_
    ) {
        launchpad = AgoraLaunchpad(launchpad_);
        endpointRegistry = AgoraEndpointRegistry(endpointRegistry_);
        agentSub = IAgoraAgentSub(agentSub_);
        swapRouter = IV3SwapRouter(swapRouter_);
        agora = IERC20(agora_);
        admin = admin_;
    }

    // ─── Core ────────────────────────────────────────────────────────────────────

    /// @notice Pay for an agent's service. Routes through bonding curve or direct based on endpoint config.
    /// @param agent The agent's wallet address
    /// @param agoraAmount $AGORA amount (18 decimals)
    /// @param nonce 16-byte unique identifier for replay protection
    /// @param endpointPath Which endpoint (e.g. "/api/v1/chat")
    /// @param minTokensOut Slippage protection (ignored for direct mode)
    function payForService(
        address agent,
        uint256 agoraAmount,
        bytes16 nonce,
        string calldata endpointPath,
        uint256 minTokensOut
    ) external nonReentrant returns (uint256 tokensReceived, uint256 fee) {
        // Validations
        if (nonceUsed[nonce]) revert NonceUsed();
        if (agoraAmount == 0) revert ZeroAmount();

        // Look up endpoint
        if (!endpointRegistry.isEndpointActive(agent, endpointPath)) revert EndpointNotActive();
        uint256 minPrice = endpointRegistry.getMinPrice(agent, endpointPath);
        if (minPrice > 0 && agoraAmount < minPrice) revert BelowMinimum();

        uint8 paymentMode = endpointRegistry.getPaymentMode(agent, endpointPath);

        // Pull $AGORA from payer
        agora.safeTransferFrom(msg.sender, address(this), agoraAmount);

        bool viaUniswap;
        bool directPayment;
        uint256 curveId;

        if (paymentMode == 0) {
            // ─── Mode 0: Curve (buy agent tokens) ─────────────────────────

            // Look up agent's curve
            if (!launchpad.hasLaunched(agent)) revert NoCurve();
            curveId = launchpad.getAgentCurve(agent);
            AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);

            if (!curve.graduated) {
                // Pre-graduation: buy on bonding curve
                agora.approve(address(launchpad), agoraAmount);
                (tokensReceived, fee) = launchpad.buy(curveId, agoraAmount, minTokensOut);

                // Launchpad sends tokens to this contract, forward to payer
                IERC20(curve.token).safeTransfer(msg.sender, tokensReceived);
            } else {
                // Post-graduation: swap on Uniswap V3
                agora.approve(address(swapRouter), agoraAmount);

                tokensReceived = swapRouter.exactInputSingle(IV3SwapRouter.ExactInputSingleParams({
                    tokenIn: address(agora),
                    tokenOut: curve.token,
                    fee: 10000, // 1% pool fee (matches graduation pool)
                    recipient: msg.sender,
                    amountIn: agoraAmount,
                    amountOutMinimum: minTokensOut,
                    sqrtPriceLimitX96: 0
                }));

                fee = 0; // Uniswap fees are implicit
                viaUniswap = true;
            }
        } else {
            // ─── Mode 1: Direct ($AGORA to agent's payTo) ──────────────────

            (,,,address payTo,) = agentSub.getSubscription(agent);
            agora.safeTransfer(payTo, agoraAmount);

            tokensReceived = 0;
            fee = 0;
            directPayment = true;
        }

        // Record
        nonceUsed[nonce] = true;
        receipts[nonce] = Receipt({
            payer: msg.sender,
            agent: agent,
            curveId: curveId,
            agoraAmount: agoraAmount,
            tokensReceived: tokensReceived,
            fee: fee,
            blockNumber: block.number,
            viaUniswap: viaUniswap,
            directPayment: directPayment
        });

        totalPayments++;
        totalVolumeAgora += agoraAmount;

        // Record in endpoint registry
        endpointRegistry.recordTask(agent, agoraAmount);

        emit PaymentProcessed(nonce, msg.sender, agent, agoraAmount, tokensReceived, fee, directPayment, viaUniswap);
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    /// @notice Verify a payment by nonce. Used by x402 servers for payment confirmation.
    function verifyPayment(bytes16 nonce) external view returns (Receipt memory) {
        return receipts[nonce];
    }

    /// @notice Check if a nonce is available (not yet used)
    function isNonceAvailable(bytes16 nonce) external view returns (bool) {
        return !nonceUsed[nonce];
    }

    /// @notice Get protocol stats
    function getStats() external view returns (uint256 payments, uint256 volume) {
        return (totalPayments, totalVolumeAgora);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function transferAdmin(address newAdmin) external onlyAdmin {
        pendingAdmin = newAdmin;
        emit AdminTransferInitiated(newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferred(msg.sender);
    }
}
