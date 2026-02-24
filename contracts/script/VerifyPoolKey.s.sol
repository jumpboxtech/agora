// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

contract VerifyPoolKey is Script {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    bytes32 constant EXPECTED = 0x1b327ee7eab03048ae8c6b02c094c6dd45228ef8ff2da9486ef5c43adfc918d8;

    address constant AGORA = 0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131;
    address constant USDC  = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH  = 0x4200000000000000000000000000000000000006;
    address constant HOOKS = 0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC;

    // Clanker V2 hooks
    address constant HOOKS_STATIC_V2  = 0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC;
    address constant HOOKS_DYNAMIC_V2 = 0xd60D6B218116cFd801E28F78d011a203D2b068Cc;

    function run() external pure {
        // Try AGORA/WETH with dynamic fee
        _try("AGORA/WETH dynamic+hooks_v1", AGORA, WETH, 0x800000, 200, HOOKS);
        _try("AGORA/USDC dynamic+hooks_v1", AGORA, USDC, 0x800000, 200, HOOKS);

        // Try with V2 hooks
        _try("AGORA/WETH dynamic+static_v2", AGORA, WETH, 0x800000, 200, HOOKS_STATIC_V2);
        _try("AGORA/USDC dynamic+static_v2", AGORA, USDC, 0x800000, 200, HOOKS_STATIC_V2);
        _try("AGORA/WETH dynamic+dynamic_v2", AGORA, WETH, 0x800000, 200, HOOKS_DYNAMIC_V2);

        // Try 1% fee (non-dynamic) with WETH
        _try("AGORA/WETH 10000+hooks_v1", AGORA, WETH, 10000, 200, HOOKS);

        // Try with native ETH (address(0)) instead of WETH
        _try("AGORA/ETH dynamic+hooks_v1", address(0), AGORA, 0x800000, 200, HOOKS);

        // Different tick spacings with WETH
        _try("AGORA/WETH dynamic+v1 ts=100", AGORA, WETH, 0x800000, 100, HOOKS);
        _try("AGORA/WETH dynamic+v1 ts=60", AGORA, WETH, 0x800000, 60, HOOKS);
    }

    function _try(string memory label, address c0, address c1, uint24 fee, int24 ts, address hooks) internal pure {
        // Ensure proper ordering
        if (uint160(c0) > uint160(c1)) {
            (c0, c1) = (c1, c0);
        }
        PoolKey memory key = PoolKey(c0, c1, fee, ts, hooks);
        bytes32 poolId = keccak256(abi.encode(key));
        if (poolId == EXPECTED) {
            console.log("MATCH:", label);
            console.logBytes32(poolId);
        }
    }
}
