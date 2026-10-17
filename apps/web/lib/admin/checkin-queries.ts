import { ApiSuccessSchema } from "@chofex/registration-contract";
import { Schema } from "effect";
import {
  CheckinConfirmationSchema,
  CheckinRosterSchema,
} from "./checkin-contract";

export const checkinRosterKey = ["admin", "checkin-roster"] as const;
async function responseData(response: Response) {
  const body: unknown = await response.json();
  if (!response.ok) {
    const failure = Schema.decodeUnknownOption(
      Schema.Struct({ error: Schema.Struct({ message: Schema.String }) }),
    )(body);
    if (failure._tag === "Some") throw new Error(failure.value.error.message);
    throw new Error("No se pudo consultar el check-in. Vuelve a intentarlo.");
  }
  return body;
}
export async function fetchCheckinRoster(search: string, signal: AbortSignal) {
  let init: RequestInit = { method: "GET", cache: "no-store", signal };
  if (search)
    init = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ search }),
      cache: "no-store",
      signal,
    };
  const response = await fetch("/api/admin/checkin", init);
  return Schema.decodeUnknownSync(ApiSuccessSchema(CheckinRosterSchema))(
    await responseData(response),
  ).data;
}
export async function confirmCheckinArrival(applicationId: string) {
  const response = await fetch("/api/admin/checkin", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ applicationId }),
    cache: "no-store",
  });
  return Schema.decodeUnknownSync(ApiSuccessSchema(CheckinConfirmationSchema))(
    await responseData(response),
  ).data;
}
