import type { CandidateCountryFilter } from "./candidate-filters";
import { parseCandidateFilters } from "./candidate-filters";
import type { CandidateRankingSort } from "./types";

export interface HistoryQuery {
  readonly end: string;
  readonly days: 7 | 14 | 30 | 90;
  readonly now: string;
  readonly country?: CandidateCountryFilter;
  readonly challenge?: CandidateRankingSort;
  readonly showUpPercent: number;
  readonly costPerConfirmation?: number;
}

export const limaDay = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const parseHistoryQuery = (
  input: Readonly<Record<string, string | readonly string[] | undefined>>,
  now = new Date(),
): HistoryQuery => {
  const get = (key: string): string | undefined => {
    const value = input[key];
    if (typeof value === "string") return value;
    return value?.[0];
  };
  const today = limaDay(now);
  let end = today;
  const candidate = get("end");
  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    const parsed = new Date(`${candidate}T00:00:00Z`);
    if (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === candidate &&
      candidate >= "2020-01-01" &&
      candidate <= today
    )
      end = candidate;
  }
  let days: HistoryQuery["days"] = 30;
  const rawDays = get("days");
  if (rawDays === "7") days = 7;
  if (rawDays === "14") days = 14;
  if (rawDays === "90") days = 90;
  let showUpPercent = 100;
  const rate = Number(get("showUp"));
  if (Number.isFinite(rate) && rate >= 1 && rate <= 100) showUpPercent = rate;
  let costPerConfirmation: number | undefined;
  const rawCost = get("cost")?.trim();
  const cost = Number(rawCost);
  if (rawCost && Number.isFinite(cost) && cost >= 0 && cost <= 1_000_000)
    costPerConfirmation = cost;
  const { country, challenge } = parseCandidateFilters(input);
  return {
    end,
    days,
    now: now.toISOString(),
    country,
    challenge,
    showUpPercent,
    costPerConfirmation,
  };
};
