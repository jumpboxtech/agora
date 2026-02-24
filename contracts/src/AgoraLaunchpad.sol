// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AgentToken} from "./AgentToken.sol";
import {IAgoraAgentSub} from "./interfaces/IAgoraAgentSub.sol";
import {INonfungiblePositionManager} from "./interfaces/INonfungiblePositionManager.sol";

/// @title AgoraLaunchpad — Bonding curve factory for AI agents
/// @notice Constant product AMM with $AGORA reserve and auto-graduation to Uniswap V3.
///         Only agents with active AgoraAgentSub subscriptions can launch.
contract AgoraLaunchpad is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Structs ─────────────────────────────────────────────────────────────────

    struct Curve {
        address creator;
        address token;
        uint256 totalSupply;
        uint256 virtualAgora;    // virtual $AGORA reserve (sets initial price)
        uint256 k;               // virtualAgora * totalSupply (constant product)
        uint256 agoraReserve;    // actual $AGORA deposited by buyers
        uint256 tokensSold;
        uint256 graduationAgora; // $AGORA threshold for graduation
        uint256 feeBps;
        uint256 accruedFees;     // $AGORA fees waiting for graduation split
        bool graduated;
        uint256 createdAt;
        uint256 creatorShareBps;
        address uniswapPool;
    }

    // ─── Constants ───────────────────────────────────────────────────────────────

    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant MAX_FEE_BPS = 500;         // 5% max
    uint256 public constant MAX_CREATOR_SHARE = 10_000; // 100%
    uint24 public constant POOL_FEE = 10000;            // 1% Uni V3 fee tier
    int24 public constant TICK_LOWER = -887200;         // full range (tick spacing 200)
    int24 public constant TICK_UPPER = 887200;

    // ─── Immutables ──────────────────────────────────────────────────────────────

    IERC20 public immutable agora;
    INonfungiblePositionManager public immutable nfpm;
    IAgoraAgentSub public immutable agentSub;

    // ─── State ───────────────────────────────────────────────────────────────────

    address public admin;
    address public pendingAdmin;
    address public protocolFeeRecipient;
    uint256 public totalCurves;

    // Defaults for new curves
    uint256 public defaultTotalSupply = 1_000_000_000e18;     // 1B tokens (18 dec)
    uint256 public defaultVirtualAgora = 1_000_000_000e18;    // 1B $AGORA virtual
    uint256 public defaultGraduationAgora = 5_000_000_000e18; // 5B $AGORA to graduate
    uint256 public defaultFeeBps = 100;                       // 1%
    uint256 public defaultCreatorShareBps = 8000;             // 80%

    mapping(uint256 => Curve) public curves;
    mapping(address => uint256) public agentCurve;
    mapping(address => bool) public hasLaunched;

    // ─── Events ──────────────────────────────────────────────────────────────────

    event CurveLaunched(uint256 indexed curveId, address indexed creator, address token, string name, string symbol);
    event TokenBought(uint256 indexed curveId, address indexed buyer, uint256 agoraIn, uint256 tokensOut, uint256 fee);
    event TokenSold(uint256 indexed curveId, address indexed seller, uint256 tokensIn, uint256 agoraOut, uint256 fee);
    event CurveGraduated(uint256 indexed curveId, uint256 creatorShare, uint256 protocolShare, address pool);
    event DefaultsUpdated();
    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed newAdmin);

    // ─── Errors ──────────────────────────────────────────────────────────────────

    error NotSubscribed();
    error AlreadyLaunched();
    error CurveNotFound();
    error AlreadyGraduated();
    error NotGraduated();
    error ZeroAmount();
    error SlippageExceeded();
    error SoldOut();
    error NotAdmin();
    error InvalidParams();
    error NotPendingAdmin();

    // ─── Modifiers ───────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────────

    constructor(
        address agora_,
        address nfpm_,
        address agentSub_,
        address admin_,
        address protocolFeeRecipient_
    ) {
        agora = IERC20(agora_);
        nfpm = INonfungiblePositionManager(nfpm_);
        agentSub = IAgoraAgentSub(agentSub_);
        admin = admin_;
        protocolFeeRecipient = protocolFeeRecipient_;
    }

    // ─── Core ────────────────────────────────────────────────────────────────────

    /// @notice Launch a bonding curve token. Requires active AgoraAgentSub subscription.
    function launch(string calldata name, string calldata symbol) external returns (uint256 curveId) {
        if (!agentSub.isActive(msg.sender)) revert NotSubscribed();
        if (hasLaunched[msg.sender]) revert AlreadyLaunched();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert InvalidParams();

        curveId = totalCurves;

        // Deploy ERC-20 token — all supply minted to this contract
        bytes32 salt = keccak256(abi.encode(msg.sender, curveId));
        AgentToken token = new AgentToken{salt: salt}(name, symbol, defaultTotalSupply, address(this));

        uint256 k = defaultVirtualAgora * defaultTotalSupply;

        curves[curveId] = Curve({
            creator: msg.sender,
            token: address(token),
            totalSupply: defaultTotalSupply,
            virtualAgora: defaultVirtualAgora,
            k: k,
            agoraReserve: 0,
            tokensSold: 0,
            graduationAgora: defaultGraduationAgora,
            feeBps: defaultFeeBps,
            accruedFees: 0,
            graduated: false,
            createdAt: block.number,
            creatorShareBps: defaultCreatorShareBps,
            uniswapPool: address(0)
        });

        agentCurve[msg.sender] = curveId;
        hasLaunched[msg.sender] = true;
        totalCurves++;

        emit CurveLaunched(curveId, msg.sender, address(token), name, symbol);
    }

    /// @notice Buy tokens on a bonding curve with $AGORA
    function buy(uint256 curveId, uint256 agoraAmount, uint256 minTokensOut)
        external
        nonReentrant
        returns (uint256 tokensOut, uint256 fee)
    {
        Curve storage curve = curves[curveId];
        if (curve.creator == address(0)) revert CurveNotFound();
        if (curve.graduated) revert AlreadyGraduated();
        if (agoraAmount == 0) revert ZeroAmount();

        // Fee calculation
        fee = (agoraAmount * curve.feeBps) / BPS_DENOM;
        uint256 netAgora = agoraAmount - fee;

        // AMM: constant product
        uint256 tokenReserve = curve.totalSupply - curve.tokensSold;
        if (tokenReserve == 0) revert SoldOut();

        uint256 effectiveAgora = curve.virtualAgora + curve.agoraReserve + netAgora;
        uint256 newTokenReserve = curve.k / effectiveAgora;
        tokensOut = tokenReserve - newTokenReserve;

        if (tokensOut == 0) revert ZeroAmount();
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        // Transfer $AGORA from buyer
        agora.safeTransferFrom(msg.sender, address(this), agoraAmount);

        // Update state
        curve.agoraReserve += netAgora;
        curve.tokensSold += tokensOut;
        curve.accruedFees += fee;

        // Transfer tokens to buyer
        IERC20(curve.token).safeTransfer(msg.sender, tokensOut);

        emit TokenBought(curveId, msg.sender, agoraAmount, tokensOut, fee);

        // Auto-graduation
        if (curve.agoraReserve >= curve.graduationAgora) {
            _graduate(curveId);
        }
    }

    /// @notice Sell tokens back to the bonding curve for $AGORA
    function sell(uint256 curveId, uint256 tokenAmount, uint256 minAgoraOut)
        external
        nonReentrant
        returns (uint256 agoraOut, uint256 fee)
    {
        Curve storage curve = curves[curveId];
        if (curve.creator == address(0)) revert CurveNotFound();
        if (curve.graduated) revert AlreadyGraduated();
        if (tokenAmount == 0) revert ZeroAmount();

        // AMM: reverse constant product
        uint256 tokenReserve = curve.totalSupply - curve.tokensSold;
        uint256 newTokenReserve = tokenReserve + tokenAmount;
        uint256 newAgoraReserve = (curve.k / newTokenReserve) - curve.virtualAgora;
        uint256 grossAgora = curve.agoraReserve - newAgoraReserve;

        fee = (grossAgora * curve.feeBps) / BPS_DENOM;
        agoraOut = grossAgora - fee;

        if (agoraOut == 0) revert ZeroAmount();
        if (agoraOut < minAgoraOut) revert SlippageExceeded();

        // Transfer tokens from seller
        IERC20(curve.token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        // Update state
        curve.agoraReserve = newAgoraReserve;
        curve.tokensSold -= tokenAmount;
        curve.accruedFees += fee;

        // Transfer $AGORA to seller
        agora.safeTransfer(msg.sender, agoraOut);

        emit TokenSold(curveId, msg.sender, tokenAmount, agoraOut, fee);
    }

    /// @notice Manually trigger graduation if threshold is met
    function graduate(uint256 curveId) external {
        Curve storage curve = curves[curveId];
        if (curve.creator == address(0)) revert CurveNotFound();
        if (curve.graduated) revert AlreadyGraduated();
        if (curve.agoraReserve < curve.graduationAgora) revert NotGraduated();
        _graduate(curveId);
    }

    // ─── Graduation ──────────────────────────────────────────────────────────────

    function _graduate(uint256 curveId) internal {
        Curve storage curve = curves[curveId];

        // 1. Fee split
        uint256 creatorShare = (curve.accruedFees * curve.creatorShareBps) / BPS_DENOM;
        uint256 protocolShare = curve.accruedFees - creatorShare;

        if (creatorShare > 0) {
            agora.safeTransfer(curve.creator, creatorShare);
        }
        if (protocolShare > 0) {
            agora.safeTransfer(protocolFeeRecipient, protocolShare);
        }

        // 2. Seed amounts for Uniswap V3
        uint256 seedAgora = curve.agoraReserve;
        uint256 seedTokens = curve.totalSupply - curve.tokensSold;

        // 3. Sort tokens (Uni V3 requires token0 < token1)
        address tokenAddr = curve.token;
        address agoraAddr = address(agora);
        (address token0, address token1) = agoraAddr < tokenAddr
            ? (agoraAddr, tokenAddr)
            : (tokenAddr, agoraAddr);

        (uint256 amount0, uint256 amount1) = token0 == agoraAddr
            ? (seedAgora, seedTokens)
            : (seedTokens, seedAgora);

        // 4. Compute sqrtPriceX96
        uint160 sqrtPriceX96 = _computeSqrtPriceX96(amount0, amount1);

        // 5. Create pool and initialize
        address pool = nfpm.createAndInitializePoolIfNecessary(token0, token1, POOL_FEE, sqrtPriceX96);

        // 6. Approve and add full-range liquidity
        agora.approve(address(nfpm), seedAgora);
        IERC20(tokenAddr).approve(address(nfpm), seedTokens);

        nfpm.mint(INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: POOL_FEE,
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this), // LP NFT permanently locked
            deadline: block.timestamp
        }));

        // 7. Mark graduated
        curve.graduated = true;
        curve.uniswapPool = pool;
        curve.accruedFees = 0;

        emit CurveGraduated(curveId, creatorShare, protocolShare, pool);
    }

    /// @dev Compute sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96
    function _computeSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        uint256 sqrtAmount1 = _sqrt(amount1);
        uint256 sqrtAmount0 = _sqrt(amount0);
        uint256 result = (sqrtAmount1 * (1 << 96)) / sqrtAmount0;
        return uint160(result);
    }

    /// @dev Integer square root (Babylonian method)
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    function getCurve(uint256 curveId) external view returns (Curve memory) {
        return curves[curveId];
    }

    function getAgentCurve(address agent) external view returns (uint256) {
        return agentCurve[agent];
    }

    function getBuyQuote(uint256 curveId, uint256 agoraAmount) external view returns (uint256 tokensOut, uint256 fee) {
        Curve memory curve = curves[curveId];
        if (curve.graduated || curve.creator == address(0)) return (0, 0);

        fee = (agoraAmount * curve.feeBps) / BPS_DENOM;
        uint256 netAgora = agoraAmount - fee;
        uint256 tokenReserve = curve.totalSupply - curve.tokensSold;
        uint256 effectiveAgora = curve.virtualAgora + curve.agoraReserve + netAgora;
        uint256 newTokenReserve = curve.k / effectiveAgora;
        tokensOut = tokenReserve - newTokenReserve;
    }

    function getSellQuote(uint256 curveId, uint256 tokenAmount) external view returns (uint256 agoraOut, uint256 fee) {
        Curve memory curve = curves[curveId];
        if (curve.graduated || curve.creator == address(0)) return (0, 0);

        uint256 tokenReserve = curve.totalSupply - curve.tokensSold;
        uint256 newTokenReserve = tokenReserve + tokenAmount;
        uint256 newAgoraReserve = (curve.k / newTokenReserve) - curve.virtualAgora;
        uint256 grossAgora = curve.agoraReserve - newAgoraReserve;
        fee = (grossAgora * curve.feeBps) / BPS_DENOM;
        agoraOut = grossAgora - fee;
    }

    function getPrice(uint256 curveId) external view returns (uint256) {
        Curve memory curve = curves[curveId];
        uint256 tokenReserve = curve.totalSupply - curve.tokensSold;
        if (tokenReserve == 0) return 0;
        // Price in $AGORA per token, scaled by 1e18
        return ((curve.virtualAgora + curve.agoraReserve) * 1e18) / tokenReserve;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function setDefaults(
        uint256 totalSupply_,
        uint256 virtualAgora_,
        uint256 graduationAgora_,
        uint256 feeBps_,
        uint256 creatorShareBps_
    ) external onlyAdmin {
        if (totalSupply_ == 0 || virtualAgora_ == 0 || graduationAgora_ == 0) revert InvalidParams();
        if (feeBps_ > MAX_FEE_BPS) revert InvalidParams();
        if (creatorShareBps_ > MAX_CREATOR_SHARE) revert InvalidParams();

        defaultTotalSupply = totalSupply_;
        defaultVirtualAgora = virtualAgora_;
        defaultGraduationAgora = graduationAgora_;
        defaultFeeBps = feeBps_;
        defaultCreatorShareBps = creatorShareBps_;

        emit DefaultsUpdated();
    }

    function setProtocolFeeRecipient(address recipient) external onlyAdmin {
        protocolFeeRecipient = recipient;
    }

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
