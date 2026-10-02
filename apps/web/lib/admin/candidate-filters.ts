import { countries, countryName } from "@chofex/registration-contract";

import {
  type CandidateFilter,
  type CandidateRankingSort,
  parseCandidateFilter,
  parseCandidateRankingSort,
} from "./types";

export type CandidateCountryFilter =
  | { readonly kind: "unknown" }
  | { readonly kind: "outside_peru" }
  | { readonly kind: "country"; readonly code: string };

export interface CandidateFilters {
  readonly page: number;
  readonly query: string;
  readonly status?: CandidateFilter;
  readonly ranking?: CandidateRankingSort;
  readonly challenge?: CandidateRankingSort;
  readonly country?: CandidateCountryFilter;
}

export const parseCountryFilter = (
  value: string | undefined,
): CandidateCountryFilter | undefined => {
  if (value === "unknown") return { kind: "unknown" };
  if (value === "outside_peru") return { kind: "outside_peru" };
  const country = countries.find((item) => item.code === value);
  if (country) return { kind: "country", code: country.code };
  return undefined;
};

export const countryFilterValue = (
  country: CandidateCountryFilter | undefined,
): string => {
  if (!country) return "";
  if (country.kind === "unknown") return "unknown";
  if (country.kind === "outside_peru") return "outside_peru";
  return country.code;
};

export const countryFilterLabel = (
  country: CandidateCountryFilter | undefined,
): string => {
  if (!country) return "Todos";
  if (country.kind === "unknown") return "Sin indicar";
  if (country.kind === "outside_peru") return "Fuera de Perú";
  return countryName(country.code);
};

export const countryFilterOptions = (
  country: CandidateCountryFilter | undefined,
) => {
  const options = [
    { value: "", label: "Todos" },
    { value: "PE", label: "Perú" },
    { value: "outside_peru", label: "Fuera de Perú" },
    { value: "unknown", label: "Sin indicar" },
  ];
  if (country?.kind === "country" && country.code !== "PE") {
    options.push({ value: country.code, label: countryName(country.code) });
  }
  return options;
};

export const parseCandidateFilters = (
  input:
    | URLSearchParams
    | Readonly<Record<string, string | readonly string[] | undefined>>,
): CandidateFilters => {
  const get = (key: string): string | undefined => {
    if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
    const value = input[key];
    if (typeof value === "string") return value;
    return value?.[0];
  };
  const parsedPage = Number.parseInt(get("page") ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  return {
    page,
    query: get("q")?.trim().slice(0, 200) ?? "",
    status: parseCandidateFilter(get("status")),
    ranking: parseCandidateRankingSort(get("ranking")),
    challenge: parseCandidateRankingSort(get("challenge")),
    country: parseCountryFilter(get("country")),
  };
};

export const candidateFilterQuery = (filters: CandidateFilters): string => {
  const parameters = new URLSearchParams();
  if (filters.page > 1) parameters.set("page", String(filters.page));
  if (filters.query) parameters.set("q", filters.query);
  if (filters.status) parameters.set("status", filters.status);
  if (filters.ranking) parameters.set("ranking", filters.ranking);
  if (filters.challenge) parameters.set("challenge", filters.challenge);
  const country = countryFilterValue(filters.country);
  if (country) parameters.set("country", country);
  return parameters.toString();
};
