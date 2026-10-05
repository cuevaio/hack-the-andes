import { createHash } from "node:crypto";
import {
  BrokenAgentEvaluationSolutionSchema,
  blackBoxChallengeSlug,
  brokenAgentChallengeSlug,
  type ChallengeAttemptView,
  type ChallengeCatalogItem,
  type ChallengeDefinition,
  type ChallengeEvaluationResult,
  type ChallengeLocalTestResult,
  type ChallengeObservation,
  type ChallengeQueryResult,
  type ChallengeScore,
  type ChallengeSolution,
  challengeAdmissionNotice,
  challengeBySlug,
  challengeCatalog,
  compareChallengeScores,
  type EvaluationApprovalReview,
  isChallengeRankingVisibleAt,
  JavascriptSourceSolutionSchema,
  type ParticipantChallengeMilestone,
  type ParticipantChallengeProgress,
  ShipmentSchema,
  SlowServiceEvaluationSolutionSchema,
} from "@chofex/challenges-contract";
import {
  PowerReadingSchema,
  powerGridChallengeSlug,
} from "@chofex/challenges-contract/power-grid";
import {
  isSlowServiceSourceWithinLimit,
  slowServiceChallengeSlug,
} from "@chofex/challenges-contract/slow-service";
import { db } from "@chofex/db";
import { and, asc, desc, eq, inArray, sql } from "@chofex/db/orm";
import {
  challengeAttempts,
  challengeEvaluations,
  challengeObservations,
} from "@chofex/db/schema";
import { Schema } from "effect";

import { isUniqueViolation } from "../db-errors";
import { HttpError } from "../registration/http";
import { participantIdFor } from "../registration/participants";
import { runBrokenAgentPublicTests } from "./broken-agent-public";
import { catalogItemFor, rankingPathFor } from "./catalog";
import { challengesForceOpen, currentChallengeTime } from "./clock";
import { hasChallengeEarlyAccess } from "./early-access";
import {
  ChallengeEngineError,
  challengeEngine,
  currentChallengeVersionFor,
  slowServiceEngineEvaluateTimeoutMs,
} from "./engine";
import {
  consumeEvaluationApproval,
  createOrReuseEvaluationApproval,
  releaseEvaluationApproval,
} from "./evaluation-approvals";
import { isConfirmedSolutionExecutionFailure } from "./failure-policy";
import { requireChallengeParticipationOpen } from "./participation-policy";
import {
  challengeCompletionDurationMs,
  challengeProgressStatus,
  earliestChallengeCompletionAt,
} from "./progress";
import { rankedEvaluationsFor, rankForAttempt } from "./ranking";
import { competitionRanksForEvaluations } from "./ranking-policy";
import {
  type ChallengeReservation,
  completeEvaluationReservation,
  completeQueryReservation,
  consumeFailedEvaluationReservation,
  findChallengeObservation,
  releaseChallengeReservation,
  reserveChallengeUse,
} from "./reservations";
import { runPowerGridSolution, runShippingSolution } from "./sandbox";
import { participantVisibleScore, scoreFromStored } from "./score";
import { attemptSeed, shareCodeFromSeed } from "./seed";
import { runSlowServicePublicTests } from "./slow-service-public";

type AttemptRecord = typeof challengeAttempts.$inferSelect;
type EvaluationRecord = typeof challengeEvaluations.$inferSelect;

const engineHttpError = (
  error: ChallengeEngineError,
  kind: "query" | "evaluation" = "evaluation",
): HttpError => {
  if (error.status === 422 && error.code === "SOLUTION_DID_NOT_COMPLETE") {
    return new HttpError(422, error.code, error.message, false);
  }
  if (isConfirmedSolutionExecutionFailure(error)) {
    return new HttpError(422, error.code, error.message, false);
  }
  if (kind === "query") {
    return new HttpError(
      503,
      "CHALLENGE_ENGINE_UNAVAILABLE",
      "The challenge engine is temporarily unavailable",
      true,
    );
  }
  return engineUnavailableError();
};

const engineUnavailableError = (): HttpError =>
  new HttpError(
    503,
    "CHALLENGE_ENGINE_UNAVAILABLE",
    "The official evaluation could not be completed. This attempt was not consumed.",
    true,
  );

const duplicateQueryError = (): HttpError =>
  new HttpError(
    409,
    "DUPLICATE_QUERY",
    "Esa lectura ya está en tu cuaderno. Cambia al menos un campo; las consultas repetidas no consumen presupuesto.",
    false,
  );

const parseInput = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown,
): S["Type"] => {
  try {
    return Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(
      input,
    );
  } catch (error) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Input validation failed",
      false,
      { issues: String(error) },
    );
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const reviewRequiredError = (sourceDigest: string): HttpError =>
  new HttpError(
    428,
    "HUMAN_REVIEW_REQUIRED",
    "Broken Agent requires the participant's engineering review before an official evaluation",
    false,
    {
      sourceDigest,
      requiredFields: [
        "sourceDigest",
        "focus",
        "failureScenario",
        "evidence",
        "decision",
        "confidence",
        "remainingRisk",
      ],
      next: "Discuss the implementation with the participant, preserve their answers in review.json, then retry with --review review.json.",
    },
  );

