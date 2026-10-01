"use client";

import { Combobox } from "@base-ui/react/combobox";
import { countries } from "@chofex/registration-contract";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useId } from "react";

import {
  type CandidateCountryFilter,
  countryFilterValue,
  parseCountryFilter,
} from "@/lib/admin/candidate-filters";

const options = [
  { code: "", name: "Todos los países", flag: "" },
  { code: "unknown", name: "Sin indicar", flag: "" },
  ...countries,
];

export function CountryFilter({
  value,
  onChange,
}: {
  readonly value: CandidateCountryFilter | undefined;
  readonly onChange: (country: CandidateCountryFilter | undefined) => void;
}) {
  const id = useId();
  const selected = options.find(
    (option) => option.code === countryFilterValue(value),
  );
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-muted-foreground"
      >
        País de residencia
      </label>
      <Combobox.Root
        items={options}
        value={selected}
        onValueChange={(option) => {
          if (option) onChange(parseCountryFilter(option.code));
        }}
        itemToStringLabel={(option) => option.name}
        isItemEqualToValue={(a, b) => a.code === b.code}
        autoHighlight
      >
        <div className="relative">
          <Combobox.Input
            id={id}
            placeholder="Buscar país…"
            className="h-11 w-full border border-input bg-background px-3 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Combobox.Trigger
            aria-label="Mostrar países"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center"
          >
            <ChevronDownIcon className="size-4" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="z-50">
            <Combobox.Popup className="w-(--anchor-width) border bg-popover text-popover-foreground shadow-lg">
              <Combobox.Empty className="p-3 text-sm text-muted-foreground">
                No se encontraron países.
              </Combobox.Empty>
              <Combobox.List className="max-h-64 overflow-y-auto p-1">
                {(option: (typeof options)[number]) => (
                  <Combobox.Item
                    key={option.code}
                    value={option}
                    className="flex min-h-11 cursor-default items-center gap-2 px-2 text-sm data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <span aria-hidden="true">{option.flag}</span>
                    <span className="flex-1">{option.name}</span>
                    <Combobox.ItemIndicator>
                      <CheckIcon className="size-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
