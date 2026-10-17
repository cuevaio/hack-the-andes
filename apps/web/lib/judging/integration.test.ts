import { expect, test } from "bun:test";

test("judging API enforces Clerk roles, preserves metadata, isolates scores, and blocks deactivated judges", async () => {
  const child = Bun.spawn(
    [process.execPath, "lib/judging/fixtures/integration.ts"],
    {
      cwd: new URL("../../", import.meta.url).pathname,
      env: { ...process.env, NEW_DATABASE_URL: "", CLERK_SECRET_KEY: "" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ code, stdout, stderr }).toEqual({
    code: 0,
    stdout: "judging integration passed\n",
    stderr: "",
  });
}, 30000);