const requireChallenge = (slug: string): ChallengeDefinition => {
  const challenge = challengeBySlug(slug);
  if (!challenge) {
    throw new HttpError(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
  }
  return challenge;
};

const requirePlayableChallenge = async (
  slug: string,
  now: Date,
  clerkUserId: string,
): Promise<ChallengeDefinition> => {
  const challenge = requireChallenge(slug);
  return requireChallengeParticipationOpen(
    challenge,
    now,
    challengesForceOpen(),
    await hasChallengeEarlyAccess(clerkUserId, slug),
  );
};

const requireImplementedChallenge = async (
  slug: string,
  now: Date,
  clerkUserId: string,
): Promise<ChallengeDefinition> => {
  const challenge = await requirePlayableChallenge(slug, now, clerkUserId);
  if (
    challenge.slug !== blackBoxChallengeSlug &&
    challenge.slug !== powerGridChallengeSlug &&
    challenge.slug !== brokenAgentChallengeSlug &&
    challenge.slug !== slowServiceChallengeSlug
  ) {
    throw new HttpError(
      404,
      "CHALLENGE_NOT_AVAILABLE",
      `${challenge.title} is not available yet`,
    );
  }
  return challenge;
};

const versionForChallenge = (challenge: ChallengeDefinition): string => {
  const version = currentChallengeVersionFor(challenge.slug);
  if (!version) {
    throw new HttpError(
      404,
      "CHALLENGE_NOT_AVAILABLE",
      `${challenge.title} is not available yet`,
    );
  }
  return version;
};

const createAttempt = async (
  participantId: string,
  challenge: ChallengeDefinition,
): Promise<AttemptRecord> => {
  const challengeVersion = versionForChallenge(challenge);
  const seed = attemptSeed(
    participantId,
    `${challenge.slug}:${challengeVersion}`,
  );
  for (let length = 4; length <= 8; length += 1) {
    try {
      const [created] = await db
        .insert(challengeAttempts)
        .values({
          participantId,
          challengeSlug: challenge.slug,
          challengeVersion,
          shareCode: shareCodeFromSeed(seed, length),
          queriesLimit: challenge.queryLimit,
          evaluationsLimit: challenge.evaluationLimit,
        })
        .returning();
      if (created) return created;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const [existing] = await db
        .select()
        .from(challengeAttempts)
        .where(
          and(
            eq(challengeAttempts.participantId, participantId),
            eq(challengeAttempts.challengeSlug, challenge.slug),
            eq(challengeAttempts.challengeVersion, challengeVersion),
          ),
        )
        .limit(1);
      if (existing) return existing;
    }
  }
  throw new Error("Could not allocate a challenge share code");
};

const attemptFor = async (
  participantId: string,
  challenge: ChallengeDefinition,
): Promise<AttemptRecord> => {
  const challengeVersion = versionForChallenge(challenge);
  const [existing] = await db
    .select()
    .from(challengeAttempts)
    .where(
      and(
        eq(challengeAttempts.participantId, participantId),
        eq(challengeAttempts.challengeSlug, challenge.slug),
        eq(challengeAttempts.challengeVersion, challengeVersion),
      ),
    )
    .limit(1);
  if (existing) return existing;
  return createAttempt(participantId, challenge);
};

const releaseAfterFailure = async (
  reservation: ChallengeReservation,
  kind: "query" | "evaluation",
): Promise<void> => {
  try {
    await releaseChallengeReservation(reservation, kind);
  } catch (error) {
    console.error("Could not release challenge reservation", error);
  }
};

const progressStatus = (
  attempt: AttemptRecord | undefined,
  evaluation: EvaluationRecord | undefined,
): ParticipantChallengeProgress["status"] => {
  return challengeProgressStatus({
    hasPersistedEvaluation: Boolean(evaluation),
    hasAttempt: Boolean(attempt),
  });
};

const completionDurationFor = (
  attempt: AttemptRecord | undefined,
  completedAt: Date | undefined,
): number | undefined => {
  if (!attempt || !completedAt) return undefined;
  return challengeCompletionDurationMs(attempt.createdAt, completedAt);
};

const progressFrom = (
  challenge: ChallengeDefinition,
  item: ChallengeCatalogItem,
  attempt: AttemptRecord | undefined,
  evaluation: EvaluationRecord | undefined,
  rankedScore: ChallengeScore | undefined,
  rank?: number,
  completedAt?: Date,
): ParticipantChallengeProgress => {
  const bestScore = rankedScore ?? (evaluation && scoreFromStored(evaluation));
  return {
    slug: challenge.slug,
    title: challenge.title,
    theme: challenge.theme,
    status: progressStatus(attempt, evaluation),
    open: item.open,
    closed: item.closed,
    playable: item.playable,
    queriesUsed: attempt?.queriesUsed ?? 0,
    queriesLimit: attempt?.queriesLimit ?? challenge.queryLimit,
    evaluationsUsed: attempt?.evaluationsUsed ?? 0,
    evaluationsLimit: attempt?.evaluationsLimit ?? challenge.evaluationLimit,
    bestAccuracy: bestScore?.accuracy,
    bestExactCount: bestScore?.exactCount,
    completionDurationMs: completionDurationFor(attempt, completedAt),
    shareCode: attempt?.shareCode,
    rank,
  };
};

const observationView = (row: {
  sequence: number;
  input: unknown;
  output: unknown;
  createdAt: Date;
}): ChallengeObservation => ({
  sequence: row.sequence,
  input: row.input,
  output: row.output,
  createdAt: row.createdAt.toISOString(),
});

const percentileFor = (rank: number, competitorCount: number): number => {
  if (competitorCount <= 0) return 100;
  return (rank / competitorCount) * 100;
};

const shareTextFor = (
  challenge: ChallengeDefinition,
  result: {
    accuracy: number;
    queriesUsed: number;
    rank?: number;
    competitorCount?: number;
    shareCode: string;
  },
): string => {
  const accuracyPercent = (result.accuracy * 100).toFixed(2);
  if (challenge.slug === slowServiceChallengeSlug) {
    const lines = [
      `THE SLOW SERVICE #${result.shareCode}`,
      `${accuracyPercent}% de puntaje oficial`,
    ];
    if (result.rank !== undefined) lines.push(`Puesto #${result.rank}`);
    lines.push("Respuestas exactas, menos trabajo de ejecución.");
    return lines.join("\n");
  }
  if (challenge.slug === brokenAgentChallengeSlug) {
    const lines = [
      `🛠️ BROKEN AGENT #${result.shareCode}`,
      `${accuracyPercent} preparación para producción`,
      `${challenge.evaluationLimit} evaluaciones oficiales disponibles`,
    ];
    if (result.rank !== undefined && result.competitorCount !== undefined) {
      const topPercent = percentileFor(
        result.rank,
        result.competitorCount,
      ).toFixed(1);
      lines.push(`Top ${topPercent}%`);
    }
    lines.push(
      "Los tests públicos estaban verdes. ¿Lo enviarías a producción?",
    );
    return lines.join("\n");
  }
  const lines = [
    `🕵️ BLACK BOX #${result.shareCode}`,
    `${accuracyPercent}% replication`,
    `${result.queriesUsed} / ${challenge.queryLimit} queries used`,
  ];
  if (result.rank !== undefined && result.competitorCount !== undefined) {
    const topPercent = percentileFor(
      result.rank,
      result.competitorCount,
    ).toFixed(1);
    lines.push(`Top ${topPercent}%`);
  }
  lines.push("Can you reverse engineer yours?");
  return lines.join("\n");
};

const loadBestEvaluation = async (
  attempt: AttemptRecord,
): Promise<EvaluationRecord | undefined> => {
  if (attempt.challengeSlug === slowServiceChallengeSlug) {
    const [evaluation] = await db
      .select()
      .from(challengeEvaluations)
      .where(eq(challengeEvaluations.attemptId, attempt.id))
      .orderBy(
        desc(challengeEvaluations.accuracy),
        asc(challengeEvaluations.createdAt),
        asc(challengeEvaluations.id),
      )
      .limit(1);
    return evaluation;
  }
  const [evaluation] = await db
    .select()
    .from(challengeEvaluations)
    .where(eq(challengeEvaluations.attemptId, attempt.id))
    .orderBy(
      desc(challengeEvaluations.accuracy),
      desc(challengeEvaluations.exactCount),
      asc(challengeEvaluations.queriesUsed),
      asc(challengeEvaluations.runtimeMs),
      asc(challengeEvaluations.createdAt),
      asc(challengeEvaluations.id),
    )
    .limit(1);
  return evaluation;
};

const loadFirstEvaluation = async (
  attempt: AttemptRecord,
): Promise<EvaluationRecord | undefined> => {
  const [evaluation] = await db
    .select()
    .from(challengeEvaluations)
    .where(eq(challengeEvaluations.attemptId, attempt.id))
    .orderBy(asc(challengeEvaluations.createdAt), asc(challengeEvaluations.id))
    .limit(1);
  return evaluation;
};

const loadObservations = async (
  attemptId: string,
): Promise<Array<ChallengeObservation>> => {
  const rows = await db
    .select()
    .from(challengeObservations)
    .where(eq(challengeObservations.attemptId, attemptId))
    .orderBy(asc(challengeObservations.sequence));
  return rows.map(observationView);
};

export interface ParticipantChallengeActivity {
  readonly progressByParticipant: ReadonlyMap<
    string,
    ReadonlyArray<ParticipantChallengeProgress>
  >;
  readonly milestonesByParticipant: ReadonlyMap<
    string,
    ReadonlyArray<ParticipantChallengeMilestone>
  >;
}

const loadChallengeActivityForParticipants = async (
  participantIds: ReadonlyArray<string>,
  now: Date,
  includeHistory: boolean,
  adminEarlyAccess = false,
): Promise<ParticipantChallengeActivity> => {
  const uniqueParticipantIds = [...new Set(participantIds)];
  if (uniqueParticipantIds.length === 0) {
    return {
      progressByParticipant: new Map(),
      milestonesByParticipant: new Map(),
    };
  }

  const loadedAttempts = await db
    .select()
    .from(challengeAttempts)
    .where(inArray(challengeAttempts.participantId, uniqueParticipantIds));
  const attempts = loadedAttempts.filter((attempt) => {
    const currentVersion = currentChallengeVersionFor(attempt.challengeSlug);
    return attempt.challengeVersion === currentVersion;
  });
  const allAttempts = includeHistory ? loadedAttempts : attempts;

  const attemptIds = allAttempts.map((attempt) => attempt.id);
  let evaluations: ReadonlyArray<EvaluationRecord> = [];
  if (attemptIds.length > 0) {
    evaluations = await db
      .select()
      .from(challengeEvaluations)
      .where(inArray(challengeEvaluations.attemptId, attemptIds));
  }
  const evaluationByAttemptId = new Map<string, EvaluationRecord>();
  const completedAtByAttemptId = new Map<string, Date>();
  for (const evaluation of evaluations) {
    const completedAt = completedAtByAttemptId.get(evaluation.attemptId);
    completedAtByAttemptId.set(
      evaluation.attemptId,
      earliestChallengeCompletionAt(completedAt, evaluation.createdAt),
    );
    const current = evaluationByAttemptId.get(evaluation.attemptId);
    if (
      !current ||
      compareChallengeScores(
        scoreFromStored(evaluation),
        scoreFromStored(current),
      ) < 0
    ) {
      evaluationByAttemptId.set(evaluation.attemptId, evaluation);
    }
  }

  const rankedSlugSet = new Set<string>();
  for (const attempt of attempts) {
    if (!evaluationByAttemptId.has(attempt.id)) continue;
    const challenge = challengeBySlug(attempt.challengeSlug);
    if (challenge && isChallengeRankingVisibleAt(challenge, now)) {
      rankedSlugSet.add(attempt.challengeSlug);
    }
  }
  const rankedSlugs = [...rankedSlugSet];
  const rankings = await Promise.all(
    rankedSlugs.map(
      async (slug) => [slug, await rankedEvaluationsFor(slug)] as const,
    ),
  );
  const rankByAttemptId = new Map<string, number>();
  const rankedScoreByAttemptId = new Map<string, ChallengeScore>();
  for (const [, ranked] of rankings) {
    const ranks = competitionRanksForEvaluations(ranked);
    for (const [index, entry] of ranked.entries()) {
      rankByAttemptId.set(entry.attemptId, ranks[index] ?? 1);
      rankedScoreByAttemptId.set(entry.attemptId, entry.score);
    }
  }

  const progressByParticipant = new Map<
    string,
    ReadonlyArray<ParticipantChallengeProgress>
  >();
  for (const participantId of uniqueParticipantIds) {
    const attemptBySlug = new Map(
      attempts
        .filter((attempt) => attempt.participantId === participantId)
        .map((attempt) => [attempt.challengeSlug, attempt]),
    );
    const progress = challengeCatalog.map((challenge) => {
      const item = catalogItemFor(
        challenge,
        now,
        challengesForceOpen(),
        adminEarlyAccess,
      );
      const attempt = attemptBySlug.get(challenge.slug);
      let evaluation: EvaluationRecord | undefined;
      if (attempt) evaluation = evaluationByAttemptId.get(attempt.id);
      const rank = attempt ? rankByAttemptId.get(attempt.id) : undefined;
      const rankedScore = attempt
        ? rankedScoreByAttemptId.get(attempt.id)
        : undefined;
      let completedAt: Date | undefined;
      if (attempt) completedAt = completedAtByAttemptId.get(attempt.id);
      return progressFrom(
        challenge,
        item,
        attempt,
        evaluation,
        rankedScore,
        rank,
        completedAt,
      );
    });
    progressByParticipant.set(participantId, progress);
  }
  const milestonesByParticipant = new Map<
    string,
    ReadonlyArray<ParticipantChallengeMilestone>
  >();
  for (const participantId of uniqueParticipantIds) {
    const milestones = allAttempts
      .filter((attempt) => attempt.participantId === participantId)
      .map((attempt) => {
        const challenge = challengeBySlug(attempt.challengeSlug);
        const completedAt = completedAtByAttemptId.get(attempt.id);
        return {
          attemptId: attempt.id,
          slug: attempt.challengeSlug,
          title: challenge?.title ?? attempt.challengeSlug,
          startedAt: attempt.createdAt.toISOString(),
          completedAt: completedAt?.toISOString(),
        };
      });
    milestonesByParticipant.set(participantId, milestones);
  }
  return { progressByParticipant, milestonesByParticipant };
};

export const challengeActivityForParticipants = (
  participantIds: ReadonlyArray<string>,
  now: Date = currentChallengeTime(),
): Promise<ParticipantChallengeActivity> =>
  loadChallengeActivityForParticipants(participantIds, now, true);

export const challengeProgressForParticipants = async (
  participantIds: ReadonlyArray<string>,
  now: Date = currentChallengeTime(),
): Promise<
  ReadonlyMap<string, ReadonlyArray<ParticipantChallengeProgress>>
> => {
  const activity = await loadChallengeActivityForParticipants(
    participantIds,
    now,
    false,
  );
  return activity.progressByParticipant;
};

export const challengeProgressForParticipant = async (
  participantId: string,
  now: Date = currentChallengeTime(),
  adminEarlyAccess = false,
): Promise<Array<ParticipantChallengeProgress>> => {
  const { progressByParticipant } = await loadChallengeActivityForParticipants(
    [participantId],
    now,
    false,
    adminEarlyAccess,
  );
  return [...(progressByParticipant.get(participantId) ?? [])];
};

export const getChallengeAttempt = async (
  clerkUserId: string,
  slug: string,
  now: Date = currentChallengeTime(),
): Promise<ChallengeAttemptView> => {
  const challenge = requireChallenge(slug);
  const challengeVersion = versionForChallenge(challenge);
  const participantId = await participantIdFor(clerkUserId);
  const item = catalogItemFor(
    challenge,
    now,
    challengesForceOpen(),
    await hasChallengeEarlyAccess(clerkUserId, slug),
  );
  const rankingVisible = isChallengeRankingVisibleAt(challenge, now);
  const [existing] = await db
    .select()
    .from(challengeAttempts)
    .where(
      and(
        eq(challengeAttempts.participantId, participantId),
        eq(challengeAttempts.challengeSlug, challenge.slug),
        eq(challengeAttempts.challengeVersion, challengeVersion),
      ),
    )
    .limit(1);

  let rank: number | undefined;
  if (rankingVisible && existing?.bestEvaluationId) {
    const ranked = await rankedEvaluationsFor(challenge.slug);
    rank = rankForAttempt(ranked, existing.id)?.rank;
  }

  let evaluation: EvaluationRecord | undefined;
  let firstEvaluation: EvaluationRecord | undefined;
  if (existing) {
    [evaluation, firstEvaluation] = await Promise.all([
      loadBestEvaluation(existing),
      loadFirstEvaluation(existing),
    ]);
  }
  const observations = existing ? await loadObservations(existing.id) : [];
  const progress = progressFrom(
    challenge,
    item,
    existing,
    evaluation,
    evaluation && scoreFromStored(evaluation),
    rank,
    firstEvaluation?.createdAt,
  );

  let latestEvaluation: ChallengeAttemptView["latestEvaluation"];
  if (evaluation && existing) {
    let standing: ReturnType<typeof rankForAttempt>;
    if (rankingVisible) {
      const ranked = await rankedEvaluationsFor(challenge.slug);
      standing = rankForAttempt(ranked, existing.id);
    }
    let percentile: number | undefined;
    if (standing) {
      percentile = percentileFor(standing.rank, standing.competitorCount);
    }
    latestEvaluation = {
      ...scoreFromStored(evaluation),
      shareCode: existing.shareCode,
      rank: standing?.rank,
      percentile,
      createdAt: evaluation.createdAt.toISOString(),
    };
  }

  let localTestHint =
    "Test against your notebook with `andes challenge test --challenge black-box --source ./shipping.js`. Official evaluation consumes one attempt.";
  if (challenge.slug === powerGridChallengeSlug) {
    localTestHint =
      "Prueba gratis contra tu cuaderno con `andes challenge test --challenge power-grid --source ./bill.js`. Cada evaluación oficial consume uno de tus 3 intentos y usa 1,000 lecturas ocultas.";
  }
  if (challenge.slug === brokenAgentChallengeSlug) {
    localTestHint =
      "Ejecuta `npm test` dentro de broken-agent y luego `andes challenge test --challenge broken-agent --source ./scheduler.js`. Los tests públicos son ilimitados. Antes de evaluar, el participante debe elegir una traza de falla y completar su review vinculado al source.";
  }
  if (challenge.slug === slowServiceChallengeSlug) {
    localTestHint =
      "Slow Service v3 usa createLedger({ accounts }), amend() y report({ account, from, to, asOf, percentile }). El reporte incluye debits y debitAmountAtPercentile exactos. Ejecuta `bun install`, `bun test ./.kit/ledger.test.ts` y `bun run benchmark ledger.js 1000` dentro de slow-service. Comprueba las cargas completas con `bun run benchmark ledger.js 6000`, `bun run benchmark ledger.js 6000 --max-history` y `bun run benchmark ledger.js 6000 --max-history --negative-heavy`. La última usa 2,000 y 8,000 journals para diagnosticar memoria, no los tamaños oficiales de 6,000 y 24,000. Los tests públicos y benchmarks son ilimitados y no certifican el puntaje oculto. Antes de evaluar, el participante revisa con su agente un caso concreto y evidencia real, guarda review.json vinculado al código y aprueba la versión exacta en el navegador. Una aprobación registra responsabilidad, no comprensión ni autoría independiente.";
  }

  return {
    admission: {
      challengesMandatory: true,
      selectionBasis: "challenge_rankings",
      notice: challengeAdmissionNotice,
    },
    challenge: item,
    progress,
    observations,
    latestEvaluation,
    aiAllowed: true,
    localTestHint,
  };
};

const parsePowerReading = (input: unknown) =>
  parseInput(PowerReadingSchema, input);
const parseShipment = (input: unknown) => parseInput(ShipmentSchema, input);

const prepareOracleQuery = (slug: string, rawInput: unknown) => {
  if (slug === powerGridChallengeSlug) {
    const input = parsePowerReading(rawInput);
    return {
      input,
      run: (key: string) => challengeEngine().queryPowerGrid(key, input),
    };
  }
  const input = parseShipment(rawInput);
  return { input, run: (key: string) => challengeEngine().query(key, input) };
};

export const queryChallenge = async (
  clerkUserId: string,
  slug: string,
  rawInput: unknown,
  now: Date = currentChallengeTime(),
): Promise<ChallengeQueryResult> => {
  const challenge = await requireImplementedChallenge(slug, now, clerkUserId);
  if (
    challenge.slug !== blackBoxChallengeSlug &&
    challenge.slug !== powerGridChallengeSlug
  ) {
    throw new HttpError(
      404,
      "QUERY_NOT_AVAILABLE",
      `${challenge.title} does not use oracle queries`,
    );
  }
  const query = prepareOracleQuery(challenge.slug, rawInput);
  const { input } = query;
  const participantId = await participantIdFor(clerkUserId);
  const attempt = await attemptFor(participantId, challenge);

  const existing = await findChallengeObservation(attempt.id, input);
  if (existing) throw duplicateQueryError();

  const reservation = await reserveChallengeUse(attempt.id, "query");

  if (!reservation) {
    throw new HttpError(
      429,
      "QUERY_LIMIT_REACHED",
      `No quedan consultas para ${challenge.title} (${attempt.queriesLimit}/${attempt.queriesLimit})`,
    );
  }

  let output: number;
  try {
    output = await query.run(attempt.id);
  } catch (error) {
    await releaseAfterFailure(reservation, "query");
    if (error instanceof ChallengeEngineError) {
      throw engineHttpError(error, "query");
    }
    console.error("Challenge engine query failed", error);
    throw engineUnavailableError();
  }

  let completed: Awaited<ReturnType<typeof completeQueryReservation>>;
  try {
    completed = await completeQueryReservation(reservation, input, output);
  } catch (error) {
    await releaseAfterFailure(reservation, "query");
    if (isUniqueViolation(error)) throw duplicateQueryError();
    throw error;
  }
  if (!completed) throw engineUnavailableError();

  return {
    observation: completed.observation,
    queriesUsed: completed.queriesUsed,
    queriesRemaining: completed.queriesLimit - completed.queriesUsed,
    queriesLimit: completed.queriesLimit,
  };
};

const numericOutput = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
};

