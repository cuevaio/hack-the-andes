import { expect, test } from "bun:test";
import { parseEnvironment } from "./deploy-environment";
import { removePowerGridPreviewSecret } from "./remove-power-grid-preview-secret";

test("removing preview secret preserves every unrelated runtime variable and build setting", async () => {
  let calls = 0;
  await removePowerGridPreviewSecret({
    baseUrl: "https://vps.cueva.io",
    apiKey: "deployment-key",
    applicationId: "web-app",
    fetch: async (_url, init) => {
      calls += 1;
      if (init?.method === "GET")
        return Response.json({
          env: 'CLERK_SECRET_KEY="existing"\nCHALLENGE_ENGINE_URL="https://engine.hacktheandes.com"\nCUSTOM_FLAG="keep"\nPOWER_GRID_ADMIN_PREVIEW_SECRET="old-secret"',
          buildArgs: "existing args",
          buildSecrets: "existing build secrets",
          createEnvFile: true,
        });
      const saved = JSON.parse(String(init?.body));
      expect(saved).toMatchObject({
        applicationId: "web-app",
        buildArgs: "existing args",
        buildSecrets: "existing build secrets",
        createEnvFile: true,
      });
      expect(parseEnvironment(saved.env)).toEqual({
        CLERK_SECRET_KEY: "existing",
        CHALLENGE_ENGINE_URL: "https://engine.hacktheandes.com",
        CUSTOM_FLAG: "keep",
      });
      return Response.json({ success: true });
    },
  });
  expect(calls).toBe(2);
});

test("configuration is idempotent and refuses a different production host", async () => {
  let calls = 0;
  const options = {
    baseUrl: "https://vps.cueva.io",
    apiKey: "deployment-key",
    applicationId: "web-app",
    fetch: async () => {
      calls += 1;
      return Response.json({
        env: "CUSTOM_FLAG=keep",
      });
    },
  };
  await removePowerGridPreviewSecret(options);
  expect(calls).toBe(1);
  await expect(
    removePowerGridPreviewSecret({
      ...options,
      baseUrl: "https://other.example",
    }),
  ).rejects.toThrow("Unexpected deployment server");
  expect(calls).toBe(1);
});
