// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgoraAgentSubV2, IV4Router} from "../src/AgoraAgentSubV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000e6); // 1M USDC
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract MockAgora is ERC20 {
    constructor() ERC20("Agora", "AGORA") {
        _mint(msg.sender, 100_000_000_000 ether); // 100B AGORA
    }
}

/// @dev Mock V4 Router that simulates swapExactTokensForTokens
///      Swaps USDC → AGORA at 1 USDC = 1000 AGORA rate
contract MockV4Router {
    IERC20 public usdc;
    IERC20 public agora;
    uint256 public rate = 1000; // 1 USDC (1e6) = 1000 AGORA (1000e18)

    constructor(address _usdc, address _agora) {
        usdc = IERC20(_usdc);
        agora = IERC20(_agora);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        bool, /* zeroForOne */
        IV4Router.PoolKey calldata, /* poolKey */
        bytes calldata, /* hookData */
        address receiver,
        uint256 /* deadline */
    ) external payable returns (int256) {
        // Pull USDC from caller
        usdc.transferFrom(msg.sender, address(this), amountIn);

        // Calculate AGORA output: amountIn is in 6 decimals, output in 18 decimals
        uint256 amountOut = amountIn * rate * 1e12; // 6 dec → 18 dec conversion * rate

        require(amountOut >= amountOutMin, "Too little received");

        // Send AGORA to receiver (burn address)
        agora.transfer(receiver, amountOut);

        // Return BalanceDelta (simplified — just return amountOut as int256)
        return int256(amountOut);
    }
}

