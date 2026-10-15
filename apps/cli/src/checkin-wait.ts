import type { ApiSuccess, Checkin } from "@chofex/registration-contract";
import { Effect } from "effect";
import { type CliError, cliError } from "./errors.js";

interface PollingClock {
  readonly now: () => number;
  readonly pause: () => Effect.Effect<void>;
}

const monotonicClock: PollingClock = {
  now: () => performance.now(),
  pause: () => Effect.sleep("10 seconds"),
};

export const waitForCheckin = (
  poll: () => Effect.Effect<ApiSuccess<Checkin>, CliError>,
  clock: PollingClock = monotonicClock,
) =>
  Effect.gen(function* () {
    // The server enforces the QR's actual expiry. The local waiting budget must
    // not compare server timestamps against a skewed or changing laptop clock.
    const deadline = clock.now() + 5 * 60_000;
    while (clock.now() < deadline) {
      yield* clock.pause();
      const current = yield* poll().pipe(
        Effect.catch((error) => {
          if (error.retryable) return Effect.succeed(undefined);
          return Effect.fail(error);
        }),
      );
      if (current?.data.checkedIn) return current;
    }
    return yield* cliError(
      "CHECKIN_TIMEOUT",
      "El QR venció. Ejecuta andes checkin otra vez; si ya te verificaron, tu asistencia sigue guardada.",
    );
  });
