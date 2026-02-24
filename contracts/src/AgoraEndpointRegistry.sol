// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgoraAgentSub} from "./interfaces/IAgoraAgentSub.sol";

/// @title AgoraEndpointRegistry — Endpoint metadata + payment config for agents
/// @notice Lightweight registry for per-endpoint pricing and payment mode.
///         Uses AgoraAgentSub as identity layer — only active subscribers can register.
contract AgoraEndpointRegistry {
    // ─── Types ───────────────────────────────────────────────────────────────────

    struct Endpoint {
        string path;         // e.g. "/api/v1/chat"
        uint256 priceAgora;  // minimum $AGORA per call (18 decimals)
        uint8 paymentMode;   // 0 = curve (buy agent tokens), 1 = direct ($AGORA to payTo)
        bool active;
    }

    struct AgentProfile {
        string endpointUrl;    // base URL, e.g. "https://my-agent.agora.jumpbox.tech"
        uint256 totalTasks;
        uint256 totalEarned;   // cumulative $AGORA routed
        uint256 endpointCount; // number of endpoints (including inactive)
    }

    // ─── State ───────────────────────────────────────────────────────────────────

    IAgoraAgentSub public immutable agentSub;
    address public admin;
    address public pendingAdmin;
    address public router; // AgoraRouter, authorized to call recordTask

    mapping(address => AgentProfile) public profiles;
    mapping(address => mapping(uint256 => Endpoint)) public endpoints; // agent => index => Endpoint
    mapping(address => mapping(bytes32 => uint256)) internal _endpointIndex; // agent => keccak256(path) => index+1

    address[] public registeredAgents; // for marketplace enumeration
    mapping(address => bool) public isRegistered;

    // ─── Events ──────────────────────────────────────────────────────────────────

    event EndpointsRegistered(address indexed agent, string endpointUrl, uint256 count);
    event EndpointUpdated(address indexed agent, string path, uint256 priceAgora, uint8 paymentMode);
    event EndpointRemoved(address indexed agent, string path);
    event TaskRecorded(address indexed agent, uint256 amount);
    event RouterUpdated(address indexed router);
    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed newAdmin);

    // ─── Errors ──────────────────────────────────────────────────────────────────

    error NotSubscribed();
    error NotRouter();
    error NotAdmin();
    error NotPendingAdmin();
    error EmptyPath();
    error EndpointNotFound();
    error InvalidPaymentMode();
    error NoEndpoints();

    // ─── Modifiers ───────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlySubscribed() {
        if (!agentSub.isActive(msg.sender)) revert NotSubscribed();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────────

    constructor(address agentSub_, address admin_) {
        agentSub = IAgoraAgentSub(agentSub_);
        admin = admin_;
    }

    // ─── Agent Functions ─────────────────────────────────────────────────────────

    /// @notice Register endpoints for your agent. Requires active subscription.
    /// @param endpointUrl Base URL for the agent
    /// @param paths Endpoint paths (e.g. "/api/v1/chat")
    /// @param prices Minimum $AGORA per call (18 decimals)
    /// @param modes Payment modes (0=curve, 1=direct)
    function registerEndpoints(
        string calldata endpointUrl,
        string[] calldata paths,
        uint256[] calldata prices,
        uint8[] calldata modes
    ) external onlySubscribed {
        if (paths.length == 0) revert NoEndpoints();
        require(paths.length == prices.length && paths.length == modes.length, "Array length mismatch");

        AgentProfile storage profile = profiles[msg.sender];
        profile.endpointUrl = endpointUrl;

        for (uint256 i; i < paths.length; ++i) {
            if (bytes(paths[i]).length == 0) revert EmptyPath();
            if (modes[i] > 1) revert InvalidPaymentMode();

            bytes32 pathHash = keccak256(bytes(paths[i]));
            uint256 idx = _endpointIndex[msg.sender][pathHash];

            if (idx == 0) {
                // New endpoint
                uint256 newIdx = profile.endpointCount;
                profile.endpointCount++;
                endpoints[msg.sender][newIdx] = Endpoint({
                    path: paths[i],
                    priceAgora: prices[i],
                    paymentMode: modes[i],
                    active: true
                });
                _endpointIndex[msg.sender][pathHash] = newIdx + 1; // +1 because 0 means "not found"
            } else {
                // Update existing
                Endpoint storage ep = endpoints[msg.sender][idx - 1];
                ep.priceAgora = prices[i];
                ep.paymentMode = modes[i];
                ep.active = true;
            }
        }

        if (!isRegistered[msg.sender]) {
            isRegistered[msg.sender] = true;
            registeredAgents.push(msg.sender);
        }

        emit EndpointsRegistered(msg.sender, endpointUrl, paths.length);
    }

    /// @notice Update a single endpoint's config
    function updateEndpoint(string calldata path, uint256 priceAgora, uint8 paymentMode) external onlySubscribed {
        if (bytes(path).length == 0) revert EmptyPath();
        if (paymentMode > 1) revert InvalidPaymentMode();

        bytes32 pathHash = keccak256(bytes(path));
        uint256 idx = _endpointIndex[msg.sender][pathHash];
        if (idx == 0) revert EndpointNotFound();

        Endpoint storage ep = endpoints[msg.sender][idx - 1];
        ep.priceAgora = priceAgora;
        ep.paymentMode = paymentMode;
        ep.active = true;

        emit EndpointUpdated(msg.sender, path, priceAgora, paymentMode);
    }

    /// @notice Deactivate an endpoint
    function removeEndpoint(string calldata path) external {
        bytes32 pathHash = keccak256(bytes(path));
        uint256 idx = _endpointIndex[msg.sender][pathHash];
        if (idx == 0) revert EndpointNotFound();

        endpoints[msg.sender][idx - 1].active = false;
        emit EndpointRemoved(msg.sender, path);
    }

    // ─── Router-Only ─────────────────────────────────────────────────────────────

    /// @notice Record a completed task (only callable by router)
    function recordTask(address agent, uint256 amount) external {
        if (msg.sender != router) revert NotRouter();
        profiles[agent].totalTasks++;
        profiles[agent].totalEarned += amount;
        emit TaskRecorded(agent, amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    /// @notice Get a specific endpoint by path
    function getEndpoint(address agent, string calldata path) external view returns (Endpoint memory) {
        bytes32 pathHash = keccak256(bytes(path));
        uint256 idx = _endpointIndex[agent][pathHash];
        if (idx == 0) revert EndpointNotFound();
        return endpoints[agent][idx - 1];
    }

    /// @notice Get the payment mode for an endpoint
    function getPaymentMode(address agent, string calldata path) external view returns (uint8) {
        bytes32 pathHash = keccak256(bytes(path));
        uint256 idx = _endpointIndex[agent][pathHash];
        if (idx == 0) revert EndpointNotFound();
        return endpoints[agent][idx - 1].paymentMode;
    }

    /// @notice Get the minimum price for an endpoint
    function getMinPrice(address agent, string calldata path) external view returns (uint256) {
        bytes32 pathHash = keccak256(bytes(path));
        uint256 idx = _endpointIndex[agent][pathHash];
        if (idx == 0) revert EndpointNotFound();
        return endpoints[agent][idx - 1].priceAgora;
    }

    /// @notice Check if an endpoint exists and is active
    function isEndpointActive(address agent, string calldata path) external view returns (bool) {
        bytes32 pathHash = keccak256(bytes(path));
        uint256 idx = _endpointIndex[agent][pathHash];
        if (idx == 0) return false;
        return endpoints[agent][idx - 1].active;
    }

    /// @notice Get all endpoints for an agent
    function getAgentEndpoints(address agent) external view returns (Endpoint[] memory) {
        uint256 count = profiles[agent].endpointCount;
        Endpoint[] memory eps = new Endpoint[](count);
        for (uint256 i; i < count; ++i) {
            eps[i] = endpoints[agent][i];
        }
        return eps;
    }

    /// @notice Get total number of registered agents (for marketplace pagination)
    function totalRegisteredAgents() external view returns (uint256) {
        return registeredAgents.length;
    }

    /// @notice Get agent address by index (for marketplace enumeration)
    function getAgentAt(uint256 index) external view returns (address) {
        return registeredAgents[index];
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function setRouter(address router_) external onlyAdmin {
        router = router_;
        emit RouterUpdated(router_);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        pendingAdmin = newAdmin;
        emit AdminTransferInitiated(newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferred(msg.sender);
    }
}
