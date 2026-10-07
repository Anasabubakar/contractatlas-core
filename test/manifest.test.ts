import { describe, expect, it } from "vitest";
import { KNOWN_NETWORKS, parseManifest } from "../src/manifest.ts";

const CID_A = "C" + "A".repeat(55);
const CID_B = "C" + "B".repeat(55);
const H1 = "a".repeat(64);

function base() {
  return {
    schemaVersion: "1",
    protocol: { name: "Demo" },
    network: { name: "testnet", passphrase: KNOWN_NETWORKS.testnet as string },
    contracts: [{ id: CID_A, name: "Vault", declaredWasmHash: H1 }],
  };
}

describe("parseManifest", () => {
  it("accepts a minimal manifest and applies defaults", () => {
    const r = parseManifest(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.contracts[0]?.audits).toEqual([]);
      expect(r.manifest.contracts[0]?.privileges).toEqual([]);
    }
  });

  it("rejects unknown fields (strict)", () => {
    const m = base() as Record<string, unknown>;
    m.safetyScore = 99;
    const r = parseManifest(m);
    expect(r.ok).toBe(false);
  });

  it("rejects uppercase or short wasm hashes", () => {
    const m = base();
    m.contracts[0]!.declaredWasmHash = "A".repeat(64);
    expect(parseManifest(m).ok).toBe(false);
    m.contracts[0]!.declaredWasmHash = "abc";
    expect(parseManifest(m).ok).toBe(false);
  });

  it("rejects a well-known network name with the wrong passphrase", () => {
    const m = base();
    m.network.passphrase = KNOWN_NETWORKS.mainnet;
    const r = parseManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.path).toBe("network.passphrase");
  });

  it("allows a custom passphrase only for standalone networks", () => {
    const m = base();
    m.network = { name: "standalone", passphrase: "Standalone Network ; February 2017" };
    expect(parseManifest(m).ok).toBe(true);
  });

  it("rejects duplicate contract ids", () => {
    const m = base();
    m.contracts.push({ id: CID_A, name: "Dup", declaredWasmHash: H1 });
    const r = parseManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.message).toMatch(/duplicate/);
  });

  it("rejects non-https report links and 39-character commits", () => {
    const m = base() as any;
    m.contracts[0].audits = [
      { id: "a1", auditor: "X", report: "http://example.com/r.pdf", date: "2026-01-01", reviewedWasmHashes: [H1] },
    ];
    expect(parseManifest(m).ok).toBe(false);
    m.contracts[0].audits[0].report = "https://example.com/r.pdf";
    m.contracts[0].audits[0].reviewedSourceCommit = { repository: "https://github.com/a/b", commit: "a".repeat(39) };
    expect(parseManifest(m).ok).toBe(false);
  });

  it("reports readable paths for nested issues", () => {
    const m = base() as any;
    m.contracts[1] = { id: "nope", name: "Bad" };
    const r = parseManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.path === "contracts.1.id")).toBe(true);
  });
});
