import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { canonicalJson, checkManifest, manifestSha256 } from "../src/check.ts";
import { StaticLedgerSource } from "../src/ledger.ts";
import { KNOWN_NETWORKS, parseManifest } from "../src/manifest.ts";

const ID1 = StrKey.encodeContract(Buffer.alloc(32, 1));
const ID2 = StrKey.encodeContract(Buffer.alloc(32, 2));
const H_OLD = "1".repeat(64);
const H_NEW = "2".repeat(64);
const FIXED = () => new Date("2026-10-07T12:00:00.000Z");

function manifest(over: Record<string, unknown> = {}) {
  const r = parseManifest({
    schemaVersion: "1",
    protocol: { name: "Demo" },
    network: { name: "testnet", passphrase: KNOWN_NETWORKS.testnet },
    contracts: [
      {
        id: ID1,
        name: "Vault",
        declaredWasmHash: H_OLD,
        audits: [{ id: "a1", auditor: "Fixture", report: "https://example.com/r.pdf", date: "2026-01-01", reviewedWasmHashes: [H_OLD] }],
      },
      { id: ID2, name: "Registry", declaredWasmHash: H_OLD },
    ],
    ...over,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.manifest;
}

const opts = (source: StaticLedgerSource) => ({ source, now: FIXED, toolVersion: "test" });

describe("checkManifest", () => {
  it("aggregates per-contract statuses and picks the worst overall", async () => {
    const source = new StaticLedgerSource({
      passphrase: KNOWN_NETWORKS.testnet,
      latestLedger: 77,
      origin: "https://rpc.example",
      contracts: { [ID1]: { kind: "wasm", wasmHash: H_OLD }, [ID2]: { kind: "wasm", wasmHash: H_OLD } },
    });
    const r = await checkManifest(manifest(), opts(source));
    expect(r.summary).toEqual({ match: 1, drift: 0, incomplete: 1, unavailable: 0 });
    expect(r.overall).toBe("incomplete");
    expect(r.source).toMatchObject({ rpcOrigin: "https://rpc.example", latestLedger: 77, network: { status: "match" } });
    expect(r.observedAt).toBe("2026-10-07T12:00:00.000Z");
    expect(r.limitations.length).toBeGreaterThan(0);
  });

  it("reports drift after an upgrade and keeps the audit reference", async () => {
    const source = new StaticLedgerSource({
      passphrase: KNOWN_NETWORKS.testnet,
      contracts: { [ID1]: { kind: "wasm", wasmHash: H_NEW }, [ID2]: { kind: "wasm", wasmHash: H_OLD } },
    });
    const r = await checkManifest(manifest(), opts(source));
    const vault = r.contracts.find((c) => c.id === ID1)!;
    expect(vault.status).toBe("drift");
    expect(vault.audits[0]?.report).toBe("https://example.com/r.pdf");
    expect(r.overall).toBe("drift");
  });

  it("refuses to compare across networks and makes no contract claims", async () => {
    const source = new StaticLedgerSource({
      passphrase: KNOWN_NETWORKS.mainnet,
      contracts: { [ID1]: { kind: "wasm", wasmHash: H_OLD }, [ID2]: { kind: "wasm", wasmHash: H_OLD } },
    });
    const r = await checkManifest(manifest(), opts(source));
    expect(r.source.network.status).toBe("mismatch");
    expect(r.contracts.every((c) => c.status === "unavailable" && c.live.kind === "unavailable")).toBe(true);
    expect(r.contracts[0]?.findings[0]?.code).toBe("network_mismatch");
    expect(r.source.latestLedger).toBeNull();
  });

  it("treats an unreachable network identity as unavailable", async () => {
    const source = new StaticLedgerSource({ passphrase: new Error("connection refused"), contracts: {} });
    const r = await checkManifest(manifest(), opts(source));
    expect(r.source.network.status).toBe("unavailable");
    expect(r.contracts[0]?.findings[0]?.code).toBe("network_unavailable");
    expect(r.overall).toBe("unavailable");
  });

  it("still classifies contracts when only the latest-ledger lookup fails", async () => {
    const source = new StaticLedgerSource({
      passphrase: KNOWN_NETWORKS.testnet,
      latestLedger: new Error("no health"),
      contracts: { [ID1]: { kind: "wasm", wasmHash: H_OLD }, [ID2]: { kind: "wasm", wasmHash: H_OLD } },
    });
    const r = await checkManifest(manifest(), opts(source));
    expect(r.source.latestLedger).toBeNull();
    expect(r.summary.match).toBe(1);
  });

  it("is deterministic: same inputs and clock give byte-identical JSON", async () => {
    const mk = () =>
      new StaticLedgerSource({
        passphrase: KNOWN_NETWORKS.testnet,
        contracts: { [ID1]: { kind: "wasm", wasmHash: H_OLD }, [ID2]: { kind: "not_live", detail: "x" } },
      });
    const a = JSON.stringify(await checkManifest(manifest(), opts(mk())));
    const b = JSON.stringify(await checkManifest(manifest(), opts(mk())));
    expect(a).toBe(b);
  });
});

describe("manifest hashing", () => {
  it("ignores key order and formatting", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });

  it("changes when any declared value changes", () => {
    const a = manifest();
    const b = manifest({ protocol: { name: "Other" } });
    expect(manifestSha256(a)).not.toBe(manifestSha256(b));
    expect(manifestSha256(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
