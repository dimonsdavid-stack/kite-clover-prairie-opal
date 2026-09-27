// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract ImplementationRegistry is AccessControl {
    struct Implementation { address implementation; bytes32 codeHash; bool enabled; }
    mapping(bytes32 => mapping(uint32 => Implementation)) public implementations;
    event Registered(bytes32 indexed template, uint32 indexed version, address implementation, bytes32 codeHash);
    event Enabled(bytes32 indexed template, uint32 indexed version, bool enabled);
    constructor(address admin) { require(admin != address(0), "zero admin"); _grantRole(DEFAULT_ADMIN_ROLE, admin); }
    function register(bytes32 template, uint32 version, address implementation, bytes32 expectedCodeHash)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(template != bytes32(0) && version != 0, "invalid version");
        require(implementation.code.length > 0 && implementation.codehash == expectedCodeHash, "wrong code");
        require(implementations[template][version].implementation == address(0), "version exists");
        implementations[template][version] = Implementation(implementation, expectedCodeHash, true);
        emit Registered(template, version, implementation, expectedCodeHash);
    }
    function setEnabled(bytes32 template, uint32 version, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(implementations[template][version].implementation != address(0), "unknown version");
        implementations[template][version].enabled = enabled; emit Enabled(template, version, enabled);
    }
    function resolve(bytes32 template, uint32 version) external view returns (address implementation) {
        Implementation memory entry = implementations[template][version];
        require(entry.enabled && entry.implementation.code.length > 0 && entry.implementation.codehash == entry.codeHash, "untrusted implementation");
        return entry.implementation;
    }
}

contract StrategyRegistry is ImplementationRegistry {
    constructor(address admin) ImplementationRegistry(admin) {}
}

contract LineageRegistry is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    struct Lineage { address creator; address parent; bytes32 template; uint32 version; bytes32 configHash; uint64 timestamp; }
    mapping(address => Lineage) public lineage;
    event Recorded(address indexed venture, address indexed creator, address parent, bytes32 template, uint32 version, bytes32 configHash);
    constructor(address admin) { require(admin != address(0), "zero admin"); _grantRole(DEFAULT_ADMIN_ROLE, admin); }
    function record(address venture, address creator, address parent, bytes32 template, uint32 version, bytes32 configHash)
        external onlyRole(RECORDER_ROLE)
    {
        require(venture.code.length > 0 && creator != address(0) && lineage[venture].creator == address(0), "invalid lineage");
        require(parent == address(0) || lineage[parent].creator != address(0), "unknown parent");
        lineage[venture] = Lineage(creator, parent, template, version, configHash, uint64(block.timestamp));
        emit Recorded(venture, creator, parent, template, version, configHash);
    }
}

/// @notice A payer opts into one immutable referral; attribution alone never authorizes payout.
contract AttributionRegistry {
    mapping(address => address) public referrer;
    event Attributed(address indexed payer, address indexed distributor);
    function attribute(address distributor) external {
        require(distributor != address(0) && distributor != msg.sender && referrer[msg.sender] == address(0), "invalid attribution");
        referrer[msg.sender] = distributor; emit Attributed(msg.sender, distributor);
    }
}
