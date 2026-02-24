// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgoraLaunchpad} from "../src/AgoraLaunchpad.sol";
import {AgoraEndpointRegistry} from "../src/AgoraEndpointRegistry.sol";
import {AgoraAgentSub} from "../src/AgoraAgentSub.sol";
import {AgentToken} from "../src/AgentToken.sol";
import {INonfungiblePositionManager} from "../src/interfaces/INonfungiblePositionManager.sol";

// ─── Mocks ──────────────────────────────────────────────────────────────────

contract MockAgora is ERC20 {
    constructor() ERC20("Agora", "AGORA") {
        _mint(msg.sender, 100_000_000_000 ether);
    }
}

contract MockNFPM is INonfungiblePositionManager {
    address public lastPool;
    MintParams public lastMintParams;
    bool public mintCalled;

    function createAndInitializePoolIfNecessary(address, address, uint24, uint160)
        external
        payable
        returns (address pool)
    {
        pool = address(0x1234);
        lastPool = pool;
    }

    function mint(MintParams calldata params) external payable returns (uint256, uint128, uint256, uint256) {
        lastMintParams = params;
        mintCalled = true;
        return (1, 0, 0, 0);
    }
}

// ─── AgoraEndpointRegistry Tests ────────────────────────────────────────────

contract AgoraEndpointRegistryTest is Test {
    MockAgora public token;
    AgoraAgentSub public agentSub;
    AgoraEndpointRegistry public registry;

    address public owner = address(0xBEEF);
    address public admin = address(0xAD);
    address public treasury = address(0x7EA5);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public routerAddr = address(0x1234);

    function setUp() public {
        token = new MockAgora();
        agentSub = new AgoraAgentSub(address(token), treasury, owner);
        registry = new AgoraEndpointRegistry(address(agentSub), admin);

        // Fund and subscribe alice
        token.transfer(alice, 10_000_000_000 ether);
        token.transfer(bob, 10_000_000_000 ether);

        vm.startPrank(alice);
        token.approve(address(agentSub), type(uint256).max);
        agentSub.subscribe(1, "alice-agent", alice);
        vm.stopPrank();

        // Set router
        vm.prank(admin);
        registry.setRouter(routerAddr);
    }

    // ─── registerEndpoints ──────────────────────────────────────────────────

    function test_registerEndpoints_success() public {
        string[] memory paths = new string[](2);
        paths[0] = "/api/v1/chat";
        paths[1] = "/api/v1/search";

        uint256[] memory prices = new uint256[](2);
        prices[0] = 1e18;
        prices[1] = 2e18;

        uint8[] memory modes = new uint8[](2);
        modes[0] = 0;
        modes[1] = 1;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        // Check profile
        (string memory endpointUrl, uint256 totalTasks, uint256 totalEarned, uint256 endpointCount) =
            registry.profiles(alice);
        assertEq(endpointUrl, "https://alice.agora.tech");
        assertEq(totalTasks, 0);
        assertEq(totalEarned, 0);
        assertEq(endpointCount, 2);

        // Check endpoints
        AgoraEndpointRegistry.Endpoint memory ep0 = registry.getEndpoint(alice, "/api/v1/chat");
        assertEq(ep0.path, "/api/v1/chat");
        assertEq(ep0.priceAgora, 1e18);
        assertEq(ep0.paymentMode, 0);
        assertTrue(ep0.active);

        AgoraEndpointRegistry.Endpoint memory ep1 = registry.getEndpoint(alice, "/api/v1/search");
        assertEq(ep1.path, "/api/v1/search");
        assertEq(ep1.priceAgora, 2e18);
        assertEq(ep1.paymentMode, 1);
        assertTrue(ep1.active);
    }

    function test_registerEndpoints_revert_notSubscribed() public {
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 0;

        vm.prank(bob); // bob is not subscribed
        vm.expectRevert(AgoraEndpointRegistry.NotSubscribed.selector);
        registry.registerEndpoints("https://bob.agora.tech", paths, prices, modes);
    }

    function test_registerEndpoints_revert_emptyPath() public {
        string[] memory paths = new string[](1);
        paths[0] = "";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 0;

        vm.prank(alice);
        vm.expectRevert(AgoraEndpointRegistry.EmptyPath.selector);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);
    }

    function test_registerEndpoints_revert_invalidMode() public {
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 2; // invalid: only 0 or 1

        vm.prank(alice);
        vm.expectRevert(AgoraEndpointRegistry.InvalidPaymentMode.selector);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);
    }

    function test_registerEndpoints_revert_noEndpoints() public {
        string[] memory paths = new string[](0);
        uint256[] memory prices = new uint256[](0);
        uint8[] memory modes = new uint8[](0);

        vm.prank(alice);
        vm.expectRevert(AgoraEndpointRegistry.NoEndpoints.selector);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);
    }

    // ─── updateEndpoint ─────────────────────────────────────────────────────

    function test_updateEndpoint() public {
        // First register
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 0;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        // Update
        vm.prank(alice);
        registry.updateEndpoint("/api/v1/chat", 5e18, 1);

        AgoraEndpointRegistry.Endpoint memory ep = registry.getEndpoint(alice, "/api/v1/chat");
        assertEq(ep.priceAgora, 5e18);
        assertEq(ep.paymentMode, 1);
        assertTrue(ep.active);
    }

    function test_updateEndpoint_revert_notFound() public {
        vm.prank(alice);
        vm.expectRevert(AgoraEndpointRegistry.EndpointNotFound.selector);
        registry.updateEndpoint("/nonexistent", 1e18, 0);
    }

    // ─── removeEndpoint ─────────────────────────────────────────────────────

    function test_removeEndpoint() public {
        // Register first
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 0;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        assertTrue(registry.isEndpointActive(alice, "/api/v1/chat"));

        // Remove
        vm.prank(alice);
        registry.removeEndpoint("/api/v1/chat");

        assertFalse(registry.isEndpointActive(alice, "/api/v1/chat"));
    }

    // ─── recordTask ─────────────────────────────────────────────────────────

    function test_recordTask_success() public {
        // Register alice so profile exists
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 0;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        // Router records task
        vm.prank(routerAddr);
        registry.recordTask(alice, 100e18);

        (, uint256 totalTasks, uint256 totalEarned,) = registry.profiles(alice);
        assertEq(totalTasks, 1);
        assertEq(totalEarned, 100e18);

        // Record another
        vm.prank(routerAddr);
        registry.recordTask(alice, 50e18);

        (, totalTasks, totalEarned,) = registry.profiles(alice);
        assertEq(totalTasks, 2);
        assertEq(totalEarned, 150e18);
    }

    function test_recordTask_revert_notRouter() public {
        vm.prank(alice);
        vm.expectRevert(AgoraEndpointRegistry.NotRouter.selector);
        registry.recordTask(alice, 100e18);
    }

    // ─── getAgentEndpoints ──────────────────────────────────────────────────

    function test_getAgentEndpoints() public {
        string[] memory paths = new string[](3);
        paths[0] = "/api/v1/chat";
        paths[1] = "/api/v1/search";
        paths[2] = "/api/v1/embed";
        uint256[] memory prices = new uint256[](3);
        prices[0] = 1e18;
        prices[1] = 2e18;
        prices[2] = 3e18;
        uint8[] memory modes = new uint8[](3);
        modes[0] = 0;
        modes[1] = 1;
        modes[2] = 0;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        AgoraEndpointRegistry.Endpoint[] memory eps = registry.getAgentEndpoints(alice);
        assertEq(eps.length, 3);
        assertEq(eps[0].path, "/api/v1/chat");
        assertEq(eps[1].path, "/api/v1/search");
        assertEq(eps[2].path, "/api/v1/embed");
    }

    // ─── marketplace enumeration ────────────────────────────────────────────

    function test_marketplace_enumeration() public {
        // Subscribe bob too
        vm.startPrank(bob);
        token.approve(address(agentSub), type(uint256).max);
        agentSub.subscribe(1, "bob-agent", bob);
        vm.stopPrank();

        // Register alice
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 0;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        assertEq(registry.totalRegisteredAgents(), 1);
        assertEq(registry.getAgentAt(0), alice);

        // Register bob
        vm.prank(bob);
        registry.registerEndpoints("https://bob.agora.tech", paths, prices, modes);

        assertEq(registry.totalRegisteredAgents(), 2);
        assertEq(registry.getAgentAt(1), bob);
    }

    // ─── view helpers ───────────────────────────────────────────────────────

    function test_getPaymentMode() public {
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 1;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        assertEq(registry.getPaymentMode(alice, "/api/v1/chat"), 1);
    }

    function test_getMinPrice() public {
        string[] memory paths = new string[](1);
        paths[0] = "/api/v1/chat";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 42e18;
        uint8[] memory modes = new uint8[](1);
        modes[0] = 0;

        vm.prank(alice);
        registry.registerEndpoints("https://alice.agora.tech", paths, prices, modes);

        assertEq(registry.getMinPrice(alice, "/api/v1/chat"), 42e18);
    }
}

