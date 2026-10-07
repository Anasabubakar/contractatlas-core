// Network test. Skipped unless CONTRACTATLAS_LIVE=1. Never part of the deterministic CI run.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkManifest } from "../../src/check.ts";
import { RpcLedgerSource } from "../../src/ledger.ts";
import { parseManifest } from "../../src/manifest.ts";

const live = process.env.CONTRACTATLAS_LIVE === "1";
const RPC = process.env.CONTRACTATLAS_RPC ?? "https://soroban-testnet.stellar.org";
const V2 = "0224a0453c0806df55ee2d7bb6db54f49885011429d0203cb6568101e3aa5967";
const V1 = "42d30fff6be1b7e59d031879d32aa33fb45e740f035d10e03b13e8474dc7cc92";

describe.skipIf(!live)("live testnet fixture", () => {
  it("fixture A is upgraded to v2 (drift) and fixture B remains v1 (incomplete)", async () => {
    const parsed = parseManifest(JSON.parse(readFileSync("fixtures/testnet/manifest.json", "utf8")));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const report = await checkManifest(parsed.manifest, { source: new RpcLedgerSource(RPC), toolVersion: "live-test" });
    expect(report.source.network.status).toBe("match");
    const [a, b] = report.contracts;
    expect(a?.status).toBe("drift");
    expect(a?.live).toEqual({ kind: "wasm", wasmHash: V2 });
    expect(b?.status).toBe("incomplete");
    expect(b?.live).toEqual({ kind: "wasm", wasmHash: V1 });
    expect(report.overall).toBe("drift");
  }, 60_000);

  it("a wrong-network manifest against the testnet RPC refuses to compare", async () => {
    const raw = JSON.parse(readFileSync("fixtures/testnet/manifest.json", "utf8"));
    raw.network = { name: "mainnet", passphrase: "Public Global Stellar Network ; September 2015" };
    const parsed = parseManifest(raw);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const report = await checkManifest(parsed.manifest, { source: new RpcLedgerSource(RPC), toolVersion: "live-test" });
    expect(report.source.network.status).toBe("mismatch");
    expect(report.contracts.every((c) => c.status === "unavailable")).toBe(true);
  }, 60_000);
});
