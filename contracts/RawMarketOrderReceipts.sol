// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @notice Immutable testnet receipts for orders accepted by the RawMarket matcher.
/// @dev This proves order acknowledgement, not atomic payment-versus-asset settlement.
contract RawMarketOrderReceipts {
    struct Receipt {
        bytes32 symbol;
        bytes32 walletRef;
        uint256 priceTicks;
        uint256 quantity;
        uint64 engineSequence;
        uint64 recordedAt;
        bool isBuy;
    }

    address public immutable operator;
    mapping(bytes32 => Receipt) public receipts;

    event OrderRecorded(
        bytes32 indexed orderId,
        bytes32 indexed symbol,
        bytes32 indexed walletRef,
        bool isBuy,
        uint256 priceTicks,
        uint256 quantity,
        uint64 engineSequence
    );

    error NotOperator();
    error DuplicateOrder();
    error InvalidOrder();

    constructor() {
        operator = msg.sender;
    }

    function recordOrder(
        bytes32 orderId,
        bytes32 symbol,
        bytes32 walletRef,
        bool isBuy,
        uint256 priceTicks,
        uint256 quantity,
        uint64 engineSequence
    ) external {
        if (msg.sender != operator) revert NotOperator();
        if (receipts[orderId].recordedAt != 0) revert DuplicateOrder();
        if (priceTicks == 0 || quantity == 0) revert InvalidOrder();
        receipts[orderId] = Receipt(symbol, walletRef, priceTicks, quantity, engineSequence, uint64(block.timestamp), isBuy);
        emit OrderRecorded(orderId, symbol, walletRef, isBuy, priceTicks, quantity, engineSequence);
    }
}
