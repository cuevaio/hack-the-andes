import { expect, test } from "bun:test";

test("organizer exception unlocks credits while private details remain pending and normal eligibility is preserved", async () => {
  const child = Bun.spawn(
    [process.execPath, "lib/credits/fixtures/exception.ts"],
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
    stdout: "organizer check-in exception passed\n",
    stderr: "",
  });
});
