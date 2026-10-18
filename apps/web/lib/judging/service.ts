import "server-only";
import { sql } from "@chofex/db/orm";
import { clerkClient } from "@clerk/nextjs/server";
import { Schema } from "effect";
import { eventQuery } from "@/lib/event/database";
import { HttpError } from "@/lib/registration/http";
import {
  type AdminBoard,
  AdminBoardSchema,
  type AdminCommand,
  type EvaluationCommand,
  type JudgeBoard,
  JudgeBoardSchema,
  RepositoryAnalysisSchema,
} from "./contract";
import { withJudgeRole } from "./roles";

export async function getAdminBoard() {
  return withRepositoryAnalyses(
    Schema.decodeUnknownSync(AdminBoardSchema)(
      await eventQuery(sql`select judging_board() as result`),
    ),
  );
}
export async function getJudgeBoard(judgeId: string) {
  await requireActiveJudge(judgeId);
  return withRepositoryAnalyses(
    Schema.decodeUnknownSync(JudgeBoardSchema)(
      await eventQuery(sql`select judging_board(${judgeId}) as result`),
    ),
  );
}
async function requireActiveJudge(judgeId: string) {
  const active = await eventQuery(
    sql`select exists(select 1 from judging_judges where clerk_user_id=${judgeId} and active) as result`,
  );
  if (active !== true)
    throw new HttpError(
      403,
      "JUDGE_REQUIRED",
      "Tu acceso como jurado no está activo. Contacta a la organización.",
    );
}
export async function adminJudgingAction(
  adminId: string,
  command: AdminCommand,
) {
  return withRepositoryAnalyses(
    Schema.decodeUnknownSync(AdminBoardSchema)(
      await eventQuery(
        sql`select judging_admin_action(${adminId},${JSON.stringify(command)}::jsonb) as result`,
      ),
    ),
  );
}
export async function saveEvaluation(
  judgeId: string,
  command: EvaluationCommand,
) {
  return withRepositoryAnalyses(
    Schema.decodeUnknownSync(JudgeBoardSchema)(
      await eventQuery(
        sql`select judging_save_evaluation(${judgeId},${JSON.stringify(command)}::jsonb) as result`,
      ),
    ),
  );
}
export async function grantJudge(email: string) {
  const clerk = await clerkClient();
  const { data: users } = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 2,
  });
  const matches = users.filter((user) =>
    user.emailAddresses.some(
      (address) =>
        address.emailAddress.toLowerCase() === email.toLowerCase() &&
        address.verification?.status === "verified",
    ),
  );
  const user = matches[0];
  if (matches.length !== 1 || !user)
    throw new HttpError(
      422,
      "JUDGE_ACCOUNT_REQUIRED",
      "Necesitamos una cuenta con ese correo verificado. Pídele que inicie sesión primero.",
    );
  await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: { roles: withJudgeRole(user.publicMetadata) },
  });
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    email;
  await eventQuery(
    sql`insert into judging_judges(clerk_user_id,name,active) values(${user.id},${name},true) on conflict(clerk_user_id) do update set name=excluded.name,active=true returning true as result`,
  );
  return getAdminBoard();
}
export async function setJudgeActive(judgeId: string, active: boolean) {
  await eventQuery(
    sql`update judging_judges set active=${active} where clerk_user_id=${judgeId} returning true as result`,
  );
  return getAdminBoard();
}

// Only enrich the presentations already admitted by judging_board's visibility rules.
async function withRepositoryAnalyses<T extends JudgeBoard | AdminBoard>(
  board: T,
): Promise<T> {
  if (board.presentations.length === 0) return board;
  const ids = board.presentations.map((presentation) => presentation.id);
  const records = Schema.decodeUnknownSync(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        analysis: RepositoryAnalysisSchema,
      }),
    ),
  )(
    await eventQuery(
      sql`select coalesce(jsonb_agg(jsonb_build_object('id',id,'analysis',snapshot->'repositoryAnalysis')),'[]'::jsonb) as result from judging_presentations where id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`,`,
      )}) and snapshot->'repositoryAnalysis' is not null`,
    ),
  );
  const analyses = new Map(
    records.map((record) => [record.id, record.analysis]),
  );
  return {
    ...board,
    presentations: board.presentations.map((presentation) => ({
      ...presentation,
      repositoryAnalysis: analyses.get(presentation.id) ?? null,
    })),
  };
}
