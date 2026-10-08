# Manifest

```json
{
  "schemaVersion": "1",
  "protocol": { "name": "My protocol" },
  "network": { "name": "testnet", "passphrase": "Test SDF Network ; September 2015" },
  "contracts": [{
    "id": "C...",
    "name": "Vault",
    "declaredWasmHash": "<64 hex>",
    "audits": [{
      "id": "audit-2026-01", "auditor": "...", "report": "https://...", "date": "2026-01-15",
      "reviewedWasmHashes": ["<64 hex>"],
      "limitations": ["Did not cover the oracle adapter."]
    }],
    "privileges": [{ "role": "upgrade authority", "holder": "G..." }]
  }]
}
```

JSON Schemas: `schema/manifest.v1.schema.json` and `schema/report.v1.schema.json` (generated from the runtime schemas; CI fails when stale).
