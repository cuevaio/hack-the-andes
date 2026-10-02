"use client";

import { useId } from "react";

import {
  type CandidateCountryFilter,
  countryFilterOptions,
  countryFilterValue,
  parseCountryFilter,
} from "@/lib/admin/candidate-filters";

export function CountryFilter({
  value,
  onChange,
}: {
  readonly value: CandidateCountryFilter | undefined;
  readonly onChange: (country: CandidateCountryFilter | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-muted-foreground"
      >
        Residencia
      </label>
      <select
        id={id}
        name="country"
        value={countryFilterValue(value)}
        onChange={(event) => onChange(parseCountryFilter(event.target.value))}
        className="h-11 w-full border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {countryFilterOptions(value).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
