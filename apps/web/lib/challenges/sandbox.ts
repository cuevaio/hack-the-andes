import * as childProcess from "node:child_process";
import type { Shipment } from "@chofex/challenges-contract";
import type { LodgeBooking } from "@chofex/challenges-contract/mountain-lodge";
import type { PowerReading } from "@chofex/challenges-contract/power-grid";

import { HttpError } from "../registration/http";

const evaluationTimeoutMs = 1_500;
const workerExitGraceMs = 500;
const maximumWorkerOutputBytes = 64 * 1_024;
const maximumConcurrentWorkers = 4;
let activeWorkers = 0;

// Next's output tracer treats direct spawn(..., ["--eval", source]) calls as
// asset references. Keep the process API indirect so the inline worker remains
// runtime data rather than a build-time module path.
const spawnIsolatedProcess = Reflect.get(
  childProcess,
  "spawn",
) as typeof childProcess.spawn;

const workerSource = String.raw`
import vm from "node:vm";

let requestText = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) requestText += chunk;

const reply = (message) => process.stdout.write(JSON.stringify(message));

try {
  const request = JSON.parse(requestText);
  const shipmentsJson = JSON.stringify(request.shipments);
  const functionName = request.functionName;
  if (!["calculateShipping", "calculateBill", "quoteStay"].includes(functionName)) throw new Error("Invalid entry point");
  const scriptSource = [
    '"use strict";',
    "const __loadSolution = () => {",
    "  const module = { exports: {} };",
    "  const exports = module.exports;",
    request.source,
    '  if (typeof ' + functionName + ' === "function") return ' + functionName + ';',
    "  if (",
    "    module.exports &&",
    '    typeof module.exports === "object" &&',
    '    typeof module.exports.' + functionName + ' === "function"',
    "  ) {",
    '    return module.exports.' + functionName + ';',
    "  }",
    '  if (typeof module.exports === "function") return module.exports;',
    '  throw new Error("Define function ' + functionName + '(input)");',
    "};",
    "const __calculateShipping = __loadSolution();",
    "const __shipments = JSON.parse(" + JSON.stringify(shipmentsJson) + ");",
    "const __results = __shipments.map((input) => {",
    "  const value = __calculateShipping(input);",
    '  if (typeof value !== "number" || !Number.isFinite(value)) {',
    '    throw new Error("Solution must return a finite number");',
    "  }",
    "  return value;",
    "});",
    "JSON.stringify(__results);",
  ].join("\n");

  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  const script = new vm.Script(scriptSource, { filename: "solution.js" });
  const serializedResults = script.runInContext(context, {
    timeout: ${evaluationTimeoutMs},
    displayErrors: true,
  });
  reply({ ok: true, results: JSON.parse(serializedResults) });
} catch (error) {
  let message = String(error);
  if (error instanceof Error) message = error.message;
  reply({ ok: false, error: message });
}
`;

const executionError = (message: string): HttpError =>
  new HttpError(
    422,
    "SOLUTION_EXECUTION_FAILED",
    `Could not run solution: ${message}`,
    false,
  );

const parseWorkerResponse = (
  output: string,
  expectedResults: number,
): Array<number> => {
  let response: unknown;
  try {
    response = JSON.parse(output) as unknown;
  } catch {
    throw executionError("The isolated runner returned an invalid response");
  }
  if (!response || typeof response !== "object" || !("ok" in response)) {
    throw executionError("The isolated runner returned an invalid response");
  }
  if (
    response.ok === false &&
    "error" in response &&
    typeof response.error === "string"
  ) {
    throw executionError(response.error);
  }
  if (
    response.ok !== true ||
    !("results" in response) ||
    !Array.isArray(response.results)
  ) {
    throw executionError("Solution did not produce a result list");
  }

  if (response.results.length !== expectedResults) {
    throw executionError("Solution did not produce one result per input");
  }
  const results: Array<number> = [];
  for (const value of response.results) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw executionError("Solution must return a finite number");
    }
    results.push(value);
  }
  return results;
};

const runNumericSolution = (
  source: string,
  shipments: ReadonlyArray<Shipment | PowerReading | LodgeBooking>,
  functionName: "calculateShipping" | "calculateBill" | "quoteStay",
): Promise<Array<number>> => {
  if (activeWorkers >= maximumConcurrentWorkers) {
    return Promise.reject(
      new HttpError(
        503,
        "SOLUTION_RUNNER_BUSY",
        "The solution runner is busy; try again shortly",
        true,
      ),
    );
  }
  activeWorkers += 1;

  return new Promise((resolve, reject) => {
    let child: childProcess.ChildProcessWithoutNullStreams;
    try {
      child = spawnIsolatedProcess(
        "node",
        [
          "--permission",
          "--max-old-space-size=32",
          "--input-type=module",
          "--eval",
          workerSource,
        ],
        {
          env: { NODE_ENV: "production", PATH: process.env.PATH ?? "" },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch {
      activeWorkers -= 1;
      reject(executionError("The isolated runner could not start"));
      return;
    }
    let output = "";
    let outputBytes = 0;
    let diagnosticBytes = 0;
    let settled = false;

    const finish = (result: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      result();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(executionError("Execution timed out")));
    }, evaluationTimeoutMs + workerExitGraceMs);

    const stopWorker = (message: string): void => {
      child.kill("SIGKILL");
      finish(() => reject(executionError(message)));
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (settled) return;
      outputBytes += Buffer.byteLength(chunk, "utf8");
      if (outputBytes > maximumWorkerOutputBytes) {
        stopWorker("The isolated runner exceeded its output limit");
        return;
      }
      output += chunk;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (settled) return;
      diagnosticBytes += chunk.byteLength;
      if (diagnosticBytes > maximumWorkerOutputBytes) {
        stopWorker("The isolated runner exceeded its output limit");
      }
    });
    child.on("error", () => {
      stopWorker("The isolated runner could not start");
    });
    child.stdin.on("error", () => {
      stopWorker("The isolated runner could not read the solution");
    });
    child.once("close", (code) => {
      activeWorkers -= 1;
      finish(() => {
        if (code !== 0) {
          reject(executionError("The isolated runner exited"));
          return;
        }
        try {
          resolve(parseWorkerResponse(output, shipments.length));
        } catch (error) {
          reject(error);
        }
      });
    });

    child.stdin.end(JSON.stringify({ source, shipments, functionName }));
  });
};

export const runShippingSolution = (
  source: string,
  inputs: ReadonlyArray<Shipment>,
) => runNumericSolution(source, inputs, "calculateShipping");

export const runPowerGridSolution = (
  source: string,
  inputs: ReadonlyArray<PowerReading>,
) => runNumericSolution(source, inputs, "calculateBill");

export const runMountainLodgeSolution = (
  source: string,
  inputs: ReadonlyArray<LodgeBooking>,
) => runNumericSolution(source, inputs, "quoteStay");
