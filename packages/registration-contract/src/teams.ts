import { Schema } from "effect";

export const tracks = [
  "environmental",
  "transport",
  "education",
  "security",
] as const;
export const trackNames = {
  environmental: "Clima y Territorio",
  security: "Seguridad",
  transport: "Movilidad y Transporte",
  education: "Educación Escolar",
} as const;
export const TrackSchema = Schema.Literals(tracks);
export type Track = typeof TrackSchema.Type;
const id = Schema.String.pipe(Schema.check(Schema.isUUID()));
const name = Schema.Trim.pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(80),
    Schema.isPattern(/^[^\p{C}]+$/u),
  ),
);

export const TeamActionSchema = Schema.Union([
  Schema.Struct({ action: Schema.Literal("create"), name }),
  Schema.Struct({ action: Schema.Literal("rename"), name, expectedTeamId: id }),
  Schema.Struct({
    action: Schema.Literal("invite"),
    email: Schema.Trim.pipe(
      Schema.check(
        Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
        Schema.isMaxLength(320),
      ),
    ),
  }),
  Schema.Struct({
    action: Schema.Literal("accept"),
    invitationId: id,
    expectedTeamId: Schema.NullOr(id),
  }),
  Schema.Struct({ action: Schema.Literal("decline"), invitationId: id }),
  Schema.Struct({ action: Schema.Literal("leave"), expectedTeamId: id }),
  Schema.Struct({
    action: Schema.Literal("remove"),
    participantId: id,
    expectedTeamId: id,
  }),
  Schema.Struct({
    action: Schema.Literal("track"),
    track: TrackSchema,
    expectedTeamId: id,
  }),
]);
export type TeamAction = typeof TeamActionSchema.Type;

export const TeamMemberSchema = Schema.Struct({
  id,
  name: Schema.String,
  checkedIn: Schema.Boolean,
});
export const TeamSchema = Schema.Struct({
  id,
  name: Schema.String,
  track: Schema.NullOr(TrackSchema),
  trackChangedBy: Schema.NullOr(Schema.String),
  trackChangedAt: Schema.NullOr(Schema.String),
  members: Schema.Array(TeamMemberSchema),
});
export type Team = typeof TeamSchema.Type;
export const TeamStateSchema = Schema.Struct({
  participantId: id,
  checkedIn: Schema.Boolean,
  selectionOpen: Schema.Boolean,
  team: Schema.NullOr(TeamSchema),
  invitations: Schema.Array(
    Schema.Struct({ id, teamId: id, teamName: Schema.String }),
  ),
  tracks: Schema.Array(
    Schema.Struct({
      id: TrackSchema,
      teams: Schema.Number,
      capacity: Schema.Number,
    }),
  ),
});
export type TeamState = typeof TeamStateSchema.Type;
export const TeamDashboardSchema = Schema.Struct({
  selectionOpen: Schema.Boolean,
  teams: Schema.Array(TeamSchema),
  unassigned: Schema.Array(TeamMemberSchema),
});
export type TeamDashboard = typeof TeamDashboardSchema.Type;
export const CheckinSchema = Schema.Struct({
  checkedIn: Schema.Boolean,
  token: Schema.optional(Schema.String),
  expiresAt: Schema.optional(Schema.String),
});
export type Checkin = typeof CheckinSchema.Type;
export const CheckinPreviewSchema = Schema.Struct({
  name: Schema.String,
  pictureUrl: Schema.NullOr(Schema.String),
  checkedIn: Schema.Boolean,
});
export type CheckinPreview = typeof CheckinPreviewSchema.Type;
