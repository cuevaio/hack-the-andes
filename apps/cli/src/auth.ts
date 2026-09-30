import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

import {
  type CampaignAttributionHandoff,
  campaignAttributionFromOAuthState,
} from "@chofex/registration-contract";

import { config } from "./config.js";

const keychainService = "run.chofex.cli.oauth";
const keychainAccount = "credentials";

export interface Credentials {
  readonly accessToken: string;
  readonly campaignAttribution?: CampaignAttributionHandoff;
  readonly refreshToken?: string;
  readonly expiresAt?: number;
}

interface TokenResponse {
  readonly access_token?: unknown;
  readonly refresh_token?: unknown;
  readonly expires_in?: unknown;
  readonly error?: unknown;
  readonly error_description?: unknown;
}

interface AuthorizationCallback {
  readonly authorizationCode: string;
  readonly campaignAttribution?: CampaignAttributionHandoff;
}

export const pkceChallenge = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

export const createPkce = (): { verifier: string; challenge: string } => {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
};

export const macOSCredentialSaveArgs = (value: string): string[] => [
  "add-generic-password",
  "-U",
  "-a",
  keychainAccount,
  "-s",
  keychainService,
  "-w",
  value,
];

export const revocationToken = (credentials: Credentials): string =>
  credentials.refreshToken ?? credentials.accessToken;

const invalidClientError = (description: string): Error => {
  let detail = "";
  if (description) {
    detail = `: ${description.replace(/[.\s]+$/, "")}`;
  }
  return new Error(
    `Chofex OAuth client is unavailable${detail}. Check that the CLI OAuth application still exists in Clerk and update the CLI configuration.`,
  );
};

export const assertAuthorizationClient = async (
  authorizationUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> => {
  let url = authorizationUrl;
  for (let hop = 0; hop < 5; hop += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        redirect: "manual",
        headers: { accept: "application/json, text/html" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return;
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }
    if (response.ok) return;
    const body = (await response.json().catch(() => ({}))) as TokenResponse;
    if (body.error === "invalid_client") {
      let description = "";
      if (typeof body.error_description === "string") {
        description = body.error_description;
      }
      throw invalidClientError(description);
    }
    return;
  }
};

export const windowsCredentialScript = (
  action: "read" | "save" | "delete",
): string => {
  const loadTypes =
    "$ErrorActionPreference='Stop';" +
    "$null=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime];" +
    "$null=[Windows.Security.Credentials.PasswordCredential,Windows.Security.Credentials,ContentType=WindowsRuntime];";
  const prefix = `${loadTypes}$v=New-Object Windows.Security.Credentials.PasswordVault;`;
  if (action === "read") {
    return `${prefix}$c=$v.Retrieve('${keychainService}','${keychainAccount}');$c.RetrievePassword();[Console]::Out.Write($c.Password)`;
  }
  if (action === "delete") {
    return `${prefix}$c=$v.Retrieve('${keychainService}','${keychainAccount}');$v.Remove($c)`;
  }
  return `${prefix}$p=[Console]::In.ReadToEnd().Trim();$v.Add((New-Object Windows.Security.Credentials.PasswordCredential('${keychainService}','${keychainAccount}',$p)));$saved=$v.Retrieve('${keychainService}','${keychainAccount}');$saved.RetrievePassword();if($saved.Password-ne$p){throw 'Credential verification failed'}`;
};

const runCommand = async (
  executable: string,
  args: string[],
  input?: string,
): Promise<string> =>
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else
        reject(
          new Error(
            stderr.trim() || `${executable} exited with status ${code}`,
          ),
        );
    });
    child.stdin.end(input);
  });

