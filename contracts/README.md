# RawMarket Hedera contract

`RawMarketSettlement.sol` is the prototype series, oracle-sequence and claim-accounting registry used by the RawMarket testnet demo.

## Deployed testnet instance

- Network: Hedera testnet
- Address: `0x553678C79D4F38d0C7b1297824048887059AD7BA`
- Deployment transaction: `0xdd3859b55287b28c7e297af0ea37a22ad6f75827236162c060af73db279d4544`
- Explorer: [HashScan](https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA)
- Public artifact record: [`deployments/hedera-testnet.json`](../deployments/hedera-testnet.json)

Eight commodity series are configured in this deployment.

## What it does today

- stores immutable operator authority;
- creates capped series with multiplier and expiry;
- records final benchmark values and monotonic oracle sequences;
- calculates capped complementary payout accounting; and
- prevents a second claim-accounting record for the same series/account key.

## What it does not do

This deployment is not a production collateral vault or completed ATS settlement path:

- `finalize` requires a non-empty signature array but does not verify threshold signatures;
- `recordClaim` trusts operator-supplied long/short amounts;
- `claim` updates accounting and emits an event but does not transfer HTS collateral;
- no browser wallet currently signs these contract calls; and
- engine fills are not atomically submitted to this contract.

ATS factory/configuration and ATS-issued RawMarket assets remain pending. Plain HTS test assets are interim development rails and are not presented as ATS security tokens. See [`docs/HEDERA_INTEGRATION.md`](../docs/HEDERA_INTEGRATION.md) for the exact deployment boundary and completion checklist.
