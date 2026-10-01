import {
  type ChallengeAttemptView,
  ChallengeAttemptViewSchema,
  type ChallengeCatalogResponse,
  ChallengeCatalogSchema,
  type ChallengeEvaluationResult,
  ChallengeEvaluationResultSchema,
  type ChallengeLocalTestResult,
  ChallengeLocalTestResultSchema,
  type ChallengeQueryResult,
  ChallengeQueryResultSchema,
  type ChallengeRanking,
  ChallengeRankingSchema,
} from "@chofex/challenges-contract";
import {
  ApiFailureSchema,
  type ApiSuccess,
  ApiSuccessSchema,
  type BadgeRegenerationInput,
  type BadgeResult,
  BadgeResultSchema,
  type CampaignAttributionHandoff,
  type CreatedRegistration,
  CreatedRegistrationSchema,
  type CurrentUser,
  CurrentUserSchema,
  campaignAttributionHandoffHeader,
  campaignAttributionHandoffValue,
  type PictureUpload,
  PictureUploadGrantSchema,
  PictureUploadSchema,
  type RegistrationResult,
  RegistrationResultSchema,
} from "@chofex/registration-contract";
import { Effect, Result, Schema } from "effect";

import { authentication, type Credentials } from "./auth.js";
import { type CliError, cliError } from "./errors.js";

export const authenticationRecoveryMessage = (
  code: string,
  message: string,
): string => {
  if (code !== "AUTHENTICATION_REQUIRED") return message;
  if (message !== "Authentication failed") return message;
  return `${message}. If login just succeeded, update the CLI with \`andes update\` or \`npm install --global hacktheandes-cli@latest\`, then run \`andes logout\` and \`andes login\`.`;
};

export interface ApiClientOptions {
  readonly apiUrl: string;
  readonly authenticate?: (forceRefresh?: boolean) => Promise<Credentials>;
  readonly campaignAttribution?: CampaignAttributionHandoff;
  readonly token?: string;
}

const endpoint = (apiUrl: string, path: string): string =>
  `${apiUrl.replace(/\/$/, "")}${path}`;

const resolveAuthentication = (
  suppliedToken: string | undefined,
  campaignAttribution: CampaignAttributionHandoff | undefined,
  authenticate: (forceRefresh?: boolean) => Promise<Credentials>,
  forceRefresh = false,
): Effect.Effect<Credentials, CliError> => {
  if (suppliedToken) {
    return Effect.succeed({ accessToken: suppliedToken, campaignAttribution });
  }
  return Effect.tryPromise({
    try: () => authenticate(forceRefresh),
    catch: (error) => cliError("AUTHENTICATION_REQUIRED", String(error), false),
  });
};

const defaultRequestTimeoutMs = 20_000;
export const challengeEvaluateRequestTimeoutMs = 30_000;

const sendRequest = (
  options: ApiClientOptions,
  path: string,
  init: RequestInit,
  credentials?: Credentials,
  timeoutMs = defaultRequestTimeoutMs,
): Effect.Effect<Response, CliError> =>
  Effect.tryPromise({
    try: () => {
      const headers = new Headers(init.headers);
      headers.set("accept", "application/json");
      if (credentials) {
        headers.set("authorization", `Bearer ${credentials.accessToken}`);
        if (credentials.campaignAttribution) {
          const handoff = campaignAttributionHandoffValue(
            credentials.campaignAttribution,
          );
          if (handoff) headers.set(campaignAttributionHandoffHeader, handoff);
        }
      }
      headers.set("x-request-id", crypto.randomUUID());
      if (init.body !== undefined) {
        headers.set("content-type", "application/json");
      }
      return fetch(endpoint(options.apiUrl, path), {
        ...init,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    },
    catch: (error) =>
      cliError(
        "NETWORK_ERROR",
        `Could not reach the registration API: ${String(error)}`,
        true,
      ),
  });

const decodeHttpBody = Effect.fn("decodeHttpBody")(function* <A, R>(
  response: Response,
  decodeResponse: (input: unknown) => Effect.Effect<ApiSuccess<A>, unknown, R>,
): Effect.fn.Return<ApiSuccess<A>, CliError, R> {
  const body = yield* Effect.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: () =>
      cliError(
        "INVALID_API_RESPONSE",
        `The API returned a non-JSON response (${response.status})`,
        response.status >= 500,
      ),
  });

  if (!response.ok) {
    const failure = Schema.decodeUnknownResult(ApiFailureSchema)(body);
    if (Result.isSuccess(failure)) {
      return yield* cliError(
        failure.success.error.code,
        authenticationRecoveryMessage(
          failure.success.error.code,
          failure.success.error.message,
        ),
        failure.success.error.retryable,
        failure.success.error.details,
        failure.success.requestId,
      );
    }
    return yield* cliError(
      "HTTP_ERROR",
      `The API request failed with status ${response.status}`,
      response.status >= 500,
    );
  }

  return yield* decodeResponse(body).pipe(
    Effect.mapError((error) =>
      cliError(
        "INVALID_API_RESPONSE",
        "The API response did not match protocol version 1",
        false,
        { issues: String(error) },
      ),
    ),
  );
});

