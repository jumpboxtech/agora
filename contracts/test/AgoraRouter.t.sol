// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AgoraRouter} from "../src/AgoraRouter.sol";
import {AgoraLaunchpad} from "../src/AgoraLaunchpad.sol";
import {AgoraEndpointRegistry} from "../src/AgoraEndpointRegistry.sol";
import {AgoraAgentSub} from "../src/AgoraAgentSub.sol";
import {AgentToken} from "../src/AgentToken.sol";
import {INonfungiblePositionManager} from "../src/interfaces/INonfungiblePositionManager.sol";
import {IV3SwapRouter} from "../src/interfaces/IV3SwapRouter.sol";

// ─── Mocks ──────────────────────────────────────────────────────────────────

contract MockAgora is ERC20 {
    constructor() ERC20("Agora", "AGORA") {
        _mint(msg.sender, 100_000_000_000 ether);
    }
}

contract MockNFPM is INonfungiblePositionManager {
    function createAndInitializePoolIfNecessary(address, address, uint24, uint160)
        external
        payable
        returns (address)
    {
        return address(0x1234);
    }

    function mint(MintParams calldata) external payable returns (uint256, uint128, uint256, uint256) {
        return (1, 0, 0, 0);
    }
}

contract MockSwapRouter is IV3SwapRouter {
    function exactInputSingle(ExactInputSingleParams calldata) external payable returns (uint256) {
        return 0;
    }
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

contract AgoraRouterTest is Test {
    MockAgora public agora;
    AgoraAgentSub public agentSub;
    MockNFPM public nfpm;
    MockSwapRouter public swapRouter;
    AgoraEndpointRegistry public registry;
    AgoraLaunchpad public launchpad;
    AgoraRouter public router;

    address public admin = address(0xAD);
    address public treasury = address(0x7EA5);
    address public alice = address(0xA11CE); // agent
    address public bob = address(0xB0B);     // payer

    // Launchpad test defaults (small values for fast tests)
    uint256 constant SUPPLY = 1_000e18;
    uint256 constant VIRTUAL = 100e18;
    uint256 constant GRADUATION = 500e18;
    uint256 constant FEE_BPS = 100;        // 1%
    uint256 constant CREATOR_SHARE = 8000; // 80%

    // Endpoint paths
    string constant CURVE_PATH = "/api/v1/chat";
    string constant DIRECT_PATH = "/api/v1/status";

    function setUp() public {
        // 1. Deploy MockAgora (mints 100B to this test contract)
        agora = new MockAgora();

        // 2. Deploy AgoraAgentSub (owner = admin)
        agentSub = new AgoraAgentSub(address(agora), treasury, admin);

        // 3. Deploy mock Uniswap contracts
        nfpm = new MockNFPM();
        swapRouter = new MockSwapRouter();

        // 4. Deploy AgoraEndpointRegistry
        registry = new AgoraEndpointRegistry(address(agentSub), admin);

        // 5. Deploy AgoraLaunchpad with small test defaults
        launchpad = new AgoraLaunchpad(
            address(agora),
            address(nfpm),
            address(agentSub),
            admin,
            treasury
        );
        // Set small defaults for testing
        vm.prank(admin);
        launchpad.setDefaults(SUPPLY, VIRTUAL, GRADUATION, FEE_BPS, CREATOR_SHARE);

        // 6. Deploy AgoraRouter
        router = new AgoraRouter(
            address(launchpad),
            address(registry),
            address(agentSub),
            address(swapRouter),
            address(agora),
            admin
        );

        // 7. Wire: registry.setRouter(address(router))
        vm.prank(admin);
        registry.setRouter(address(router));

        // 8. Fund alice and bob with $AGORA
        agora.transfer(alice, 10_000_000_000 ether);
        agora.transfer(bob, 10_000_000_000 ether);

        // 9. Alice subscribes via agentSub (needs approval first)
        vm.prank(alice);
        agora.approve(address(agentSub), type(uint256).max);
        vm.prank(alice);
        agentSub.subscribe(1, "alice-agent", alice);

        // 10. Alice launches a curve on launchpad
        vm.prank(alice);
        launchpad.launch("AliceToken", "ALICE");

        // 11. Alice registers endpoints on registry
        string[] memory paths = new string[](2);
        uint256[] memory prices = new uint256[](2);
        uint8[] memory modes = new uint8[](2);

        paths[0] = CURVE_PATH;
        prices[0] = 1e18; // min 1 $AGORA
        modes[0] = 0;     // curve mode

        paths[1] = DIRECT_PATH;
        prices[1] = 2e18; // min 2 $AGORA
        modes[1] = 1;     // direct mode

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.test", paths, prices, modes);

        // 12. Bob approves router for $AGORA
        vm.prank(bob);
        agora.approve(address(router), type(uint256).max);

        // Also approve launchpad from router (router calls launchpad.buy which does transferFrom)
        // The router handles its own approve to launchpad internally
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    function _getAgentToken() internal view returns (address) {
        uint256 curveId = launchpad.getAgentCurve(alice);
        AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);
        return curve.token;
    }

    // ─── Test 1: payForService curve mode ───────────────────────────────────────

    function test_payForService_curveMode() public {
        uint256 payAmount = 10e18;
        bytes16 nonce = bytes16(uint128(1));
        address tokenAddr = _getAgentToken();

        uint256 bobAgoraBefore = agora.balanceOf(bob);
        uint256 bobTokenBefore = IERC20(tokenAddr).balanceOf(bob);

        vm.prank(bob);
        (uint256 tokensReceived, uint256 fee) = router.payForService(
            alice,
            payAmount,
            nonce,
            CURVE_PATH,
            0 // no slippage protection for test
        );

        // Bob spent $AGORA
        assertEq(agora.balanceOf(bob), bobAgoraBefore - payAmount);

        // Bob received agent tokens
        assertGt(tokensReceived, 0, "Should receive tokens");
        assertEq(IERC20(tokenAddr).balanceOf(bob), bobTokenBefore + tokensReceived);

        // Fee was charged (1% of payAmount = 0.1e18)
        assertGt(fee, 0, "Fee should be nonzero");

        // Router should hold no agent tokens
        assertEq(IERC20(tokenAddr).balanceOf(address(router)), 0, "Router should hold 0 agent tokens");
    }

    // ─── Test 2: payForService direct mode ──────────────────────────────────────

    function test_payForService_directMode() public {
        uint256 payAmount = 5e18;
        bytes16 nonce = bytes16(uint128(2));

        // Alice's payTo is alice herself (set during subscribe)
        uint256 aliceAgoraBefore = agora.balanceOf(alice);
        uint256 bobAgoraBefore = agora.balanceOf(bob);

        vm.prank(bob);
        (uint256 tokensReceived, uint256 fee) = router.payForService(
            alice,
            payAmount,
            nonce,
            DIRECT_PATH,
            0
        );

        // Direct mode: no tokens received
        assertEq(tokensReceived, 0, "Direct mode should not return tokens");
        assertEq(fee, 0, "Direct mode should have no fee");

        // Bob spent $AGORA
        assertEq(agora.balanceOf(bob), bobAgoraBefore - payAmount);

        // Alice (payTo) received $AGORA
        assertEq(agora.balanceOf(alice), aliceAgoraBefore + payAmount);
    }

    // ─── Test 3: revert on nonce replay ─────────────────────────────────────────

    function test_payForService_revert_nonceReplay() public {
        bytes16 nonce = bytes16(uint128(3));
        uint256 payAmount = 5e18;

        // First call succeeds
        vm.prank(bob);
        router.payForService(alice, payAmount, nonce, CURVE_PATH, 0);

        // Second call with same nonce reverts
        vm.prank(bob);
        vm.expectRevert(AgoraRouter.NonceUsed.selector);
        router.payForService(alice, payAmount, nonce, CURVE_PATH, 0);
    }

    // ─── Test 4: revert on zero amount ──────────────────────────────────────────

    function test_payForService_revert_zeroAmount() public {
        bytes16 nonce = bytes16(uint128(4));

        vm.prank(bob);
        vm.expectRevert(AgoraRouter.ZeroAmount.selector);
        router.payForService(alice, 0, nonce, CURVE_PATH, 0);
    }

    // ─── Test 5: revert below minimum price ─────────────────────────────────────

    function test_payForService_revert_belowMinimum() public {
        bytes16 nonce = bytes16(uint128(5));

        // CURVE_PATH has minPrice = 1e18, send less
        vm.prank(bob);
        vm.expectRevert(AgoraRouter.BelowMinimum.selector);
        router.payForService(alice, 0.5e18, nonce, CURVE_PATH, 0);
    }

    // ─── Test 6: revert on inactive endpoint ────────────────────────────────────

    function test_payForService_revert_endpointNotActive() public {
        bytes16 nonce = bytes16(uint128(6));

        // Non-existent endpoint
        vm.prank(bob);
        vm.expectRevert(AgoraRouter.EndpointNotActive.selector);
        router.payForService(alice, 5e18, nonce, "/api/v1/nonexistent", 0);
    }

    // ─── Test 7: revert when agent has no curve (curve mode) ────────────────────

    function test_payForService_revert_noCurve() public {
        // Create a new agent (charlie) who has a subscription but no curve
        address charlie = address(0xC4A7);
        agora.transfer(charlie, 10_000_000_000 ether);

        vm.prank(charlie);
        agora.approve(address(agentSub), type(uint256).max);
        vm.prank(charlie);
        agentSub.subscribe(1, "charlie-agent", charlie);

        // Charlie registers a curve-mode endpoint
        string[] memory paths = new string[](1);
        uint256[] memory prices = new uint256[](1);
        uint8[] memory modes = new uint8[](1);
        paths[0] = "/api/v1/chat";
        prices[0] = 1e18;
        modes[0] = 0; // curve mode
        vm.prank(charlie);
        registry.registerEndpoints("https://charlie.agora.test", paths, prices, modes);

        // Bob tries to pay charlie's curve-mode endpoint, but charlie has no curve
        bytes16 nonce = bytes16(uint128(7));
        vm.prank(bob);
        vm.expectRevert(AgoraRouter.NoCurve.selector);
        router.payForService(charlie, 5e18, nonce, "/api/v1/chat", 0);
    }

    // ─── Test 8: verifyPayment returns correct receipt ──────────────────────────

    function test_verifyPayment() public {
        uint256 payAmount = 10e18;
        bytes16 nonce = bytes16(uint128(8));

        vm.prank(bob);
        (uint256 tokensReceived, uint256 fee) = router.payForService(
            alice, payAmount, nonce, CURVE_PATH, 0
        );

        AgoraRouter.Receipt memory receipt = router.verifyPayment(nonce);

        assertEq(receipt.payer, bob, "Payer mismatch");
        assertEq(receipt.agent, alice, "Agent mismatch");
        assertEq(receipt.agoraAmount, payAmount, "Amount mismatch");
        assertEq(receipt.tokensReceived, tokensReceived, "Tokens mismatch");
        assertEq(receipt.fee, fee, "Fee mismatch");
        assertEq(receipt.blockNumber, block.number, "Block number mismatch");
        assertFalse(receipt.viaUniswap, "Should not be via Uniswap");
        assertFalse(receipt.directPayment, "Should not be direct payment");
        assertEq(receipt.curveId, 0, "Curve ID should be 0 for first curve");
    }

    // ─── Test 9: isNonceAvailable ───────────────────────────────────────────────

    function test_isNonceAvailable() public {
        bytes16 nonce = bytes16(uint128(9));

        // Before use: available
        assertTrue(router.isNonceAvailable(nonce), "Nonce should be available before use");

        // Use it
        vm.prank(bob);
        router.payForService(alice, 5e18, nonce, CURVE_PATH, 0);

        // After use: not available
        assertFalse(router.isNonceAvailable(nonce), "Nonce should not be available after use");
    }

    // ─── Test 10: stats accumulate ──────────────────────────────────────────────

    function test_stats_accumulate() public {
        // Initial stats are zero
        (uint256 payments0, uint256 volume0) = router.getStats();
        assertEq(payments0, 0);
        assertEq(volume0, 0);

        // First payment
        uint256 amount1 = 10e18;
        vm.prank(bob);
        router.payForService(alice, amount1, bytes16(uint128(101)), CURVE_PATH, 0);

        (uint256 payments1, uint256 volume1) = router.getStats();
        assertEq(payments1, 1);
        assertEq(volume1, amount1);

        // Second payment (direct mode)
        uint256 amount2 = 5e18;
        vm.prank(bob);
        router.payForService(alice, amount2, bytes16(uint128(102)), DIRECT_PATH, 0);

        (uint256 payments2, uint256 volume2) = router.getStats();
        assertEq(payments2, 2);
        assertEq(volume2, amount1 + amount2);

        // Also check individual storage variables
        assertEq(router.totalPayments(), 2);
        assertEq(router.totalVolumeAgora(), amount1 + amount2);
    }

    // ─── Test 11: recordTask in registry ────────────────────────────────────────

    function test_recordsTask_inRegistry() public {
        // Get initial profile state
        (, uint256 initialTasks, uint256 initialEarned,) = registry.profiles(alice);
        assertEq(initialTasks, 0);
        assertEq(initialEarned, 0);

        // First payment (curve mode)
        uint256 amount1 = 10e18;
        vm.prank(bob);
        router.payForService(alice, amount1, bytes16(uint128(111)), CURVE_PATH, 0);

        (, uint256 tasks1, uint256 earned1,) = registry.profiles(alice);
        assertEq(tasks1, 1, "totalTasks should be 1 after first payment");
        assertEq(earned1, amount1, "totalEarned should equal first payment amount");

        // Second payment (direct mode)
        uint256 amount2 = 3e18;
        vm.prank(bob);
        router.payForService(alice, amount2, bytes16(uint128(112)), DIRECT_PATH, 0);

        (, uint256 tasks2, uint256 earned2,) = registry.profiles(alice);
        assertEq(tasks2, 2, "totalTasks should be 2 after second payment");
        assertEq(earned2, amount1 + amount2, "totalEarned should accumulate");
    }

    // ─── Test 12: admin transfer (2-step) ───────────────────────────────────────

    function test_admin_transfer() public {
        address newAdmin = address(0xBEEF);

        // Only admin can initiate
        vm.prank(bob);
        vm.expectRevert(AgoraRouter.NotAdmin.selector);
        router.transferAdmin(newAdmin);

        // Admin initiates transfer
        vm.prank(admin);
        router.transferAdmin(newAdmin);

        // Admin hasn't changed yet
        assertEq(router.admin(), admin, "Admin should not change before acceptance");
        assertEq(router.pendingAdmin(), newAdmin, "Pending admin should be set");

        // Wrong address cannot accept
        vm.prank(bob);
        vm.expectRevert(AgoraRouter.NotPendingAdmin.selector);
        router.acceptAdmin();

        // Correct pending admin accepts
        vm.prank(newAdmin);
        router.acceptAdmin();

        assertEq(router.admin(), newAdmin, "Admin should be updated after acceptance");
        assertEq(router.pendingAdmin(), address(0), "Pending admin should be cleared");
    }
}
