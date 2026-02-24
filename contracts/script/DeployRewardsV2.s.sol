// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgoraRewardsV2} from "../src/AgoraRewardsV2.sol";

/// @title Deploy AgoraRewardsV2 on Base mainnet
/// @dev Usage: PRIVATE_KEY=0x... forge script script/DeployRewardsV2.s.sol --rpc-url base --broadcast
///
/// Signer = treasury wallet (signs claim tickets off-chain)
/// Owner  = deployer wallet (manages pool, pauses, rotates signer)
/// Pool   = owner must transfer $AGORA to the contract after deployment
contract DeployRewardsV2 is Script {
    address constant AGORA_TOKEN = 0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131;
    address constant TREASURY = 0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4;

    // Default limits
    uint256 constant MAX_CLAIM = 10_000 ether;       // 10K AGORA max per claim
    uint256 constant DAILY_WALLET = 20_000 ether;    // 20K AGORA/day per wallet
    uint256 constant DAILY_FID = 20_000 ether;       // 20K AGORA/day per FID
    uint256 constant LIFETIME = 500_000 ether;       // 500K AGORA lifetime per wallet
    uint256 constant COOLDOWN = 300;                 // 5 min between claims

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);
        console.log("AGORA token:", AGORA_TOKEN);
        console.log("Signer (treasury):", TREASURY);

        vm.startBroadcast(deployerKey);

        AgoraRewardsV2 rewards = new AgoraRewardsV2(
            AGORA_TOKEN, TREASURY, deployer,
            MAX_CLAIM, DAILY_WALLET, DAILY_FID, LIFETIME, COOLDOWN
        );
        console.log("AgoraRewardsV2 deployed at:", address(rewards));

        vm.stopBroadcast();

        // Verify
        console.log("--- Verification ---");
        console.log("Owner:", rewards.owner());
        console.log("Signer:", rewards.signer());
        console.log("Pool balance:", rewards.poolBalance());
        console.log("Max claim:", rewards.maxClaimAmount());
        console.log("Daily wallet cap:", rewards.dailyWalletCap());
        console.log("Daily FID cap:", rewards.dailyFidCap());
        console.log("Lifetime cap:", rewards.lifetimeCap());
        console.log("Cooldown:", rewards.claimCooldown());
        console.log("");
        console.log("NEXT: Transfer $AGORA to the contract to fund the reward pool");
    }
}
