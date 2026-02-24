// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title AgentToken — Minimal ERC-20 for agent bonding curves
/// @notice Total supply minted to launchpad at construction. No owner, no mint after deploy.
contract AgentToken is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address mintTo_
    ) ERC20(name_, symbol_) {
        _mint(mintTo_, totalSupply_);
    }
}
