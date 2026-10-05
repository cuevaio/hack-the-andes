import { expect, test } from "bun:test";

test("admin selection uses full latest-version rankings, exact ranks and current application decisions", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./fixtures/candidate-rankings.ts", import.meta.url).pathname,
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
    stdout: "candidate rankings passed\n",
    stderr: "",
  });
}, 30_000);
