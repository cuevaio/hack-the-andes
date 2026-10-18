import { TeamProjectSchema } from "@chofex/registration-contract";
import { Schema } from "effect";

const id = Schema.String.pipe(Schema.check(Schema.isUUID()));
const version = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)));
const score = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
);
export const EvaluationFieldsSchema = Schema.Struct({
  traction: Schema.NullOr(score),
  technical: Schema.NullOr(score),
  pitch: Schema.NullOr(score),
  notes: Schema.String.pipe(Schema.check(Schema.isMaxLength(4000))),
});
export type EvaluationFields = typeof EvaluationFieldsSchema.Type;
export const EvaluationSchema = Schema.Struct({
  ...EvaluationFieldsSchema.fields,
  presentationId: id,
  judgeId: Schema.String,
  revision: version,
  submittedAt: Schema.NullOr(Schema.String),
});
export type Evaluation = typeof EvaluationSchema.Type;
export const PresentationSchema = Schema.Struct({
  id,
  project: TeamProjectSchema,
  members: Schema.Array(Schema.String),
  position: Schema.Int,
  status: Schema.Literals(["queued", "current", "finished", "skipped"]),
  presentedAt: Schema.NullOr(Schema.String),
});
export type Presentation = typeof PresentationSchema.Type;
export const SessionSchema = Schema.Struct({
  initializedAt: Schema.NullOr(Schema.String),
  currentPresentationId: Schema.NullOr(id),
  revision: version,
  remainingMs: Schema.Number,
  running: Schema.Boolean,
  serverNow: Schema.String,
});
export type JudgingSession = typeof SessionSchema.Type;
export const JudgeSchema = Schema.Struct({
  clerkUserId: Schema.String,
  name: Schema.String,
  active: Schema.Boolean,
});
export const JudgeBoardSchema = Schema.Struct({
  remainingTeams: version,
  session: SessionSchema,
  presentations: Schema.Array(PresentationSchema),
  evaluations: Schema.Array(EvaluationSchema),
});
export type JudgeBoard = typeof JudgeBoardSchema.Type;
export const AdminBoardSchema = Schema.Struct({
  ...JudgeBoardSchema.fields,
  judges: Schema.Array(JudgeSchema),
});
export type AdminBoard = typeof AdminBoardSchema.Type;
export const EvaluationCommandSchema = Schema.Struct({
  ...EvaluationFieldsSchema.fields,
  presentationId: id,
  expectedRevision: version,
  submit: Schema.Boolean,
});
export type EvaluationCommand = typeof EvaluationCommandSchema.Type;
export const AdminCommandSchema = Schema.Union([
  Schema.Struct({
    action: Schema.Literals(["initialize", "pause", "resume", "finish"]),
    expectedRevision: version,
  }),
  Schema.Struct({
    action: Schema.Literal("present"),
    presentationId: id,
    expectedRevision: version,
  }),
  Schema.Struct({
    action: Schema.Literal("reopen"),
    presentationId: id,
    judgeId: Schema.String,
    expectedRevision: version,
  }),
]);
export type AdminCommand = typeof AdminCommandSchema.Type;
export const GrantJudgeSchema = Schema.Struct({
  email: Schema.Trim.pipe(
    Schema.check(
      Schema.isMaxLength(320),
      Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    ),
  ),
});
export const JudgeActiveSchema = Schema.Struct({
  clerkUserId: Schema.String,
  active: Schema.Boolean,
});

export function weightedScore(fields: EvaluationFields): number | null {
  if (
    fields.traction === null ||
    fields.technical === null ||
    fields.pitch === null
  )
    return null;
  return fields.traction * 6 + fields.technical * 8 + fields.pitch * 6;
}
export const rubric = [
  {
    key: "traction",
    label: "Tracción",
    weight: "30%",
    anchors:
      "1: Sin evidencia externa. 3: Entrevistas o señales verificables de interés y aprendizaje. 5: Uso real, retención o demanda sólida con evidencia.",
  },
  {
    key: "technical",
    label: "Esfuerzo técnico",
    weight: "40%",
    anchors:
      "1: Plantilla con cambios mínimos o sin funcionamiento. 3: Producto funcional con lógica e integraciones propias. 5: Ingeniería sólida, decisiones justificadas y problemas complejos resueltos. Usar IA no resta puntos por sí solo.",
  },
  {
    key: "pitch",
    label: "Pitch",
    weight: "30%",
    anchors:
      "1: Problema o solución poco claros. 3: Explicación y demostración comprensibles. 5: Propuesta convincente, demostración clara y respuestas precisas.",
  },
] as const;
