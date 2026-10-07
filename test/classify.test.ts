import { describe, expect, it } from "vitest";
import { classifyContract, worstStatus } from "../src/classify.ts";
import { parseManifest, type ContractEntry } from "../src/manifest.ts";
import { KNOWN_NETWORKS } from "../src/manifest.ts";

const CID = "C" + "A".repeat(55);
const H_OLD = "1".repeat(64);
const H_NEW = "2".repeat(64);
const COMMIT = "c".repeat(40);

function entry(over: Record<string, unknown> = {}): ContractEntry {
  const r = parseManifest({
    schemaVersion: "1",
    protocol: { name: "T" },
    network: { name: "testnet", passphrase: KNOWN_NETWORKS.testnet },
    contracts: [{ id: CID, name: "Vault", ...over }],
  });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.manifest.contracts[0]!;
}

const audit = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  auditor: "Example Fixture Auditor",
  report: "https://example.com/report.pdf",
  date: "2026-01-01",
  reviewedWasmHashes: [H_OLD],
  ...over,
});

describe("classifyContract", () => {
  it("match: live == declared and an audit lists the live hash", () => {
    const r = classifyContract(entry({ declaredWasmHash: H_OLD, audits: [audit()] }), { kind: "wasm", wasmHash: H_OLD });
    expect(r.status).toBe("match");
    expect(r.audits[0]?.coversLiveArtifact).toBe(true);
    expect(r.findings.map((f) => f.code)).toContain("live_artifact_in_audit_scope");
  });

  it("drift: upgrade changes the live hash; the historical audit stays attached but no longer covers", () => {
    const r = classifyContract(entry({ declaredWasmHash: H_OLD, audits: [audit()] }), { kind: "wasm", wasmHash: H_NEW });
    expect(r.status).toBe("drift");
    expect(r.audits).toHaveLength(1);
    expect(r.audits[0]?.coversLiveArtifact).toBe(false);
    expect(r.findings[0]?.code).toBe("live_hash_differs_from_declared");
  });

  it("drift: manifest updated to the new hash but audits only list the old artifact", () => {
    const r = classifyContract(entry({ declaredWasmHash: H_NEW, audits: [audit()] }), { kind: "wasm", wasmHash: H_NEW });
    expect(r.status).toBe("drift");
    expect(r.findings[0]?.code).toBe("live_artifact_outside_audit_scope");
  });

  it("incomplete: source-commit-only audit never becomes a match", () => {
    const e = entry({
      declaredWasmHash: H_OLD,
      audits: [audit({ reviewedWasmHashes: [], reviewedSourceCommit: { repository: "https://github.com/o/r", commit: COMMIT } })],
    });
    const r = classifyContract(e, { kind: "wasm", wasmHash: H_OLD });
    expect(r.status).toBe("incomplete");
    expect(r.findings.map((f) => f.code)).toContain("audit_scope_unmapped_to_artifact");
    expect(r.audits[0]?.coversLiveArtifact).toBe(false);
  });

  it("incomplete: no audits referenced", () => {
    const r = classifyContract(entry({ declaredWasmHash: H_OLD }), { kind: "wasm", wasmHash: H_OLD });
    expect(r.status).toBe("incomplete");
    expect(r.findings[0]?.code).toBe("no_audit_reference");
  });

  it("incomplete: no declared hash", () => {
    const r = classifyContract(entry({ audits: [audit()] }), { kind: "wasm", wasmHash: H_OLD });
    expect(r.status).toBe("incomplete");
    expect(r.findings[0]?.code).toBe("no_declared_artifact");
  });

  it("incomplete: Stellar Asset Contract has no WASM to compare", () => {
    const r = classifyContract(entry({ declaredWasmHash: H_OLD }), { kind: "stellar_asset" });
    expect(r.status).toBe("incomplete");
    expect(r.findings[0]?.code).toBe("executable_not_wasm");
  });

  it("unavailable: a failed ledger read is never reported as drift", () => {
    const r = classifyContract(entry({ declaredWasmHash: H_OLD, audits: [audit()] }), { kind: "unavailable", detail: "timeout" });
    expect(r.status).toBe("unavailable");
    expect(r.live.kind).toBe("unavailable");
  });

  it("unavailable: a non-live entry is not asserted to be missing", () => {
    const r = classifyContract(entry({ declaredWasmHash: H_OLD }), { kind: "not_live", detail: "no entry" });
    expect(r.status).toBe("unavailable");
    expect(r.findings[0]?.message).toMatch(/archived/);
  });

  it("copies privilege declarations without verifying them", () => {
    const holder = "G" + "A".repeat(55);
    const r = classifyContract(
      entry({ declaredWasmHash: H_OLD, audits: [audit()], privileges: [{ role: "upgrade authority", holder }] }),
      { kind: "wasm", wasmHash: H_OLD },
    );
    expect(r.declarations.privileges).toEqual([{ role: "upgrade authority", holder, description: null }]);
  });

  it("notes a declared source commit as unverified", () => {
    const r = classifyContract(
      entry({ declaredWasmHash: H_OLD, audits: [audit()], declaredSourceCommit: { repository: "https://github.com/o/r", commit: COMMIT } }),
      { kind: "wasm", wasmHash: H_OLD },
    );
    expect(r.status).toBe("match");
    expect(r.findings.map((f) => f.code)).toContain("declared_source_commit_unverified");
  });
});

describe("worstStatus", () => {
  it("orders drift > unavailable > incomplete > match", () => {
    expect(worstStatus(["match", "incomplete"])).toBe("incomplete");
    expect(worstStatus(["incomplete", "unavailable"])).toBe("unavailable");
    expect(worstStatus(["unavailable", "drift", "match"])).toBe("drift");
    expect(worstStatus([])).toBe("match");
  });
});
