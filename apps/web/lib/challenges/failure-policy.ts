import { ChallengeEngineError } from "./engine";

const opaqueEngineEvaluationFailure =
  /^submitted solution could not be evaluated$/i;

export const isConfirmedSolutionExecutionFailure = (
  error: unknown,
): boolean => {
  if (
    !(error instanceof ChallengeEngineError) ||
    error.status !== 422 ||
    error.code !== "SOLUTION_EXECUTION_FAILED"
  ) {
    return false;
  }
  const message = error.message.trim();
  if (!message) return false;
  return !opaqueEngineEvaluationFailure.test(message);
};
