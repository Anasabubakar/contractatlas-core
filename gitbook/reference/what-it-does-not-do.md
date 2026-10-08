# What it does not do

No safety score, no "audited" label, no inference of privileged roles (they are declarations you write), no source rebuild. A match means the deployed hash equals a hash an audit says it reviewed. It does not mean the audit covered dependencies, configuration or roles. See [SPEC.md](https://github.com/Contract-Atlas/contractatlas-core/blob/main/SPEC.md) and [ADR 0001](https://github.com/Contract-Atlas/contractatlas-core/blob/main/docs/adr/0001-incremental-value-over-existing-tools.md) for how this compares with Stellar Lab and others.
