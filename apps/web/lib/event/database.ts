import type { SQL } from "@chofex/db/orm";
import { sql } from "@chofex/db/orm";
import { Schema, SchemaIssue } from "effect";
import { HttpError } from "@/lib/registration/http";

const databaseErrorSchema = Schema.Struct({
  error: Schema.Struct({ code: Schema.String, message: Schema.String }),
});

export function parseEventInput<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown,
): S["Type"] {
  try {
    return Schema.decodeUnknownSync(schema, {
      onExcessProperty: "error",
      errors: "all",
    })(input);
  } catch (error) {
    if (!Schema.isSchemaError(error)) throw error;
    const formatted = SchemaIssue.makeFormatterStandardSchemaV1({
      leafHook: (issue) => {
        if (issue._tag === "MissingKey") return "Este campo es obligatorio.";
        return "Valor inválido para este campo.";
      },
      checkHook: (issue) =>
        SchemaIssue.defaultCheckHook(issue) ??
        "Revisa el formato o la longitud de este campo.",
    })(error.issue);
    const issues = formatted.issues.map((issue) => ({
      field: (issue.path ?? [])
        .map((part) => {
          if (typeof part === "object") return String(part.key);
          return String(part);
        })
        .join("."),
      reason: issue.message,
    }));
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Revisa los campos indicados.",
      false,
      { issues },
    );
  }
}

export async function eventQuery(statement: SQL): Promise<unknown> {
  const { db } = await import("@chofex/db");
  const result = await db.execute(statement);
  const value = result.rows[0]?.result;
  if (value && typeof value === "object" && "error" in value) {
    const { error } = Schema.decodeUnknownSync(databaseErrorSchema)(value);
    let status = 409;
    if (
      error.code === "ADMIN_REQUIRED" ||
      error.code === "CONFIRMATION_REQUIRED"
    )
      status = 403;
    if (error.code === "VALIDATION_ERROR") status = 422;
    throw new HttpError(status, error.code, error.message);
  }
  return value;
}

export async function confirmedParticipantId(
  clerkUserId: string,
): Promise<string> {
  const value = await eventQuery(
    sql`select participant_id as result from hackathon_confirmed_participants where clerk_user_id=${clerkUserId}`,
  );
  if (typeof value !== "string")
    throw new HttpError(
      403,
      "CONFIRMATION_REQUIRED",
      "Necesitas una postulación aceptada y confirmar tu asistencia con andes confirm.",
    );
  return value;
}
