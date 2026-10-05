import {
  ChallengeLocalTestResultSchema,
  ChallengeScoreSchema,
  JavascriptSourceSolutionSchema,
} from "@chofex/challenges-contract";
import { PowerReadingSchema } from "@chofex/challenges-contract/power-grid";
import { Schema } from "effect";

export const PreviewObservationSchema = Schema.Struct({
  input: PowerReadingSchema,
  output: Schema.Finite,
});
export type PreviewObservation = typeof PreviewObservationSchema.Type;
const source = JavascriptSourceSolutionSchema.fields.source;
export const AdminPreviewRequestSchema = Schema.Union([
  Schema.Struct({ action: Schema.Literal("unlock") }),
  Schema.Struct({ action: Schema.Literal("query"), input: PowerReadingSchema }),
  Schema.Struct({
    action: Schema.Literal("test"),
    source,
    observations: Schema.Array(PreviewObservationSchema).pipe(
      Schema.check(Schema.isMaxLength(25)),
    ),
  }),
  Schema.Struct({ action: Schema.Literal("evaluate"), source }),
]);
export type AdminPreviewRequest = typeof AdminPreviewRequestSchema.Type;
export const AdminPreviewResultSchema = Schema.Union([
  Schema.Struct({
    action: Schema.Literal("unlock"),
    version: Schema.Literal("power-grid-v1"),
  }),
  Schema.Struct({
    action: Schema.Literal("query"),
    observation: PreviewObservationSchema,
  }),
  Schema.Struct({
    action: Schema.Literal("test"),
    result: ChallengeLocalTestResultSchema,
  }),
  Schema.Struct({
    action: Schema.Literal("evaluate"),
    score: ChallengeScoreSchema,
  }),
]);
export type AdminPreviewResult = typeof AdminPreviewResultSchema.Type;
