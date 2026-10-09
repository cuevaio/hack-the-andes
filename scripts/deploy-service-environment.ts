import {
  type ApplicationEnvironment,
  serviceEnvironment,
} from "./deploy-environment";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface DokployApplicationEnvironment {
  readonly env?: string | null;
  readonly buildArgs?: string | null;
  readonly buildSecrets?: string | null;
  readonly createEnvFile?: boolean;
}

interface ReconcileServiceEnvironmentOptions {
  readonly serverUrl: string;
  readonly expectedServerUrl: string;
  readonly apiKey: string;
  readonly applicationId: string;
  readonly application: ApplicationEnvironment;
  readonly applications: ApplicationEnvironment[];
  readonly fetch: Fetch;
  readonly additionalEnvironment?: Record<string, string>;
}

interface ReconcileServiceEnvironmentResult {
  readonly changedNames: string[];
}

const normalizeUrl = (value: string): string => value.replace(/\/+$/, "");

interface EnvironmentAssignment {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

// Keep this grammar aligned with the `dotenv` parser Dokploy uses when it
// converts the stored source into container variables.
const dotenvRecord =
  /^\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?$/gm;

const environmentAssignments = (source: string): EnvironmentAssignment[] => {
  const assignments: EnvironmentAssignment[] = [];
  for (const match of source.matchAll(dotenvRecord)) {
    const name = match[1];
    if (!name || match.index === undefined) continue;
    assignments.push({
      name,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return assignments;
};

const reconciledEnvironment = (
  source: string,
  desired: Record<string, string>,
): { environment: string; changedNames: string[] } => {
  let environment = source;
  const changedNames: string[] = [];
  for (const [name, value] of Object.entries(desired)) {
    const assignment = `${name}=${JSON.stringify(value)}`;
    const matches = environmentAssignments(environment).filter(
      (candidate) => candidate.name === name,
    );
    const currentAssignment = matches[0];
    if (
      matches.length === 1 &&
      currentAssignment &&
      environment.slice(currentAssignment.start, currentAssignment.end) ===
        assignment
    ) {
      continue;
    }

    changedNames.push(name);
    if (matches.length === 0) {
      let separator = "";
      if (environment && !environment.endsWith("\n")) {
        separator = environment.includes("\r\n") ? "\r\n" : "\n";
      }
      environment = `${environment}${separator}${assignment}`;
      continue;
    }

    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index];
      if (!match) continue;
      const replacement = index === 0 ? assignment : "";
      environment = `${environment.slice(0, match.start)}${replacement}${environment.slice(match.end)}`;
    }
  }
  return { environment, changedNames };
};

const request = async (
  fetch: Fetch,
  url: URL,
  apiKey: string,
  init: RequestInit,
): Promise<unknown> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      "x-api-key": apiKey,
    },
  });
  if (!response.ok) {
    throw new Error(
      `${init.method} ${url.pathname} failed with HTTP ${response.status}. Inspect Dokploy for redacted details.`,
    );
  }
  const body = await response.text();
  if (!body) return;
  return JSON.parse(body);
};

export const reconcileServiceEnvironment = async (
  options: ReconcileServiceEnvironmentOptions,
): Promise<ReconcileServiceEnvironmentResult> => {
  const baseUrl = normalizeUrl(options.serverUrl);
  const expectedServerUrl = normalizeUrl(options.expectedServerUrl);
  if (baseUrl !== expectedServerUrl) {
    throw new Error(
      `Refusing to use ${baseUrl}. This manifest targets ${expectedServerUrl}.`,
    );
  }
  const applicationUrl = new URL("/api/application.one", `${baseUrl}/`);
  applicationUrl.searchParams.set("applicationId", options.applicationId);
  const applicationState = (await request(
    options.fetch,
    applicationUrl,
    options.apiKey,
    { method: "GET" },
  )) as DokployApplicationEnvironment;
  const desired = {
    ...serviceEnvironment(options.application, options.applications),
    ...options.additionalEnvironment,
  };
  const { environment, changedNames } = reconciledEnvironment(
    applicationState.env ?? "",
    desired,
  );
  if (changedNames.length === 0) return { changedNames };

  const saveUrl = new URL("/api/application.saveEnvironment", `${baseUrl}/`);
  await request(options.fetch, saveUrl, options.apiKey, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      applicationId: options.applicationId,
      env: environment,
      buildArgs: applicationState.buildArgs ?? null,
      buildSecrets: applicationState.buildSecrets ?? null,
      createEnvFile: applicationState.createEnvFile ?? false,
    }),
  });
  return { changedNames };
};
