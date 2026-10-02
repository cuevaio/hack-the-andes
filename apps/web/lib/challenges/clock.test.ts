import { expect, test } from "bun:test";
import { challengesForceOpen } from "./clock";

test("production cannot reopen closed challenges with the development override", () => {
  const nodeEnv = process.env.NODE_ENV;
  const override = process.env.CHALLENGES_FORCE_OPEN;
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.CHALLENGES_FORCE_OPEN = "true";
    expect(challengesForceOpen()).toBe(false);
    Reflect.set(process.env, "NODE_ENV", "development");
    expect(challengesForceOpen()).toBe(true);
  } finally {
    if (nodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", nodeEnv);
    if (override === undefined) delete process.env.CHALLENGES_FORCE_OPEN;
    else process.env.CHALLENGES_FORCE_OPEN = override;
  }
});