contract AgoraAgentSubV2Test is Test {
    AgoraAgentSubV2 public sub;
    MockUSDC public usdc;
    MockAgora public agora;
    MockV4Router public router;

    address public owner = address(0xBEEF);
    address public treasury = address(0x7EA5);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public dead = address(0xdead);
    address public hooks = address(0xC00C);

    IV4Router.PoolKey public poolKey;

    function setUp() public {
        usdc = new MockUSDC();
        agora = new MockAgora();
        router = new MockV4Router(address(usdc), address(agora));

        // Fund mock router with AGORA for swap outputs
        agora.transfer(address(router), 50_000_000_000 ether);

        // Set up pool key (AGORA < USDC numerically)
        poolKey = IV4Router.PoolKey({
            currency0: address(agora),
            currency1: address(usdc),
            fee: 10000,
            tickSpacing: 200,
            hooks: hooks
        });

        sub = new AgoraAgentSubV2(
            address(usdc),
            address(agora),
            address(router),
            treasury,
            poolKey,
            owner
        );

        // Fund users with USDC
        usdc.transfer(alice, 10_000e6); // $10,000
        usdc.transfer(bob, 10_000e6);

        // Approve
        vm.prank(alice);
        usdc.approve(address(sub), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(sub), type(uint256).max);
    }

    // ─── Constructor ────────────────────────────────────────────────────────────

    function test_ConstructorZeroUsdcReverts() public {
        vm.expectRevert(AgoraAgentSubV2.ZeroAddress.selector);
        new AgoraAgentSubV2(address(0), address(agora), address(router), treasury, poolKey, owner);
    }

    function test_ConstructorZeroAgoraReverts() public {
        vm.expectRevert(AgoraAgentSubV2.ZeroAddress.selector);
        new AgoraAgentSubV2(address(usdc), address(0), address(router), treasury, poolKey, owner);
    }

    function test_ConstructorZeroRouterReverts() public {
        vm.expectRevert(AgoraAgentSubV2.ZeroAddress.selector);
        new AgoraAgentSubV2(address(usdc), address(agora), address(0), treasury, poolKey, owner);
    }

    function test_ConstructorZeroTreasuryReverts() public {
        vm.expectRevert(AgoraAgentSubV2.ZeroAddress.selector);
        new AgoraAgentSubV2(address(usdc), address(agora), address(router), address(0), poolKey, owner);
    }

    function test_ConstructorInvalidPoolKeyReverts() public {
        IV4Router.PoolKey memory badKey = poolKey;
        badKey.currency0 = address(0);
        vm.expectRevert(AgoraAgentSubV2.InvalidPoolKey.selector);
        new AgoraAgentSubV2(address(usdc), address(agora), address(router), treasury, badKey, owner);
    }

    // ─── Subscribe ──────────────────────────────────────────────────────────────

    function test_SubscribeStarter() public {
        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);

        (uint8 tier, uint256 expiresAt, string memory name, address payTo, bool active) = sub.getSubscription(alice);
        assertEq(tier, 1);
        assertEq(expiresAt, block.timestamp + 30 days);
        assertEq(name, "alice-agent");
        assertEq(payTo, alice);
        assertTrue(active);
    }

    function test_SubscribePro() public {
        vm.prank(alice);
        sub.subscribe(2, "alice-pro", alice);

        assertEq(sub.totalActiveSubscriptions(), 1);
        assertTrue(sub.isActive(alice));
    }

    function test_SubscribeEnterprise() public {
        vm.prank(alice);
        sub.subscribe(3, "alice-ent", alice);

        (uint8 tier,,,,) = sub.getSubscription(alice);
        assertEq(tier, 3);
    }

    function test_SubscribeInvalidTierReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.InvalidTier.selector);
        sub.subscribe(0, "test", alice);

        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.InvalidTier.selector);
        sub.subscribe(4, "test", alice);
    }

    function test_SubscribeZeroPayToReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.ZeroAddress.selector);
        sub.subscribe(1, "test", address(0));
    }

    function test_SubscribeEmptyNameReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.EmptyAgentName.selector);
        sub.subscribe(1, "", alice);
    }

    function test_SubscribeInvalidNameReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.InvalidNameChar.selector);
        sub.subscribe(1, "UPPERCASE", alice);

        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.InvalidNameChar.selector);
        sub.subscribe(1, "-leading-hyphen", alice);
    }

    function test_SubscribeDuplicateNameReverts() public {
        vm.prank(alice);
        sub.subscribe(1, "taken-name", alice);

        vm.prank(bob);
        vm.expectRevert(AgoraAgentSubV2.NameTaken.selector);
        sub.subscribe(1, "taken-name", bob);
    }

    // ─── Payment Flow ───────────────────────────────────────────────────────────

    function test_PaymentSplitStarter() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 deadBefore = agora.balanceOf(dead);

        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);

        // Starter = $10 = 10e6 USDC
        // 50% to treasury = 5e6 USDC
        uint256 treasuryGot = usdc.balanceOf(treasury) - treasuryBefore;
        assertEq(treasuryGot, 5e6);

        // 50% swapped: 5e6 USDC * 1000 rate * 1e12 = 5e21 AGORA
        uint256 deadGot = agora.balanceOf(dead) - deadBefore;
        assertEq(deadGot, 5e6 * 1000 * 1e12);

        // Stats tracked
        assertEq(sub.totalUsdcCollected(), 10e6);
        assertGt(sub.totalBurned(), 0);
    }

    function test_PaymentSplitPro() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(alice);
        sub.subscribe(2, "alice-pro", alice);

        // Pro = $25 = 25e6 USDC, 50% to treasury = 12.5e6 but integer division = 12e6
        uint256 treasuryGot = usdc.balanceOf(treasury) - treasuryBefore;
        assertEq(treasuryGot, 25e6 / 2); // 12500000
    }

    function test_PaymentSplitEnterprise() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(alice);
        sub.subscribe(3, "alice-ent", alice);

        // Enterprise = $50 = 50e6 USDC, 50% to treasury = 25e6
        uint256 treasuryGot = usdc.balanceOf(treasury) - treasuryBefore;
        assertEq(treasuryGot, 25e6);
    }

    // ─── Renew ──────────────────────────────────────────────────────────────────

    function test_Renew() public {
        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);

        (,uint256 exp1,,,) = sub.getSubscription(alice);

        vm.prank(alice);
        sub.renew();

        (,uint256 exp2,,,) = sub.getSubscription(alice);
        assertEq(exp2, exp1 + 30 days);
    }

    function test_RenewNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.NotSubscribed.selector);
        sub.renew();
    }

    function test_RenewAfterExpiry() public {
        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);

        // Warp past expiry
        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        sub.renew();

        (,uint256 exp,,,bool active) = sub.getSubscription(alice);
        assertTrue(active);
        assertEq(exp, block.timestamp + 30 days);
    }

    function test_RenewMaxPrepaidReverts() public {
        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);

        // Renew 12 times = 390 days total > 365 max
        for (uint256 i = 0; i < 11; i++) {
            vm.prank(alice);
            sub.renew();
        }

        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.MaxPrepaidExceeded.selector);
        sub.renew();
    }

    // ─── Update Agent ───────────────────────────────────────────────────────────

    function test_UpdateAgent() public {
        vm.prank(alice);
        sub.subscribe(1, "old-name", alice);

        vm.prank(alice);
        sub.updateAgent("new-name", bob);

        (,,string memory name, address payTo,) = sub.getSubscription(alice);
        assertEq(name, "new-name");
        assertEq(payTo, bob);

        // Old name should be available
        assertTrue(sub.isNameAvailable("old-name"));
        assertFalse(sub.isNameAvailable("new-name"));
    }

    function test_UpdateNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSubV2.NotSubscribed.selector);
        sub.updateAgent("test", alice);
    }

    // ─── Release Name ───────────────────────────────────────────────────────────

    function test_ReleaseName() public {
        vm.prank(alice);
        sub.subscribe(1, "my-agent", alice);
        assertFalse(sub.isNameAvailable("my-agent"));

        vm.prank(alice);
        sub.releaseName();
        assertTrue(sub.isNameAvailable("my-agent"));
    }

    // ─── Name Availability ──────────────────────────────────────────────────────

    function test_NameAvailableAfterExpiry() public {
        vm.prank(alice);
        sub.subscribe(1, "temp-name", alice);
        assertFalse(sub.isNameAvailable("temp-name"));

        vm.warp(block.timestamp + 31 days);
        assertTrue(sub.isNameAvailable("temp-name"));
    }

    // ─── Tier Costs ─────────────────────────────────────────────────────────────

    function test_GetTierCost() public view {
        assertEq(sub.getTierCost(0), 0);
        assertEq(sub.getTierCost(1), 10e6);   // $10
        assertEq(sub.getTierCost(2), 25e6);   // $25
        assertEq(sub.getTierCost(3), 50e6);   // $50
    }

    // ─── Pool Key ───────────────────────────────────────────────────────────────

    function test_GetPoolKey() public view {
        (address c0, address c1, uint24 fee, int24 ts, address h) = sub.getPoolKey();
        assertEq(c0, address(agora));
        assertEq(c1, address(usdc));
        assertEq(fee, 10000);
        assertEq(ts, 200);
        assertEq(h, hooks);
    }

    function test_SetPoolKey() public {
        IV4Router.PoolKey memory newKey = IV4Router.PoolKey({
            currency0: address(agora),
            currency1: address(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0x1234)
        });

        vm.prank(owner);
        sub.setPoolKey(newKey);

        (,, uint24 fee, int24 ts, address h) = sub.getPoolKey();
        assertEq(fee, 3000);
        assertEq(ts, 60);
        assertEq(h, address(0x1234));
    }

    function test_SetPoolKeyInvalidReverts() public {
        IV4Router.PoolKey memory badKey = poolKey;
        badKey.currency0 = address(0);

        vm.prank(owner);
        vm.expectRevert(AgoraAgentSubV2.InvalidPoolKey.selector);
        sub.setPoolKey(badKey);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────────

    function test_SetTierCost() public {
        vm.prank(owner);
        sub.setTierCost(1, 15e6); // $15
        assertEq(sub.getTierCost(1), 15e6);
    }

    function test_SetTreasury() public {
        vm.prank(owner);
        sub.setTreasury(bob);
        assertEq(sub.treasury(), bob);
    }

    function test_SetTreasuryZeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgoraAgentSubV2.ZeroAddress.selector);
        sub.setTreasury(address(0));
    }

    function test_SetMinSwapOut() public {
        vm.prank(owner);
        sub.setMinSwapOut(1000);
        assertEq(sub.minSwapOut(), 1000);
    }

    function test_Pause() public {
        vm.prank(owner);
        sub.pause();

        vm.prank(alice);
        vm.expectRevert();
        sub.subscribe(1, "test", alice);
    }

    function test_Unpause() public {
        vm.prank(owner);
        sub.pause();

        vm.prank(owner);
        sub.unpause();

        vm.prank(alice);
        sub.subscribe(1, "test", alice);
        assertTrue(sub.isActive(alice));
    }

    function test_RescueTokens() public {
        // Deploy a random token and send to contract
        MockAgora other = new MockAgora();
        other.transfer(address(sub), 1000 ether);

        vm.prank(owner);
        sub.rescueTokens(address(other), 1000 ether);
        assertEq(other.balanceOf(owner), 1000 ether);
    }

    function test_RescueUsdcReverts() public {
        vm.prank(owner);
        vm.expectRevert("Cannot rescue core tokens");
        sub.rescueTokens(address(usdc), 1e6);
    }

    function test_RescueAgoraReverts() public {
        vm.prank(owner);
        vm.expectRevert("Cannot rescue core tokens");
        sub.rescueTokens(address(agora), 1 ether);
    }

    function test_NonOwnerCannotSetTierCost() public {
        vm.prank(alice);
        vm.expectRevert();
        sub.setTierCost(1, 100e6);
    }

    // ─── USDC Balance Check ─────────────────────────────────────────────────────

    function test_UsdcDeductedCorrectly() public {
        uint256 before = usdc.balanceOf(alice);

        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);

        assertEq(usdc.balanceOf(alice), before - 10e6);
    }

    function test_MultipleSubscriptionsTotalUsdc() public {
        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);

        vm.prank(bob);
        sub.subscribe(3, "bob-agent", bob);

        assertEq(sub.totalUsdcCollected(), 10e6 + 50e6);
    }
}