export const testChallengeSolution = async (
  clerkUserId: string,
  slug: string,
  rawInput: unknown,
  now: Date = currentChallengeTime(),
): Promise<ChallengeLocalTestResult> => {
  const challenge = await requireImplementedChallenge(slug, now, clerkUserId);
  const solution = parseInput(JavascriptSourceSolutionSchema, rawInput);
  const participantId = await participantIdFor(clerkUserId);
  const attempt = await attemptFor(participantId, challenge);
  if (challenge.slug === brokenAgentChallengeSlug) {
    return runBrokenAgentPublicTests(solution.source);
  }
  if (challenge.slug === slowServiceChallengeSlug)
    return runSlowServicePublicTests(solution.source);
  const observations = await loadObservations(attempt.id);
  if (observations.length === 0) {
    throw new HttpError(
      422,
      "NO_OBSERVATIONS",
      "Consulta la máquina antes de probar tu solución contra el cuaderno",
    );
  }

  let actual: number[];
  if (challenge.slug === powerGridChallengeSlug) {
    const readings = observations.map((row) => parsePowerReading(row.input));
    actual = await runPowerGridSolution(solution.source, readings);
  } else {
    const shipments = observations.map((row) => parseShipment(row.input));
    actual = await runShippingSolution(solution.source, shipments);
  }
  const mismatches: Array<{
    sequence: number;
    expected: unknown;
    actual: unknown;
  }> = [];
  let exactCount = 0;
  let absoluteError = 0;

  for (const [index, observation] of observations.entries()) {
    const expected = numericOutput(observation.output);
    const predicted = actual[index];
    if (expected === undefined || predicted === undefined) {
      mismatches.push({
        sequence: observation.sequence,
        expected: observation.output,
        actual: predicted,
      });
      continue;
    }
    if (expected === predicted) exactCount += 1;
    else {
      mismatches.push({
        sequence: observation.sequence,
        expected,
        actual: predicted,
      });
    }
    absoluteError += Math.abs(expected - predicted);
  }

  return {
    matchedObservations: exactCount,
    observationCount: observations.length,
    accuracy: exactCount / observations.length,
    meanError: absoluteError / observations.length,
    mismatches: mismatches.slice(0, 20),
  };
};

