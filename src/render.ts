import type { ContractResult, Report, Status } from "./types.ts";

const LABEL: Record<Status, string> = {
  match: "MATCH",
  drift: "DRIFT",
  incomplete: "INCOMPLETE",
  unavailable: "UNAVAILABLE",
};

function short(hash: string | null): string {
  return hash === null ? "none" : `${hash.slice(0, 12)}…${hash.slice(-6)}`;
}

function liveLine(c: ContractResult): string {
  switch (c.live.kind) {
    case "wasm":
      return `wasm ${short(c.live.wasmHash)}`;
    case "stellar_asset":
      return "Stellar Asset Contract (no WASM)";
    case "other_executable":
      return `non-WASM executable (${c.live.detail})`;
    case "not_live":
      return "no live instance entry";
    case "unavailable":
      return "not read";
  }
}

export function renderText(report: Report): string {
  const lines: string[] = [];
  lines.push(`ContractAtlas report: ${report.manifest.protocol} on ${report.manifest.network.name}`);
  lines.push(`Observed ${report.observedAt}${report.source.latestLedger !== null ? ` at ledger ${report.source.latestLedger}` : ""}${report.source.rpcOrigin ? ` via ${report.source.rpcOrigin}` : ""}`);
  lines.push(`Manifest sha256 ${report.manifest.sha256}`);
  lines.push(
    `Overall: ${LABEL[report.overall]}  (match ${report.summary.match}, drift ${report.summary.drift}, incomplete ${report.summary.incomplete}, unavailable ${report.summary.unavailable})`,
  );
  lines.push("");
  for (const c of report.contracts) {
    lines.push(`${LABEL[c.status].padEnd(11)} ${c.name} ${c.id}`);
    lines.push(`            live: ${liveLine(c)}   declared: ${short(c.declared.wasmHash)}`);
    for (const f of c.findings) lines.push(`            [${f.severity}] ${f.code}: ${f.message}`);
    for (const a of c.audits) {
      lines.push(`            audit ${a.id} (${a.auditor}, ${a.date}) ${a.coversLiveArtifact ? "lists the live artifact" : "does not list the live artifact"}: ${a.report}`);
    }
  }
  lines.push("");
  lines.push("Limits of this report:");
  for (const l of report.limitations) lines.push(`  - ${l}`);
  return lines.join("\n") + "\n";
}

export function renderMarkdown(report: Report): string {
  const out: string[] = [];
  out.push(`## ContractAtlas: ${report.manifest.protocol} (${report.manifest.network.name})`);
  out.push("");
  out.push(`Overall **${LABEL[report.overall]}**. Observed ${report.observedAt}${report.source.latestLedger !== null ? `, ledger ${report.source.latestLedger}` : ""}. Manifest \`${report.manifest.sha256.slice(0, 16)}\`.`);
  out.push("");
  out.push("| Status | Contract | Live | Declared | Findings |");
  out.push("|---|---|---|---|---|");
  for (const c of report.contracts) {
    const findings = c.findings.map((f) => `\`${f.code}\``).join(", ") || "-";
    out.push(`| ${LABEL[c.status]} | ${c.name} \`${c.id.slice(0, 8)}…\` | ${liveLine(c)} | ${short(c.declared.wasmHash)} | ${findings} |`);
  }
  out.push("");
  out.push("<details><summary>What this report does not establish</summary>");
  out.push("");
  for (const l of report.limitations) out.push(`- ${l}`);
  out.push("");
  out.push("</details>");
  return out.join("\n") + "\n";
}

export function exitCodeFor(report: Report, failOn: readonly Status[]): 0 | 1 {
  return report.contracts.some((c) => failOn.includes(c.status)) ? 1 : 0;
}
