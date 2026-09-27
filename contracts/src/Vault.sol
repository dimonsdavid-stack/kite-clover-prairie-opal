// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CircuitBreaker} from "./Control.sol";

/// @notice Non-investing ERC4626 custody vault. Six virtual-share decimals mitigate first-depositor donations.
contract ArclenosVault is ERC4626, ReentrancyGuard {
    CircuitBreaker public immutable breaker;
    constructor(IERC20 asset_, CircuitBreaker breaker_) ERC20("ARCLENOS Custody Share", "arCUST") ERC4626(asset_) {
        require(address(asset_).code.length > 0 && address(breaker_).code.length > 0, "invalid dependency"); breaker = breaker_;
    }
    function _decimalsOffset() internal pure override returns (uint8) { return 6; }
    function maxDeposit(address) public view override returns (uint256) {
        if (breaker.paused()) return 0;
        uint256 assets = totalAssets(); uint256 cap = breaker.maxExposure();
        return assets < cap ? cap - assets : 0;
    }
    function maxMint(address receiver) public view override returns (uint256) { return convertToShares(maxDeposit(receiver)); }
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        require(assets > 0 && previewDeposit(assets) > 0, "zero shares"); return super.deposit(assets, receiver);
    }
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        require(shares > 0, "zero shares"); return super.mint(shares, receiver);
    }
    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }
    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        uint256 balance = totalAssets(); super._deposit(caller, receiver, assets, shares);
        require(totalAssets() - balance == assets, "unsupported token"); breaker.check(totalAssets());
    }
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
        uint256 beforeBalance = IERC20(asset()).balanceOf(receiver); super._withdraw(caller, receiver, owner, assets, shares);
        require(IERC20(asset()).balanceOf(receiver) - beforeBalance == assets, "unsupported token");
    }
}

/// @notice Per-user ERC4626 execution adapter with caller-specified slippage and no retained position custody.
contract StrategyAdapter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC4626 public immutable vault;
    IERC20 public immutable asset;
    CircuitBreaker public immutable breaker;
    bytes32 public immutable vaultCodeHash;
    constructor(IERC4626 vault_, CircuitBreaker breaker_, bytes32 expectedCodeHash) {
        require(address(vault_).code.length > 0 && address(vault_).codehash == expectedCodeHash && address(breaker_).code.length > 0, "invalid adapter");
        vault = vault_; asset = IERC20(vault_.asset()); breaker = breaker_; vaultCodeHash = expectedCodeHash;
    }
    function deposit(uint256 assets, uint256 minShares, uint256 deadline) external nonReentrant returns (uint256 shares) {
        require(block.timestamp <= deadline && assets > 0 && minShares > 0 && address(vault).codehash == vaultCodeHash, "invalid request"); breaker.check(assets);
        uint256 beforeBalance = asset.balanceOf(address(this)); asset.safeTransferFrom(msg.sender, address(this), assets);
        require(asset.balanceOf(address(this)) - beforeBalance == assets, "unsupported token");
        asset.forceApprove(address(vault), assets); shares = vault.deposit(assets, msg.sender); asset.forceApprove(address(vault), 0);
        require(shares >= minShares && asset.balanceOf(address(this)) == beforeBalance, "slippage");
    }
    function redeem(uint256 shares, uint256 minAssets, uint256 deadline) external nonReentrant returns (uint256 assets) {
        require(block.timestamp <= deadline && shares > 0 && minAssets > 0 && address(vault).codehash == vaultCodeHash, "invalid request");
        // Vault allowance is granted directly to the adapter; assets go directly back to the position owner.
        assets = vault.redeem(shares, msg.sender, msg.sender); require(assets >= minAssets, "slippage");
    }
}
