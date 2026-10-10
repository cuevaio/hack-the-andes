import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Mountain Lodge CLI queries, tests, evaluates and preserves budgets through the real API and database", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      fileURLToPath(
        new URL("./fixtures/mountain-lodge-flow.ts", import.meta.url),
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
    output: "mountain lodge flow passed\n",
  });
}, 60_000);
