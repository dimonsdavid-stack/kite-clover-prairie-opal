// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Policy for transaction-bounded service signers. Administrators should be a timelocked multisig.
contract AccessPolicy is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    struct Limit { uint128 perTransaction; uint128 perDay; uint128 used; uint64 day; }
    mapping(address => mapping(address => Limit)) public limits;
    mapping(address => mapping(bytes4 => bool)) public allowedCall;
    mapping(address => bool) public consumers;
    bool public halted;
    error Denied();
    event BudgetConfigured(address indexed signer, address indexed asset, uint128 perTransaction, uint128 perDay);
    event Consumption(address indexed signer, address indexed asset, address target, bytes4 selector, uint256 amount);
    event Halted(bool halted);

    constructor(address admin, address guardian) {
        require(admin != address(0) && guardian != address(0), "zero authority");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);
    }
    function configure(address signer, address asset, uint128 perTransaction, uint128 perDay)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(perTransaction <= perDay, "invalid limits");
        Limit storage l = limits[signer][asset];
        l.perTransaction = perTransaction;
        l.perDay = perDay; // Never reset today's consumed budget on reconfiguration.
        emit BudgetConfigured(signer, asset, perTransaction, perDay);
    }
    function setConsumer(address consumer, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(consumer.code.length != 0, "no code");
        consumers[consumer] = enabled;
    }
    function setCall(address target, bytes4 selector, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(target != address(0), "zero target");
        allowedCall[target][selector] = enabled;
    }
    function halt() external onlyRole(GUARDIAN_ROLE) { halted = true; emit Halted(true); }
    function resume() external onlyRole(DEFAULT_ADMIN_ROLE) { halted = false; emit Halted(false); }
    function consume(address signer, address asset, address target, bytes4 selector, uint256 amount) external {
        if (!consumers[msg.sender] || halted || !hasRole(OPERATOR_ROLE, signer) || !allowedCall[target][selector]) revert Denied();
        Limit storage l = limits[signer][asset];
        uint64 day = uint64(block.timestamp / 1 days);
        if (l.day != day) { l.day = day; l.used = 0; }
        if (amount == 0 || amount > l.perTransaction || uint256(l.used) + amount > l.perDay) revert Denied();
        l.used += uint128(amount);
        emit Consumption(signer, asset, target, selector, amount);
    }
}

contract EmergencyPause is AccessControl {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bool public paused;
    event PauseChanged(bool paused, bytes32 reason);
    constructor(address admin, address guardian) {
        require(admin != address(0) && guardian != address(0), "zero authority");
        _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(GUARDIAN_ROLE, guardian);
    }
    function pause(bytes32 reason) external onlyRole(GUARDIAN_ROLE) { paused = true; emit PauseChanged(true, reason); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { paused = false; emit PauseChanged(false, bytes32(0)); }
}

contract CircuitBreaker is EmergencyPause {
    uint256 public immutable maxExposure;
    constructor(address admin, address guardian, uint256 cap) EmergencyPause(admin, guardian) {
        require(cap > 0, "zero cap"); maxExposure = cap;
    }
    function check(uint256 exposure) external view {
        require(!paused && exposure <= maxExposure, "circuit breaker");
    }
}
