import { Schema } from "effect";

const id = Schema.String.pipe(Schema.check(Schema.isUUID()));
export const CheckinParticipantSchema = Schema.Struct({
  participantId: id,
  applicationId: id,
  name: Schema.String,
  legalName: Schema.String,
  email: Schema.String,
  pictureUrl: Schema.NullOr(Schema.String),
  document: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("available"),
      lastFour: Schema.String,
    }),
    Schema.Struct({ status: Schema.Literals(["not-provided", "unavailable"]) }),
  ]),
  eligibility: Schema.Literals(["ready", "confirmation-required"]),
  checkedInAt: Schema.NullOr(Schema.String),
});
export type CheckinParticipant = typeof CheckinParticipantSchema.Type;
export const CheckinRosterSchema = Schema.Struct({
  participants: Schema.Array(CheckinParticipantSchema),
  counts: Schema.Struct({
    total: Schema.Number,
    checkedIn: Schema.Number,
    pending: Schema.Number,
    confirmationRequired: Schema.Number,
  }),
});
export type CheckinRoster = typeof CheckinRosterSchema.Type;
export const CheckinSearchSchema = Schema.Struct({
  search: Schema.Trim.pipe(Schema.check(Schema.isMaxLength(200))),
});
export const CheckinConfirmationInputSchema = Schema.Struct({
  applicationId: id,
});
export const CheckinConfirmationSchema = Schema.Struct({
  applicationId: id,
  checkedInAt: Schema.String,
});
export const checkinStatuses = ["all", "checked-in", "not-checked-in"] as const;
export const CheckinStatusSchema = Schema.Literals(checkinStatuses);
export type CheckinStatus = (typeof checkinStatuses)[number];
export const checkinSorts = [
  "name-asc",
  "name-desc",
  "arrival-desc",
  "arrival-asc",
] as const;
export const CheckinSortSchema = Schema.Literals(checkinSorts);
export type CheckinSort = (typeof checkinSorts)[number];
