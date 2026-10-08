# Demo: a real testnet upgrade

`fixtures/testnet` holds a manifest for two contracts deployed on testnet from [`fixtures/upgradeable-fixture`](https://github.com/Contract-Atlas/contractatlas-core/blob/main/fixtures/upgradeable-fixture/README.md) and two recorded reports from real runs:

1. [`01-before-upgrade`](https://github.com/Contract-Atlas/contractatlas-core/blob/main/fixtures/testnet/reports/01-before-upgrade.txt): fixture A is `match`; fixture B, whose review names a source commit only, is `incomplete`.
2. After a real on-chain `upgrade` transaction, [`02-after-upgrade`](https://github.com/Contract-Atlas/contractatlas-core/blob/main/fixtures/testnet/reports/02-after-upgrade.txt): fixture A is `drift` and the CLI exits 1. The audit link is retained but no longer covers the live code.

Contract IDs, hashes and transactions: [DEPLOYMENT.md](https://github.com/Contract-Atlas/contractatlas-core/blob/main/fixtures/testnet/DEPLOYMENT.md). The "audits" in the fixture are fictional labels, not professional audits. The contracts are permanently in the post-upgrade state, so a fresh run reproduces report 02.
