import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("official evaluation preserves approval across outage and persistence failure", async () => {
  // Isolate the database module replacement from other tests in this process.
  const child = Bun.spawn(
    [
      process.execPath,
      fileURLToPath(new URL("./fixtures/evaluation-retry.ts", import.meta.url)),
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ exitCode, output: stdout + stderr }).toEqual({
    exitCode: 0,
    output: "evaluation retry passed\n",
  });
}, 20_000);
