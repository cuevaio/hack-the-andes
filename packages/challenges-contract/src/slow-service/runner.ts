import * as childProcess from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import type {
  AmendmentResult,
  BalanceReport,
  LedgerOperation,
  LedgerResult,
  LedgerSetup,
} from "@chofex/challenges-contract/slow-service/contract";

const execFileSync: typeof childProcess.execFileSync = Reflect.get(
  childProcess,
  "execFileSync",
);
const spawn: typeof childProcess.spawn = Reflect.get(childProcess, "spawn");

export const runnerLimits = Object.freeze({
  heapBytes: 640 * 1024 * 1024,
  // The valid maximum-width UTF-16 input exceeds 256 MiB during host JSON import.
  // This is separate from guest heap accounting and does not cap process RSS.
  hostOldSpaceMiB: 512,
  maxStackBytes: 512 * 1024,
  sourceBytes: 32 * 1024,
  timeoutMs: 30_000,
  cpuSeconds: 25,
  outputBytes: 32 * 1024 * 1024,
  operations: 100_000,
});

export type RunnerOutcome =
  | {
      kind: "completed";
      results: LedgerResult[];
      checkpoints: number;
      cpuMicros: number;
      measurementCpuMicros: number;
      peakRssBytes: number;
    }
  | {
      kind: "failed";
      reason: "budget" | "execution" | "timeout" | "memory";
      checkpoints: number;
    };

export interface RunnerInput {
  readonly source: string;
  readonly setup: LedgerSetup;
  readonly operations: readonly LedgerOperation[];
  readonly checkpointBudget: number;
  readonly measurementStartOperation?: number;
  readonly timeoutMs?: number;
}

