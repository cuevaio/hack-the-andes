import { parseEnvironment, serializeEnvironment } from "./deploy-environment";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
export const configurePowerGridPreview = async (options: {
  baseUrl: string;
  apiKey: string;
  applicationId: string;
  secret: string;
  fetch: typeof fetch;
}) => {
  if (options.baseUrl !== "https://vps.cueva.io")
    throw new Error("Unexpected deployment server");
  if (
    options.secret.length < 32 ||
    options.secret.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(options.secret)
  )
    throw new Error("Invalid preview secret configuration");
  const call = async (path: string, init: RequestInit): Promise<unknown> => {
    const response = await options.fetch(new URL(path, options.baseUrl), {
      ...init,
      headers: {
        "x-api-key": options.apiKey,
        "content-type": "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(
        `Preview configuration request failed: HTTP ${response.status}`,
      );
    return response.json();
  };
  const applicationUrl = `/api/application.one?applicationId=${encodeURIComponent(options.applicationId)}`;
  const state = await call(applicationUrl, { method: "GET" });
  if (
    typeof state !== "object" ||
    state === null ||
    !("env" in state) ||
    typeof state.env !== "string"
  )
    throw new Error("Invalid deployment application response");
  const environment = parseEnvironment(state.env);
  if (environment.POWER_GRID_ADMIN_PREVIEW_SECRET === options.secret) return;
  environment.POWER_GRID_ADMIN_PREVIEW_SECRET = options.secret;
  await call("/api/application.saveEnvironment", {
    method: "POST",
    body: JSON.stringify({
      applicationId: options.applicationId,
      env: serializeEnvironment(environment),
      buildArgs: "buildArgs" in state ? state.buildArgs : null,
      buildSecrets: "buildSecrets" in state ? state.buildSecrets : null,
      createEnvFile: "createEnvFile" in state ? state.createEnvFile : false,
    }),
  });
};
if (import.meta.main) {
  await configurePowerGridPreview({
    baseUrl: required("DOKPLOY_URL"),
    apiKey: required("DOKPLOY_API_KEY"),
    applicationId: required("DOKPLOY_APPLICATION_ID"),
    secret: required("POWER_GRID_ADMIN_PREVIEW_SECRET"),
    fetch,
  });
  process.stdout.write(
    "Admin preview configured. Existing runtime variables preserved.\n",
  );
}
