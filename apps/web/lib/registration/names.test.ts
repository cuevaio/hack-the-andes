import { expect, test } from "bun:test";

test("login, confirmation, and badge edits share a public name while legal names remain separate", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./fixtures/names.ts", import.meta.url).pathname,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ exitCode, stdout, stderr }).toEqual({
    exitCode: 0,
    stdout: "participant name lifecycle passed\n",
    stderr: "",
  });
}, 30_000);