// These are QuickJS 0.32.0 release-sync interrupt-handler checkpoints, not
// universal instructions or portable fuel. Initialization, argument parsing,
// every operation, output validation, and guest serialization share one budget.
// Native builtins can perform substantial work without proportional checkpoints.
// cpuMicros measures child workload CPU, not a deterministic score. Startup is
// excluded; the Linux process CPU ceiling includes startup and is only a backstop.
// The measured tail starts immediately before the configured operation and ends
// after the last operation's argument import and output serialization. Both CPU
// metrics include trusted marshalling. Disposal and protocol emission are outside
// the measurement. Never rank algorithmic efficiency using checkpoints.
// peakRssBytes is the trusted child's process high-water RSS, including Node and
// WASM, not guest heap usage or a scoring gate. It is sampled after protocol
// serialization and the main stdout write, before emitting its own tiny field.
// Linux /proc excludes pre-exec parent memory inherited by ru_maxrss.
const worker = String.raw`
"use strict";
const { readFileSync, writeSync } = require("node:fs");
const { getQuickJS } = require(process.argv[1]);
const limits = JSON.parse(process.argv[2]);
let checkpoints = 0;
let exhausted = false;
let runtime;
let context;
let classifyError;
const retained = [];
let outcome;
let cpuStart;
let measurementStart;
const failed = reason => ({ kind: "failed", reason, checkpoints });
const fail = reason => { throw { runnerFailure: reason }; };
function keep(handle) { retained.push(handle); return handle; }
function take(result) {
  if (result.error) {
    // Do not dump guest exceptions: dump can execute poisoned toJSON/getters.
    let reason = exhausted ? "budget" : "execution";
    if (!exhausted && classifyError) {
      const classification = context.callFunction(classifyError, context.undefined, result.error);
      if (classification.error) classification.error.dispose();
      else {
        if (context.typeof(classification.value) === "boolean" && context.eq(classification.value, context.true)) reason = "memory";
        classification.value.dispose();
      }
    }
    result.error.dispose();
    fail(exhausted ? "budget" : reason);
  }
  if (exhausted) { result.value.dispose(); fail("budget"); }
  return result.value;
}
function assertSynchronous(handle) {
  const state = context.getPromiseState(handle);
  if (state.type === "fulfilled" && state.notAPromise) return;
  if (state.type === "fulfilled") state.value.dispose();
  if (state.type === "rejected") state.error.dispose();
  fail("execution");
}
(async () => {
  try {
    const QuickJS = await getQuickJS();
    cpuStart = process.cpuUsage();
    const input = JSON.parse(readFileSync(0, "utf8"));
    const measurementStartOperation = input.measurementStartOperation ?? 0;
    runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(limits.heapBytes);
    runtime.setMaxStackSize(limits.maxStackBytes);
    runtime.setInterruptHandler(() => {
      checkpoints += 1;
      exhausted = exhausted || checkpoints > input.checkpointBudget;
      // Timeout counts are the last observed snapshot, not an exact final count.
      if (checkpoints === 1 || checkpoints % 1024 === 0 || exhausted) {
        writeSync(1, "@" + String(checkpoints) + "\n");
      }
      return exhausted;
    });
    // Eval:false also disables host evalCode in this runtime. Keep host
    // compilation and remove every guest dynamic-constructor route below.
    context = runtime.newContext();
    // No module loader, host callbacks, process, filesystem, or network objects
    // are installed. These helpers live in handles, not guest globals.
    const helpers = keep(take(context.evalCode(
      '(function () { ' +
      'const parse = JSON.parse, stringify = JSON.stringify; ' +
      'const keys = Reflect.ownKeys, descriptor = Object.getOwnPropertyDescriptor; ' +
      'const prototype = Object.getPrototypeOf, internalError = InternalError.prototype; ' +
      'const create = Object.create, define = Object.defineProperty; ' +
      'const safe = Number.isSafeInteger; ' +
      'const read = (value, name) => { const field = descriptor(value, name); ' +
      'if (!field || !descriptor(field, "value")) throw null; return field.value; }; ' +
      'for (const fn of [function(){}, function*(){}, async function(){}, async function*(){}]) { ' +
      'define(prototype(fn), "constructor", { value: undefined, writable: false, configurable: false }); } ' +
      'for (const name of ["eval", "Function"]) { ' +
      'define(globalThis, name, { value: undefined, writable: false, configurable: false }); } ' +
      'return { parse, memoryError: error => { ' +
      'if (!error || typeof error !== "object" || prototype(error) !== internalError) return false; ' +
      'const field = descriptor(error, "message"); ' +
      'return !!field && !!descriptor(field, "value") && field.value === "out of memory"; }, method: (ledger, name) => { ' +
      'const method = ledger[name]; ' +
      'if (typeof method !== "function") throw null; return method; }, ' +
      'serialize: (value, kind) => { ' +
      'if (value === null || typeof value !== "object") throw null; ' +
      'let fields; if (kind === "amend") { ' +
      'const variant = read(value, "kind"); ' +
      'if (variant === "committed") fields = ["kind", "revision", "checkpoint"]; ' +
      'else if (variant === "conflict") fields = ["kind", "revision"]; ' +
      'else if (variant === "insolvent") fields = ["kind", "account", "at", "balance"]; ' +
      'else throw null; } ' +
      'else if (kind === "report") fields = ["opening", "net", "closing", "entries", "minimumBalance", "debits", "debitAmountAtPercentile"]; ' +
      'else throw null; ' +
      'if (keys(value).length !== fields.length) throw null; ' +
      'const clean = create(null); ' +
      'for (let index = 0; index < fields.length; index++) { ' +
      'const name = fields[index], field = read(value, name); ' +
      'if (name === "kind" || name === "account") { if (typeof field !== "string") throw null; } ' +
      'else if (name === "debitAmountAtPercentile") { ' +
      'if (field !== null && (!safe(field) || field < 1 || field > 1000000000)) throw null; } ' +
      'else { if (!safe(field)) throw null; ' +
      'if (name === "balance") { if (field >= 0) throw null; } ' +
      'else if (name !== "net" && field < 0) throw null; } ' +
      'define(clean, name, { value: field, enumerable: true }); } ' +
      'if (kind === "report") { if (clean.debits > clean.entries) throw null; ' +
      'if (clean.debits === 0 ? clean.debitAmountAtPercentile !== null : clean.debitAmountAtPercentile === null) throw null; } ' +
      'return stringify(clean); } }; })()',
      "runner-helpers.js", { type: "global" }
    )));
    const parse = keep(context.getProp(helpers, "parse"));
    const method = keep(context.getProp(helpers, "method"));
    const serialize = keep(context.getProp(helpers, "serialize"));
    classifyError = keep(context.getProp(helpers, "memoryError"));
    const factory = keep(take(context.evalCode(
      '(function () { "use strict"; const module = { exports: {} }; const exports = module.exports;\n' + input.source +
      '\n;if (typeof createLedger === "function") return createLedger;' +
      'if (typeof module.exports === "function") return module.exports;' +
      'if (module.exports && typeof module.exports.createLedger === "function") return module.exports.createLedger;' +
      'throw new Error("Define createLedger");\n})()',
      "candidate.js", { type: "global" }
    )));
    const setupText = context.newString(JSON.stringify(input.setup));
    let setup;
    let ledger;
    try {
      setup = take(context.callFunction(parse, context.undefined, setupText));
      ledger = keep(take(context.callFunction(factory, context.undefined, setup)));
    } finally {
      if (setup) setup.dispose();
      setupText.dispose();
    }
    assertSynchronous(ledger);
    const methods = {};
    for (const name of ["amend", "report"]) {
      const nameHandle = context.newString(name);
      try { methods[name] = keep(take(context.callFunction(method, context.undefined, ledger, nameHandle))); }
      finally { nameHandle.dispose(); }
    }
    const results = [];
    let outputBytes = 256;
    for (const [index, operation] of input.operations.entries()) {
      if (index === measurementStartOperation) measurementStart = process.cpuUsage();
      const argumentText = context.newString(JSON.stringify(
        operation.kind === "amend" ? operation.amendment : operation.report
      ));
      let argument;
      let result;
      let kind;
      let serialized;
      try {
        argument = take(context.callFunction(parse, context.undefined, argumentText));
        result = take(context.callFunction(methods[operation.kind], ledger, argument));
        assertSynchronous(result);
        kind = context.newString(operation.kind);
        serialized = take(context.callFunction(serialize, context.undefined, result, kind));
        if (context.typeof(serialized) !== "string") fail("execution");
        const text = context.getString(serialized);
        outputBytes += Buffer.byteLength(text) + 1;
        if (outputBytes > limits.outputBytes) fail("execution");
        results.push(JSON.parse(text));
      } finally {
        if (serialized) serialized.dispose();
        if (kind) kind.dispose();
        if (result) result.dispose();
        if (argument) argument.dispose();
        argumentText.dispose();
      }
      if (exhausted) fail("budget");
    }
    const measurementCpu = measurementStart ? process.cpuUsage(measurementStart) : { user: 0, system: 0 };
    const cpu = process.cpuUsage(cpuStart);
    outcome = { kind: "completed", results, checkpoints, cpuMicros: cpu.user + cpu.system,
      measurementCpuMicros: measurementCpu.user + measurementCpu.system };
  } catch (error) {
    const reason = exhausted ? "budget" :
      error && error.runnerFailure ? error.runnerFailure :
      error instanceof WebAssembly.RuntimeError || error instanceof RangeError ? "memory" : "execution";
    outcome = failed(reason);
  } finally {
    try {
      for (let i = retained.length - 1; i >= 0; i -= 1) retained[i].dispose();
      if (context) context.dispose();
      if (runtime) runtime.dispose();
    } catch { outcome = failed(exhausted ? "budget" : "execution"); }
  }
  if (outcome.kind === "completed") {
    // Include protocol encoding/buffering in RSS. The final field is host-only.
    const prefix = JSON.stringify(outcome).slice(0, -1);
    process.stdout.write(prefix, () => {
      let peakRssBytes;
      if (process.platform === "linux") {
        const match = /^VmHWM:\s+(\d+)\s+kB$/m.exec(readFileSync("/proc/self/status", "utf8"));
        if (!match) throw new Error("Missing trusted process high-water RSS");
        peakRssBytes = Number(match[1]) * 1024;
      } else peakRssBytes = process.resourceUsage().maxRSS * 1024;
      process.stdout.end(',"peakRssBytes":' + peakRssBytes + '}');
    });
  } else process.stdout.write(JSON.stringify(outcome));
})().catch(() => { process.stdout.write(JSON.stringify(failed("execution"))); });
`;

