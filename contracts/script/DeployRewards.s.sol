// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgoraRewards} from "../src/AgoraRewards.sol";

/// @title Deploy AgoraRewards on Base mainnet
/// @dev Usage: PRIVATE_KEY=0x... forge script script/DeployRewards.s.sol --rpc-url base --broadcast
///
/// Signer = treasury wallet (signs claim tickets off-chain)
/// Owner  = deployer wallet (manages pool, pauses, rotates signer)
/// Pool   = 16M $AGORA (owner must transfer tokens to the contract after deployment)
contract DeployRewards is Script {
    address constant AGORA_TOKEN = 0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131;
    address constant TREASURY = 0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);
        console.log("AGORA token:", AGORA_TOKEN);
        console.log("Signer (treasury):", TREASURY);

        vm.startBroadcast(deployerKey);

        AgoraRewards rewards = new AgoraRewards(AGORA_TOKEN, TREASURY, deployer);
        console.log("AgoraRewards deployed at:", address(rewards));

        vm.stopBroadcast();

        // Verify
        console.log("--- Verification ---");
        console.log("Owner:", rewards.owner());
        console.log("Signer:", rewards.signer());
        console.log("Pool balance:", rewards.poolBalance());
        console.log("");
        console.log("NEXT: Transfer 16M $AGORA to the contract to fund the reward pool");
    }
}
