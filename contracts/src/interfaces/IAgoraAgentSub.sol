// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface for the deployed AgoraAgentSub contract
interface IAgoraAgentSub {
    function isActive(address user) external view returns (bool);

    function getSubscription(address user)
        external
        view
        returns (uint8 tier, uint256 expiresAt, string memory agentName, address payTo, bool active);
}
