export type Status = "match" | "drift" | "incomplete" | "unavailable";

export type Severity = "info" | "warning" | "error";

export type FindingCode =
  | "network_mismatch"
  | "network_unavailable"
  | "ledger_unavailable"
  | "entry_not_live"
  | "executable_not_wasm"
  | "no_declared_artifact"
  | "live_hash_differs_from_declared"
  | "live_artifact_outside_audit_scope"
  | "no_audit_reference"
  | "audit_scope_unmapped_to_artifact"
  | "live_artifact_in_audit_scope"
  | "declared_source_commit_unverified";

export interface Finding {
  code: FindingCode;
  severity: Severity;
  message: string;
  /** Machine-readable evidence the message is based on. */
  evidence?: Record<string, string | number | boolean | null>;
}

/** What the ledger source observed for one contract. */
export type LiveObservation =
  | { kind: "wasm"; wasmHash: string }
  | { kind: "stellar_asset" }
  | { kind: "not_live"; detail: string }
  | { kind: "unavailable"; detail: string };

export interface ContractResult {
  id: string;
  name: string;
  status: Status;
  live:
    | { kind: "wasm"; wasmHash: string }
    | { kind: "stellar_asset" }
    | { kind: "not_live" }
    | { kind: "unavailable" };
  declared: { wasmHash: string | null; sourceCommit: string | null };
  audits: Array<{
    id: string;
    auditor: string;
    report: string;
    date: string;
    /** True only when this audit explicitly lists the live WASM hash as reviewed. */
    coversLiveArtifact: boolean;
    reviewedWasmHashes: string[];
    reviewedSourceCommit: string | null;
    limitations: string[];
  }>;
  /** Human declarations copied from the manifest. Never verified by this tool. */
  declarations: {
    privileges: Array<{ role: string; holder: string; description: string | null }>;
    dependencies: Array<{ name: string; contractId: string | null; note: string | null }>;
    limitations: string[];
  };
  findings: Finding[];
}

export type NetworkCheck =
  | { status: "match"; expected: string; observed: string }
  | { status: "mismatch"; expected: string; observed: string }
  | { status: "unavailable"; expected: string; detail: string };

export interface Report {
  reportVersion: "1";
  tool: { name: string; version: string };
  /** ISO-8601 UTC time the observations were collected. */
  observedAt: string;
  manifest: {
    schemaVersion: "1";
    protocol: string;
    sha256: string;
    network: { name: string; passphrase: string };
  };
  source: {
    /** Origin only (scheme + host); never includes path, query or credentials. */
    rpcOrigin: string | null;
    latestLedger: number | null;
    network: NetworkCheck;
  };
  summary: Record<Status, number>;
  /** Worst status across contracts: drift > unavailable > incomplete > match. */
  overall: Status;
  contracts: ContractResult[];
  /** Fixed statements about what this report does not establish. */
  limitations: string[];
}
