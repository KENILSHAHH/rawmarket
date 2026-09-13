// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @notice Minimal testnet ERC-3643 identity registry and compliance module for RawMarket.
/// @dev This is deliberately simple: the owner manages one eligibility allowlist.
contract RawMarketEligibility {
    address public immutable owner;
    mapping(address => bool) public verified;

    event EligibilityUpdated(address indexed account, bool eligible);
    event ComplianceTransfer(address indexed from, address indexed to, uint256 amount);
    event ComplianceCreated(address indexed to, uint256 amount);
    event ComplianceDestroyed(address indexed from, uint256 amount);

    error NotOwner();

    constructor(address initialAccount) {
        owner = msg.sender;
        verified[initialAccount] = true;
        emit EligibilityUpdated(initialAccount, true);
    }

    function setVerified(address account, bool eligible) external {
        if (msg.sender != owner) revert NotOwner();
        verified[account] = eligible;
        emit EligibilityUpdated(account, eligible);
    }

    function isVerified(address account) external view returns (bool) {
        return verified[account];
    }

    function canTransfer(address from, address to, uint256) external view returns (bool) {
        return (from == address(0) || verified[from]) && (to == address(0) || verified[to]);
    }

    function transferred(address from, address to, uint256 amount) external {
        emit ComplianceTransfer(from, to, amount);
    }

    function created(address to, uint256 amount) external {
        emit ComplianceCreated(to, amount);
    }

    function destroyed(address from, uint256 amount) external {
        emit ComplianceDestroyed(from, amount);
    }
}
