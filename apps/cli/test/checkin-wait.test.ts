import { expect, spyOn, test } from "bun:test";
import type { ApiSuccess, Checkin } from "@chofex/registration-contract";
import { Effect } from "effect";
import { waitForCheckin } from "../src/checkin-wait.js";
import { cliError } from "../src/errors.js";

const response = (checkedIn: boolean): ApiSuccess<Checkin> => ({
  version: 1,
  ok: true,
  requestId: "polling-fixture",
  data: { checkedIn },
});
function clock() {
  let elapsed = 0;
  return {
    now: () => elapsed,
    pause: () =>
      Effect.sync(() => {
        elapsed += 10_000;
      }),
  };
}

for (const offset of [-3_600_000, 3_600_000]) {
  test(`polling completes normally when the laptop clock is skewed by ${offset}ms`, async () => {
    const wall = spyOn(Date, "now").mockReturnValue(1_800_000_000_000 + offset);
    try {
      let calls = 0;
      const result = await Effect.runPromise(
        waitForCheckin(
          () => Effect.sync(() => response(++calls === 2)),
          clock(),
        ),
      );
      expect(result.data.checkedIn).toBe(true);
      expect(calls).toBe(2);
      expect(wall).not.toHaveBeenCalled();
    } finally {
      wall.mockRestore();
    }
  });
}

test("waiting remains bounded to five monotonic minutes", async () => {
  const timer = clock();
  let calls = 0;
  const failure = await Effect.runPromise(
    Effect.flip(
      waitForCheckin(
        () =>
          Effect.sync(() => {
            calls++;
            return response(false);
          }),
        timer,
      ),
    ),
  );
  expect(failure.code).toBe("CHECKIN_TIMEOUT");
  expect(timer.now()).toBe(300_000);
  expect(calls).toBe(30);
});

test("retryable polling failures do not discard a later admin confirmation", async () => {
  let calls = 0;
  const result = await Effect.runPromise(
    waitForCheckin(() => {
      if (++calls === 1) return cliError("NETWORK_ERROR", "fixture", true);
      return Effect.succeed(response(true));
    }, clock()),
  );
  expect(result.data.checkedIn).toBe(true);
  expect(calls).toBe(2);
});

test("nonretryable authentication errors stop polling", async () => {
  const timer = clock();
  const failure = await Effect.runPromise(
    Effect.flip(
      waitForCheckin(
        () => cliError("AUTHENTICATION_REQUIRED", "fixture"),
        timer,
      ),
    ),
  );
  expect(failure.code).toBe("AUTHENTICATION_REQUIRED");
  expect(timer.now()).toBe(10_000);
});
