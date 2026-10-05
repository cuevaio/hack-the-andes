import { expect, test } from "bun:test";
import { hasChallengeEarlyAccess } from "./early-access";

test("only current public or private Clerk admin-panel metadata grants Power Grid early access", async () => {
  for (const metadata of [
    { role: "admin" },
    { roles: ["builder", "admin"] },
    { role: "application_reviewer" },
    { roles: ["application_reviewer"] },
  ]) {
    for (const scope of ["publicMetadata", "privateMetadata"]) {
      expect(
        await hasChallengeEarlyAccess(
          "user_admin",
          "power-grid",
          async (id) => {
            expect(id).toBe("user_admin");
            return {
              publicMetadata: {},
              privateMetadata: {},
              [scope]: metadata,
            };
          },
        ),
      ).toBe(true);
    }
  }
  for (const metadata of [
    {},
    { role: "participant" },
    { roles: ["builder"] },
    { role: "ADMIN" },
  ]) {
    expect(
      await hasChallengeEarlyAccess("user_admin", "power-grid", async () => ({
        publicMetadata: metadata,
        privateMetadata: {},
      })),
    ).toBe(false);
  }
});

test("early access does not open other challenges and fails closed when Clerk is unavailable", async () => {
  const readUser = async () => {
    throw new Error("Clerk unavailable");
  };
  expect(
    await hasChallengeEarlyAccess("user_admin", "black-box", readUser),
  ).toBe(false);
  expect(
    await hasChallengeEarlyAccess("user_admin", "agent-arena", readUser),
  ).toBe(false);
  await expect(
    hasChallengeEarlyAccess("user_admin", "power-grid", readUser),
  ).rejects.toThrow("Clerk unavailable");
});
