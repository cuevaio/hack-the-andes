import { expect, test } from "bun:test";

test("admin roster searches encrypted documents and registers audited idempotent arrivals alongside QR check-in", async () => {
  const child = Bun.spawn(
    [process.execPath, "lib/admin/fixtures/checkin-integration.ts"],
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
    stdout: "admin check-in integration passed\n",
    stderr: "",
  });
});
