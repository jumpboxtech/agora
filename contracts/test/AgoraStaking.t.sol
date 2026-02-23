// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgoraStaking} from "../src/AgoraStaking.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAgora is ERC20 {
    constructor() ERC20("Agora", "AGORA") {
        _mint(msg.sender, 100_000_000_000 ether); // 100B
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AgoraStakingTest is Test {
    AgoraStaking public staking;
    MockAgora public token;
    address public owner = address(0xBEEF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public dead = address(0xdead);

    function setUp() public {
        token = new MockAgora();
        staking = new AgoraStaking(address(token), owner);

        token.transfer(alice, 50_000_000_000 ether);
        token.transfer(bob, 50_000_000_000 ether);

        vm.prank(alice);
        token.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        token.approve(address(staking), type(uint256).max);
    }

    // ─── Constructor ────────────────────────────────────────────────────────────

    function test_ConstructorZeroAddressReverts() public {
        vm.expectRevert(AgoraStaking.ZeroAddress.selector);
        new AgoraStaking(address(0), owner);
    }

    // ─── Staking ────────────────────────────────────────────────────────────────

    function test_StakeBasic() public {
        vm.prank(alice);
        staking.stake(10_000_000 ether);

        (uint256 staked,,,,) = staking.getUserStake(alice);
        assertEq(staked, 10_000_000 ether);
        assertEq(staking.totalStaked(), 10_000_000 ether);
    }

    function test_StakeMultipleDeposits() public {
        vm.startPrank(alice);
        staking.stake(5_000_000 ether);
        staking.stake(5_000_000 ether);
        vm.stopPrank();

        (uint256 staked,,,,) = staking.getUserStake(alice);
        assertEq(staked, 10_000_000 ether);
    }

    function test_StakeZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraStaking.ZeroAmount.selector);
        staking.stake(0);
    }

    function test_StakeWhileUnstakingAllowed() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        staking.initiateUnstake(5_000_000 ether);
        staking.stake(1_000_000 ether); // should NOT revert
        vm.stopPrank();

        (uint256 staked,,,,) = staking.getUserStake(alice);
        assertEq(staked, 6_000_000 ether); // 10M - 5M + 1M
    }

    // ─── Tiers ──────────────────────────────────────────────────────────────────

    function test_TierNone() public view {
        assertEq(staking.getStakeTier(alice), 0);
        assertEq(staking.getStakeBonus(alice), 0);
    }

    function test_Tier1() public {
        vm.prank(alice);
        staking.stake(10_000_000 ether);
        assertEq(staking.getStakeTier(alice), 1);
        assertEq(staking.getStakeBonus(alice), 500);
    }

    function test_Tier2() public {
        vm.prank(alice);
        staking.stake(100_000_000 ether);
        assertEq(staking.getStakeTier(alice), 2);
        assertEq(staking.getStakeBonus(alice), 1500);
    }

    function test_Tier3() public {
        vm.prank(alice);
        staking.stake(1_000_000_000 ether);
        assertEq(staking.getStakeTier(alice), 3);
        assertEq(staking.getStakeBonus(alice), 3000);
    }

    function test_Tier4() public {
        vm.prank(alice);
        staking.stake(10_000_000_000 ether);
        assertEq(staking.getStakeTier(alice), 4);
        assertEq(staking.getStakeBonus(alice), 5000);
    }

    // ─── Unstaking ──────────────────────────────────────────────────────────────

    function test_InitiateUnstake() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        staking.initiateUnstake(5_000_000 ether);
        vm.stopPrank();

        (uint256 staked, uint256 unstaking, uint256 unstakeAt,,) = staking.getUserStake(alice);
        assertEq(staked, 5_000_000 ether);
        assertEq(unstaking, 5_000_000 ether);
        assertEq(unstakeAt, block.timestamp + 30);
        assertEq(staking.totalStaked(), 5_000_000 ether);
        assertEq(staking.totalUnstaking(), 5_000_000 ether);
    }

    function test_InitiateUnstakeInsufficientReverts() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        vm.expectRevert(AgoraStaking.InsufficientStake.selector);
        staking.initiateUnstake(20_000_000 ether);
        vm.stopPrank();
    }

    function test_ClaimUnstakeWithBurn() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        staking.initiateUnstake(10_000_000 ether);
        vm.stopPrank();

        // Before cooldown
        vm.prank(alice);
        vm.expectRevert(AgoraStaking.CooldownNotComplete.selector);
        staking.claimUnstake();

        // After cooldown
        vm.warp(block.timestamp + 31);
        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        staking.claimUnstake();
        uint256 balAfter = token.balanceOf(alice);

        uint256 expectedBurn = 10_000_000 ether / 100;
        uint256 expectedReturn = 10_000_000 ether - expectedBurn;
        assertEq(balAfter - balBefore, expectedReturn);
        assertEq(staking.totalBurned(), expectedBurn);
        assertEq(staking.totalUnstaking(), 0);
        assertEq(token.balanceOf(dead), expectedBurn);
    }

    function test_ClaimUnstakeNoUnstakePendingReverts() public {
        vm.prank(alice);
        vm.expectRevert(AgoraStaking.NoUnstakePending.selector);
        staking.claimUnstake();
    }

    function test_DoubleUnstakeReverts() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        staking.initiateUnstake(5_000_000 ether);
        vm.expectRevert(AgoraStaking.UnstakePending.selector);
        staking.initiateUnstake(3_000_000 ether);
        vm.stopPrank();
    }

    // ─── Full cycle ─────────────────────────────────────────────────────────────

    function test_FullStakeUnstakeCycle() public {
        uint256 startBal = token.balanceOf(alice);

        vm.prank(alice);
        staking.stake(1_000_000_000 ether);
        assertEq(staking.getStakeTier(alice), 3);

        vm.prank(alice);
        staking.initiateUnstake(1_000_000_000 ether);
        assertEq(staking.getStakeTier(alice), 0);

        vm.warp(block.timestamp + 31);
        vm.prank(alice);
        staking.claimUnstake();

        uint256 endBal = token.balanceOf(alice);
        uint256 burned = 1_000_000_000 ether / 100;
        assertEq(startBal - endBal, burned);
    }

    // ─── Rescue (audit fix: accounts for totalUnstaking) ────────────────────────

    function test_RescueNonStakedTokens() public {
        token.mint(address(staking), 1_000 ether);

        vm.prank(owner);
        staking.rescueTokens(address(token), 1_000 ether);
        assertEq(token.balanceOf(owner), 1_000 ether);
    }

    function test_CannotRescueStakedTokens() public {
        vm.prank(alice);
        staking.stake(10_000_000 ether);

        vm.prank(owner);
        vm.expectRevert("Cannot rescue committed tokens");
        staking.rescueTokens(address(token), 10_000_000 ether);
    }

    function test_CannotRescueUnstakingTokens() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        staking.initiateUnstake(10_000_000 ether);
        vm.stopPrank();

        // totalStaked = 0, but totalUnstaking = 10M — rescue should still fail
        vm.prank(owner);
        vm.expectRevert("Cannot rescue committed tokens");
        staking.rescueTokens(address(token), 10_000_000 ether);
    }

    function test_RescueExcessWithUnstaking() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        staking.initiateUnstake(5_000_000 ether);
        vm.stopPrank();

        token.mint(address(staking), 1_000 ether);

        vm.prank(owner);
        staking.rescueTokens(address(token), 1_000 ether);

        vm.prank(owner);
        vm.expectRevert("Cannot rescue committed tokens");
        staking.rescueTokens(address(token), 1 ether);
    }

    function test_OnlyOwnerCanRescue() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.rescueTokens(address(token), 0);
    }

    // ─── Pausable ───────────────────────────────────────────────────────────────

    function test_PauseBlocksStaking() public {
        vm.prank(owner);
        staking.pause();

        vm.prank(alice);
        vm.expectRevert();
        staking.stake(1_000_000 ether);
    }

    function test_PauseBlocksUnstaking() public {
        vm.prank(alice);
        staking.stake(1_000_000 ether);

        vm.prank(owner);
        staking.pause();

        vm.prank(alice);
        vm.expectRevert();
        staking.initiateUnstake(1_000_000 ether);
    }

    function test_ClaimUnstakeWorksWhilePaused() public {
        vm.startPrank(alice);
        staking.stake(1_000_000 ether);
        staking.initiateUnstake(1_000_000 ether);
        vm.stopPrank();

        vm.prank(owner);
        staking.pause();

        vm.warp(block.timestamp + 31);
        vm.prank(alice);
        staking.claimUnstake(); // should NOT revert
    }

    function test_UnpauseResumesOperations() public {
        vm.prank(owner);
        staking.pause();
        vm.prank(owner);
        staking.unpause();

        vm.prank(alice);
        staking.stake(1_000_000 ether);
    }

    // ─── Ownable2Step ───────────────────────────────────────────────────────────

    function test_TransferOwnershipRequiresAcceptance() public {
        vm.prank(owner);
        staking.transferOwnership(alice);
        assertEq(staking.owner(), owner);

        vm.prank(alice);
        staking.acceptOwnership();
        assertEq(staking.owner(), alice);
    }

    // ─── TotalCommitted ─────────────────────────────────────────────────────────

    function test_TotalCommitted() public {
        vm.startPrank(alice);
        staking.stake(10_000_000 ether);
        staking.initiateUnstake(3_000_000 ether);
        vm.stopPrank();

        assertEq(staking.totalCommitted(), 10_000_000 ether);
    }

    // ─── getUserStake ───────────────────────────────────────────────────────────

    function test_GetUserStakeReturnsCorrectData() public {
        vm.prank(alice);
        staking.stake(100_000_000 ether);

        (uint256 staked, uint256 unstaking, uint256 unstakeAt, uint8 tier, uint256 bonusBps) =
            staking.getUserStake(alice);

        assertEq(staked, 100_000_000 ether);
        assertEq(unstaking, 0);
        assertEq(unstakeAt, 0);
        assertEq(tier, 2);
        assertEq(bonusBps, 1500);
    }
}
