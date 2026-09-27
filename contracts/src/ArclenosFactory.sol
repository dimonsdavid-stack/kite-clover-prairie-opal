// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ImplementationRegistry, LineageRegistry} from "./Registry.sol";
import {EmergencyPause} from "./Control.sol";

interface IArclenosModule {
    function initialize(address owner, address guardian, bytes calldata config) external;
    function owner() external view returns (address);
    function guardian() external view returns (address);
    function initialized() external view returns (bool);
}

contract ArclenosFactory is AccessControl, ReentrancyGuard {
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    ImplementationRegistry public immutable registry;
    LineageRegistry public immutable lineage;
    EmergencyPause public immutable emergency;
    event VentureDeployed(address indexed venture, address indexed creator, bytes32 indexed template, uint32 version, bytes32 salt, bytes32 configHash);
    constructor(address admin, ImplementationRegistry registry_, LineageRegistry lineage_, EmergencyPause emergency_) {
        require(admin != address(0) && address(registry_).code.length > 0 && address(lineage_).code.length > 0 && address(emergency_).code.length > 0, "invalid dependency");
        _grantRole(DEFAULT_ADMIN_ROLE, admin); registry = registry_; lineage = lineage_; emergency = emergency_;
    }
    function deploymentSalt(address creator, bytes32 userSalt) public pure returns (bytes32) {
        return keccak256(abi.encode(creator, userSalt));
    }
    function predict(bytes32 template, uint32 version, address creator, bytes32 userSalt) external view returns (address) {
        return Clones.predictDeterministicAddress(registry.resolve(template, version), deploymentSalt(creator, userSalt), address(this));
    }
    function deploy(bytes32 template, uint32 version, bytes32 userSalt, address owner, address guardian, address parent, bytes calldata config)
        external onlyRole(DEPLOYER_ROLE) nonReentrant returns (address venture)
    {
        require(!emergency.paused() && owner != address(0) && guardian != address(0) && config.length <= 8192, "invalid deployment");
        address implementation = registry.resolve(template, version);
        bytes32 salt = deploymentSalt(msg.sender, userSalt);
        venture = Clones.cloneDeterministic(implementation, salt);
        // Initialization and all postconditions are one transaction; any failure rolls back CREATE2.
        IArclenosModule module = IArclenosModule(venture);
        module.initialize(owner, guardian, config);
        require(module.initialized() && module.owner() == owner && module.guardian() == guardian, "initialization mismatch");
        bytes32 configHash = keccak256(config);
        lineage.record(venture, msg.sender, parent, template, version, configHash);
        emit VentureDeployed(venture, msg.sender, template, version, salt, configHash);
    }
}
