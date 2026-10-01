import { expect, test } from "bun:test";

test("challenge reads, public tests and browser approval queue completion reminders", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./fixtures/routes.ts", import.meta.url).pathname,
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
    stdout: "reminder routes passed\n",
    stderr: "",
  });
});

test("reminder enqueue targets the open challenge and deduplicates per version", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./fixtures/enqueue.ts", import.meta.url).pathname,
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
    stdout: "reminder enqueue passed\n",
    stderr: "",
  });
});
