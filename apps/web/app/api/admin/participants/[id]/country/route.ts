import { db } from "@chofex/db";
import { eq } from "@chofex/db/orm";
import { participants } from "@chofex/db/schema";
import { CountryInput } from "@chofex/registration-contract";
import { Schema } from "effect";

import { requireAdminIdentity } from "@/lib/admin/auth";
import {
  HttpError,
  jsonSuccess,
  readJson,
  withApiHandler,
} from "@/lib/registration/http";

export const runtime = "nodejs";

export const PATCH = (
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    await requireAdminIdentity();
    const rawInput = await readJson(request);
    let input: typeof CountryInput.Type;
    try {
      input = Schema.decodeUnknownSync(CountryInput, {
        onExcessProperty: "error",
      })(rawInput);
    } catch {
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "Selecciona un país válido.",
      );
    }
    const { id } = await context.params;
    const [result] = await db
      .update(participants)
      .set({ countryCode: input.countryCode, updatedAt: new Date() })
      .where(eq(participants.id, id))
      .returning({
        participantId: participants.id,
        countryCode: participants.countryCode,
      });
    if (!result)
      throw new HttpError(
        404,
        "PARTICIPANT_NOT_FOUND",
        "No se encontró al participante.",
      );
    return jsonSuccess(requestId, result);
  });
