// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IArclenosModule} from "./ArclenosFactory.sol";

/// @notice Cloneable, non-investing, exact-transfer custody module. Exits remain open during a pause.
contract VentureModule is IArclenosModule, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable factory;
    address public owner;
    address public guardian;
    bool public initialized;
    bool public paused;
    IERC20 public asset;
    uint256 public cap;
    uint256 public totalDeposits;
    mapping(address => uint256) public balanceOf;
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event Paused(bool paused);
    constructor(address factory_) { require(factory_ != address(0), "zero factory"); factory = factory_; initialized = true; }
    function initialize(address owner_, address guardian_, bytes calldata config) external {
        require(msg.sender == factory && !initialized && owner_ != address(0) && guardian_ != address(0), "invalid initializer");
        (address asset_, uint256 cap_) = abi.decode(config, (address, uint256));
        require(asset_.code.length > 0 && cap_ > 0, "invalid config");
        initialized = true; owner = owner_; guardian = guardian_; asset = IERC20(asset_); cap = cap_;
    }
    function deposit(uint256 amount) external nonReentrant {
        require(initialized && !paused && amount > 0 && totalDeposits + amount <= cap, "deposit blocked");
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        require(asset.balanceOf(address(this)) - beforeBalance == amount, "unsupported token");
        balanceOf[msg.sender] += amount; totalDeposits += amount; emit Deposit(msg.sender, amount);
    }
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= balanceOf[msg.sender], "insufficient deposit");
        balanceOf[msg.sender] -= amount; totalDeposits -= amount;
        uint256 beforeBalance = asset.balanceOf(msg.sender);
        asset.safeTransfer(msg.sender, amount);
        require(asset.balanceOf(msg.sender) - beforeBalance == amount, "unsupported token");
        emit Withdrawal(msg.sender, amount);
    }
    function pause() external { require(msg.sender == guardian || msg.sender == owner, "not guardian"); paused = true; emit Paused(true); }
    function resume() external { require(msg.sender == owner, "not owner"); paused = false; emit Paused(false); }
}
