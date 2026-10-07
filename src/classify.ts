import type { ContractEntry } from "./manifest.ts";
import type { ContractResult, Finding, LiveObservation, Status } from "./types.ts";

const STATUS_RANK: Record<Status, number> = { match: 0, incomplete: 1, unavailable: 2, drift: 3 };

export function worstStatus(statuses: Status[]): Status {
  let worst: Status = "match";
  for (const s of statuses) if (STATUS_RANK[s] > STATUS_RANK[worst]) worst = s;
  return worst;
}

function liveForResult(obs: LiveObservation): ContractResult["live"] {
  switch (obs.kind) {
    case "wasm":
      return { kind: "wasm", wasmHash: obs.wasmHash };
    case "stellar_asset":
      return { kind: "stellar_asset" };
    case "not_live":
      return { kind: "not_live" };
    case "unavailable":
      return { kind: "unavailable" };
  }
}

function baseResult(entry: ContractEntry, obs: LiveObservation): ContractResult {
  const liveHash = obs.kind === "wasm" ? obs.wasmHash : null;
  return {
    id: entry.id,
    name: entry.name,
    status: "match",
    live: liveForResult(obs),
    declared: {
      wasmHash: entry.declaredWasmHash ?? null,
      sourceCommit: entry.declaredSourceCommit?.commit ?? null,
    },
    audits: entry.audits.map((a) => ({
      id: a.id,
      auditor: a.auditor,
      report: a.report,
      date: a.date,
      coversLiveArtifact: liveHash !== null && a.reviewedWasmHashes.includes(liveHash),
      reviewedWasmHashes: [...a.reviewedWasmHashes],
      reviewedSourceCommit: a.reviewedSourceCommit?.commit ?? null,
      limitations: [...a.limitations],
    })),
    declarations: {
      privileges: entry.privileges.map((p) => ({
        role: p.role,
        holder: p.holder,
        description: p.description ?? null,
      })),
      dependencies: entry.dependencies.map((d) => ({
        name: d.name,
        contractId: d.contractId ?? null,
        note: d.note ?? null,
      })),
      limitations: [...entry.limitations],
    },
    findings: [],
  };
}

/**
 * Classify one contract from a completed live observation. Pure and deterministic.
 *
 * Rules, in order:
 *  - the ledger could not answer             -> unavailable (never a mismatch)
 *  - the instance entry is not live          -> unavailable (it may be archived or never deployed; absence is not proven)
 *  - the executable is a Stellar Asset Contract -> incomplete (there is no WASM artifact to compare)
 *  - no declared WASM hash                   -> incomplete
 *  - live hash differs from declared hash    -> drift
 *  - hash matches declared:
 *      some audit lists the live hash as reviewed         -> match
 *      audits list artifact hashes, none is the live one   -> drift (audit scope describes other code)
 *      otherwise (no audits, or source-commit-only audits) -> incomplete
 */
export function classifyContract(entry: ContractEntry, obs: LiveObservation): ContractResult {
  const result = baseResult(entry, obs);
  const add = (f: Finding) => result.findings.push(f);

  if (obs.kind === "unavailable") {
    add({ code: "ledger_unavailable", severity: "warning", message: `Could not read the contract from the ledger source: ${obs.detail}. This is not evidence of a mismatch.` });
    result.status = "unavailable";
    return result;
  }
  if (obs.kind === "not_live") {
    add({
      code: "entry_not_live",
      severity: "warning",
      message: `The contract instance is not a live ledger entry (${obs.detail}). It may be archived, expired or never deployed on this network; this check cannot tell which.`,
    });
    result.status = "unavailable";
    return result;
  }
  if (obs.kind === "stellar_asset") {
    add({
      code: "executable_not_wasm",
      severity: "warning",
      message: "The contract's executable is the built-in Stellar Asset Contract, so there is no WASM artifact to compare with a declared hash.",
    });
    result.status = "incomplete";
    return result;
  }

  const live = obs.wasmHash;
  const declared = entry.declaredWasmHash;

  if (declared === undefined) {
    add({
      code: "no_declared_artifact",
      severity: "warning",
      message: "The manifest declares no expected WASM hash for this contract, so the live code cannot be compared with anything.",
      evidence: { liveWasmHash: live },
    });
    result.status = "incomplete";
    return result;
  }

  if (declared !== live) {
    add({
      code: "live_hash_differs_from_declared",
      severity: "error",
      message: "The WASM hash deployed at this contract ID differs from the hash the manifest declares. Audit references below describe earlier or other code.",
      evidence: { declaredWasmHash: declared, liveWasmHash: live },
    });
    result.status = "drift";
    return result;
  }

  const auditHashes = entry.audits.flatMap((a) => a.reviewedWasmHashes);
  if (auditHashes.includes(live)) {
    add({
      code: "live_artifact_in_audit_scope",
      severity: "info",
      message: "The live WASM hash equals a hash that at least one referenced audit lists as reviewed. This does not establish that the audit covered dependencies, configuration or privileged roles.",
      evidence: { liveWasmHash: live },
    });
    result.status = "match";
  } else if (auditHashes.length > 0) {
    add({
      code: "live_artifact_outside_audit_scope",
      severity: "error",
      message: "The live WASM hash matches the declared hash, but none of the referenced audits lists it as reviewed. The audits describe different artifacts.",
      evidence: { liveWasmHash: live },
    });
    result.status = "drift";
  } else if (entry.audits.length > 0) {
    add({
      code: "audit_scope_unmapped_to_artifact",
      severity: "warning",
      message: "The referenced audits identify reviewed source only, not a WASM artifact. Without a reliable source-to-artifact mapping the live code's audit coverage is unresolved.",
      evidence: { liveWasmHash: live },
    });
    result.status = "incomplete";
  } else {
    add({
      code: "no_audit_reference",
      severity: "warning",
      message: "The manifest references no audit for this contract.",
      evidence: { liveWasmHash: live },
    });
    result.status = "incomplete";
  }

  if (entry.declaredSourceCommit !== undefined) {
    add({
      code: "declared_source_commit_unverified",
      severity: "info",
      message: "A declared source commit is recorded but this tool does not rebuild source or verify it against the deployed WASM.",
      evidence: { commit: entry.declaredSourceCommit.commit },
    });
  }
  return result;
}
