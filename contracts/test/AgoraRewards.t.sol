// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgoraRewards} from "../src/AgoraRewards.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAgora is ERC20 {
    constructor() ERC20("Agora", "AGORA") {
        _mint(msg.sender, 100_000_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AgoraRewardsTest is Test {
    AgoraRewards public rewards;
    ERC20 public token;
    address public owner = address(0xBEEF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    // Signer private key + derived address
    uint256 constant SIGNER_KEY = 0xDEAD;
    address public signerAddr;

    function setUp() public {
        signerAddr = vm.addr(SIGNER_KEY);

        token = new MockAgora();
        rewards = new AgoraRewards(address(token), signerAddr, owner);

        // Fund pool with 16M AGORA
        token.transfer(address(rewards), 16_000_000 ether);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _signClaim(address player, uint256 amount, uint256 nonce) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encode(player, amount, nonce, block.chainid, address(rewards))
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    function test_ConstructorZeroAgoraReverts() public {
        vm.expectRevert(AgoraRewards.ZeroAddress.selector);
        new AgoraRewards(address(0), signerAddr, owner);
    }

    function test_ConstructorZeroSignerReverts() public {
        vm.expectRevert(AgoraRewards.ZeroAddress.selector);
        new AgoraRewards(address(token), address(0), owner);
    }

    function test_ConstructorSetsState() public view {
        assertEq(address(rewards.AGORA()), address(token));
        assertEq(rewards.signer(), signerAddr);
        assertEq(rewards.owner(), owner);
        assertEq(rewards.poolBalance(), 16_000_000 ether);
    }

    // ─── Claim ────────────────────────────────────────────────────────────────

    function test_ClaimBasic() public {
        uint256 amount = 2000 ether;
        uint256 nonce = 1;
        bytes memory sig = _signClaim(alice, amount, nonce);

        vm.prank(alice);
        rewards.claim(amount, nonce, sig);

        assertEq(token.balanceOf(alice), amount);
        assertEq(rewards.totalClaimed(alice), amount);
        assertEq(rewards.totalDistributed(), amount);
        assertEq(rewards.totalClaims(), 1);
        assertTrue(rewards.usedNonces(nonce));
    }

    function test_ClaimMultiple() public {
        // Claim 1
        bytes memory sig1 = _signClaim(alice, 1000 ether, 1);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, sig1);

        // Claim 2
        bytes memory sig2 = _signClaim(alice, 500 ether, 2);
        vm.prank(alice);
        rewards.claim(500 ether, 2, sig2);

        assertEq(rewards.totalClaimed(alice), 1500 ether);
        assertEq(rewards.totalClaims(), 2);
    }

    function test_ClaimMultipleUsers() public {
        bytes memory sigA = _signClaim(alice, 2000 ether, 1);
        bytes memory sigB = _signClaim(bob, 3000 ether, 2);

        vm.prank(alice);
        rewards.claim(2000 ether, 1, sigA);
        vm.prank(bob);
        rewards.claim(3000 ether, 2, sigB);

        assertEq(rewards.totalClaimed(alice), 2000 ether);
        assertEq(rewards.totalClaimed(bob), 3000 ether);
        assertEq(rewards.totalDistributed(), 5000 ether);
    }

    // ─── Claim Reverts ────────────────────────────────────────────────────────

    function test_ClaimZeroAmountReverts() public {
        bytes memory sig = _signClaim(alice, 0, 1);
        vm.prank(alice);
        vm.expectRevert(AgoraRewards.ZeroAmount.selector);
        rewards.claim(0, 1, sig);
    }

    function test_ClaimNonceReuseReverts() public {
        bytes memory sig = _signClaim(alice, 1000 ether, 42);
        vm.prank(alice);
        rewards.claim(1000 ether, 42, sig);

        // Same nonce again
        vm.prank(alice);
        vm.expectRevert(AgoraRewards.NonceAlreadyUsed.selector);
        rewards.claim(1000 ether, 42, sig);
    }

    function test_ClaimWrongSignerReverts() public {
        // Sign with a different key
        uint256 wrongKey = 0xBAD;
        bytes32 messageHash = keccak256(
            abi.encode(alice, 1000 ether, uint256(1), block.chainid, address(rewards))
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert(AgoraRewards.InvalidSignature.selector);
        rewards.claim(1000 ether, 1, badSig);
    }

    function test_ClaimWrongPlayerReverts() public {
        // Signature is for alice but bob tries to claim
        bytes memory sig = _signClaim(alice, 1000 ether, 1);

        vm.prank(bob);
        vm.expectRevert(AgoraRewards.InvalidSignature.selector);
        rewards.claim(1000 ether, 1, sig);
    }

    function test_ClaimWrongAmountReverts() public {
        // Signature is for 1000 but player tries 2000
        bytes memory sig = _signClaim(alice, 1000 ether, 1);

        vm.prank(alice);
        vm.expectRevert(AgoraRewards.InvalidSignature.selector);
        rewards.claim(2000 ether, 1, sig);
    }

    function test_ClaimInsufficientPoolReverts() public {
        // Drain the pool first
        vm.prank(owner);
        rewards.withdrawPool(16_000_000 ether);

        bytes memory sig = _signClaim(alice, 1000 ether, 1);
        vm.prank(alice);
        vm.expectRevert(AgoraRewards.InsufficientPool.selector);
        rewards.claim(1000 ether, 1, sig);
    }

    // ─── Cross-chain replay protection ────────────────────────────────────────

    function test_ClaimWrongChainIdReverts() public {
        // Sign for a different chain
        bytes32 messageHash = keccak256(
            abi.encode(alice, 1000 ether, uint256(1), uint256(999), address(rewards))
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert(AgoraRewards.InvalidSignature.selector);
        rewards.claim(1000 ether, 1, badSig);
    }

    // ─── Admin: setSigner ─────────────────────────────────────────────────────

    function test_SetSigner() public {
        address newSigner = address(0xCAFE);
        vm.prank(owner);
        rewards.setSigner(newSigner);
        assertEq(rewards.signer(), newSigner);
    }

    function test_SetSignerZeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgoraRewards.ZeroAddress.selector);
        rewards.setSigner(address(0));
    }

    function test_SetSignerOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        rewards.setSigner(alice);
    }

    function test_NewSignerWorks() public {
        uint256 newKey = 0xCAFE;
        address newSigner = vm.addr(newKey);

        vm.prank(owner);
        rewards.setSigner(newSigner);

        // Sign with new key
        bytes32 messageHash = keccak256(
            abi.encode(alice, 1000 ether, uint256(1), block.chainid, address(rewards))
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newKey, ethSignedHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        rewards.claim(1000 ether, 1, sig);
        assertEq(token.balanceOf(alice), 1000 ether);
    }

    // ─── Admin: withdrawPool ──────────────────────────────────────────────────

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

    // ─── Rescue ───────────────────────────────────────────────────────────────

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

    // ─── Pausable ─────────────────────────────────────────────────────────────

    function test_PauseBlocksClaim() public {
        vm.prank(owner);
        rewards.pause();

        bytes memory sig = _signClaim(alice, 1000 ether, 1);
        vm.prank(alice);
        vm.expectRevert();
        rewards.claim(1000 ether, 1, sig);
    }

    function test_UnpauseResumesClaim() public {
        vm.prank(owner);
        rewards.pause();
        vm.prank(owner);
        rewards.unpause();

        bytes memory sig = _signClaim(alice, 1000 ether, 1);
        vm.prank(alice);
        rewards.claim(1000 ether, 1, sig);
        assertEq(token.balanceOf(alice), 1000 ether);
    }

    // ─── Ownable2Step ─────────────────────────────────────────────────────────

    function test_TransferOwnershipRequiresAcceptance() public {
        vm.prank(owner);
        rewards.transferOwnership(alice);
        assertEq(rewards.owner(), owner);

        vm.prank(alice);
        rewards.acceptOwnership();
        assertEq(rewards.owner(), alice);
    }

    // ─── Pool balance view ────────────────────────────────────────────────────

    function test_PoolBalanceDecreases() public {
        assertEq(rewards.poolBalance(), 16_000_000 ether);

        bytes memory sig = _signClaim(alice, 1_000_000 ether, 1);
        vm.prank(alice);
        rewards.claim(1_000_000 ether, 1, sig);

        assertEq(rewards.poolBalance(), 15_000_000 ether);
    }
}
