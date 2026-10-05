import { expect, test } from "bun:test";
import { configurePowerGridPreview } from "./configure-power-grid-preview";
import { parseEnvironment } from "./deploy-environment";

test("configuring preview preserves every unrelated runtime variable and build setting", async () => {
  const secret = "preview-secret-with-at-least-32-characters";
  let calls = 0;
  await configurePowerGridPreview({
    baseUrl: "https://vps.cueva.io",
    apiKey: "deployment-key",
    applicationId: "web-app",
    secret,
    fetch: async (_url, init) => {
      calls += 1;
      if (init?.method === "GET")
        return Response.json({
          env: 'CLERK_SECRET_KEY="existing"\nCHALLENGE_ENGINE_URL="https://engine.hacktheandes.com"\nCUSTOM_FLAG="keep"',
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
        POWER_GRID_ADMIN_PREVIEW_SECRET: secret,
      });
      return Response.json({ success: true });
    },
  });
  expect(calls).toBe(2);
});

test("configuration is idempotent and refuses a different production host", async () => {
  const secret = "preview-secret-with-at-least-32-characters";
  let calls = 0;
  const options = {
    baseUrl: "https://vps.cueva.io",
    apiKey: "deployment-key",
    applicationId: "web-app",
    secret,
    fetch: async () => {
      calls += 1;
      return Response.json({
        env: `POWER_GRID_ADMIN_PREVIEW_SECRET=${secret}`,
      });
    },
  };
  await configurePowerGridPreview(options);
  expect(calls).toBe(1);
  await expect(
    configurePowerGridPreview({ ...options, baseUrl: "https://other.example" }),
  ).rejects.toThrow("Unexpected deployment server");
  expect(calls).toBe(1);
});
