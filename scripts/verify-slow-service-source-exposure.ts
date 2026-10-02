import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { challengeBySlug } from "../packages/challenges-contract/src/index.ts";
import { slowServiceToolkit } from "../packages/challenges-contract/src/slow-service/toolkit.generated.ts";
import { slowServiceChallengeVersion } from "../packages/challenges-contract/src/slow-service.ts";

const sourceDirectory = process.argv[2];
assert.ok(sourceDirectory, "Supply the approved public source directory");
assert.equal(basename(resolve(sourceDirectory)), slowServiceChallengeVersion);
assert.equal(slowServiceToolkit.kind, "ready");
if (slowServiceToolkit.kind !== "ready") throw new Error("Toolkit unavailable");
assert.equal(slowServiceToolkit.version, slowServiceChallengeVersion);
assert.equal(challengeBySlug("make-it-fast")?.playable, true);

// Never enumerate the parent directory. Only these six approved files can enter
// the participant bundle; package.json and AGENTS.md are generated locally.
const whitelist = [
  ["README.participant.md", "README.md"],
  ["starter.js", "ledger.js"],
  ["contract.ts", ".kit/contract.ts"],
  ["runner.ts", ".kit/runner.ts"],
  ["public-benchmark.ts", ".kit/public-benchmark.ts"],
  ["participant-tests.ts", ".kit/ledger.test.ts"],
] as const;
assert.deepEqual(
  Object.keys(slowServiceToolkit.files).sort(),
  [
    ...whitelist.map(([, target]) => target),
    "package.json",
    "AGENTS.md",
  ].sort(),
);
const sha256 = (content: string) =>
  createHash("sha256").update(content).digest("hex");
const manifest = [];
for (const [source, target] of whitelist) {
  const approved = await readFile(resolve(sourceDirectory, source), "utf8");
  assert.equal(slowServiceToolkit.files[target], approved, target);
  manifest.push({
    source,
    target,
    bytes: Buffer.byteLength(approved),
    sha256: sha256(approved),
  });
  if (source === "contract.ts" || source === "runner.ts") {
    const local = await readFile(
      new URL(
        `../packages/challenges-contract/src/slow-service/${source}`,
        import.meta.url,
      ),
      "utf8",
    );
    const adapted = approved.replace(
      '"./contract"',
      '"@chofex/challenges-contract/slow-service/contract"',
    );
    const formatter = Bun.spawn(
      [
        process.execPath,
        "x",
        "--bun",
        "@biomejs/biome",
        "check",
        "--write",
        `--stdin-file-path=packages/challenges-contract/src/slow-service/${source}`,
      ],
      { stdin: new Blob([adapted]), stdout: "pipe", stderr: "pipe" },
    );
    const [exit, formatted, diagnostics] = await Promise.all([
      formatter.exited,
      new Response(formatter.stdout).text(),
      new Response(formatter.stderr).text(),
    ]);
    assert.equal(exit, 0, diagnostics);
    assert.equal(local, formatted, `${source} integration mirror`);
  }
}
process.stdout.write(
  `${JSON.stringify({ version: slowServiceChallengeVersion, exactApprovedFiles: 6, generatedFiles: ["package.json", "AGENTS.md"], playable: true, manifest }, null, 2)}\n`,
);
