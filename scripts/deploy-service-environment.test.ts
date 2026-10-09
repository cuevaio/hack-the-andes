import { describe, expect, test } from "bun:test";

import type { ApplicationEnvironment } from "./deploy-environment";
import { reconcileServiceEnvironment } from "./deploy-service-environment";

const website: ApplicationEnvironment = {
  name: "Website",
  domain: "hacktheandes.com",
  environmentVariables: ["NEW_DATABASE_URL"],
  optionalEnvironmentVariables: [],
  serviceEnvironmentVariables: {
    CHALLENGE_ENGINE_URL: "Challenge Engine",
  },
};

const applications: ApplicationEnvironment[] = [
  website,
  {
    name: "Challenge Engine",
    domain: "engine.hacktheandes.com",
    environmentVariables: ["CHALLENGE_ENGINE_API_SECRET"],
    optionalEnvironmentVariables: [],
  },
];

describe("Dokploy service environment reconciliation", () => {
  test("installs shared limiter credentials while preserving other runtime settings", async () => {
    let saved: unknown;
    const result = await reconcileServiceEnvironment({
      serverUrl: "https://vps.example",
      expectedServerUrl: "https://vps.example",
      apiKey: "dokploy-secret",
      applicationId: "website-id",
      application: website,
      applications,
      additionalEnvironment: {
        RATE_LIMIT_SERVICE_URL: "https://limiter.example",
        RATE_LIMIT_SERVICE_TOKEN: "local-test-secret",
      },
      fetch: async (input, init) => {
        if (String(input).includes("application.one"))
          return Response.json({
            env: 'NEW_DATABASE_URL="preserved"\nCHALLENGE_ENGINE_URL="https://engine.hacktheandes.com"',
            buildArgs: "existing",
            createEnvFile: true,
          });
        saved = JSON.parse(String(init?.body));
        return Response.json(true);
      },
    });
    expect(result.changedNames).toEqual([
      "RATE_LIMIT_SERVICE_URL",
      "RATE_LIMIT_SERVICE_TOKEN",
    ]);
    expect(saved).toMatchObject({ buildArgs: "existing", createEnvFile: true });
    if (
      !saved ||
      typeof saved !== "object" ||
      !("env" in saved) ||
      typeof saved.env !== "string"
    )
      throw new Error("Missing saved environment");
    expect(saved.env).toContain('NEW_DATABASE_URL="preserved"');
    expect(saved.env).toContain('RATE_LIMIT_SERVICE_TOKEN="local-test-secret"');
  });
  test("replaces a stale service URL without changing secrets", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const request = { url, init: init ?? {} };
      requests.push(request);
      if (url.includes("application.one")) {
        return Response.json({
          env: [
            'CHALLENGE_ENGINE_API_SECRET="private-secret"',
            'CHALLENGE_ENGINE_URL="https://andes-engine.cueva.io"',
            'NEW_DATABASE_URL="postgresql://database.example/chofex"',
            'PRIVATE_KEY="-----BEGIN PRIVATE KEY-----',
            "CHALLENGE_ENGINE_URL=https://embedded.example",
            "multiline-secret-content",
            '-----END PRIVATE KEY-----"',
            "SCRIPT='first \\'quoted",
            "CHALLENGE_ENGINE_URL=https://embedded-script.example",
            "last'",
            "SCRIPT_BACKTICK=`first",
            "CHALLENGE_ENGINE_URL=https://embedded-backtick.example",
            "last`",
            'export SCRIPT_EXPORTED="first',
            "CHALLENGE_ENGINE_URL=https://embedded-export.example",
            'last"',
            'SCRIPT-NAME="first',
            "CHALLENGE_ENGINE_URL=https://embedded-hyphen.example",
            'last"',
            "SCRIPT.NAME=`first",
            "CHALLENGE_ENGINE_URL=https://embedded-dot.example",
            "last`",
            '1SCRIPT="first',
            "CHALLENGE_ENGINE_URL=https://embedded-digit.example",
            'last"',
            '.SCRIPT="first',
            "CHALLENGE_ENGINE_URL=https://embedded-leading-dot.example",
            'last"',
            '-SCRIPT="first',
            "CHALLENGE_ENGINE_URL=https://embedded-leading-hyphen.example",
            'last"',
          ].join("\n"),
          buildArgs: "NODE_ENV=production",
          buildSecrets: null,
          createEnvFile: false,
        });
      }
      return Response.json(true);
    };

    const result = await reconcileServiceEnvironment({
      serverUrl: "https://vps.example",
      expectedServerUrl: "https://vps.example",
      apiKey: "dokploy-secret",
      applicationId: "website-id",
      application: website,
      applications,
      fetch,
    });

    expect(result).toEqual({
      changedNames: ["CHALLENGE_ENGINE_URL"],
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe(
      "https://vps.example/api/application.one?applicationId=website-id",
    );
    expect(requests[0]?.init.headers).toEqual({
      "x-api-key": "dokploy-secret",
    });

    const saveRequest = requests[1];
    expect(saveRequest?.url).toBe(
      "https://vps.example/api/application.saveEnvironment",
    );
    const body = JSON.parse(String(saveRequest?.init.body));
    expect(body).toEqual({
      applicationId: "website-id",
      env: [
        'CHALLENGE_ENGINE_API_SECRET="private-secret"',
        'CHALLENGE_ENGINE_URL="https://engine.hacktheandes.com"',
        'NEW_DATABASE_URL="postgresql://database.example/chofex"',
        'PRIVATE_KEY="-----BEGIN PRIVATE KEY-----',
        "CHALLENGE_ENGINE_URL=https://embedded.example",
        "multiline-secret-content",
        '-----END PRIVATE KEY-----"',
        "SCRIPT='first \\'quoted",
        "CHALLENGE_ENGINE_URL=https://embedded-script.example",
        "last'",
        "SCRIPT_BACKTICK=`first",
        "CHALLENGE_ENGINE_URL=https://embedded-backtick.example",
        "last`",
        'export SCRIPT_EXPORTED="first',
        "CHALLENGE_ENGINE_URL=https://embedded-export.example",
        'last"',
        'SCRIPT-NAME="first',
        "CHALLENGE_ENGINE_URL=https://embedded-hyphen.example",
        'last"',
        "SCRIPT.NAME=`first",
        "CHALLENGE_ENGINE_URL=https://embedded-dot.example",
        "last`",
        '1SCRIPT="first',
        "CHALLENGE_ENGINE_URL=https://embedded-digit.example",
        'last"',
        '.SCRIPT="first',
        "CHALLENGE_ENGINE_URL=https://embedded-leading-dot.example",
        'last"',
        '-SCRIPT="first',
        "CHALLENGE_ENGINE_URL=https://embedded-leading-hyphen.example",
        'last"',
      ].join("\n"),
      buildArgs: "NODE_ENV=production",
      buildSecrets: null,
      createEnvFile: false,
    });
  });

  test("does not save an environment that already matches", async () => {
    let requests = 0;
    const fetch = async () => {
      requests += 1;
      return Response.json({
        env: 'CHALLENGE_ENGINE_URL="https://engine.hacktheandes.com"',
        buildArgs: null,
        buildSecrets: null,
        createEnvFile: false,
      });
    };

    const result = await reconcileServiceEnvironment({
      serverUrl: "https://vps.example",
      expectedServerUrl: "https://vps.example/",
      apiKey: "dokploy-secret",
      applicationId: "website-id",
      application: website,
      applications,
      fetch,
    });

    expect(result).toEqual({ changedNames: [] });
    expect(requests).toBe(1);
  });

  test("rejects a Dokploy endpoint mismatch before sending credentials", async () => {
    let requests = 0;
    const fetch = async () => {
      requests += 1;
      return Response.json({});
    };

    await expect(
      reconcileServiceEnvironment({
        serverUrl: "https://unexpected.example",
        expectedServerUrl: "https://vps.example",
        apiKey: "dokploy-secret",
        applicationId: "website-id",
        application: website,
        applications,
        fetch,
      }),
    ).rejects.toThrow(
      "Refusing to use https://unexpected.example. This manifest targets https://vps.example.",
    );
    expect(requests).toBe(0);
  });
});