const nativeRequire = createRequire(join(process.cwd(), "package.json"));
const resolveDependency: NodeJS.RequireResolve = Reflect.get(
  nativeRequire,
  "resolve",
);
const quickJSPath = resolveDependency("quickjs-emscripten");
let nodePath: string | undefined;

function getNodePath(timeoutMs: number): string {
  if (nodePath) return nodePath;
  nodePath = process.versions.bun
    ? execFileSync("node", ["-p", "process.execPath"], {
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", NODE_ENV: "production" },
        timeout: timeoutMs,
        killSignal: "SIGKILL",
      }).trim()
    : process.execPath;
  return nodePath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasExactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function parseAmendmentResult(value: unknown): AmendmentResult | undefined {
  if (!isRecord(value)) return undefined;
  switch (value.kind) {
    case "committed":
      if (
        !hasExactFields(value, ["kind", "revision", "checkpoint"]) ||
        !isSafeCount(value.revision) ||
        !isSafeCount(value.checkpoint)
      )
        return undefined;
      return {
        kind: "committed",
        revision: value.revision,
        checkpoint: value.checkpoint,
      };
    case "conflict":
      if (
        !hasExactFields(value, ["kind", "revision"]) ||
        !isSafeCount(value.revision)
      )
        return undefined;
      return { kind: "conflict", revision: value.revision };
    case "insolvent":
      if (
        !hasExactFields(value, ["kind", "account", "at", "balance"]) ||
        typeof value.account !== "string" ||
        !isSafeCount(value.at) ||
        !isSafeInteger(value.balance) ||
        value.balance >= 0
      )
        return undefined;
      return {
        kind: "insolvent",
        account: value.account,
        at: value.at,
        balance: value.balance,
      };
    default:
      return undefined;
  }
}

function parseReport(value: unknown): BalanceReport | undefined {
  if (
    !isRecord(value) ||
    !hasExactFields(value, [
      "opening",
      "net",
      "closing",
      "entries",
      "minimumBalance",
      "debits",
      "debitAmountAtPercentile",
    ]) ||
    !isSafeCount(value.opening) ||
    !isSafeInteger(value.net) ||
    !isSafeCount(value.closing) ||
    !isSafeCount(value.entries) ||
    !isSafeCount(value.minimumBalance) ||
    !isSafeCount(value.debits) ||
    value.debits > value.entries
  )
    return undefined;
  const debitAmountAtPercentile = value.debitAmountAtPercentile;
  if (
    debitAmountAtPercentile !== null &&
    (!isSafeInteger(debitAmountAtPercentile) ||
      debitAmountAtPercentile < 1 ||
      debitAmountAtPercentile > 1_000_000_000)
  )
    return undefined;
  if (
    value.debits === 0
      ? debitAmountAtPercentile !== null
      : debitAmountAtPercentile === null
  )
    return undefined;
  return {
    opening: value.opening,
    net: value.net,
    closing: value.closing,
    entries: value.entries,
    minimumBalance: value.minimumBalance,
    debits: value.debits,
    debitAmountAtPercentile,
  };
}

function parseOutcome(
  text: string,
  operations: readonly LedgerOperation[],
): RunnerOutcome | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || !isSafeCount(value.checkpoints)) return undefined;
  if (value.kind === "failed") {
    const reason = value.reason;
    if (
      reason !== "budget" &&
      reason !== "execution" &&
      reason !== "timeout" &&
      reason !== "memory"
    )
      return undefined;
    return { kind: "failed", reason, checkpoints: value.checkpoints };
  }
  if (
    value.kind !== "completed" ||
    !isSafeCount(value.cpuMicros) ||
    !isSafeCount(value.measurementCpuMicros) ||
    !isSafeCount(value.peakRssBytes) ||
    value.peakRssBytes === 0 ||
    !Array.isArray(value.results) ||
    value.results.length !== operations.length
  )
    return undefined;
  const results: LedgerResult[] = [];
  const rawResults: unknown[] = value.results;
  for (const [index, result] of rawResults.entries()) {
    const parsed =
      operations[index]?.kind === "amend"
        ? parseAmendmentResult(result)
        : parseReport(result);
    if (!parsed) return undefined;
    results.push(parsed);
  }
  return {
    kind: "completed",
    results,
    checkpoints: value.checkpoints,
    cpuMicros: value.cpuMicros,
    measurementCpuMicros: value.measurementCpuMicros,
    peakRssBytes: value.peakRssBytes,
  };
}

