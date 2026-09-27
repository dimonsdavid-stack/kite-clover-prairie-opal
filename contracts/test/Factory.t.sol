// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ImplementationRegistry, LineageRegistry} from "../src/Registry.sol";
import {EmergencyPause} from "../src/Control.sol";
import {ArclenosFactory} from "../src/ArclenosFactory.sol";
import {VentureModule} from "../src/VentureModule.sol";

contract TestAsset is ERC20 {
    constructor() ERC20("Test USD", "TUSD") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
contract FactoryAttacker {
    function attempt(ArclenosFactory factory, bytes32 template, address asset) external {
        factory.deploy(template, 1, keccak256("intruder"), address(this), address(this), address(0), abi.encode(asset, uint256(1000)));
    }
}
contract FactoryTest {
    struct Env {
        ArclenosFactory factory;
        ImplementationRegistry registry;
        LineageRegistry lineage;
        EmergencyPause emergency;
        VentureModule implementation;
        TestAsset asset;
        bytes32 template;
    }
    function setup() internal returns (Env memory e) {
        e.asset = new TestAsset();
        e.registry = new ImplementationRegistry(address(this));
        e.lineage = new LineageRegistry(address(this));
        e.emergency = new EmergencyPause(address(this), address(this));
        e.factory = new ArclenosFactory(address(this), e.registry, e.lineage, e.emergency);
        e.implementation = new VentureModule(address(e.factory));
        e.template = keccak256("ARCLENOS_CUSTODY");
        e.registry.register(e.template, 1, address(e.implementation), address(e.implementation).codehash);
        e.factory.grantRole(e.factory.DEPLOYER_ROLE(), address(this));
        e.lineage.grantRole(e.lineage.RECORDER_ROLE(), address(e.factory));
    }
    function deploy(Env memory e, bytes32 salt, uint256 cap) internal returns (VentureModule) {
        return VentureModule(e.factory.deploy(e.template, 1, salt, address(this), address(this), address(0), abi.encode(address(e.asset), cap)));
    }
    function testAtomicCloneInitializationAndLineage() public {
        Env memory e = setup();
        bytes32 salt = keccak256("first");
        bytes memory config = abi.encode(address(e.asset), uint256(1000));
        address predicted = e.factory.predict(e.template, 1, address(this), salt);
        VentureModule module = deploy(e, salt, 1000);
        require(address(module) == predicted && module.initialized(), "not deployed and initialized");
        require(module.owner() == address(this) && module.guardian() == address(this), "wrong authority");
        require(address(module.asset()) == address(e.asset) && module.cap() == 1000, "wrong configuration");
        (address creator, , bytes32 template, uint32 version, bytes32 configHash, ) = e.lineage.lineage(address(module));
        require(creator == address(this) && template == e.template && version == 1 && configHash == keccak256(config), "lineage mismatch");
        (bool replay,) = address(module).call(abi.encodeWithSelector(VentureModule.initialize.selector, address(this), address(this), config));
        require(!replay, "reinitialization allowed");
        (bool duplicate,) = address(e.factory).call(abi.encodeWithSelector(ArclenosFactory.deploy.selector,
            e.template, uint32(1), salt, address(this), address(this), address(0), config));
        require(!duplicate, "duplicate address allowed");
    }
    function testUnprivilegedDeployerRejected() public {
        Env memory e = setup();
        FactoryAttacker attacker = new FactoryAttacker();
        (bool accepted,) = address(attacker).call(abi.encodeWithSelector(FactoryAttacker.attempt.selector, e.factory, e.template, address(e.asset)));
        require(!accepted, "unauthorized deploy allowed");
    }
    function testEmergencyPauseStopsDeployments() public {
        Env memory e = setup();
        e.emergency.pause(keccak256("incident"));
        (bool accepted,) = address(e.factory).call(abi.encodeWithSelector(ArclenosFactory.deploy.selector,
            e.template, uint32(1), keccak256("paused"), address(this), address(this), address(0), abi.encode(address(e.asset), uint256(1000))));
        require(!accepted, "paused factory deployed");
    }
    function testFuzzDepositWithdrawAndPausedExit(uint96 raw) public {
        Env memory e = setup();
        VentureModule module = deploy(e, keccak256("position"), 1e21);
        uint256 amount = uint256(raw) % 1e18 + 1;
        e.asset.mint(address(this), amount);
        e.asset.approve(address(module), amount);
        module.deposit(amount);
        module.pause();
        (bool accepted,) = address(module).call(abi.encodeWithSelector(VentureModule.deposit.selector, uint256(1)));
        require(!accepted, "paused deposit allowed");
        module.withdraw(amount);
        require(module.totalDeposits() == 0 && module.balanceOf(address(this)) == 0, "liability retained");
        require(e.asset.balanceOf(address(this)) == amount, "asset not returned");
    }
}