const evaluationResult = async (
  challenge: ChallengeDefinition,
  attemptId: string,
  completed: {
    readonly shareCode: string;
    readonly evaluationsUsed: number;
    readonly evaluationsLimit: number;
  },
  score: ChallengeScore,
  now: Date,
): Promise<ChallengeEvaluationResult> => {
  let standing: { rank: number; competitorCount: number } | undefined;
  if (isChallengeRankingVisibleAt(challenge, now)) {
    try {
      const ranked = await rankedEvaluationsFor(challenge.slug);
      standing = rankForAttempt(ranked, attemptId);
    } catch (error) {
      console.error("Could not load challenge ranking after evaluation", error);
    }
  }

  const rankingResult: {
    rank?: number;
    competitorCount?: number;
    percentile?: number;
  } = {};
  if (standing) {
    rankingResult.rank = standing.rank;
    rankingResult.competitorCount = standing.competitorCount;
    rankingResult.percentile = percentileFor(
      standing.rank,
      standing.competitorCount,
    );
  }

  return {
    ...participantVisibleScore(score),
    shareCode: completed.shareCode,
    ...rankingResult,
    evaluationsUsed: completed.evaluationsUsed,
    evaluationsRemaining:
      completed.evaluationsLimit - completed.evaluationsUsed,
    evaluationsLimit: completed.evaluationsLimit,
    rankingPath: rankingPathFor(challenge.slug),
    shareText: shareTextFor(challenge, {
      accuracy: score.accuracy,
      queriesUsed: score.queriesUsed,
      rank: standing?.rank,
      competitorCount: standing?.competitorCount,
      shareCode: completed.shareCode,
    }),
  };
};