export async function runLedger(input: RunnerInput): Promise<RunnerOutcome> {
  const startedAt = performance.now();
  const failure = (
    reason: "execution" | "timeout" | "memory",
    checkpoints = 0,
  ): Extract<RunnerOutcome, { kind: "failed" }> => ({
    kind: "failed",
    reason,
    checkpoints,
  });
  if (
    Buffer.byteLength(input.source, "utf8") > runnerLimits.sourceBytes ||
    input.operations.length > runnerLimits.operations ||
    !isSafeCount(input.checkpointBudget) ||
    input.operations.some(
      (operation) =>
        operation.kind === "report" &&
        (!Number.isInteger(operation.report.percentile) ||
          operation.report.percentile < 1 ||
          operation.report.percentile > 100),
    ) ||
    (input.timeoutMs !== undefined &&
      (!Number.isFinite(input.timeoutMs) ||
        !Number.isInteger(input.timeoutMs) ||
        input.timeoutMs <= 0)) ||
    (input.measurementStartOperation !== undefined &&
      (!isSafeCount(input.measurementStartOperation) ||
        input.measurementStartOperation > input.operations.length))
  )
    return failure("execution");
  const timeoutMs = Math.min(
    input.timeoutMs ?? runnerLimits.timeoutMs,
    runnerLimits.timeoutMs,
  );
  const remainingMs = () => timeoutMs - (performance.now() - startedAt);
  if (remainingMs() <= 0) return failure("timeout");
  let payload: string;
  let executable: string;
  try {
    payload = JSON.stringify(input);
    if (remainingMs() <= 0) return failure("timeout");
    executable = getNodePath(Math.max(1, Math.floor(remainingMs())));
  } catch (error) {
    return failure(
      remainingMs() <= 0 || (isRecord(error) && error.code === "ETIMEDOUT")
        ? "timeout"
        : "execution",
    );
  }
  if (remainingMs() <= 0) return failure("timeout");
  return new Promise((resolve) => {
    // The trusted shell only applies RLIMIT_CPU and execs Node. Candidate text
    // remains stdin data and never enters the shell command or Node's evaluator.
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        "/bin/sh",
        [
          "-c",
          `ulimit -t ${runnerLimits.cpuSeconds} || exit 1; exec "$@"`,
          "slow-service-runner",
          executable,
          `--max-old-space-size=${runnerLimits.hostOldSpaceMiB}`,
          "--input-type=commonjs",
          "-e",
          worker,
          quickJSPath,
          JSON.stringify(runnerLimits),
        ],
        {
          env: { NODE_ENV: "production" },
          stdio: ["pipe", "pipe", "ignore"],
        },
      );
    } catch {
      resolve(failure("execution"));
      return;
    }
    let checkpoints = 0;
    let progress = Buffer.alloc(0);
    let readingProgress = true;
    let bytes = 0;
    const chunks: Buffer[] = [];
    let settled = false;
    let forcedFailure: ReturnType<typeof failure> | undefined;
    const finish = (outcome: RunnerOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const forceFailure = (reason: "execution" | "timeout") => {
      if (settled || forcedFailure) return;
      forcedFailure = failure(reason, checkpoints);
      clearTimeout(timer);
      // A caller may release its admission slot only after close. Sending SIGKILL
      // is not confirmation of exit, so neither this path nor error resolves.
      if (child.pid !== undefined) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* Still await the owned child's close. */
        }
      }
    };
    const timer = setTimeout(
      () => {
        forceFailure("timeout");
      },
      Math.max(0, remainingMs()),
    );
    child.on("error", () => forceFailure("execution"));
    child.on("close", (code, signal) => {
      if (forcedFailure) {
        finish(forcedFailure);
        return;
      }
      if (code !== 0) {
        finish(
          failure(
            signal === "SIGABRT"
              ? "memory"
              : signal === "SIGXCPU" || signal === "SIGKILL"
                ? "timeout"
                : "execution",
            checkpoints,
          ),
        );
        return;
      }
      finish(
        parseOutcome(
          Buffer.concat(chunks).toString("utf8"),
          input.operations,
        ) ?? failure("execution", checkpoints),
      );
    });
    const stdin = child.stdin;
    const stdout = child.stdout;
    if (!stdin || !stdout) {
      forceFailure("execution");
      return;
    }
    const appendOutput = (chunk: Buffer) => {
      if (forcedFailure) return;
      bytes += chunk.length;
      if (bytes > runnerLimits.outputBytes) {
        forceFailure("execution");
      } else chunks.push(chunk);
    };
    stdout.on("data", (chunk: Buffer) => {
      if (forcedFailure) return;
      if (!readingProgress) {
        appendOutput(chunk);
        return;
      }
      progress = Buffer.concat([progress, chunk]);
      while (progress[0] === 64) {
        const newline = progress.indexOf(10);
        if (newline < 0) return;
        const count = Number(progress.subarray(1, newline).toString("ascii"));
        if (isSafeCount(count) && count >= checkpoints) checkpoints = count;
        progress = progress.subarray(newline + 1);
      }
      if (progress.length > 0) {
        readingProgress = false;
        appendOutput(progress);
        progress = Buffer.alloc(0);
      }
    });
    stdin.on("error", () => {});
    try {
      stdin.end(payload);
    } catch {
      forceFailure("execution");
    }
  });
}
