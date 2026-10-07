# Testnet fixture deployment evidence

Network: Stellar testnet (`Test SDF Network ; September 2015`). Recorded 2026-10-07 UTC. The admin key is a throwaway generated for this fixture; it holds only friendbot test XLM and is not committed.

| Item | Value |
|---|---|
| Admin (upgrade authority, declared) | `GCB5WODVHS4EGWFQQ477PN3LAFLUM7RMZ7R5FSGIHRDBP34NZA76HLJ2` |
| v1 WASM sha256 | `42d30fff6be1b7e59d031879d32aa33fb45e740f035d10e03b13e8474dc7cc92` |
| v2 WASM sha256 | `0224a0453c0806df55ee2d7bb6db54f49885011429d0203cb6568101e3aa5967` |
| Fixture A contract | `CADRVGSPFVDYWRABKTEVETRVCKIADNF4XCQC73OIJPJQZOHG7EPIQ3BD` |
| Fixture B contract | `CD2FBDVYS6TBDZNJPRUBVEY7TNCFJX36QJ6KQCUHXWG4IFFSR7J2EIZH` |

Transactions (stellar.expert, testnet):

- upload v1: [e3d2ae95…](https://stellar.expert/explorer/testnet/tx/e3d2ae95f490e9bb631ae6f2419360ebdf2544442f36d668b44ab450811977e2)
- upload v2: [2dda5eb7…](https://stellar.expert/explorer/testnet/tx/2dda5eb74854defd6996d4e8ccbc9780cdd6f7d9183f5377bfc5c2f8fd44db08)
- deploy A (v1): [cbd5e63d…](https://stellar.expert/explorer/testnet/tx/cbd5e63d76e0b20a9586be235afcfd7ed6c6de2b7b1a56722d1bd99d8559831b)
- deploy B (v1): [6d0bd26d…](https://stellar.expert/explorer/testnet/tx/6d0bd26d2a99f8f3ab97ef9a8710b4416557b1af4c84f75e847406de9b125aa3)
- upgrade A to v2: [2a51ed4c…](https://stellar.expert/explorer/testnet/tx/2a51ed4c03501b07ede3a9c2e6e5718540ec8eef3bbc591f204ea4b28f41db9c)

The WASM hash of a contract equals the SHA-256 of its uploaded bytes; `stellar contract upload` printed the same two hashes as `sha256sum artifacts/*.wasm`.

## Recorded reports (real runs against `https://soroban-testnet.stellar.org`)

| File | Observed (UTC) | Ledger | Overall | What it shows |
|---|---|---|---|---|
| `reports/01-before-upgrade.json` / `.txt` | 13:49:48 | 5071480 | INCOMPLETE | A: MATCH (declared v1 = live v1, listed by the fictional review). B: INCOMPLETE (review names a source commit only). |
| `reports/02-after-upgrade.json` / `.txt` | 13:50:08 | 5071484 | DRIFT | After the on-chain upgrade, A is DRIFT: live v2 differs from the declared v1. The old review link stays attached but no longer covers the live code. B is unchanged. |

The manifest was deliberately not edited between the two runs, so the second report shows what a maintainer would see if they upgraded and forgot to update their disclosure. The live contracts are now permanently at the post-upgrade state, so re-running `contractatlas check` today reproduces report 02, not report 01.
