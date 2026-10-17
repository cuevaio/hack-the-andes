import type {
  CheckinParticipant,
  CheckinSort,
  CheckinStatus,
} from "./checkin-contract";

export const normalizeCheckinSearch = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();
const documentSearch = (value: string) =>
  normalizeCheckinSearch(value).replace(/[^\p{L}\p{N}]/gu, "");

export function matchesCheckinSearch(
  participant: Pick<CheckinParticipant, "name" | "legalName" | "email">,
  document: string | null,
  search: string,
) {
  const query = normalizeCheckinSearch(search);
  if (!query) return true;
  const identity = normalizeCheckinSearch(
    `${participant.name} ${participant.legalName} ${participant.email}`,
  );
  if (query.split(/\s+/).every((part) => identity.includes(part))) return true;
  const documentQuery = documentSearch(query);
  return Boolean(
    document &&
      documentQuery &&
      documentSearch(document).includes(documentQuery),
  );
}

const names = new Intl.Collator("es", { sensitivity: "base" });
export function visibleCheckinParticipants(
  participants: readonly CheckinParticipant[],
  status: CheckinStatus,
  sort: CheckinSort,
) {
  return participants
    .filter((participant) => {
      if (status === "checked-in") return participant.checkedInAt !== null;
      if (status === "not-checked-in") return participant.checkedInAt === null;
      return true;
    })
    .sort((left, right) => {
      const byName =
        names.compare(left.name, right.name) ||
        left.applicationId.localeCompare(right.applicationId);
      if (sort === "name-asc") return byName;
      if (sort === "name-desc") return -byName;
      if (left.checkedInAt === null && right.checkedInAt !== null) return 1;
      if (right.checkedInAt === null && left.checkedInAt !== null) return -1;
      if (left.checkedInAt === null || right.checkedInAt === null)
        return byName;
      const byArrival =
        Date.parse(left.checkedInAt) - Date.parse(right.checkedInAt);
      if (sort === "arrival-asc") return byArrival || byName;
      return -byArrival || byName;
    });
}
