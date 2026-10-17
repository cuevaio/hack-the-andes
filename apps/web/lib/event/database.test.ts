import { expect, test } from "bun:test";
import { ProjectActionSchema } from "@chofex/registration-contract";
import { Schema } from "effect";
import { HttpError } from "@/lib/registration/http";
import { parseEventInput } from "./database";

test("event validation identifies invalid fields without echoing supplied secrets", () => {
  try {
    parseEventInput(ProjectActionSchema, {
      action: "submit",
      expectedTeamId: "00000000-0000-4000-8000-000000000001",
      expectedUpdatedAt: null,
      deploymentUrl: "https://user:do-not-echo@demo.example.com",
      presentationUrl: "https://slides.example.com",
      description: "Proyecto",
    });
    throw new Error("Expected invalid deployment URL");
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    expect(error.status).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
    const details = Schema.decodeUnknownSync(
      Schema.Struct({
        issues: Schema.Array(
          Schema.Struct({ field: Schema.String, reason: Schema.String }),
        ),
      }),
    )(error.details);
    expect(details.issues).toContainEqual({
      field: "deploymentUrl",
      reason: "Ingresa una URL HTTP o HTTPS válida sin credenciales.",
    });
    expect(JSON.stringify(details)).not.toContain("do-not-echo");
  }
});
