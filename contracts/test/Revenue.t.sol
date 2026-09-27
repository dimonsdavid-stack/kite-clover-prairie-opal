// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RevenueSplitter, FeeRouter} from "../src/Revenue.sol";
import {AttributionRegistry} from "../src/Registry.sol";
import {CircuitBreaker} from "../src/Control.sol";
import {ArclenosVault} from "../src/Vault.sol";

contract RevenueToken is ERC20 {
    constructor() ERC20("Test USD", "TUSD") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
contract RevenueTest {
    function testFuzzSplitConservesFunds(uint96 raw) public {
        RevenueToken token = new RevenueToken();
        address[] memory to = new address[](2);
        to[0] = address(this);
        to[1] = address(0xBEEF);
        uint16[] memory weights = new uint16[](2);
        weights[0] = 7000;
        weights[1] = 3000;
        RevenueSplitter splitter = new RevenueSplitter(IERC20(address(token)), to, weights);
        uint256 amount = uint256(raw) + 1;
        token.mint(address(this), amount);
        token.approve(address(splitter), amount);
        splitter.distribute(amount, keccak256("receipt"));
        require(splitter.claimable(to[0]) + splitter.claimable(to[1]) == amount, "allocation mismatch");
        uint256 primary = splitter.claimable(address(this));
        splitter.claim();
        require(splitter.totalClaimed() == primary && token.balanceOf(address(splitter)) == amount - primary, "payout mismatch");
    }
    function testReferralAndReceiptReplay() public {
        RevenueToken token = new RevenueToken();
        AttributionRegistry attribution = new AttributionRegistry();
        FeeRouter router = new FeeRouter(IERC20(address(token)), address(0xCAFE), attribution, 1000);
        attribution.attribute(address(0xBEEF));
        token.mint(address(this), 1000);
        token.approve(address(router), 1000);
        bytes32 receipt = router.settle(keccak256("receipt"), 1000);
        require(router.settled(receipt) && router.claimable(address(0xBEEF)) == 100, "referral mismatch");
        require(router.claimable(address(0xCAFE)) == 900, "treasury mismatch");
        (bool replay,) = address(router).call(abi.encodeWithSelector(FeeRouter.settle.selector, keccak256("receipt"), uint256(1000)));
        require(!replay && router.totalSettled() == 1000, "duplicate settlement");
    }
    function testPausedVaultPreservesRedemption() public {
        RevenueToken token = new RevenueToken();
        CircuitBreaker breaker = new CircuitBreaker(address(this), address(this), 1000);
        ArclenosVault vault = new ArclenosVault(IERC20(address(token)), breaker);
        token.mint(address(this), 1000);
        token.approve(address(vault), 1000);
        uint256 shares = vault.deposit(100, address(this));
        breaker.pause(keccak256("incident"));
        (bool accepted,) = address(vault).call(abi.encodeWithSelector(ArclenosVault.deposit.selector, uint256(1), address(this)));
        require(!accepted, "paused deposit allowed");
        vault.redeem(shares, address(this), address(this));
        require(token.balanceOf(address(this)) == 1000, "withdrawal blocked during pause");
    }
}
