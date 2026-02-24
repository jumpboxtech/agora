// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgoraAgentSubV2, IV4Router} from "../src/AgoraAgentSubV2.sol";

/// @title Deploy AgoraAgentSubV2 on Base mainnet
/// @dev Usage: PRIVATE_KEY=0x... BASE_RPC_URL=... forge script script/DeploySubV2.s.sol --rpc-url base --broadcast
///
/// IMPORTANT: Before deploying, update POOL_KEY values below with the actual
/// V4 PoolKey for the AGORA/USDC pool. You can find these by querying the
/// PoolManager at 0x498581ff718922c3f8e6a244956af099b2652b2b on Base.
///
/// The PoolKey can also be updated after deploy via setPoolKey().
contract DeploySubV2 is Script {
    // Base mainnet addresses
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant AGORA_TOKEN = 0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131;
    address constant V4_ROUTER = 0x00000000000044a361Ae3cAc094c9D1b14Eece97; // Community V4 router
    address constant TREASURY = 0x7c3B6f7863fac4E9d2415b9BD286E22aeb264df4;

    // V4 PoolKey — verified against pool ID 0x1b327ee7...
    address constant POOL_CURRENCY0 = AGORA_TOKEN;  // 0x1Ea... < 0x833... so AGORA is currency0
    address constant POOL_CURRENCY1 = USDC;
    uint24 constant POOL_FEE = 0x800000;   // LPFeeLibrary.DYNAMIC_FEE_FLAG (Clanker)
    int24 constant POOL_TICK_SPACING = 200;
    address constant POOL_HOOKS = 0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC; // ClankerHookStaticFee V2

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        IV4Router.PoolKey memory poolKey = IV4Router.PoolKey({
            currency0: POOL_CURRENCY0,
            currency1: POOL_CURRENCY1,
            fee: POOL_FEE,
            tickSpacing: POOL_TICK_SPACING,
            hooks: POOL_HOOKS
        });

        console.log("--- AgoraAgentSubV2 Deploy (V4) ---");
        console.log("Deployer:", deployer);
        console.log("USDC:", USDC);
        console.log("AGORA:", AGORA_TOKEN);
        console.log("V4 Router:", V4_ROUTER);
        console.log("Treasury:", TREASURY);

        vm.startBroadcast(deployerKey);

        AgoraAgentSubV2 sub = new AgoraAgentSubV2(
            USDC,
            AGORA_TOKEN,
            V4_ROUTER,
            TREASURY,
            poolKey,
            deployer
        );

        console.log("AgoraAgentSubV2 deployed at:", address(sub));

        vm.stopBroadcast();

        // Verify
        console.log("--- Verification ---");
        console.log("Owner:", sub.owner());
        console.log("Treasury:", sub.treasury());
        console.log("Tier 1 (Starter):", sub.getTierCost(1), "USDC");
        console.log("Tier 2 (Pro):", sub.getTierCost(2), "USDC");
        console.log("Tier 3 (Enterprise):", sub.getTierCost(3), "USDC");
    }
}
