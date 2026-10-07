#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { checkManifest } from "./check.ts";
import { RpcLedgerSource } from "./ledger.ts";
import { parseManifest } from "./manifest.ts";
import { exitCodeFor, renderMarkdown, renderText } from "./render.ts";
import type { Status } from "./types.ts";
import { TOOL_VERSION } from "./version.ts";

export interface CliIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

const STATUSES: readonly Status[] = ["match", "drift", "incomplete", "unavailable"];

function parseFailOn(value: string): Status[] {
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (!STATUSES.includes(p as Status) || p === "match") {
      throw new InvalidArgumentError(`--fail-on takes a comma list of drift, incomplete, unavailable (got "${p}")`);
    }
  }
  return parts as Status[];
}

function parsePositiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new InvalidArgumentError("must be a positive integer");
  return n;
}

async function loadManifest(path: string, io: CliIo) {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    io.stderr(`Cannot read manifest ${path}: ${e instanceof Error ? e.message : String(e)}\n`);
    return null;
  }
  const parsed = parseManifest(raw);
  if (!parsed.ok) {
    io.stderr(`Invalid manifest ${path}:\n`);
    for (const i of parsed.issues) io.stderr(`  ${i.path}: ${i.message}\n`);
    return null;
  }
  return parsed.manifest;
}

/**
 * Exit codes: 0 no failing status, 1 a status named by --fail-on was found,
 * 2 invalid manifest or usage, 3 unexpected error.
 */
export async function runCli(argv: string[], io: CliIo): Promise<number> {
  let exit = 0;
  const program = new Command();
  program
    .name("contractatlas")
    .description("Compare a Soroban protocol's live deployments with its declared audit scope.")
    .version(TOOL_VERSION)
    .exitOverride()
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr });

  program
    .command("validate")
    .argument("<manifest>", "path to a ContractAtlas manifest (JSON)")
    .description("Validate a manifest without touching the network.")
    .action(async (path: string) => {
      const m = await loadManifest(path, io);
      if (m === null) {
        exit = 2;
        return;
      }
      io.stdout(`Manifest OK: ${m.protocol.name}, ${m.contracts.length} contract(s) on ${m.network.name}\n`);
    });

  program
    .command("check")
    .argument("<manifest>", "path to a ContractAtlas manifest (JSON)")
    .requiredOption("--rpc <url>", "Stellar RPC endpoint for the manifest's network")
    .option("--format <format>", "text, json or markdown", "text")
    .option("--out <file>", "also write the JSON report to this file")
    .option("--fail-on <statuses>", "exit 1 when any contract has one of these statuses", parseFailOn, ["drift", "unavailable"] as Status[])
    .option("--strict", "shorthand for --fail-on drift,incomplete,unavailable")
    .option("--timeout <ms>", "per-request timeout in milliseconds", parsePositiveInt, 15000)
    .option("--allow-http", "permit http:// RPC URLs (local standalone networks only)")
    .description("Fetch live executables and classify each contract: match, drift, incomplete or unavailable.")
    .action(async (path: string, opts) => {
      if (!["text", "json", "markdown"].includes(opts.format)) {
        io.stderr(`--format must be text, json or markdown\n`);
        exit = 2;
        return;
      }
      const manifest = await loadManifest(path, io);
      if (manifest === null) {
        exit = 2;
        return;
      }
      let source: RpcLedgerSource;
      try {
        source = new RpcLedgerSource(opts.rpc, { timeoutMs: opts.timeout, allowHttp: opts.allowHttp === true });
      } catch (e) {
        io.stderr(`${e instanceof Error ? e.message : String(e)}\n`);
        exit = 2;
        return;
      }
      const report = await checkManifest(manifest, { source, toolVersion: TOOL_VERSION });
      const json = JSON.stringify(report, null, 2) + "\n";
      if (opts.out) await writeFile(opts.out, json);
      io.stdout(opts.format === "json" ? json : opts.format === "markdown" ? renderMarkdown(report) : renderText(report));
      const failOn: Status[] = opts.strict ? ["drift", "incomplete", "unavailable"] : opts.failOn;
      exit = exitCodeFor(report, failOn);
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (e) {
    if (e instanceof CommanderError) return e.exitCode === 0 ? 0 : 2;
    io.stderr(`Unexpected error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 3;
  }
  return exit;
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) {
  runCli(process.argv.slice(2), {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
  }).then((code) => process.exit(code));
}