const findSlowServiceEvaluation = async (
  attemptId: string,
  solution: ChallengeSolution,
): Promise<EvaluationRecord | undefined> => {
  if (!("review" in solution)) return undefined;
  const [evaluation] = await db
    .select()
    .from(challengeEvaluations)
    .where(
      and(
        eq(challengeEvaluations.attemptId, attemptId),
        sql`${challengeEvaluations.solution}->>'source' = ${solution.source}`,
        sql`${challengeEvaluations.solution}->'review' = ${JSON.stringify(solution.review)}::jsonb`,
      ),
    )
    .orderBy(asc(challengeEvaluations.createdAt), asc(challengeEvaluations.id))
    .limit(1);
  return evaluation;
};

export const evaluateChallenge = async (
  clerkUserId: string,
  slug: string,
  rawInput: unknown,
  now: Date = currentChallengeTime(),
  publicOrigin = "https://hacktheandes.com",
): Promise<ChallengeEvaluationResult> => {
  const challenge = await requireImplementedChallenge(slug, now, clerkUserId);
  let solution: ChallengeSolution;
  let brokenAgentSourceDigest: string | undefined;
  let approvalReview: EvaluationApprovalReview | undefined;
  const companionReviewRequired =
    challenge.slug === slowServiceChallengeSlug &&
    currentChallengeVersionFor(challenge.slug) === "slow-service-v3";
  if (challenge.slug === brokenAgentChallengeSlug) {
    if (!isRecord(rawInput) || rawInput.review === undefined) {
      const unreviewedSolution = parseInput(
        JavascriptSourceSolutionSchema,
        rawInput,
      );
      const sourceDigest = createHash("sha256")
        .update(unreviewedSolution.source)
        .digest("hex");
      throw reviewRequiredError(sourceDigest);
    }
    const reviewedSolution = parseInput(
      BrokenAgentEvaluationSolutionSchema,
      rawInput,
    );
    const sourceDigest = createHash("sha256")
      .update(reviewedSolution.source)
      .digest("hex");
    if (reviewedSolution.review.sourceDigest !== sourceDigest) {
      throw new HttpError(
        409,
        "STALE_HUMAN_REVIEW",
        "The participant's review does not match the submitted source",
        false,
        {
          expectedSourceDigest: sourceDigest,
          reviewSourceDigest: reviewedSolution.review.sourceDigest,
        },
      );
    }
    brokenAgentSourceDigest = sourceDigest;
    solution = reviewedSolution;
    approvalReview = reviewedSolution.review;
  } else if (companionReviewRequired) {
    if (!isRecord(rawInput) || rawInput.review === undefined) {
      const unreviewed = parseInput(JavascriptSourceSolutionSchema, rawInput);
      if (!isSlowServiceSourceWithinLimit(unreviewed.source)) {
        throw new HttpError(
          422,
          "INVALID_SOURCE",
          "El source debe tener entre 1 y 32,768 bytes UTF-8.",
        );
      }
      const sourceDigest = createHash("sha256")
        .update(unreviewed.source)
        .digest("hex");
      throw new HttpError(
        428,
        "HUMAN_REVIEW_REQUIRED",
        "The Slow Service requiere una revisión y aprobación del participante antes de evaluar.",
        false,
        {
          sourceDigest,
          requiredFields: [
            "sourceDigest",
            "focus",
            "failureScenario",
            "evidence",
            "decision",
            "confidence",
            "remainingRisk",
          ],
          next: "Con ayuda del agente, elige un caso concreto, revisa evidencia real y decide ship o block. Guarda review.json y repite con --review ./review.json.",
        },
      );
    }
    const reviewed = parseInput(SlowServiceEvaluationSolutionSchema, rawInput);
    const sourceDigest = createHash("sha256")
      .update(reviewed.source)
      .digest("hex");
    if (reviewed.review.sourceDigest !== sourceDigest) {
      throw new HttpError(
        409,
        "STALE_HUMAN_REVIEW",
        "La revisión no coincide con el código enviado.",
        false,
        {
          expectedSourceDigest: sourceDigest,
          reviewSourceDigest: reviewed.review.sourceDigest,
        },
      );
    }
    if (reviewed.review.decision === "block") {
      throw new HttpError(
        409,
        "REVIEW_BLOCKED",
        "La decisión block no autoriza una evaluación. Revisa el código y la evidencia antes de cambiarla.",
      );
    }
    solution = reviewed;
    brokenAgentSourceDigest = sourceDigest;
    approvalReview = {
      challengeSlug: "make-it-fast",
      challengeVersion: "slow-service-v3",
      source: reviewed.source,
      review: reviewed.review,
    };
  } else {
    solution = parseInput(JavascriptSourceSolutionSchema, rawInput);
  }
  if (
    challenge.slug === slowServiceChallengeSlug &&
    !isSlowServiceSourceWithinLimit(solution.source)
  )
    throw new HttpError(
      422,
      "INVALID_SOURCE",
      "El source debe tener entre 1 y 32,768 bytes UTF-8.",
    );
  const participantId = await participantIdFor(clerkUserId);
  const attempt = await attemptFor(participantId, challenge);
  if (challenge.slug === slowServiceChallengeSlug) {
    const persisted = await findSlowServiceEvaluation(attempt.id, solution);
    if (persisted) {
      return evaluationResult(
        challenge,
        attempt.id,
        attempt,
        scoreFromStored(persisted),
        now,
      );
    }
  }
  const reservationLifetime =
    challenge.slug === slowServiceChallengeSlug
      ? slowServiceEngineEvaluateTimeoutMs + 60_000
      : undefined;
  const reservation = await reserveChallengeUse(
    attempt.id,
    "evaluation",
    undefined,
    reservationLifetime,
  );

  if (!reservation) {
    throw new HttpError(
      429,
      "EVALUATION_LIMIT_REACHED",
      `No official evaluations remaining (${attempt.evaluationsLimit}/${attempt.evaluationsLimit})`,
    );
  }

  let approvalId: string | undefined;
  if (approvalReview && brokenAgentSourceDigest) {
    approvalId = await consumeEvaluationApproval(
      attempt.id,
      brokenAgentSourceDigest,
      approvalReview,
    );
    if (!approvalId) {
      await releaseAfterFailure(reservation, "evaluation");
      const approval = await createOrReuseEvaluationApproval(
        attempt.id,
        brokenAgentSourceDigest,
        approvalReview,
      );
      const approvalUrl = `${publicOrigin}/challenges/${challenge.slug}/approve/${approval.id}`;
      throw new HttpError(
        428,
        "HUMAN_APPROVAL_REQUIRED",
        "The participant must review and approve this exact evaluation in the browser",
        false,
        {
          approvalUrl,
          expiresAt: approval.expiresAt,
          sourceDigest: approval.sourceDigest,
          evaluationsRemaining:
            attempt.evaluationsLimit - attempt.evaluationsUsed,
          retryCommand: companionReviewRequired
            ? "andes challenge evaluate --challenge make-it-fast --source ./ledger.js --review ./review.json"
            : "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
        },
      );
    }
  }

  const releaseEvaluation = async (): Promise<void> => {
    if (approvalId) {
      try {
        await releaseEvaluationApproval(approvalId);
      } catch (error) {
        console.error("Could not restore evaluation approval", {
          approvalId,
          error,
        });
      }
    }
    await releaseAfterFailure(reservation, "evaluation");
  };

  let score: ChallengeScore;
  try {
    const challengeVersion = currentChallengeVersionFor(challenge.slug);
    if (!challengeVersion) throw engineUnavailableError();
    score = await challengeEngine().evaluate(
      challengeVersion,
      attempt.id,
      solution.source,
      challenge.slug === slowServiceChallengeSlug ? 0 : reservation.queriesUsed,
    );
  } catch (error) {
    if (error instanceof ChallengeEngineError) {
      if (
        challenge.slug !== slowServiceChallengeSlug &&
        isConfirmedSolutionExecutionFailure(error)
      ) {
        try {
          const consumed =
            await consumeFailedEvaluationReservation(reservation);
          if (!consumed) throw new Error("Evaluation reservation expired");
        } catch (persistenceError) {
          await releaseEvaluation();
          console.error(
            "Could not persist failed challenge evaluation",
            persistenceError,
          );
          throw engineUnavailableError();
        }
        throw engineHttpError(error);
      }
      await releaseEvaluation();
      console.error("Challenge engine evaluation failed", {
        attemptId: attempt.id,
        code: error.code,
        status: error.status,
      });
      throw engineHttpError(error);
    }
    await releaseEvaluation();
    console.error("Challenge engine evaluation failed", error);
    throw engineUnavailableError();
  }

  let completed: Awaited<ReturnType<typeof completeEvaluationReservation>>;
  try {
    let storedSolution: ChallengeSolution & {
      readonly challengeSlug?: "make-it-fast";
      readonly approvalId?: string;
    } = solution;
    if (challenge.slug === slowServiceChallengeSlug)
      storedSolution = {
        ...solution,
        challengeSlug: slowServiceChallengeSlug,
        ...(approvalId ? { approvalId } : {}),
      };
    completed = await completeEvaluationReservation(
      reservation,
      storedSolution,
      score,
    );
  } catch (error) {
    await releaseEvaluation();
    throw error;
  }
  if (!completed) {
    await releaseEvaluation();
    throw engineUnavailableError();
  }

  if (challenge.slug === slowServiceChallengeSlug) {
    const persisted = await findSlowServiceEvaluation(attempt.id, solution);
    if (persisted) score = scoreFromStored(persisted);
  }
  return evaluationResult(challenge, attempt.id, completed, score, now);
};