const request = Effect.fn("apiRequest")(function* <A, R>(
  options: ApiClientOptions,
  path: string,
  init: RequestInit,
  decodeResponse: (input: unknown) => Effect.Effect<ApiSuccess<A>, unknown, R>,
  timeoutMs = defaultRequestTimeoutMs,
): Effect.fn.Return<ApiSuccess<A>, CliError, R> {
  const suppliedToken = options.token ?? process.env.CHOFEX_TOKEN;
  const authenticate = options.authenticate ?? authentication;
  const credentials = yield* resolveAuthentication(
    suppliedToken,
    options.campaignAttribution,
    authenticate,
  );
  let response = yield* sendRequest(
    options,
    path,
    init,
    credentials,
    timeoutMs,
  );
  if (response.status === 401 && !suppliedToken) {
    const refreshed = yield* resolveAuthentication(
      undefined,
      undefined,
      authenticate,
      true,
    ).pipe(
      Effect.map((value) => ({ ok: true as const, value })),
      Effect.catch(() => Effect.succeed({ ok: false as const })),
    );
    if (refreshed.ok) {
      response = yield* sendRequest(
        options,
        path,
        init,
        refreshed.value,
        timeoutMs,
      );
    }
  }
  return yield* decodeHttpBody(response, decodeResponse);
});

const publicRequest = Effect.fn("publicApiRequest")(function* <A, R>(
  options: ApiClientOptions,
  path: string,
  init: RequestInit,
  decodeResponse: (input: unknown) => Effect.Effect<ApiSuccess<A>, unknown, R>,
): Effect.fn.Return<ApiSuccess<A>, CliError, R> {
  const response = yield* sendRequest(options, path, init);
  return yield* decodeHttpBody(response, decodeResponse);
});

const decodeCreatedRegistration = Schema.decodeUnknownEffect(
  ApiSuccessSchema(CreatedRegistrationSchema),
);
const decodeBadgeResult = Schema.decodeUnknownEffect(
  ApiSuccessSchema(BadgeResultSchema),
);
const decodeCurrentUser = Schema.decodeUnknownEffect(
  ApiSuccessSchema(CurrentUserSchema),
);
const decodeRegistrationResult = Schema.decodeUnknownEffect(
  ApiSuccessSchema(RegistrationResultSchema),
);
const decodePictureUploadGrant = Schema.decodeUnknownEffect(
  ApiSuccessSchema(PictureUploadGrantSchema),
);
const decodePictureUpload = Schema.decodeUnknownEffect(
  ApiSuccessSchema(PictureUploadSchema),
);
const decodeChallengeCatalog = Schema.decodeUnknownEffect(
  ApiSuccessSchema(ChallengeCatalogSchema),
);
const decodeChallengeAttempt = Schema.decodeUnknownEffect(
  ApiSuccessSchema(ChallengeAttemptViewSchema),
);
const decodeChallengeQuery = Schema.decodeUnknownEffect(
  ApiSuccessSchema(ChallengeQueryResultSchema),
);
const decodeChallengeTest = Schema.decodeUnknownEffect(
  ApiSuccessSchema(ChallengeLocalTestResultSchema),
);
const decodeChallengeEvaluation = Schema.decodeUnknownEffect(
  ApiSuccessSchema(ChallengeEvaluationResultSchema),
);
const decodeChallengeRanking = Schema.decodeUnknownEffect(
  ApiSuccessSchema(ChallengeRankingSchema),
);

export const register = (
  options: ApiClientOptions,
  input: unknown,
): Effect.Effect<ApiSuccess<CreatedRegistration>, CliError> =>
  request(
    options,
    "/api/v1/registrations",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    decodeCreatedRegistration,
  );

export const getCurrentUser = (
  options: ApiClientOptions,
): Effect.Effect<ApiSuccess<CurrentUser>, CliError> =>
  request(options, "/api/v1/me", { method: "GET" }, decodeCurrentUser);

