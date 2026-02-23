// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgoraAgentSub} from "../src/AgoraAgentSub.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAgora is ERC20 {
    constructor() ERC20("Agora", "AGORA") {
        _mint(msg.sender, 100_000_000_000 ether);
    }
}

contract AgoraAgentSubTest is Test {
    AgoraAgentSub public sub;
    ERC20 public token;
    address public owner = address(0xBEEF);
    address public treasury = address(0x7EA5);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public dead = address(0xdead);

    function setUp() public {
        token = new MockAgora();
        sub = new AgoraAgentSub(address(token), treasury, owner);

        token.transfer(alice, 10_000_000_000 ether);
        token.transfer(bob, 10_000_000_000 ether);

        vm.prank(alice);
        token.approve(address(sub), type(uint256).max);
        vm.prank(bob);
        token.approve(address(sub), type(uint256).max);
    }

    // ─── Constructor ────────────────────────────────────────────────────────────

    function test_ConstructorZeroAgoraReverts() public {
        vm.expectRevert(AgoraAgentSub.ZeroAddress.selector);
        new AgoraAgentSub(address(0), treasury, owner);
    }

    function test_ConstructorZeroTreasuryReverts() public {
        vm.expectRevert(AgoraAgentSub.ZeroAddress.selector);
        new AgoraAgentSub(address(token), address(0), owner);
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

    function test_SubscribeBurnAndTreasurySplit() public {
        uint256 cost = sub.tierCosts(1); // 50M
        uint256 treasuryBefore = token.balanceOf(treasury);
        uint256 deadBefore = token.balanceOf(dead);

        vm.prank(alice);
        sub.subscribe(1, "agent", alice);

        uint256 expectedBurn = cost / 2;
        uint256 expectedTreasury = cost - expectedBurn;

        assertEq(token.balanceOf(dead) - deadBefore, expectedBurn);
        assertEq(token.balanceOf(treasury) - treasuryBefore, expectedTreasury);
        assertEq(sub.totalBurned(), expectedBurn);
    }

    function test_SubscribeInvalidTierReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.InvalidTier.selector);
        sub.subscribe(0, "agent", alice);

        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.InvalidTier.selector);
        sub.subscribe(4, "agent", alice);
    }

    function test_SubscribeEmptyNameReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.EmptyAgentName.selector);
        sub.subscribe(1, "", alice);
    }

    function test_SubscribeZeroPayToReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.ZeroAddress.selector);
        sub.subscribe(1, "agent", address(0));
    }

    // ─── Name Validation ────────────────────────────────────────────────────────

    function test_SubscribeInvalidNameUppercaseReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.InvalidNameChar.selector);
        sub.subscribe(1, "MyAgent", alice);
    }

    function test_SubscribeInvalidNameSpecialCharsReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.InvalidNameChar.selector);
        sub.subscribe(1, "my_agent", alice);
    }

    function test_SubscribeInvalidNameLeadingHyphenReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.InvalidNameChar.selector);
        sub.subscribe(1, "-agent", alice);
    }

    function test_SubscribeInvalidNameTrailingHyphenReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.InvalidNameChar.selector);
        sub.subscribe(1, "agent-", alice);
    }

    function test_SubscribeValidNameWithHyphensAndNumbers() public {
        vm.prank(alice);
        sub.subscribe(1, "my-agent-123", alice);

        (,, string memory name,,) = sub.getSubscription(alice);
        assertEq(name, "my-agent-123");
    }

    function test_SubscribeNameTooLongReverts() public {
        // 64 chars — over the 63 limit
        bytes memory longName = new bytes(64);
        for (uint256 i; i < 64; i++) longName[i] = "a";

        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.NameTooLong.selector);
        sub.subscribe(1, string(longName), alice);
    }

    // ─── Name Uniqueness ────────────────────────────────────────────────────────

    function test_NameTakenReverts() public {
        vm.prank(alice);
        sub.subscribe(1, "cool-agent", alice);

        vm.prank(bob);
        vm.expectRevert(AgoraAgentSub.NameTaken.selector);
        sub.subscribe(1, "cool-agent", bob);
    }

    function test_SameUserCanReuseOwnName() public {
        vm.prank(alice);
        sub.subscribe(1, "my-agent", alice);

        // Alice re-subscribes with same name — should work
        vm.prank(alice);
        sub.subscribe(2, "my-agent", alice);

        (uint8 tier,,,,) = sub.getSubscription(alice);
        assertEq(tier, 2);
    }

    function test_NameReleasedOnChange() public {
        vm.prank(alice);
        sub.subscribe(1, "old-name", alice);

        // Alice changes name
        vm.prank(alice);
        sub.updateAgent("new-name", alice);

        // Bob can now take the old name
        vm.prank(bob);
        sub.subscribe(1, "old-name", bob);
        assertTrue(sub.isActive(bob));
    }

    function test_IsNameAvailable() public {
        assertTrue(sub.isNameAvailable("test-agent"));

        vm.prank(alice);
        sub.subscribe(1, "test-agent", alice);
        assertFalse(sub.isNameAvailable("test-agent"));

        // Expires
        vm.warp(block.timestamp + 31 days);
        assertTrue(sub.isNameAvailable("test-agent"));
    }

    function test_ReleaseName() public {
        vm.prank(alice);
        sub.subscribe(1, "my-agent", alice);

        vm.prank(alice);
        sub.releaseName();

        (,, string memory name,,) = sub.getSubscription(alice);
        assertEq(bytes(name).length, 0);

        // Bob can take it
        vm.prank(bob);
        sub.subscribe(1, "my-agent", bob);
        assertTrue(sub.isActive(bob));
    }

    // ─── Renew ──────────────────────────────────────────────────────────────────

    function test_RenewExtendsFromExpiry() public {
        vm.prank(alice);
        sub.subscribe(1, "agent", alice);

        (, uint256 firstExpiry,,,) = sub.getSubscription(alice);

        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        sub.renew();

        (, uint256 newExpiry,,,) = sub.getSubscription(alice);
        assertEq(newExpiry, firstExpiry + 30 days);
    }

    function test_RenewAfterExpiry() public {
        vm.prank(alice);
        sub.subscribe(1, "agent", alice);

        vm.warp(block.timestamp + 60 days);
        assertFalse(sub.isActive(alice));

        vm.prank(alice);
        sub.renew();

        (, uint256 newExpiry,,,) = sub.getSubscription(alice);
        assertEq(newExpiry, block.timestamp + 30 days);
        assertTrue(sub.isActive(alice));
    }

    function test_RenewNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.NotSubscribed.selector);
        sub.renew();
    }

    // ─── Max prepaid duration ───────────────────────────────────────────────────

    function test_MaxPrepaidExceededReverts() public {
        vm.startPrank(alice);
        sub.subscribe(1, "agent", alice);
        // Renew 11 more times → 12 × 30 days = 360 days (under 365)
        for (uint256 i; i < 11; i++) {
            sub.renew();
        }
        // 13th renewal would push to 390 days > 365
        vm.expectRevert(AgoraAgentSub.MaxPrepaidExceeded.selector);
        sub.renew();
        vm.stopPrank();
    }

    // ─── Update Agent Config ────────────────────────────────────────────────────

    function test_UpdateAgentConfig() public {
        vm.prank(alice);
        sub.subscribe(1, "agent-v1", alice);

        vm.prank(alice);
        sub.updateAgent("agent-v2", bob);

        (,, string memory name, address payTo,) = sub.getSubscription(alice);
        assertEq(name, "agent-v2");
        assertEq(payTo, bob);
    }

    function test_UpdateAgentExpiredReverts() public {
        vm.prank(alice);
        sub.subscribe(1, "agent", alice);

        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.SubscriptionExpired.selector);
        sub.updateAgent("new-name", alice);
    }

    function test_UpdateAgentNotSubscribedReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraAgentSub.NotSubscribed.selector);
        sub.updateAgent("agent", alice);
    }

    // ─── Re-subscribe ───────────────────────────────────────────────────────────

    function test_ResubscribeExtendsTime() public {
        vm.prank(alice);
        sub.subscribe(1, "agent", alice);

        (, uint256 firstExpiry,,,) = sub.getSubscription(alice);

        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        sub.subscribe(2, "agent-pro", alice);

        (, uint256 newExpiry,,,) = sub.getSubscription(alice);
        assertEq(newExpiry, firstExpiry + 30 days);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────────

    function test_SetTreasury() public {
        vm.prank(owner);
        sub.setTreasury(bob);
        assertEq(sub.treasury(), bob);
    }

    function test_SetTreasuryZeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgoraAgentSub.ZeroAddress.selector);
        sub.setTreasury(address(0));
    }

    function test_SetTierCost() public {
        vm.prank(owner);
        sub.setTierCost(1, 25_000_000 ether);
        assertEq(sub.tierCosts(1), 25_000_000 ether);
    }

    function test_OnlyOwnerSetTreasury() public {
        vm.prank(alice);
        vm.expectRevert();
        sub.setTreasury(alice);
    }

    function test_OnlyOwnerSetTierCost() public {
        vm.prank(alice);
        vm.expectRevert();
        sub.setTierCost(1, 0);
    }

    function test_SetTierCostInvalidTierReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgoraAgentSub.InvalidTier.selector);
        sub.setTierCost(0, 100 ether);

        vm.prank(owner);
        vm.expectRevert(AgoraAgentSub.InvalidTier.selector);
        sub.setTierCost(4, 100 ether);
    }

    function test_RescueCannotTakeAgora() public {
        vm.prank(owner);
        vm.expectRevert("Cannot rescue AGORA");
        sub.rescueTokens(address(token), 1 ether);
    }

    // ─── Pausable ───────────────────────────────────────────────────────────────

    function test_PauseBlocksSubscribe() public {
        vm.prank(owner);
        sub.pause();

        vm.prank(alice);
        vm.expectRevert();
        sub.subscribe(1, "agent", alice);
    }

    function test_PauseBlocksRenew() public {
        vm.prank(alice);
        sub.subscribe(1, "agent", alice);

        vm.prank(owner);
        sub.pause();

        vm.prank(alice);
        vm.expectRevert();
        sub.renew();
    }

    // ─── Ownable2Step ───────────────────────────────────────────────────────────

    function test_TransferOwnershipRequiresAcceptance() public {
        vm.prank(owner);
        sub.transferOwnership(alice);
        assertEq(sub.owner(), owner);

        vm.prank(alice);
        sub.acceptOwnership();
        assertEq(sub.owner(), alice);
    }

    // ─── View functions ─────────────────────────────────────────────────────────

    function test_IsActiveReturnsFalseForNonSubscriber() public view {
        assertFalse(sub.isActive(alice));
    }

    function test_GetTierCost() public view {
        assertEq(sub.getTierCost(0), 0);
        assertEq(sub.getTierCost(1), 50_000_000 ether);
        assertEq(sub.getTierCost(2), 100_000_000 ether);
        assertEq(sub.getTierCost(3), 250_000_000 ether);
    }

    function test_GetTierCostInvalidReverts() public {
        vm.expectRevert(AgoraAgentSub.InvalidTier.selector);
        sub.getTierCost(4);
    }

    // ─── Multiple users ─────────────────────────────────────────────────────────

    function test_MultipleUsersSubscribe() public {
        vm.prank(alice);
        sub.subscribe(1, "alice-agent", alice);
        vm.prank(bob);
        sub.subscribe(2, "bob-agent", bob);

        assertEq(sub.totalActiveSubscriptions(), 2);
        assertTrue(sub.isActive(alice));
        assertTrue(sub.isActive(bob));
    }
}
