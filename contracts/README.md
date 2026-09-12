# Hedera deployment note

This contract is the RawMarket collateral/oracle/claim layer. ATS-issued assets are the tradable claims; the exact factory/resolver addresses are network configuration, not constants. Deploy only after pinning the ATS SDK/contracts commit in `sources/manifest.json`, configuring the testnet operator, and verifying the resulting bytecode on HashScan. No deployed address is claimed in this repository.
