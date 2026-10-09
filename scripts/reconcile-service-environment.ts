import path from "node:path";

import type { ApplicationEnvironment } from "./deploy-environment";
import { reconcileServiceEnvironment } from "./deploy-service-environment";

interface Manifest {
  readonly serverUrl: string;
  readonly applications: ApplicationEnvironment[];
}

const requiredEnvironmentValue = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const exactlyOne = <T>(values: T[], description: string): T => {
  if (values.length !== 1) {
    throw new Error(
      `Expected exactly one ${description}, found ${values.length}.`,
    );
  }
  return values[0] as T;
};

const run = async (): Promise<void> => {
  const root = path.resolve(import.meta.dir, "..");
  const manifest = (await Bun.file(
    path.join(root, "deploy/dokploy.json"),
  ).json()) as Manifest;
  const applicationName = requiredEnvironmentValue("DOKPLOY_APPLICATION_NAME");
  const application = exactlyOne(
    manifest.applications.filter(
      (candidate) => candidate.name === applicationName,
    ),
    `application named ${applicationName}`,
  );
  const additionalEnvironment: Record<string, string> = {};
  if (applicationName === "Website") {
    for (const name of ["RATE_LIMIT_SERVICE_URL", "RATE_LIMIT_SERVICE_TOKEN"]) {
      additionalEnvironment[name] = requiredEnvironmentValue(name);
    }
  }
  const result = await reconcileServiceEnvironment({
    serverUrl: requiredEnvironmentValue("DOKPLOY_URL"),
    expectedServerUrl: manifest.serverUrl,
    apiKey: requiredEnvironmentValue("DOKPLOY_API_KEY"),
    applicationId: requiredEnvironmentValue("DOKPLOY_APPLICATION_ID"),
    application,
    applications: manifest.applications,
    fetch: globalThis.fetch,
    additionalEnvironment,
  });
  process.stdout.write(
    `${JSON.stringify({ application: applicationName, ...result })}\n`,
  );
};

await run();
