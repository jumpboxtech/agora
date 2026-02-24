// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AgoraEndpointRegistry} from "../src/AgoraEndpointRegistry.sol";
import {AgoraLaunchpad} from "../src/AgoraLaunchpad.sol";
import {AgoraRouter} from "../src/AgoraRouter.sol";

/// @notice Deploy the Agent Launchpad stack to Base mainnet
/// @dev Deploy order: Registry → Launchpad → Router → wire registry.setRouter(router)
///      Run: forge script script/DeployLaunchpad.s.sol --rpc-url base --broadcast --verify
contract DeployLaunchpad is Script {
    // ─── Base Mainnet Constants ──────────────────────────────────────────────────

    address constant AGORA_TOKEN = 0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131;
    address constant AGENT_SUB = 0xa94499B7F337FfD4a7B11dB4Ec55F9571cB726fd; // V2 — USDC subscription
    address constant NFPM = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1;
    address constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant TREASURY = 0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy AgoraEndpointRegistry
        AgoraEndpointRegistry registry = new AgoraEndpointRegistry(AGENT_SUB, deployer);

        // 2. Deploy AgoraLaunchpad
        AgoraLaunchpad launchpad = new AgoraLaunchpad(
            AGORA_TOKEN,
            NFPM,
            AGENT_SUB,
            deployer,
            TREASURY
        );

        // 3. Deploy AgoraRouter
        AgoraRouter router = new AgoraRouter(
            address(launchpad),
            address(registry),
            AGENT_SUB,
            SWAP_ROUTER,
            AGORA_TOKEN,
            deployer
        );

        // 4. Wire: registry needs to know the router for recordTask auth
        registry.setRouter(address(router));

        vm.stopBroadcast();

        // ─── Verify ──────────────────────────────────────────────────────────────

        require(registry.router() == address(router), "Router not set");
        require(launchpad.admin() == deployer, "Launchpad admin mismatch");
        require(router.admin() == deployer, "Router admin mismatch");
    }
}
