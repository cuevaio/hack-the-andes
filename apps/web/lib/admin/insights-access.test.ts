import { expect, test } from "bun:test";

test("only authorized reviewers can reach participant insights queries", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./fixtures/insights-access.ts", import.meta.url).pathname,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ exitCode, stdout, stderr }).toEqual({
    exitCode: 0,
    stdout: "insights access passed\n",
    stderr: "",
  });
}, 30_000);
