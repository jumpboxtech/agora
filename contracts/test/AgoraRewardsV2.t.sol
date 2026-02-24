// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgoraRewardsV2} from "../src/AgoraRewardsV2.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAgora is ERC20 {
    constructor() ERC20("Agora", "AGORA") {
        _mint(msg.sender, 100_000_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AgoraRewardsV2Test is Test {
    AgoraRewardsV2 public rewards;
    ERC20 public token;
    address public owner = address(0xBEEF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    // Signer private key + derived address
    uint256 constant SIGNER_KEY = 0xDEAD;
    address public signerAddr;

    // Default limits
    uint256 constant MAX_CLAIM = 10_000 ether;
    uint256 constant DAILY_WALLET = 20_000 ether;
    uint256 constant DAILY_FID = 20_000 ether;
    uint256 constant LIFETIME = 500_000 ether;
    uint256 constant COOLDOWN = 300; // 5 min

    function setUp() public {
        signerAddr = vm.addr(SIGNER_KEY);

        token = new MockAgora();
        rewards = new AgoraRewardsV2(
            address(token), signerAddr, owner,
            MAX_CLAIM, DAILY_WALLET, DAILY_FID, LIFETIME, COOLDOWN
        );

        // Fund pool with 16M AGORA
        token.transfer(address(rewards), 16_000_000 ether);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    function _signClaim(address player, uint256 amount, uint256 nonce, uint256 fid) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encode(player, amount, nonce, fid, block.chainid, address(rewards))
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    function test_ConstructorZeroAgoraReverts() public {
        vm.expectRevert(AgoraRewardsV2.ZeroAddress.selector);
        new AgoraRewardsV2(address(0), signerAddr, owner, MAX_CLAIM, DAILY_WALLET, DAILY_FID, LIFETIME, COOLDOWN);
    }

    function test_ConstructorZeroSignerReverts() public {
        vm.expectRevert(AgoraRewardsV2.ZeroAddress.selector);
        new AgoraRewardsV2(address(token), address(0), owner, MAX_CLAIM, DAILY_WALLET, DAILY_FID, LIFETIME, COOLDOWN);
    }

    function test_ConstructorSetsState() public view {
        assertEq(address(rewards.AGORA()), address(token));
        assertEq(rewards.signer(), signerAddr);
        assertEq(rewards.owner(), owner);
        assertEq(rewards.poolBalance(), 16_000_000 ether);
        assertEq(rewards.maxClaimAmount(), MAX_CLAIM);
        assertEq(rewards.dailyWalletCap(), DAILY_WALLET);
        assertEq(rewards.dailyFidCap(), DAILY_FID);
        assertEq(rewards.lifetimeCap(), LIFETIME);
        assertEq(rewards.claimCooldown(), COOLDOWN);
    }

    // ─── Claim (happy path) ─────────────────────────────────────────────────

    function test_ClaimBasic() public {
        uint256 amount = 2000 ether;
        uint256 nonce = 1;
        uint256 fid = 12345;
        bytes memory sig = _signClaim(alice, amount, nonce, fid);

        vm.prank(alice);
        rewards.claim(amount, nonce, fid, sig);

        assertEq(token.balanceOf(alice), amount);
        assertEq(rewards.totalClaimed(alice), amount);
        assertEq(rewards.totalDistributed(), amount);
        assertEq(rewards.totalClaims(), 1);
        assertTrue(rewards.usedNonces(nonce));
    }

    function test_ClaimMultipleWithCooldown() public {
        uint256 fid = 100;

        // Claim 1
        bytes memory sig1 = _signClaim(alice, 1000 ether, 1, fid);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, fid, sig1);

        // Advance past cooldown
        vm.warp(block.timestamp + COOLDOWN);

        // Claim 2
        bytes memory sig2 = _signClaim(alice, 500 ether, 2, fid);
        vm.prank(alice);
        rewards.claim(500 ether, 2, fid, sig2);

        assertEq(rewards.totalClaimed(alice), 1500 ether);
        assertEq(rewards.totalClaims(), 2);
    }

    function test_ClaimMultipleUsers() public {
        bytes memory sigA = _signClaim(alice, 2000 ether, 1, 100);
        bytes memory sigB = _signClaim(bob, 3000 ether, 2, 200);

        vm.prank(alice);
        rewards.claim(2000 ether, 1, 100, sigA);
        vm.prank(bob);
        rewards.claim(3000 ether, 2, 200, sigB);

        assertEq(rewards.totalClaimed(alice), 2000 ether);
        assertEq(rewards.totalClaimed(bob), 3000 ether);
        assertEq(rewards.totalDistributed(), 5000 ether);
    }

    // ─── Claim Reverts (V1 checks) ──────────────────────────────────────────

    function test_ClaimZeroAmountReverts() public {
        bytes memory sig = _signClaim(alice, 0, 1, 100);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.ZeroAmount.selector);
        rewards.claim(0, 1, 100, sig);
    }

    function test_ClaimNonceReuseReverts() public {
        bytes memory sig = _signClaim(alice, 1000 ether, 42, 100);
        vm.prank(alice);
        rewards.claim(1000 ether, 42, 100, sig);

        vm.warp(block.timestamp + COOLDOWN);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.NonceAlreadyUsed.selector);
        rewards.claim(1000 ether, 42, 100, sig);
    }

    function test_ClaimWrongSignerReverts() public {
        uint256 wrongKey = 0xBAD;
        bytes32 messageHash = keccak256(
            abi.encode(alice, 1000 ether, uint256(1), uint256(100), block.chainid, address(rewards))
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.InvalidSignature.selector);
        rewards.claim(1000 ether, 1, 100, badSig);
    }

    function test_ClaimWrongPlayerReverts() public {
        bytes memory sig = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(bob);
        vm.expectRevert(AgoraRewardsV2.InvalidSignature.selector);
        rewards.claim(1000 ether, 1, 100, sig);
    }

    function test_ClaimWrongFidReverts() public {
        // Signed for fid=100, but submitted with fid=200
        bytes memory sig = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.InvalidSignature.selector);
        rewards.claim(1000 ether, 1, 200, sig);
    }

    function test_ClaimInsufficientPoolReverts() public {
        vm.prank(owner);
        rewards.withdrawPool(16_000_000 ether);

        bytes memory sig = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.InsufficientPool.selector);
        rewards.claim(1000 ether, 1, 100, sig);
    }

    // ─── V2 Cap Enforcement ─────────────────────────────────────────────────

    function test_ExceedsMaxClaimReverts() public {
        uint256 amount = MAX_CLAIM + 1;
        bytes memory sig = _signClaim(alice, amount, 1, 100);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.ExceedsMaxClaim.selector);
        rewards.claim(amount, 1, 100, sig);
    }

    function test_DailyWalletCapReverts() public {
        uint256 fid = 100;

        // Claim up to daily wallet cap
        bytes memory sig1 = _signClaim(alice, MAX_CLAIM, 1, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 1, fid, sig1);

        vm.warp(block.timestamp + COOLDOWN);
        bytes memory sig2 = _signClaim(alice, MAX_CLAIM, 2, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 2, fid, sig2);

        // Third claim exceeds daily wallet cap (20K already claimed, trying another 10K)
        vm.warp(block.timestamp + COOLDOWN);
        bytes memory sig3 = _signClaim(alice, 1 ether, 3, fid);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.DailyWalletCapReached.selector);
        rewards.claim(1 ether, 3, fid, sig3);
    }

    function test_DailyFidCapReverts() public {
        uint256 fid = 100;

        // Alice claims 10K with fid=100
        bytes memory sig1 = _signClaim(alice, MAX_CLAIM, 1, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 1, fid, sig1);

        vm.warp(block.timestamp + COOLDOWN);
        bytes memory sig2 = _signClaim(alice, MAX_CLAIM, 2, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 2, fid, sig2);

        // Bob tries with same fid=100 — FID daily cap reached
        vm.warp(block.timestamp + COOLDOWN);
        bytes memory sig3 = _signClaim(bob, 1 ether, 3, fid);
        vm.prank(bob);
        vm.expectRevert(AgoraRewardsV2.DailyFidCapReached.selector);
        rewards.claim(1 ether, 3, fid, sig3);
    }

    function test_LifetimeCapReverts() public {
        uint256 fid = 100;

        // Set daily caps high so lifetime cap is the binding constraint
        vm.prank(owner);
        rewards.setLimits(MAX_CLAIM, 1_000_000 ether, 1_000_000 ether, 25_000 ether, COOLDOWN);

        // Claim 10K three times = 30K, but lifetime is 25K
        bytes memory sig1 = _signClaim(alice, MAX_CLAIM, 1, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 1, fid, sig1);

        vm.warp(block.timestamp + COOLDOWN);
        bytes memory sig2 = _signClaim(alice, MAX_CLAIM, 2, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 2, fid, sig2);

        vm.warp(block.timestamp + COOLDOWN);
        bytes memory sig3 = _signClaim(alice, MAX_CLAIM, 3, fid);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.LifetimeCapReached.selector);
        rewards.claim(MAX_CLAIM, 3, fid, sig3);
    }

    function test_CooldownReverts() public {
        bytes memory sig1 = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, 100, sig1);

        // Try immediately (no cooldown elapsed)
        bytes memory sig2 = _signClaim(alice, 1000 ether, 2, 100);
        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.CooldownActive.selector);
        rewards.claim(1000 ether, 2, 100, sig2);
    }

    function test_CooldownResetsAfterWait() public {
        bytes memory sig1 = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, 100, sig1);

        // Wait exactly cooldown
        vm.warp(block.timestamp + COOLDOWN);

        bytes memory sig2 = _signClaim(alice, 1000 ether, 2, 100);
        vm.prank(alice);
        rewards.claim(1000 ether, 2, 100, sig2);

        assertEq(rewards.totalClaimed(alice), 2000 ether);
    }

    function test_DailyCapResetsNextDay() public {
        uint256 fid = 100;

        // Claim up to daily cap
        bytes memory sig1 = _signClaim(alice, MAX_CLAIM, 1, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 1, fid, sig1);

        vm.warp(block.timestamp + COOLDOWN);
        bytes memory sig2 = _signClaim(alice, MAX_CLAIM, 2, fid);
        vm.prank(alice);
        rewards.claim(MAX_CLAIM, 2, fid, sig2);

        // Next day — daily cap resets
        vm.warp(block.timestamp + 1 days);

        bytes memory sig3 = _signClaim(alice, 5000 ether, 3, fid);
        vm.prank(alice);
        rewards.claim(5000 ether, 3, fid, sig3);
        assertEq(rewards.totalClaimed(alice), 25_000 ether);
    }

    // ─── View Functions ─────────────────────────────────────────────────────

    function test_DailyWalletRemaining() public {
        bytes memory sig = _signClaim(alice, 5000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(5000 ether, 1, 100, sig);

        assertEq(rewards.dailyWalletRemaining(alice), DAILY_WALLET - 5000 ether);
        assertEq(rewards.dailyWalletRemaining(bob), DAILY_WALLET);
    }

    function test_DailyFidRemaining() public {
        bytes memory sig = _signClaim(alice, 5000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(5000 ether, 1, 100, sig);

        assertEq(rewards.dailyFidRemaining(100), DAILY_FID - 5000 ether);
        assertEq(rewards.dailyFidRemaining(200), DAILY_FID);
    }

    function test_LifetimeRemaining() public {
        bytes memory sig = _signClaim(alice, 5000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(5000 ether, 1, 100, sig);

        assertEq(rewards.lifetimeRemaining(alice), LIFETIME - 5000 ether);
    }

    function test_CooldownRemaining() public {
        assertEq(rewards.cooldownRemaining(alice), 0);

        bytes memory sig = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, 100, sig);

        assertEq(rewards.cooldownRemaining(alice), COOLDOWN);

        vm.warp(block.timestamp + 100);
        assertEq(rewards.cooldownRemaining(alice), COOLDOWN - 100);

        vm.warp(block.timestamp + 200);
        assertEq(rewards.cooldownRemaining(alice), 0);
    }

    // ─── Cross-chain replay protection ──────────────────────────────────────

    function test_ClaimWrongChainIdReverts() public {
        bytes32 messageHash = keccak256(
            abi.encode(alice, 1000 ether, uint256(1), uint256(100), uint256(999), address(rewards))
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert(AgoraRewardsV2.InvalidSignature.selector);
        rewards.claim(1000 ether, 1, 100, badSig);
    }

    // ─── Admin: setSigner ───────────────────────────────────────────────────

    function test_SetSigner() public {
        address newSigner = address(0xCAFE);
        vm.prank(owner);
        rewards.setSigner(newSigner);
        assertEq(rewards.signer(), newSigner);
    }

    function test_SetSignerZeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgoraRewardsV2.ZeroAddress.selector);
        rewards.setSigner(address(0));
    }

    function test_SetSignerOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        rewards.setSigner(alice);
    }

    // ─── Admin: setLimits ───────────────────────────────────────────────────

    function test_SetLimits() public {
        vm.prank(owner);
        rewards.setLimits(5000 ether, 10_000 ether, 10_000 ether, 100_000 ether, 600);

        assertEq(rewards.maxClaimAmount(), 5000 ether);
        assertEq(rewards.dailyWalletCap(), 10_000 ether);
        assertEq(rewards.dailyFidCap(), 10_000 ether);
        assertEq(rewards.lifetimeCap(), 100_000 ether);
        assertEq(rewards.claimCooldown(), 600);
    }

    function test_SetLimitsOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        rewards.setLimits(1, 1, 1, 1, 1);
    }

    // ─── Admin: withdrawPool ────────────────────────────────────────────────

    function test_WithdrawPool() public {
        vm.prank(owner);
        rewards.withdrawPool(1_000_000 ether);
        assertEq(token.balanceOf(owner), 1_000_000 ether);
        assertEq(rewards.poolBalance(), 15_000_000 ether);
    }

    function test_WithdrawPoolOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        rewards.withdrawPool(1 ether);
    }

    // ─── Rescue ─────────────────────────────────────────────────────────────

    function test_RescueNonAgora() public {
        ERC20 other = new MockAgora();
        other.transfer(address(rewards), 1000 ether);

        vm.prank(owner);
        rewards.rescueTokens(address(other), 1000 ether);
        assertEq(other.balanceOf(owner), 1000 ether);
    }

    function test_RescueAgoraReverts() public {
        vm.prank(owner);
        vm.expectRevert("Cannot rescue AGORA");
        rewards.rescueTokens(address(token), 1 ether);
    }

    // ─── Pausable ───────────────────────────────────────────────────────────

    function test_PauseBlocksClaim() public {
        vm.prank(owner);
        rewards.pause();

        bytes memory sig = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        vm.expectRevert();
        rewards.claim(1000 ether, 1, 100, sig);
    }

    function test_UnpauseResumesClaim() public {
        vm.prank(owner);
        rewards.pause();
        vm.prank(owner);
        rewards.unpause();

        bytes memory sig = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, 100, sig);
        assertEq(token.balanceOf(alice), 1000 ether);
    }

    // ─── Ownable2Step ───────────────────────────────────────────────────────

    function test_TransferOwnershipRequiresAcceptance() public {
        vm.prank(owner);
        rewards.transferOwnership(alice);
        assertEq(rewards.owner(), owner);

        vm.prank(alice);
        rewards.acceptOwnership();
        assertEq(rewards.owner(), alice);
    }

    // ─── Pool balance view ──────────────────────────────────────────────────

    function test_PoolBalanceDecreases() public {
        assertEq(rewards.poolBalance(), 16_000_000 ether);

        bytes memory sig = _signClaim(alice, 1000 ether, 1, 100);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, 100, sig);

        assertEq(rewards.poolBalance(), 16_000_000 ether - 1000 ether);
    }
}
