// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AttributionRegistry} from "./Registry.sol";

/// @notice Fixed allocation, pull-claimed revenue. Rounding remainder belongs to primary recipient.
contract RevenueSplitter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable asset;
    address[] public recipients;
    uint16[] public weights;
    mapping(address => uint256) public claimable;
    uint256 public totalReceived;
    uint256 public totalClaimed;
    event RevenueReceived(address indexed payer, bytes32 indexed paymentReference, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);
    constructor(IERC20 asset_, address[] memory recipients_, uint16[] memory weights_) {
        require(address(asset_).code.length > 0 && recipients_.length > 0 && recipients_.length <= 32 && recipients_.length == weights_.length, "invalid config");
        uint256 sum;
        for (uint256 i; i < recipients_.length; ++i) { require(recipients_[i] != address(0) && weights_[i] > 0, "invalid recipient"); sum += weights_[i]; }
        require(sum == 10_000, "invalid allocation"); asset = asset_; recipients = recipients_; weights = weights_;
    }
    function distribute(uint256 amount, bytes32 paymentReference) external nonReentrant {
        require(amount > 0, "zero amount");
        uint256 balance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        require(asset.balanceOf(address(this)) - balance == amount, "unsupported token");
        uint256 allocated;
        for (uint256 i = 1; i < recipients.length; ++i) {
            uint256 portion = Math.mulDiv(amount, weights[i], 10_000); allocated += portion; claimable[recipients[i]] += portion;
        }
        claimable[recipients[0]] += amount - allocated; totalReceived += amount;
        emit RevenueReceived(msg.sender, paymentReference, amount);
    }
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender]; require(amount > 0, "nothing due");
        claimable[msg.sender] = 0; totalClaimed += amount;
        uint256 beforeBalance = asset.balanceOf(msg.sender); asset.safeTransfer(msg.sender, amount);
        require(asset.balanceOf(msg.sender) - beforeBalance == amount, "unsupported token");
        emit Claimed(msg.sender, amount);
    }
}

/// @notice Pulls actual revenue and routes an immutable, capped referral share. No speculative accrual.
contract FeeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable asset;
    address public immutable treasury;
    AttributionRegistry public immutable attribution;
    uint16 public immutable referralBps;
    mapping(address => uint256) public claimable;
    mapping(bytes32 => bool) public settled;
    uint256 public totalSettled;
    event Settled(bytes32 indexed receipt, address indexed payer, address indexed distributor, uint256 gross, uint256 referral);
    constructor(IERC20 asset_, address treasury_, AttributionRegistry attribution_, uint16 referralBps_) {
        require(address(asset_).code.length > 0 && treasury_ != address(0) && address(attribution_).code.length > 0 && referralBps_ <= 2500, "invalid fees");
        asset = asset_; treasury = treasury_; attribution = attribution_; referralBps = referralBps_;
    }
    function settle(bytes32 paymentReference, uint256 amount) external nonReentrant returns (bytes32 receipt) {
        require(amount > 0 && paymentReference != bytes32(0), "invalid settlement");
        receipt = keccak256(abi.encode(block.chainid, address(this), msg.sender, paymentReference));
        require(!settled[receipt], "already settled"); settled[receipt] = true;
        uint256 balance = asset.balanceOf(address(this)); asset.safeTransferFrom(msg.sender, address(this), amount);
        require(asset.balanceOf(address(this)) - balance == amount, "unsupported token");
        address distributor = attribution.referrer(msg.sender);
        uint256 referral = distributor == address(0) ? 0 : Math.mulDiv(amount, referralBps, 10_000);
        claimable[treasury] += amount - referral;
        if (referral != 0) claimable[distributor] += referral;
        totalSettled += amount; emit Settled(receipt, msg.sender, distributor, amount, referral);
    }
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender]; require(amount > 0, "nothing due"); claimable[msg.sender] = 0;
        uint256 beforeBalance = asset.balanceOf(msg.sender); asset.safeTransfer(msg.sender, amount);
        require(asset.balanceOf(msg.sender) - beforeBalance == amount, "unsupported token");
    }
}

/// @notice Separate onchain payment rail; does not imply that offchain x402 facilitator receipts are valid.
contract PaymentReconciliationAdapter is FeeRouter {
    constructor(IERC20 asset_, address treasury_, AttributionRegistry attribution_, uint16 referralBps_)
        FeeRouter(asset_, treasury_, attribution_, referralBps_) {}
}
