import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("admin CLI early access uses persisted participant budgets and rejects other roles and revoked access", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      fileURLToPath(
        new URL("./fixtures/early-access-flow.ts", import.meta.url),
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
    output: "early access flow passed\n",
  });
}, 60_000);
