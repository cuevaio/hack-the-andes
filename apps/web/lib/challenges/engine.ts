import {
  blackBoxChallengeSlug,
  brokenAgentChallengeSlug,
  type ChallengeScore,
  type ChallengeScoreBreakdown,
  type ChallengeSlug,
  type Shipment,
} from "@chofex/challenges-contract";
import {
  type LodgeBooking,
  mountainLodgeChallengeSlug,
  mountainLodgeChallengeVersion,
} from "@chofex/challenges-contract/mountain-lodge";
import {
  type PowerReading,
  powerGridChallengeSlug,
  powerGridChallengeVersion,
} from "@chofex/challenges-contract/power-grid";
import {
  slowServiceChallengeSlug,
  slowServiceChallengeVersion,
} from "@chofex/challenges-contract/slow-service";

export const currentChallengeVersion = "black-box-v2" as const;
export const brokenAgentChallengeVersion = "broken-agent-v3" as const;
export type CurrentChallengeVersion =
  | typeof mountainLodgeChallengeVersion
  | typeof powerGridChallengeVersion
  | typeof currentChallengeVersion
  | typeof brokenAgentChallengeVersion
  | typeof slowServiceChallengeVersion;

export const challengeEngineQueryTimeoutMs = 8_000;
export const challengeEngineEvaluateTimeoutMs = 25_000;
export const slowServiceEngineEvaluateTimeoutMs = 330_000;

export const currentChallengeVersionFor = (
  slug: ChallengeSlug | string,
): CurrentChallengeVersion | undefined => {
  if (slug === mountainLodgeChallengeSlug) return mountainLodgeChallengeVersion;
  if (slug === powerGridChallengeSlug) return powerGridChallengeVersion;
  if (slug === blackBoxChallengeSlug) return currentChallengeVersion;
  if (slug === brokenAgentChallengeSlug) return brokenAgentChallengeVersion;
  if (slug === slowServiceChallengeSlug) return slowServiceChallengeVersion;
};

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface ChallengeEngineOptions {
  readonly baseUrl: string;
  readonly apiSecret: string;
  readonly fetch: Fetch;
}

export class ChallengeEngineError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ChallengeEngineError";
    this.status = status;
    this.code = code;
  }
}

const record = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  return value as Record<string, unknown>;
};

const finiteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
};

const parseCapability = (
  value: unknown,
): { earned: number; available: number } | undefined => {
  const capability = record(value);
  const earned = finiteNumber(capability?.earned);
  const available = finiteNumber(capability?.available);
  if (earned === undefined || available === undefined) return;
  return { earned, available };
};

const parseBreakdown = (
  value: unknown,
): ChallengeScoreBreakdown | undefined => {
  if (value === undefined) return;
  const breakdown = record(value);
  if (!breakdown) return;
  const coreBehavior = parseCapability(breakdown.coreBehavior);
  const persistence = parseCapability(breakdown.persistence);
  const concurrency = parseCapability(breakdown.concurrency);
  const failureRecovery = parseCapability(breakdown.failureRecovery);
  const idempotency = parseCapability(breakdown.idempotency);
  const regressionSafety = parseCapability(breakdown.regressionSafety);
  const performance = parseCapability(breakdown.performance);
  if (
    !coreBehavior ||
    !persistence ||
    !concurrency ||
    !failureRecovery ||
    !idempotency ||
    !regressionSafety ||
    !performance
  ) {
    return;
  }
  return {
    coreBehavior,
    persistence,
    concurrency,
    failureRecovery,
    idempotency,
    regressionSafety,
    performance,
  };
};

const parseError = (status: number, value: unknown): ChallengeEngineError => {
  const response = record(value);
  const error = record(response?.error);
  if (typeof error?.code === "string" && typeof error.message === "string") {
    return new ChallengeEngineError(status, error.code, error.message);
  }
  return new ChallengeEngineError(
    502,
    "CHALLENGE_ENGINE_ERROR",
    "The challenge engine returned an invalid response",
  );
};

const parseScore = (value: unknown): ChallengeScore | undefined => {
  const score = record(value);
  if (!score) return;
  const accuracy = finiteNumber(score.accuracy);
  const exactCount = finiteNumber(score.exactCount);
  const sampleSize = finiteNumber(score.sampleSize);
  const meanError = finiteNumber(score.meanError);
  const queriesUsed = finiteNumber(score.queriesUsed);
  const runtimeMs = finiteNumber(score.runtimeMs);
  const executionCost = finiteNumber(score.executionCost);
  const breakdown = parseBreakdown(score.breakdown);
  if (
    accuracy === undefined ||
    exactCount === undefined ||
    sampleSize === undefined ||
    meanError === undefined ||
    queriesUsed === undefined ||
    runtimeMs === undefined
  ) {
    return;
  }
  const parsed: ChallengeScore = {
    accuracy,
    exactCount,
    sampleSize,
    meanError,
    queriesUsed,
    runtimeMs,
  };
  if (breakdown) {
    if (executionCost === undefined) return;
    return { ...parsed, breakdown, executionCost };
  }
  if (executionCost !== undefined) return { ...parsed, executionCost };
  return parsed;
};

