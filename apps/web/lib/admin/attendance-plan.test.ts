import { expect, test } from "bun:test";
import { planAttendance } from "./attendance-plan";
import { parseHistoryQuery } from "./history-query";
import type { AttendanceCounts } from "./participant-history";

const current: AttendanceCounts = {
  onSiteAccepted: 90,
  onSiteConfirmed: 80,
  onSiteAwaitingConfirmation: 10,
  remoteAccepted: 3,
  unknownModeAccepted: 2,
  recordedCheckIns: 0,
  reviewReady: 20,
  needsChallenge: 50,
  drafts: 30,
  firstConfirmationsLast7Days: 7,
  confirmationTimingUnknown: 4,
  missingDecisionDates: 2,
};

test("turns explicit assumptions into the remaining confirmation and effort gap", () => {
  const query = parseHistoryQuery(
    { showUp: "80", cost: "20" },
    new Date("2026-10-02T12:00:00Z"),
  );
  expect(planAttendance(current, query)).toEqual({
    target: 100,
    eventDate: "2026-10-17",
    daysRemaining: 15,
    expectedAttendance: 64,
    requiredConfirmations: 125,
    additionalConfirmations: 45,
    additionalAcceptances: 35,
    requiredDaily: 3,
    assumedBudget: 900,
    exceedsPublishedCapacity: true,
  });
});

test("historical selection does not move the live planning baseline", () => {
  const query = parseHistoryQuery(
    { end: "2026-09-01", country: "CO" },
    new Date("2026-10-02T03:00:00Z"),
  );
  const plan = planAttendance(current, query);
  expect([
    plan.daysRemaining,
    plan.additionalConfirmations,
    plan.assumedBudget,
  ]).toEqual([16, 20, null]);
});

test("handles an achieved goal and event-day or elapsed deadlines without division by zero", () => {
  for (const now of ["2026-10-17T12:00:00Z", "2026-10-19T12:00:00Z"]) {
    const query = parseHistoryQuery({}, new Date(now));
    const plan = planAttendance({ ...current, onSiteConfirmed: 110 }, query);
    expect([
      plan.daysRemaining,
      plan.additionalConfirmations,
      plan.additionalAcceptances,
      plan.requiredDaily,
    ]).toEqual([0, 0, 0, null]);
  }
});
