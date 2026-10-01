import { expect, test } from "bun:test";

test("filters the full candidate cohort before counts, ranking and pagination", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./fixtures/candidate-filters.ts", import.meta.url).pathname,
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
    stdout: "candidate filters passed\n",
    stderr: "",
  });
}, 30_000);
