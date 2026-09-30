// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ArclenosFactory} from "../src/ArclenosFactory.sol";
import {ImplementationRegistry, LineageRegistry} from "../src/Registry.sol";
import {EmergencyPause} from "../src/Control.sol";
import {VentureModule} from "../src/VentureModule.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address);
    function envUint(string calldata name) external view returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployArclenos {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 public constant TEMPLATE = keccak256("ARCLENOS_VENTURE_MODULE");
    uint32 public constant VERSION = 1;

    event ArclenosDeploymentManifest(
        uint256 indexed chainId,
        address indexed admin,
        address indexed deployer,
        address guardian,
        address asset,
        uint256 maxCap,
        bytes32 template,
        uint32 version,
        address implementationRegistry,
        address lineageRegistry,
        address emergencyPause,
        address factory,
        bytes32 factoryCodeHash,
        address implementation,
        bytes32 implementationCodeHash
    );

    function run()
        external
        returns (
            ImplementationRegistry implementationRegistry,
            LineageRegistry lineageRegistry,
            EmergencyPause emergencyPause,
            ArclenosFactory factory,
            VentureModule implementation
        )
    {
        require(block.chainid == 8453, "BASE_MAINNET_REQUIRED");

        address admin = vm.envAddress("ARCLENOS_ADMIN");
        address guardian = vm.envAddress("ARCLENOS_GUARDIAN");
        address deployer = vm.envAddress("ARCLENOS_DEPLOYER");
        address asset = vm.envAddress("ARCLENOS_ASSET");
        uint256 maxCap = vm.envUint("ARCLENOS_MAX_CAP");

        require(admin != address(0), "ZERO_ADMIN");
        require(guardian != address(0), "ZERO_GUARDIAN");
        require(deployer != address(0), "ZERO_DEPLOYER");
        require(asset.code.length > 0, "ASSET_HAS_NO_CODE");
        require(maxCap > 0, "ZERO_MAX_CAP");

        vm.startBroadcast();

        implementationRegistry = new ImplementationRegistry(admin);
        lineageRegistry = new LineageRegistry(admin);
        emergencyPause = new EmergencyPause(admin, guardian);
        factory = new ArclenosFactory(admin, implementationRegistry, lineageRegistry, emergencyPause);
        implementation = new VentureModule(address(factory));

        bytes32 implementationCodeHash = address(implementation).codehash;

        implementationRegistry.register(
            TEMPLATE,
            VERSION,
            address(implementation),
            implementationCodeHash
        );

        lineageRegistry.grantRole(lineageRegistry.RECORDER_ROLE(), address(factory));
        factory.grantRole(factory.DEPLOYER_ROLE(), deployer);

        emit ArclenosDeploymentManifest(
            block.chainid,
            admin,
            deployer,
            guardian,
            asset,
            maxCap,
            TEMPLATE,
            VERSION,
            address(implementationRegistry),
            address(lineageRegistry),
            address(emergencyPause),
            address(factory),
            address(factory).codehash,
            address(implementation),
            implementationCodeHash
        );

        vm.stopBroadcast();
    }
}