const credentialStore = async (
  action: "read" | "save" | "delete",
  value?: string,
): Promise<string> => {
  if (process.platform === "darwin") {
    if (action === "read") {
      return runCommand("security", [
        "find-generic-password",
        "-a",
        keychainAccount,
        "-s",
        keychainService,
        "-w",
      ]);
    }
    if (action === "delete") {
      return runCommand("security", [
        "delete-generic-password",
        "-a",
        keychainAccount,
        "-s",
        keychainService,
      ]);
    }
    return runCommand("security", macOSCredentialSaveArgs(value ?? ""));
  }
  if (process.platform === "linux") {
    const attributes = ["service", keychainService, "account", keychainAccount];
    if (action === "read") {
      return runCommand("secret-tool", ["lookup", ...attributes]);
    }
    if (action === "delete") {
      return runCommand("secret-tool", ["clear", ...attributes]);
    }
    return runCommand(
      "secret-tool",
      ["store", "--label=Chofex CLI", ...attributes],
      `${value}\n`,
    );
  }
  if (process.platform === "win32") {
    let input: string | undefined;
    if (action === "save") input = `${value}\n`;
    return runCommand(
      "powershell.exe",
      ["-NoProfile", "-Command", windowsCredentialScript(action)],
      input,
    );
  }
  throw new Error(`Unsupported credential store on ${process.platform}`);
};

const readCredentials = async (): Promise<Credentials | null> => {
  try {
    const value = await credentialStore("read");
    const parsed = JSON.parse(value) as Partial<Credentials>;
    if (typeof parsed.accessToken === "string") return parsed as Credentials;
    return null;
  } catch {
    return null;
  }
};

const saveCredentials = async (credentials: Credentials): Promise<void> => {
  await credentialStore("save", JSON.stringify(credentials));
};

export const tokenEndpointError = (
  status: number,
  body: TokenResponse,
): Error => {
  let description = "";
  if (typeof body.error_description === "string") {
    description = body.error_description.replace(/[.\s]+$/, "");
  }
  if (body.error === "invalid_client") {
    return invalidClientError(description);
  }
  const detail = description ? `: ${description}` : "";
  return new Error(`Clerk OAuth token endpoint returned ${status}${detail}`);
};

const credentialsFromToken = (
  body: TokenResponse,
  previousRefreshToken?: string,
  campaignAttribution?: CampaignAttributionHandoff,
): Credentials => {
  if (typeof body.access_token !== "string") {
    let detail = "";
    if (typeof body.error_description === "string") {
      detail = `: ${body.error_description}`;
    }
    throw new Error(`OAuth token exchange failed${detail}`);
  }

  let refreshToken = previousRefreshToken;
  if (typeof body.refresh_token === "string") {
    refreshToken = body.refresh_token;
  }

  let expiresAt = jwtExpiry(body.access_token);
  if (typeof body.expires_in === "number") {
    expiresAt = Date.now() + body.expires_in * 1_000;
  }

  return {
    accessToken: body.access_token,
    campaignAttribution,
    refreshToken,
    expiresAt,
  };
};

const tokenRequest = async (
  values: Record<string, string>,
): Promise<TokenResponse> => {
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) throw tokenEndpointError(response.status, body);
  return body;
};

const jwtExpiry = (token: string): number | undefined => {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString(),
    ) as { exp?: unknown };
    if (typeof payload.exp === "number") return payload.exp * 1_000;
    return undefined;
  } catch {
    return undefined;
  }
};

const refresh = async (credentials: Credentials): Promise<Credentials> => {
  if (!credentials.refreshToken) {
    throw new Error("Session expired. Run `andes login` again.");
  }
  const body = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: credentials.refreshToken,
    client_id: config.oauthClientId,
  });
  const updated = credentialsFromToken(
    body,
    credentials.refreshToken,
    credentials.campaignAttribution,
  );
  await saveCredentials(updated);
  return updated;
};

export const authentication = async (
  forceRefresh = false,
): Promise<Credentials> => {
  if (process.env.CHOFEX_TOKEN) {
    return { accessToken: process.env.CHOFEX_TOKEN };
  }
  const credentials = await readCredentials();
  if (!credentials) throw new Error("Not logged in. Run `andes login`.");
  if (
    forceRefresh ||
    (credentials.expiresAt !== undefined &&
      credentials.expiresAt <= Date.now() + 30_000)
  ) {
    return await refresh(credentials);
  }
  return credentials;
};

export const accessToken = async (forceRefresh = false): Promise<string> =>
  (await authentication(forceRefresh)).accessToken;

