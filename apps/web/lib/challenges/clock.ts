export const currentChallengeTime = (): Date => new Date();

export const challengesForceOpen = (): boolean =>
  process.env.NODE_ENV !== "production" &&
  process.env.CHALLENGES_FORCE_OPEN === "true";