export const getRegistration = (
  options: ApiClientOptions,
): Effect.Effect<ApiSuccess<RegistrationResult>, CliError> =>
  request(
    options,
    "/api/v1/registration",
    { method: "GET" },
    decodeRegistrationResult,
  );

export const selectRegistrationCountry = (
  options: ApiClientOptions,
  countryCode: string,
): Effect.Effect<ApiSuccess<RegistrationResult>, CliError> =>
  request(
    options,
    "/api/v1/registration/country",
    {
      method: "PUT",
      body: JSON.stringify({ countryCode }),
    },
    decodeRegistrationResult,
  );

export const getBadge = (
  options: ApiClientOptions,
): Effect.Effect<ApiSuccess<BadgeResult>, CliError> =>
  request(options, "/api/v1/badge", { method: "GET" }, decodeBadgeResult);

export const regenerateBadge = (
  options: ApiClientOptions,
  input: BadgeRegenerationInput,
): Effect.Effect<ApiSuccess<BadgeResult>, CliError> =>
  request(
    options,
    "/api/v1/badge",
    { method: "PATCH", body: JSON.stringify(input) },
    decodeBadgeResult,
  );

export const confirmAttendance = (
  options: ApiClientOptions,
  input: unknown,
): Effect.Effect<ApiSuccess<RegistrationResult>, CliError> =>
  request(
    options,
    "/api/v1/registration/attendance",
    { method: "PUT", body: JSON.stringify(input) },
    decodeRegistrationResult,
  );

export const beginPictureUpload = (
  options: ApiClientOptions,
  input: {
    readonly contentType: PictureUpload["contentType"];
    readonly size: number;
  },
) =>
  request(
    options,
    "/api/v1/profile-picture",
    { method: "POST", body: JSON.stringify(input) },
    decodePictureUploadGrant,
  );

export const completePictureUpload = (
  options: ApiClientOptions,
  input: { readonly pathname: string; readonly url: string },
) =>
  request(
    options,
    "/api/v1/profile-picture",
    { method: "PUT", body: JSON.stringify(input) },
    decodePictureUpload,
  );

export const saveRegistrationDraft = (
  options: ApiClientOptions,
  input: unknown,
): Effect.Effect<ApiSuccess<RegistrationResult>, CliError> =>
  request(
    options,
    "/api/v1/registration",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    decodeRegistrationResult,
  );

export const submitRegistration = (
  options: ApiClientOptions,
): Effect.Effect<ApiSuccess<CreatedRegistration>, CliError> =>
  request(
    options,
    "/api/v1/registration/submit",
    { method: "POST" },
    decodeCreatedRegistration,
  );

export const listChallenges = (
  options: ApiClientOptions,
): Effect.Effect<ApiSuccess<ChallengeCatalogResponse>, CliError> =>
  publicRequest(
    options,
    "/api/v1/challenges",
    { method: "GET" },
    decodeChallengeCatalog,
  );

export const getChallengeAttempt = (
  options: ApiClientOptions,
  slug: string,
): Effect.Effect<ApiSuccess<ChallengeAttemptView>, CliError> =>
  request(
    options,
    `/api/v1/challenges/${slug}`,
    { method: "GET" },
    decodeChallengeAttempt,
  );

export const queryChallenge = (
  options: ApiClientOptions,
  slug: string,
  input: unknown,
): Effect.Effect<ApiSuccess<ChallengeQueryResult>, CliError> =>
  request(
    options,
    `/api/v1/challenges/${slug}/query`,
    { method: "POST", body: JSON.stringify(input) },
    decodeChallengeQuery,
  );

export const testChallenge = (
  options: ApiClientOptions,
  slug: string,
  input: unknown,
): Effect.Effect<ApiSuccess<ChallengeLocalTestResult>, CliError> =>
  request(
    options,
    `/api/v1/challenges/${slug}/test`,
    { method: "POST", body: JSON.stringify(input) },
    decodeChallengeTest,
  );

export const evaluateChallenge = (
  options: ApiClientOptions,
  slug: string,
  input: unknown,
): Effect.Effect<ApiSuccess<ChallengeEvaluationResult>, CliError> =>
  request(
    options,
    `/api/v1/challenges/${slug}/evaluate`,
    { method: "POST", body: JSON.stringify(input) },
    decodeChallengeEvaluation,
    challengeEvaluateRequestTimeoutMs,
  );

export const getChallengeRanking = (
  options: ApiClientOptions,
  slug: string,
): Effect.Effect<ApiSuccess<ChallengeRanking>, CliError> =>
  publicRequest(
    options,
    `/api/v1/challenges/${slug}/ranking`,
    { method: "GET" },
    decodeChallengeRanking,
  );
