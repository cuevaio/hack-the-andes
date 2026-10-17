import { ApiSuccessSchema } from "@chofex/registration-contract";
import { Schema } from "effect";
import {
  AdminBoardSchema,
  type AdminCommand,
  type EvaluationCommand,
  JudgeBoardSchema,
} from "./contract";

export const judgeKey = (judgeId: string) =>
  ["judging", "judge", judgeId] as const;
export const adminKey = (adminId: string) =>
  ["judging", "admin", adminId] as const;
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const body: unknown = await response.json();
  if (!response.ok) {
    const failure = Schema.decodeUnknownOption(
      Schema.Struct({ error: Schema.Struct({ message: Schema.String }) }),
    )(body);
    if (failure._tag === "Some") throw new Error(failure.value.error.message);
    throw new Error(
      "No se pudo sincronizar. Revisa tu conexión y vuelve a intentarlo.",
    );
  }
  return body;
}
export async function fetchJudgeBoard(signal: AbortSignal) {
  return Schema.decodeUnknownSync(ApiSuccessSchema(JudgeBoardSchema))(
    await request("/api/judging", { signal }),
  ).data;
}
export async function fetchAdminBoard(signal: AbortSignal) {
  return Schema.decodeUnknownSync(ApiSuccessSchema(AdminBoardSchema))(
    await request("/api/admin/judging", { signal }),
  ).data;
}
function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
export async function sendEvaluation(command: EvaluationCommand) {
  return Schema.decodeUnknownSync(ApiSuccessSchema(JudgeBoardSchema))(
    await request("/api/judging", json("PATCH", command)),
  ).data;
}
export async function sendAdminCommand(command: AdminCommand) {
  return Schema.decodeUnknownSync(ApiSuccessSchema(AdminBoardSchema))(
    await request("/api/admin/judging", json("PATCH", command)),
  ).data;
}
export async function changeJudge(
  command: { email: string } | { clerkUserId: string; active: boolean },
) {
  let method = "PATCH";
  if ("email" in command) method = "POST";
  return Schema.decodeUnknownSync(ApiSuccessSchema(AdminBoardSchema))(
    await request("/api/admin/judging/judges", json(method, command)),
  ).data;
}