// ─── AgoraLaunchpad Tests ───────────────────────────────────────────────────

contract AgoraLaunchpadTest is Test {
    MockAgora public token;
    AgoraAgentSub public agentSub;
    MockNFPM public mockNfpm;
    AgoraLaunchpad public launchpad;

    address public owner = address(0xBEEF);
    address public admin = address(0xAD);
    address public treasury = address(0x7EA5);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xC);

    function setUp() public {
        token = new MockAgora();
        agentSub = new AgoraAgentSub(address(token), treasury, owner);
        mockNfpm = new MockNFPM();
        launchpad = new AgoraLaunchpad(address(token), address(mockNfpm), address(agentSub), admin, treasury);

        // Fund alice and bob
        token.transfer(alice, 50_000_000_000 ether);
        token.transfer(bob, 50_000_000_000 ether);

        // Subscribe alice as an agent
        vm.startPrank(alice);
        token.approve(address(agentSub), type(uint256).max);
        agentSub.subscribe(1, "alice-agent", alice);
        token.approve(address(launchpad), type(uint256).max);
        vm.stopPrank();

        // Subscribe bob as an agent and approve launchpad
        vm.startPrank(bob);
        token.approve(address(agentSub), type(uint256).max);
        agentSub.subscribe(1, "bob-agent", bob);
        token.approve(address(launchpad), type(uint256).max);
        vm.stopPrank();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /// @dev Launch a curve as alice with default params, return curveId
    function _launchAsAlice() internal returns (uint256 curveId) {
        vm.prank(alice);
        curveId = launchpad.launch("AliceToken", "ALICE");
    }

    /// @dev Set small defaults for graduation testing
    function _setSmallDefaults() internal {
        vm.prank(admin);
        launchpad.setDefaults(1_000e18, 100e18, 500e18, 100, 8000);
    }

    // ─── launch ─────────────────────────────────────────────────────────────

    function test_launch_success() public {
        uint256 curveId = _launchAsAlice();
        assertEq(curveId, 0);
        assertEq(launchpad.totalCurves(), 1);
        assertTrue(launchpad.hasLaunched(alice));

        AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);
        assertEq(curve.creator, alice);
        assertEq(curve.totalSupply, 1_000_000_000e18);
        assertEq(curve.virtualAgora, 1_000_000_000e18);
        assertEq(curve.k, 1_000_000_000e18 * 1_000_000_000e18);
        assertEq(curve.agoraReserve, 0);
        assertEq(curve.tokensSold, 0);
        assertEq(curve.graduationAgora, 5_000_000_000e18);
        assertEq(curve.feeBps, 100);
        assertEq(curve.accruedFees, 0);
        assertFalse(curve.graduated);
        assertEq(curve.creatorShareBps, 8000);
        assertEq(curve.uniswapPool, address(0));
        assertTrue(curve.token != address(0));

        // Verify the agent token supply is held by the launchpad
        AgentToken agentToken = AgentToken(curve.token);
        assertEq(agentToken.balanceOf(address(launchpad)), curve.totalSupply);
    }

    function test_launch_revert_notSubscribed() public {
        vm.prank(charlie); // charlie not subscribed
        vm.expectRevert(AgoraLaunchpad.NotSubscribed.selector);
        launchpad.launch("CharlieToken", "CHARLIE");
    }

    function test_launch_revert_alreadyLaunched() public {
        _launchAsAlice();

        vm.prank(alice);
        vm.expectRevert(AgoraLaunchpad.AlreadyLaunched.selector);
        launchpad.launch("AliceToken2", "ALICE2");
    }

    function test_launch_revert_emptyName() public {
        vm.prank(alice);
        vm.expectRevert(AgoraLaunchpad.InvalidParams.selector);
        launchpad.launch("", "ALICE");

        vm.prank(alice);
        vm.expectRevert(AgoraLaunchpad.InvalidParams.selector);
        launchpad.launch("AliceToken", "");
    }

    // ─── buy ────────────────────────────────────────────────────────────────

    function test_buy_basic() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        AgoraLaunchpad.Curve memory curveBefore = launchpad.getCurve(curveId);
        uint256 buyAmount = 10e18;
        uint256 bobBalBefore = token.balanceOf(bob);

        vm.prank(bob);
        (uint256 tokensOut, uint256 fee) = launchpad.buy(curveId, buyAmount, 0);

        assertTrue(tokensOut > 0);
        assertTrue(fee > 0);

        // Bob received agent tokens
        AgentToken agentToken = AgentToken(curveBefore.token);
        assertEq(agentToken.balanceOf(bob), tokensOut);

        // Bob spent AGORA
        assertEq(token.balanceOf(bob), bobBalBefore - buyAmount);

        // Curve state updated
        AgoraLaunchpad.Curve memory curveAfter = launchpad.getCurve(curveId);
        assertEq(curveAfter.agoraReserve, buyAmount - fee);
        assertEq(curveAfter.tokensSold, tokensOut);
        assertEq(curveAfter.accruedFees, fee);
    }

    function test_buy_fee_calculation() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        uint256 buyAmount = 100e18;

        vm.prank(bob);
        (, uint256 fee) = launchpad.buy(curveId, buyAmount, 0);

        // Fee is 1% (100 bps)
        uint256 expectedFee = (buyAmount * 100) / 10_000;
        assertEq(fee, expectedFee);
    }

    function test_buy_revert_zeroAmount() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.ZeroAmount.selector);
        launchpad.buy(curveId, 0, 0);
    }

    function test_buy_revert_slippage() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        // Get the quote first
        (uint256 expectedOut,) = launchpad.getBuyQuote(curveId, 10e18);

        // Ask for more than possible
        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.SlippageExceeded.selector);
        launchpad.buy(curveId, 10e18, expectedOut + 1);
    }

    function test_buy_revert_notFound() public {
        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.CurveNotFound.selector);
        launchpad.buy(999, 10e18, 0);
    }

    // ─── sell ───────────────────────────────────────────────────────────────

    function test_sell_basic() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        // Buy first
        vm.prank(bob);
        (uint256 tokensOut,) = launchpad.buy(curveId, 50e18, 0);

        // Approve launchpad to spend agent tokens
        AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);
        vm.prank(bob);
        IERC20(curve.token).approve(address(launchpad), type(uint256).max);

        uint256 bobAgoraBefore = token.balanceOf(bob);

        // Sell half
        uint256 sellAmount = tokensOut / 2;
        vm.prank(bob);
        (uint256 agoraOut, uint256 fee) = launchpad.sell(curveId, sellAmount, 0);

        assertTrue(agoraOut > 0);
        assertTrue(fee > 0);

        // Bob got AGORA back
        assertEq(token.balanceOf(bob), bobAgoraBefore + agoraOut);

        // Bob's agent tokens decreased
        assertEq(IERC20(curve.token).balanceOf(bob), tokensOut - sellAmount);
    }

    function test_sell_revert_zeroAmount() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.ZeroAmount.selector);
        launchpad.sell(curveId, 0, 0);
    }

    function test_sell_revert_slippage() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        // Buy some tokens
        vm.prank(bob);
        (uint256 tokensOut,) = launchpad.buy(curveId, 50e18, 0);

        AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);
        vm.prank(bob);
        IERC20(curve.token).approve(address(launchpad), type(uint256).max);

        // Get sell quote
        (uint256 expectedAgora,) = launchpad.getSellQuote(curveId, tokensOut);

        // Ask for more than possible
        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.SlippageExceeded.selector);
        launchpad.sell(curveId, tokensOut, expectedAgora + 1);
    }

    // ─── buy-sell round trip ────────────────────────────────────────────────

    function test_buy_sell_round_trip() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        uint256 buyAmount = 50e18;
        uint256 bobStartBalance = token.balanceOf(bob);

        // Buy
        vm.prank(bob);
        (uint256 tokensOut,) = launchpad.buy(curveId, buyAmount, 0);

        // Approve and sell all tokens back
        AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);
        vm.prank(bob);
        IERC20(curve.token).approve(address(launchpad), type(uint256).max);

        vm.prank(bob);
        (uint256 agoraBack,) = launchpad.sell(curveId, tokensOut, 0);

        uint256 bobEndBalance = token.balanceOf(bob);
        uint256 loss = bobStartBalance - bobEndBalance;

        // Should lose roughly 2% to fees (1% on buy, ~1% on sell)
        // Loss must be > 0 (fees were charged) and less than 3% of the buy amount
        assertTrue(loss > 0, "Should lose to fees");
        assertTrue(loss < (buyAmount * 3) / 100, "Loss should be under 3%");
        assertTrue(agoraBack < buyAmount, "Should get back less than put in");
    }

    // ─── price increases ────────────────────────────────────────────────────

    function test_price_increases_with_buys() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        uint256 priceBefore = launchpad.getPrice(curveId);

        vm.prank(bob);
        launchpad.buy(curveId, 50e18, 0);

        uint256 priceAfter = launchpad.getPrice(curveId);
        assertTrue(priceAfter > priceBefore, "Price should increase after buy");
    }

    // ─── quotes match trades ────────────────────────────────────────────────

    function test_quotes_match_trades() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        uint256 buyAmount = 25e18;

        // Get quote
        (uint256 quotedTokens, uint256 quotedFee) = launchpad.getBuyQuote(curveId, buyAmount);

        // Execute trade
        vm.prank(bob);
        (uint256 actualTokens, uint256 actualFee) = launchpad.buy(curveId, buyAmount, 0);

        assertEq(actualTokens, quotedTokens, "Buy tokens should match quote");
        assertEq(actualFee, quotedFee, "Buy fee should match quote");

        // Now test sell quote
        AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);
        vm.prank(bob);
        IERC20(curve.token).approve(address(launchpad), type(uint256).max);

        uint256 sellAmount = actualTokens / 2;
        (uint256 quotedAgora, uint256 quotedSellFee) = launchpad.getSellQuote(curveId, sellAmount);

        vm.prank(bob);
        (uint256 actualAgora, uint256 actualSellFee) = launchpad.sell(curveId, sellAmount, 0);

        assertEq(actualAgora, quotedAgora, "Sell agora should match quote");
        assertEq(actualSellFee, quotedSellFee, "Sell fee should match quote");
    }

    // ─── graduation ─────────────────────────────────────────────────────────

    function test_graduation_auto() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        uint256 treasuryBefore = token.balanceOf(treasury);
        uint256 aliceBefore = token.balanceOf(alice);

        // Buy enough to trigger graduation (graduation threshold = 500e18)
        // Need to buy more than 500e18 worth of net AGORA (after 1% fee)
        // So buy ~510e18 to safely exceed 500e18 net
        vm.prank(bob);
        launchpad.buy(curveId, 510e18, 0);

        // Curve should be graduated
        AgoraLaunchpad.Curve memory curve = launchpad.getCurve(curveId);
        assertTrue(curve.graduated, "Curve should be graduated");
        assertEq(curve.uniswapPool, address(0x1234)); // from MockNFPM
        assertEq(curve.accruedFees, 0); // fees distributed

        // Verify 80/20 fee split
        uint256 aliceGain = token.balanceOf(alice) - aliceBefore;
        uint256 treasuryGain = token.balanceOf(treasury) - treasuryBefore;

        // Total fees = aliceGain + treasuryGain
        uint256 totalFees = aliceGain + treasuryGain;
        assertTrue(totalFees > 0, "Fees should have been collected");

        // Creator gets 80%, protocol gets 20%
        // Use approximate check due to rounding
        uint256 expectedCreator = (totalFees * 8000) / 10_000;
        uint256 expectedProtocol = totalFees - expectedCreator;
        assertEq(aliceGain, expectedCreator, "Creator should get 80%");
        assertEq(treasuryGain, expectedProtocol, "Protocol should get 20%");

        // MockNFPM should have been called
        assertTrue(mockNfpm.mintCalled(), "NFPM mint should have been called");
    }

    function test_graduation_revert_alreadyGraduated() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        // Graduate
        vm.prank(bob);
        launchpad.buy(curveId, 510e18, 0);

        // Try to graduate again manually
        vm.expectRevert(AgoraLaunchpad.AlreadyGraduated.selector);
        launchpad.graduate(curveId);
    }

    function test_buy_revert_afterGraduation() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        // Graduate
        vm.prank(bob);
        launchpad.buy(curveId, 510e18, 0);

        // Try to buy after graduation
        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.AlreadyGraduated.selector);
        launchpad.buy(curveId, 10e18, 0);
    }

    function test_sell_revert_afterGraduation() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        // Graduate
        vm.prank(bob);
        launchpad.buy(curveId, 510e18, 0);

        // Try to sell after graduation
        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.AlreadyGraduated.selector);
        launchpad.sell(curveId, 1e18, 0);
    }

    function test_manual_graduate_revert_notReached() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        // Buy a small amount (not enough to graduate)
        vm.prank(bob);
        launchpad.buy(curveId, 10e18, 0);

        // Try manual graduation
        vm.expectRevert(AgoraLaunchpad.NotGraduated.selector);
        launchpad.graduate(curveId);
    }

    // ─── setDefaults ────────────────────────────────────────────────────────

    function test_setDefaults() public {
        vm.prank(admin);
        launchpad.setDefaults(2_000e18, 200e18, 1_000e18, 200, 7000);

        assertEq(launchpad.defaultTotalSupply(), 2_000e18);
        assertEq(launchpad.defaultVirtualAgora(), 200e18);
        assertEq(launchpad.defaultGraduationAgora(), 1_000e18);
        assertEq(launchpad.defaultFeeBps(), 200);
        assertEq(launchpad.defaultCreatorShareBps(), 7000);
    }

    function test_setDefaults_revert_notAdmin() public {
        vm.prank(alice);
        vm.expectRevert(AgoraLaunchpad.NotAdmin.selector);
        launchpad.setDefaults(1_000e18, 100e18, 500e18, 100, 8000);
    }

    function test_setDefaults_revert_zeroTotalSupply() public {
        vm.prank(admin);
        vm.expectRevert(AgoraLaunchpad.InvalidParams.selector);
        launchpad.setDefaults(0, 100e18, 500e18, 100, 8000);
    }

    function test_setDefaults_revert_zeroVirtualAgora() public {
        vm.prank(admin);
        vm.expectRevert(AgoraLaunchpad.InvalidParams.selector);
        launchpad.setDefaults(1_000e18, 0, 500e18, 100, 8000);
    }

    function test_setDefaults_revert_zeroGraduation() public {
        vm.prank(admin);
        vm.expectRevert(AgoraLaunchpad.InvalidParams.selector);
        launchpad.setDefaults(1_000e18, 100e18, 0, 100, 8000);
    }

    function test_setDefaults_revert_feeTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(AgoraLaunchpad.InvalidParams.selector);
        launchpad.setDefaults(1_000e18, 100e18, 500e18, 501, 8000); // >5%
    }

    function test_setDefaults_revert_creatorShareTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(AgoraLaunchpad.InvalidParams.selector);
        launchpad.setDefaults(1_000e18, 100e18, 500e18, 100, 10_001); // >100%
    }

    // ─── setProtocolFeeRecipient ────────────────────────────────────────────

    function test_setProtocolFeeRecipient() public {
        vm.prank(admin);
        launchpad.setProtocolFeeRecipient(bob);

        assertEq(launchpad.protocolFeeRecipient(), bob);
    }

    function test_setProtocolFeeRecipient_revert_notAdmin() public {
        vm.prank(alice);
        vm.expectRevert(AgoraLaunchpad.NotAdmin.selector);
        launchpad.setProtocolFeeRecipient(bob);
    }

    // ─── admin transfer ─────────────────────────────────────────────────────

    function test_admin_transfer() public {
        // Step 1: initiate
        vm.prank(admin);
        launchpad.transferAdmin(alice);

        assertEq(launchpad.pendingAdmin(), alice);
        assertEq(launchpad.admin(), admin); // not yet transferred

        // Step 2: accept
        vm.prank(alice);
        launchpad.acceptAdmin();

        assertEq(launchpad.admin(), alice);
        assertEq(launchpad.pendingAdmin(), address(0));
    }

    function test_admin_transfer_revert_notPendingAdmin() public {
        vm.prank(admin);
        launchpad.transferAdmin(alice);

        vm.prank(bob);
        vm.expectRevert(AgoraLaunchpad.NotPendingAdmin.selector);
        launchpad.acceptAdmin();
    }

    function test_admin_transfer_revert_notAdmin() public {
        vm.prank(alice);
        vm.expectRevert(AgoraLaunchpad.NotAdmin.selector);
        launchpad.transferAdmin(alice);
    }

    // ─── multiple curves ────────────────────────────────────────────────────

    function test_multiple_launches() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveA = launchpad.launch("AliceToken", "ALICE");

        vm.prank(bob);
        uint256 curveB = launchpad.launch("BobToken", "BOB");

        assertEq(curveA, 0);
        assertEq(curveB, 1);
        assertEq(launchpad.totalCurves(), 2);
        assertEq(launchpad.agentCurve(alice), 0);
        assertEq(launchpad.agentCurve(bob), 1);
    }

    // ─── getPrice view ──────────────────────────────────────────────────────

    function test_getPrice_initial() public {
        _setSmallDefaults();

        vm.prank(alice);
        uint256 curveId = launchpad.launch("AliceToken", "ALICE");

        uint256 price = launchpad.getPrice(curveId);
        // Initial price = virtualAgora / totalSupply * 1e18
        // = 100e18 / 1000e18 * 1e18 = 0.1e18
        assertEq(price, 0.1e18);
    }
}