const readEngineResponse = async (response: Response): Promise<unknown> => {
  const maximumResponseBytes = 1_048_576;
  const declaredBytes = Number(response.headers.get("content-length"));
  if (declaredBytes > maximumResponseBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Engine response exceeds 1 MiB");
  }
  if (!response.body) throw new Error("Empty engine response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let contents = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximumResponseBytes) {
        throw new Error("Engine response exceeds 1 MiB");
      }
      contents += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(contents + decoder.decode()) as unknown;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
};

export const createChallengeEngine = (options: ChallengeEngineOptions) => {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const post = async (
    path: string,
    payload: unknown,
    timeoutMs: number,
  ): Promise<unknown> => {
    let response: Response;
    try {
      response = await options.fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiSecret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      console.error("Challenge engine request failed", error);
      throw new ChallengeEngineError(
        503,
        "CHALLENGE_ENGINE_UNAVAILABLE",
        "The challenge engine is temporarily unavailable",
      );
    }

    let result: unknown;
    try {
      result = await readEngineResponse(response);
    } catch {
      throw new ChallengeEngineError(
        502,
        "CHALLENGE_ENGINE_ERROR",
        "The challenge engine returned an invalid response",
      );
    }
    if (!response.ok) throw parseError(response.status, result);
    return result;
  };

  const queryOracle = async (
    payload:
      | {
          challengeVersion: typeof currentChallengeVersion;
          participantKey: string;
          input: Shipment;
        }
      | {
          challengeVersion: typeof mountainLodgeChallengeVersion;
          participantKey: string;
          input: LodgeBooking;
        }
      | {
          challengeVersion: typeof powerGridChallengeVersion;
          participantKey: string;
          input: PowerReading;
        },
  ): Promise<number> => {
    const result = record(
      await post(
        "/api/v1/query",
        { version: 1, ...payload },
        challengeEngineQueryTimeoutMs,
      ),
    );
    const output = finiteNumber(result?.output);
    if (result?.version !== 1 || output === undefined)
      throw new ChallengeEngineError(
        502,
        "CHALLENGE_ENGINE_ERROR",
        "The challenge engine returned an invalid query response",
      );
    return output;
  };
  return {
    query: (participantKey: string, input: Shipment) =>
      queryOracle({
        participantKey,
        input,
        challengeVersion: currentChallengeVersion,
      }),
    queryMountainLodge: (participantKey: string, input: LodgeBooking) =>
      queryOracle({
        participantKey,
        input,
        challengeVersion: mountainLodgeChallengeVersion,
      }),
    queryPowerGrid: (participantKey: string, input: PowerReading) =>
      queryOracle({
        participantKey,
        input,
        challengeVersion: powerGridChallengeVersion,
      }),
    evaluate: async (
      challengeVersion: CurrentChallengeVersion,
      participantKey: string,
      source: string,
      queriesUsed: number,
    ): Promise<ChallengeScore> => {
      const result = record(
        await post(
          "/api/v1/evaluate",
          {
            version: 1,
            challengeVersion,
            participantKey,
            source,
            queriesUsed,
          },
          challengeVersion === slowServiceChallengeVersion
            ? slowServiceEngineEvaluateTimeoutMs
            : challengeEngineEvaluateTimeoutMs,
        ),
      );
      const score = parseScore(result?.score);
      if (result?.version !== 1 || !score) {
        throw new ChallengeEngineError(
          502,
          "CHALLENGE_ENGINE_ERROR",
          "The challenge engine returned an invalid evaluation response",
        );
      }
      if (challengeVersion === slowServiceChallengeVersion)
        return { ...score, challengeSlug: slowServiceChallengeSlug };
      return score;
    },
  };
};

const requiredEnvironmentValue = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export const challengeEngine = () =>
  createChallengeEngine({
    baseUrl: requiredEnvironmentValue("CHALLENGE_ENGINE_URL"),
    apiSecret: requiredEnvironmentValue("CHALLENGE_ENGINE_API_SECRET"),
    fetch: globalThis.fetch,
  });
