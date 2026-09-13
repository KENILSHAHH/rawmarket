# Hedera integration and evidence

This document separates what is deployed, what the live terminal uses today and what remains before RawMarket can claim atomic ATS-backed settlement.

## Current architecture

```text
Browser / Next.js terminal
          │ REST over TLS
          ▼
Rust CLOB on AWS App Runner
          │ proposed settlement boundary
          ▼
Hedera testnet
  ├── RawMarket EVM settlement registry
  ├── interim HTS test assets
  ├── partial ATS BLR infrastructure
  └── Mirror Node / HashScan evidence
```

The upper path is live: the browser sends real demo orders to the AWS-hosted matcher. The final engine-to-Hedera transfer arrow is an architectural boundary, not a completed atomic transfer integration.

## Deployed EVM contract

| Item | Value |
| --- | --- |
| Network | Hedera testnet |
| Operator account | `0.0.10522153` |
| EVM contract | `0x553678C79D4F38d0C7b1297824048887059AD7BA` |
| Deployment transaction | `0xdd3859b55287b28c7e297af0ea37a22ad6f75827236162c060af73db279d4544` |
| Explorer | [HashScan](https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA) |

The contract records series configuration, expiry/finalization data, oracle sequence numbers and claimable accounting. Eight series are configured: MILK, POTATO, TOMATO, WHEAT, CORN, RICE, SOYBEAN and DRY_BEAN.

### Prototype limitations

The deployed contract is not yet a collateral vault:

- `finalize` is operator-gated and checks that at least one signature byte array exists, but it does not cryptographically verify a threshold signer set;
- `recordClaim` accepts operator-supplied claim quantities;
- `claim` clears and emits claimable accounting but does not transfer HTS collateral; and
- the browser order path is not yet connected to contract calls.

Production settlement therefore requires a new audited deployment, not merely a UI switch.

## Interim HTS test assets

These fungible test assets establish public Hedera identities and development rails. They are plain HTS tokens, not ATS-issued security tokens.

| Asset | Token ID | HashScan |
| --- | --- | --- |
| Demo USD | `0.0.10522368` | [View](https://hashscan.io/testnet/token/0.0.10522368) |
| MILK | `0.0.10522374` | [View](https://hashscan.io/testnet/token/0.0.10522374) |
| POTATO | `0.0.10522375` | [View](https://hashscan.io/testnet/token/0.0.10522375) |
| TOMATO | `0.0.10522376` | [View](https://hashscan.io/testnet/token/0.0.10522376) |
| WHEAT | `0.0.10522378` | [View](https://hashscan.io/testnet/token/0.0.10522378) |
| CORN | `0.0.10522379` | [View](https://hashscan.io/testnet/token/0.0.10522379) |
| RICE | `0.0.10522380` | [View](https://hashscan.io/testnet/token/0.0.10522380) |
| SOYBEAN | `0.0.10522381` | [View](https://hashscan.io/testnet/token/0.0.10522381) |
| DRY BEAN | `0.0.10522382` | [View](https://hashscan.io/testnet/token/0.0.10522382) |

Creation transaction IDs are preserved in [`deployments/hedera-testnet.json`](../deployments/hedera-testnet.json).

## Asset Tokenization Studio

RawMarket pins ATS rather than coding against moving `main`:

| Item | Value |
| --- | --- |
| Repository | [`hashgraph/asset-tokenization-studio`](https://github.com/hashgraph/asset-tokenization-studio) |
| Pinned commit | `be4f860e408ec5b1a24d12feb6f872aabff69319` |
| ProxyAdmin | `0x63c67F5b2Ba9B68E699a236EA70Bed36239C805D` |
| BLR implementation | `0x1A43Fb1191C689785646F9f160d73bAD091b2CE0` |
| BLR proxy | `0xf0433BeF9a0838323D57b4a6cbE6976CE66A0A26` |
| Confirmed progress | BLR infrastructure and 28 of 108 facets |
| Resume checkpoint | `hedera-testnet-2026-09-13T11-39-30-743` |

The deployment paused when the operator exhausted its available testnet HBAR. The ATS factory/configuration and ATS-issued RawMarket assets are not complete.

ATS is the right partner layer for controlled issuance, partition-aware ownership, compliance/eligibility hooks, holds, mint/burn roles and redemption. RawMarket remains responsible for benchmark methodology, source validation, CLOB reservations, collateral solvency, settlement payoff rules and transaction reconciliation.

## Why Hedera

- HTS creates first-class token identities with native supply and transfer primitives.
- Hedera EVM allows application-specific Solidity logic without abandoning familiar tooling.
- ATS supplies a real security-token lifecycle and control model instead of a bespoke imitation.
- Fast finality and unique transaction IDs fit the matcher-to-settlement reconciliation model.
- Mirror Node and HashScan make token, contract and transaction evidence independently queryable.

The design is not literally impossible elsewhere. Hedera is valuable because these capabilities coexist in one network and ecosystem.

## Completion checklist

Before claiming genuine end-to-end ATS settlement:

1. rotate the exposed testnet operator key and use least-privilege service accounts;
2. fund and resume the pinned ATS deployment;
3. deploy the ATS factory/configuration and issue ATS-controlled commodity assets;
4. deploy an audited collateral vault with real HTS allowance/transfer handling;
5. replace operator-only oracle finalization with verified threshold signatures and replay/period/unit checks;
6. connect HashPack/MetaMask signing and authenticated user identities;
7. settle each engine match idempotently on Hedera and reconcile unknown transaction outcomes; and
8. expose confirmed transaction and token IDs in each fill record.
