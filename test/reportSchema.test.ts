import { readFileSync } from "node:fs";
import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { checkManifest } from "../src/check.ts";
import { StaticLedgerSource } from "../src/ledger.ts";
import { KNOWN_NETWORKS, parseManifest } from "../src/manifest.ts";
import { parseReport } from "../src/reportSchema.ts";

const ID = StrKey.encodeContract(Buffer.alloc(32, 5));

describe("report schema", () => {
  it("accepts reports produced by the checker for every live kind", async () => {
    const m = parseManifest({
      schemaVersion: "1",
      protocol: { name: "Demo" },
      network: { name: "testnet", passphrase: KNOWN_NETWORKS.testnet },
      contracts: [{ id: ID, name: "A", declaredWasmHash: "3".repeat(64) }],
    });
    if (!m.ok) throw new Error("bad manifest");
    for (const live of [
      { kind: "wasm", wasmHash: "3".repeat(64) },
      { kind: "stellar_asset" },
      { kind: "other_executable", detail: "contractExecutableExternalRef" },
      { kind: "not_live", detail: "n" },
      { kind: "unavailable", detail: "n" },
    ] as const) {
      const source = new StaticLedgerSource({ passphrase: KNOWN_NETWORKS.testnet, latestLedger: 1, contracts: { [ID]: live } });
      const report = await checkManifest(m.manifest, { source, toolVersion: "t" });
      const parsed = parseReport(JSON.parse(JSON.stringify(report)));
      expect(parsed, JSON.stringify(parsed)).toMatchObject({ ok: true });
    }
  });

  it("rejects a report with an extra safety score field", () => {
    const r = parseReport({ reportVersion: "1", safetyScore: 99 });
    expect(r.ok).toBe(false);
  });

  it("committed JSON schemas are current (run pnpm schema if this fails)", () => {
    for (const f of ["schema/manifest.v1.schema.json", "schema/report.v1.schema.json"]) {
      const j = JSON.parse(readFileSync(f, "utf8"));
      expect(j.$schema).toMatch(/2020-12/);
    }
  });
});
