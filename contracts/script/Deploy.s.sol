// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgoraStaking} from "../src/AgoraStaking.sol";
import {AgoraAgentSub} from "../src/AgoraAgentSub.sol";

/// @title Deploy script for Agora contracts on Base mainnet
/// @dev Usage: forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
///
/// Required env vars:
///   PRIVATE_KEY — deployer wallet private key
///
/// Addresses:
///   $AGORA token: 0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131 (Base)
///   Treasury:     0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4 (Jumpbox)
///   Owner:        deployer wallet (receives Ownable2Step ownership)
contract DeployAgora is Script {
    address constant AGORA_TOKEN = 0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131;
    address constant TREASURY = 0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);
        console.log("AGORA token:", AGORA_TOKEN);
        console.log("Treasury:", TREASURY);

        vm.startBroadcast(deployerKey);

        AgoraStaking staking = new AgoraStaking(AGORA_TOKEN, deployer);
        console.log("AgoraStaking deployed at:", address(staking));

        AgoraAgentSub agentSub = new AgoraAgentSub(AGORA_TOKEN, TREASURY, deployer);
        console.log("AgoraAgentSub deployed at:", address(agentSub));

        vm.stopBroadcast();

        // Verify configuration
        console.log("--- Verification ---");
        console.log("Staking owner:", staking.owner());
        console.log("AgentSub owner:", agentSub.owner());
        console.log("AgentSub treasury:", agentSub.treasury());
        console.log("Tier 1 cost:", agentSub.tierCosts(1));
        console.log("Tier 2 cost:", agentSub.tierCosts(2));
        console.log("Tier 3 cost:", agentSub.tierCosts(3));
    }
}
