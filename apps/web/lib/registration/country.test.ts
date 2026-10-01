import { expect, test } from "bun:test";

test("country selection persists across applications and only admins can correct it", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("./fixtures/country.ts", import.meta.url).pathname,
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
    stdout: "country lifecycle passed\n",
    stderr: "",
  });
}, 30_000);
