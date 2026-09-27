// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessPolicy} from "./Control.sol";

/// @notice Token transfers only. No arbitrary calldata, delegatecall, approval or signer key custody.
contract Treasury is ReentrancyGuard {
    using SafeERC20 for IERC20;
    AccessPolicy public immutable policy;
    event TransferExecuted(address indexed signer, address indexed asset, address indexed recipient, uint256 amount);
    constructor(AccessPolicy policy_) { require(address(policy_).code.length > 0, "invalid policy"); policy = policy_; }
    function transfer(IERC20 asset, address recipient, uint256 amount) external nonReentrant {
        require(address(asset).code.length > 0 && recipient != address(0) && recipient != address(this), "invalid transfer");
        policy.consume(msg.sender, address(asset), recipient, IERC20.transfer.selector, amount);
        uint256 beforeBalance = asset.balanceOf(recipient); asset.safeTransfer(recipient, amount);
        require(asset.balanceOf(recipient) - beforeBalance == amount, "unsupported token");
        emit TransferExecuted(msg.sender, address(asset), recipient, amount);
    }
}
