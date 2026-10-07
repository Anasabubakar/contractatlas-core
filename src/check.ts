import { createHash } from "node:crypto";
import { classifyContract, worstStatus } from "./classify.ts";
import type { LedgerSource } from "./ledger.ts";
import type { Manifest } from "./manifest.ts";
import type { ContractResult, NetworkCheck, Report, Status } from "./types.ts";

export const TOOL_NAME = "contractatlas-core";

export const REPORT_LIMITATIONS: readonly string[] = [
  "A match means the live WASM hash equals a hash an audit lists as reviewed. It does not mean the audit covered dependencies, deployment configuration or privileged roles.",
  "Privileges, dependencies and limitations are declarations copied from the manifest. They are not verified by this tool.",
  "A source commit is not compared with deployed code. Without an artifact hash mapping, audit coverage stays unresolved.",
  "Contract entries that are archived or never deployed are reported unavailable, not as proof of absence.",
  "This report is a point-in-time observation. It is not a security rating, audit or endorsement.",
];

/** Stable serialisation (sorted keys) so the manifest hash does not depend on key order or formatting. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function manifestSha256(manifest: Manifest): string {
  return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

export interface CheckOptions {
  source: LedgerSource;
  /** Injectable for deterministic tests. */
  now?: () => Date;
  toolVersion: string;
}

async function checkNetwork(manifest: Manifest, source: LedgerSource): Promise<NetworkCheck> {
  const expected = manifest.network.passphrase;
  try {
    const observed = await source.getNetworkPassphrase();
    return observed === expected ? { status: "match", expected, observed } : { status: "mismatch", expected, observed };
  } catch (e) {
    return { status: "unavailable", expected, detail: e instanceof Error ? e.message.slice(0, 200) : "unknown error" };
  }
}

function unavailableForNetwork(manifest: Manifest, network: NetworkCheck): ContractResult[] {
  const code = network.status === "mismatch" ? "network_mismatch" : "network_unavailable";
  const message =
    network.status === "mismatch"
      ? `The ledger source reports a different network than the manifest's. No contract comparison was made. Expected "${network.expected}", observed "${network.status === "mismatch" ? network.observed : ""}".`
      : "The ledger source did not identify its network, so no contract comparison was made.";
  return manifest.contracts.map((c) => ({
    id: c.id,
    name: c.name,
    status: "unavailable" as const,
    live: { kind: "unavailable" as const },
    declared: { wasmHash: c.declaredWasmHash ?? null, sourceCommit: c.declaredSourceCommit?.commit ?? null },
    audits: c.audits.map((a) => ({
      id: a.id,
      auditor: a.auditor,
      report: a.report,
      date: a.date,
      coversLiveArtifact: false,
      reviewedWasmHashes: [...a.reviewedWasmHashes],
      reviewedSourceCommit: a.reviewedSourceCommit?.commit ?? null,
      limitations: [...a.limitations],
    })),
    declarations: {
      privileges: c.privileges.map((p) => ({ role: p.role, holder: p.holder, description: p.description ?? null })),
      dependencies: c.dependencies.map((d) => ({ name: d.name, contractId: d.contractId ?? null, note: d.note ?? null })),
      limitations: [...c.limitations],
    },
    findings: [{ code, severity: "error" as const, message }],
  }));
}

export async function checkManifest(manifest: Manifest, options: CheckOptions): Promise<Report> {
  const now = options.now ?? (() => new Date());
  const { source } = options;
  const network = await checkNetwork(manifest, source);

  let latestLedger: number | null = null;
  let contracts: ContractResult[];

  if (network.status !== "match") {
    contracts = unavailableForNetwork(manifest, network);
  } else {
    try {
      latestLedger = await source.getLatestLedger();
    } catch {
      latestLedger = null;
    }
    contracts = await Promise.all(
      manifest.contracts.map(async (entry) => classifyContract(entry, await source.getExecutable(entry.id))),
    );
  }

  const summary: Record<Status, number> = { match: 0, drift: 0, incomplete: 0, unavailable: 0 };
  for (const c of contracts) summary[c.status] += 1;

  return {
    reportVersion: "1",
    tool: { name: TOOL_NAME, version: options.toolVersion },
    observedAt: now().toISOString(),
    manifest: {
      schemaVersion: manifest.schemaVersion,
      protocol: manifest.protocol.name,
      sha256: manifestSha256(manifest),
      network: { name: manifest.network.name, passphrase: manifest.network.passphrase },
    },
    source: { rpcOrigin: source.origin, latestLedger, network },
    summary,
    overall: worstStatus(contracts.map((c) => c.status)),
    contracts,
    limitations: [...REPORT_LIMITATIONS],
  };
}
