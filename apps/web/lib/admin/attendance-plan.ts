import { eventStartDate, onSiteGoal } from "@/lib/event";
import { type HistoryQuery, limaDay } from "./history-query";
import type { AttendanceCounts } from "./participant-history";

export const planAttendance = (
  current: AttendanceCounts,
  query: HistoryQuery,
) => {
  const showUpRate = query.showUpPercent / 100;
  const requiredConfirmations = Math.ceil(onSiteGoal / showUpRate);
  const additionalConfirmations = Math.max(
    0,
    requiredConfirmations - current.onSiteConfirmed,
  );
  const additionalAcceptances = Math.max(
    0,
    additionalConfirmations - current.onSiteAwaitingConfirmation,
  );
  const today = limaDay(new Date(query.now));
  const daysRemaining = Math.max(
    0,
    Math.round((Date.parse(eventStartDate) - Date.parse(today)) / 86_400_000),
  );
  let requiredDaily: number | null = null;
  if (daysRemaining > 0)
    requiredDaily = additionalConfirmations / daysRemaining;
  let assumedBudget: number | null = null;
  if (query.costPerConfirmation !== undefined)
    assumedBudget = additionalConfirmations * query.costPerConfirmation;
  return {
    target: onSiteGoal,
    eventDate: eventStartDate,
    daysRemaining,
    expectedAttendance: current.onSiteConfirmed * showUpRate,
    requiredConfirmations,
    additionalConfirmations,
    additionalAcceptances,
    requiredDaily,
    assumedBudget,
    exceedsPublishedCapacity: requiredConfirmations > onSiteGoal,
  };
};
