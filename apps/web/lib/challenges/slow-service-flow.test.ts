import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Slow Service v3 requires owned companion approval and preserves historical versions through evaluation, ranking and badge flows", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      fileURLToPath(
        new URL("./fixtures/slow-service-flow.ts", import.meta.url),
      ),
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
    output: "slow service flow passed\n",
  });
}, 20_000);
