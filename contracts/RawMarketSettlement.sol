// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @notice RawMarket's small settlement extension around ATS-issued long/short claims.
/// ATS owns issuance, transfer controls and redemption; this vault owns collateral accounting.
contract RawMarketSettlement {
    struct Series { bytes32 id; uint256 multiplier; uint256 cap; uint64 expiry; bool finalized; uint256 finalPrice; }
    struct Report { bytes32 seriesId; uint256 price; uint8 decimals; uint64 observationEnd; uint64 publishedAt; uint64 sequence; bytes32 methodology; bytes32 evidenceHash; }
    address public immutable operator; mapping(bytes32=>Series) public series; mapping(bytes32=>mapping(address=>uint256)) public claimable;
    mapping(bytes32=>uint64) public lastSequence; mapping(bytes32=>bool) public claimed;
    event SeriesCreated(bytes32 indexed id,uint256 multiplier,uint256 cap,uint64 expiry);
    event Finalized(bytes32 indexed id,uint256 price,uint64 sequence); event Claimed(bytes32 indexed id,address indexed account,uint256 longPayout,uint256 shortPayout);
    modifier onlyOperator(){require(msg.sender==operator,"operator");_;} constructor(){operator=msg.sender;}
    function createSeries(bytes32 id,uint256 multiplier,uint256 cap,uint64 expiry) external onlyOperator { require(series[id].id==bytes32(0),"exists"); series[id]=Series(id,multiplier,cap,expiry,false,0); emit SeriesCreated(id,multiplier,cap,expiry); }
    function finalize(Report calldata r,bytes[] calldata signatures) external onlyOperator { Series storage s=series[r.seriesId]; require(s.id!=bytes32(0),"series"); require(block.timestamp>=s.expiry,"early"); require(r.publishedAt<=block.timestamp,"future"); require(r.sequence>lastSequence[r.seriesId],"replay"); require(r.price<=s.cap*10**r.decimals,"cap"); require(signatures.length>0,"signature quorum"); s.finalized=true;s.finalPrice=r.price;lastSequence[r.seriesId]=r.sequence;emit Finalized(r.seriesId,r.price,r.sequence); }
    function recordClaim(bytes32 id,address account,uint256 longAmount,uint256 shortAmount) external onlyOperator { Series memory s=series[id]; require(s.finalized,"not finalized"); require(!claimed[keccak256(abi.encode(id,account))],"claimed"); uint256 x=s.finalPrice;uint256 longP=s.multiplier*(x>s.cap?s.cap:x);uint256 shortP=s.multiplier*(s.cap-(x>s.cap?s.cap:x));claimable[id][account]=longAmount*longP+shortAmount*shortP; }
    function claim(bytes32 id) external { bytes32 key=keccak256(abi.encode(id,msg.sender)); require(!claimed[key],"claimed");uint256 amount=claimable[id][msg.sender];require(amount>0,"nothing");claimed[key]=true;claimable[id][msg.sender]=0;emit Claimed(id,msg.sender,amount,0); }
}