export const bridgedAuthorizationUrl = (
  bridgeUrl: string,
  authorizationUrl: string,
): string => {
  const bridge = new URL(bridgeUrl);
  bridge.search = new URL(authorizationUrl).search;
  return bridge.toString();
};

export const browserCommand = (
  url: string,
  platform: NodeJS.Platform = process.platform,
): [string, string[]] => {
  if (platform === "darwin") return ["open", [url]];
  if (platform === "win32") {
    return ["rundll32.exe", ["url.dll,FileProtocolHandler", url]];
  }
  return ["xdg-open", [url]];
};

export const openBrowser = (url: string): void => {
  const [executable, args] = browserCommand(url);
  const child = spawn(executable, args, { detached: true, stdio: "ignore" });
  child.once("error", () => {
    // The URL was already printed, so the user can open it manually.
  });
  child.unref();
};

export const assertInteractiveLogin = (
  interactive = process.stdin.isTTY === true,
): void => {
  if (!interactive) {
    throw new Error(
      "OAuth login requires an interactive terminal. Run `andes login` yourself in a local terminal and leave it open until the browser confirms login.",
    );
  }
};

export const login = async (): Promise<string> => {
  assertInteractiveLogin();
  const { verifier, challenge } = createPkce();
  const state = randomBytes(24).toString("base64url");
  let finish!: (value: AuthorizationCallback) => void;
  let fail!: (reason: Error) => void;
  const code = new Promise<AuthorizationCallback>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    const error = url.searchParams.get("error");
    const authorizationCode = url.searchParams.get("code");
    const attributionState = campaignAttributionFromOAuthState(
      state,
      url.searchParams.get("state"),
    );
    if (!attributionState.valid || error || !authorizationCode) {
      response
        .writeHead(400, { "content-type": "text/plain" })
        .end("Chofex login failed. You can close this window.");
      let message = "Invalid OAuth callback";
      if (error) message = `Authorization failed: ${error}`;
      fail(new Error(message));
      return;
    }
    response
      .writeHead(200, { "content-type": "text/plain" })
      .end("Chofex login complete. You can close this window.");
    finish({
      authorizationCode,
      campaignAttribution: attributionState.handoff,
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start OAuth callback server");
  }
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
  const authorizationUrl = new URL(config.authorizationUrl);
  authorizationUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: config.oauthClientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: "openid profile email offline_access",
  }).toString();

  try {
    await assertAuthorizationClient(authorizationUrl.toString());
  } catch (error) {
    server.close();
    throw error;
  }
  const browserUrl = bridgedAuthorizationUrl(
    config.authorizationBridgeUrl,
    authorizationUrl.toString(),
  );
  console.error(
    `Sign in here (waiting up to five minutes):\n\n  ${browserUrl}\n\nIf the browser did not open automatically, open that URL yourself.`,
  );
  openBrowser(browserUrl);
  const timeout = setTimeout(
    () => fail(new Error("Login timed out after five minutes")),
    300_000,
  );
  try {
    const callback = await code;
    const body = await tokenRequest({
      grant_type: "authorization_code",
      client_id: config.oauthClientId,
      code: callback.authorizationCode,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const credentials = credentialsFromToken(
      body,
      undefined,
      callback.campaignAttribution,
    );
    await saveCredentials(credentials);
    return credentials.accessToken;
  } finally {
    clearTimeout(timeout);
    server.close();
  }
};

export const logout = async (): Promise<void> => {
  const credentials = await readCredentials();
  let revocationError: Error | null = null;
  try {
    if (credentials) {
      const response = await fetch(config.revocationUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: revocationToken(credentials),
          client_id: config.oauthClientId,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`Clerk OAuth revocation returned ${response.status}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      revocationError = error;
    } else {
      revocationError = new Error("OAuth revocation failed");
    }
  }
  let deletionError: Error | null = null;
  if (credentials) {
    try {
      await credentialStore("delete");
    } catch (error) {
      if (error instanceof Error) {
        deletionError = error;
      } else {
        deletionError = new Error("Could not delete local OAuth credentials");
      }
    }
  }
  if (revocationError) throw revocationError;
  if (deletionError) throw deletionError;
};
