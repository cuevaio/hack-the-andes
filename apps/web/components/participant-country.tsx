"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { countries } from "@chofex/registration-contract";
import { Button } from "@chofex/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "lucide-react";
import { useId, useState } from "react";

import {
  candidateKeys,
  updateParticipantCountry,
} from "@/lib/admin/candidate-queries";
import type { Candidate, CandidatePage } from "@/lib/admin/types";

export function ParticipantCountry({
  candidate,
  onOpenChange,
}: {
  readonly candidate: Pick<Candidate, "participantId" | "name" | "countryCode">;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const current = countries.find(
    (country) => country.code === candidate.countryCode,
  );
  const [selected, setSelected] = useState(current ?? null);
  const mutation = useMutation({
    mutationFn: updateParticipantCountry,
    onSuccess: (result) => {
      queryClient.setQueriesData<CandidatePage>(
        { queryKey: candidateKeys.all },
        (page) => {
          if (!page) return page;
          return {
            ...page,
            candidates: page.candidates.map((item) => {
              if (item.participantId !== result.participantId) return item;
              return { ...item, countryCode: result.countryCode };
            }),
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: candidateKeys.all,
      });
      changeOpen(false);
    },
  });

  function changeOpen(value: boolean) {
    setOpen(value);
    onOpenChange?.(value);
    if (value) {
      setSelected(current ?? null);
      mutation.reset();
    }
  }

  const label = `Editar país de ${candidate.name || "participante"}: ${current?.name ?? "sin indicar"}`;
  let icon = <GlobeIcon className="size-4" />;
  if (current) {
    icon = (
      <span aria-hidden="true" className="text-lg">
        {current.flag}
      </span>
    );
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) changeOpen(value);
      }}
    >
      <Dialog.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative z-20 size-8 shrink-0"
          />
        }
        aria-label={label}
        title={label}
      >
        {icon}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/65" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border bg-background p-6 shadow-xl outline-none">
          <Dialog.Title className="text-lg font-semibold">
            Editar país
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            País de residencia de {candidate.name || "este participante"}.
            Confírmalo con su LinkedIn u otras redes sociales. El participante
            no puede cambiarlo.
          </Dialog.Description>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (selected && !mutation.isPending)
                mutation.mutate({
                  participantId: candidate.participantId,
                  countryCode: selected.code,
                });
            }}
          >
            <label
              htmlFor={inputId}
              className="mt-5 mb-2 block text-sm font-medium"
            >
              País de residencia
            </label>
            <Combobox.Root
              items={countries}
              value={selected}
              onValueChange={setSelected}
              itemToStringLabel={(country) => country.name}
              isItemEqualToValue={(a, b) => a.code === b.code}
              disabled={mutation.isPending}
              autoHighlight
            >
              <div className="relative">
                <Combobox.Input
                  id={inputId}
                  placeholder="Buscar país…"
                  className="h-10 w-full border bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Combobox.Trigger
                  aria-label="Mostrar países"
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                >
                  <ChevronDownIcon className="size-4" />
                </Combobox.Trigger>
              </div>
              <Combobox.Portal>
                <Combobox.Positioner sideOffset={4} className="z-[70]">
                  <Combobox.Popup className="w-(--anchor-width) border bg-popover text-popover-foreground shadow-lg">
                    <Combobox.Empty className="p-3 text-sm text-muted-foreground">
                      No se encontraron países.
                    </Combobox.Empty>
                    <Combobox.List className="max-h-64 overflow-y-auto p-1">
                      {(country: (typeof countries)[number]) => (
                        <Combobox.Item
                          key={country.code}
                          value={country}
                          className="flex cursor-default items-center gap-2 px-2 py-2 text-sm data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        >
                          <span aria-hidden="true">{country.flag}</span>
                          <span className="flex-1">{country.name}</span>
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
            {mutation.isError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {mutation.error.message}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close
                render={<Button variant="outline" />}
                disabled={mutation.isPending}
              >
                Cancelar
              </Dialog.Close>
              <Button
                type="submit"
                disabled={
                  !selected ||
                  selected.code === current?.code ||
                  mutation.isPending
                }
              >
                {mutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
