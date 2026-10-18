import { Schema } from "effect";
import { TrackSchema } from "#teams";

const id = Schema.String.pipe(Schema.check(Schema.isUUID()));
const markdown = Schema.Trim.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(30000)),
);
const url = Schema.Trim.pipe(
  Schema.check(
    Schema.isMaxLength(2048),
    Schema.makeFilter(
      (value: string) => {
        try {
          const parsed = new URL(value);
          return (
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            Boolean(parsed.hostname) &&
            !parsed.username &&
            !parsed.password &&
            !/\s/.test(value)
          );
        } catch {
          return false;
        }
      },
      { message: "Ingresa una URL HTTP o HTTPS válida sin credenciales." },
    ),
  ),
);
const githubRepositoryUrl = url.pipe(
  Schema.check(
    Schema.makeFilter(
      (value: string) => {
        const repository =
          /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/.exec(
            value,
          );
        if (!repository) return false;
        return repository
          .slice(1)
          .every((segment) => segment !== "." && segment !== "..");
      },
      {
        message:
          "Ingresa la URL del repositorio: https://github.com/organizacion/repositorio.",
      },
    ),
  ),
);
export const ProjectSubmissionSchema = Schema.Struct({
  deploymentUrl: Schema.String,
  presentationUrl: Schema.String,
  githubUrl: Schema.NullOr(Schema.String),
  description: Schema.String,
  submittedAt: Schema.String,
  updatedAt: Schema.String,
});
export type ProjectSubmission = typeof ProjectSubmissionSchema.Type;
export const ProjectUpdateSchema = Schema.Struct({
  id,
  authorName: Schema.String,
  createdAt: Schema.String,
  body: Schema.String,
});
export type ProjectUpdate = typeof ProjectUpdateSchema.Type;
export const TeamProjectSchema = Schema.Struct({
  teamId: id,
  teamName: Schema.String,
  track: Schema.NullOr(TrackSchema),
  submission: Schema.NullOr(ProjectSubmissionSchema),
  updates: Schema.Array(ProjectUpdateSchema),
  updateCount: Schema.Number,
});
export type TeamProject = typeof TeamProjectSchema.Type;
export const ProjectStateSchema = Schema.Struct({
  project: Schema.NullOr(TeamProjectSchema),
});
export type ProjectState = typeof ProjectStateSchema.Type;
export const ProjectGallerySchema = Schema.Struct({
  visible: Schema.Boolean,
  projects: Schema.Array(TeamProjectSchema),
});
export type ProjectGallery = typeof ProjectGallerySchema.Type;
export const ProjectActionSchema = Schema.Union([
  Schema.Struct({
    action: Schema.Literal("update"),
    expectedTeamId: id,
    body: markdown,
  }),
  Schema.Struct({
    action: Schema.Literal("submit"),
    expectedUpdatedAt: Schema.NullOr(
      Schema.String.pipe(
        Schema.check(
          Schema.makeFilter(
            (value: string) =>
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
                value,
              ) && Number.isFinite(Date.parse(value)),
            { message: "Versión de entrega inválida." },
          ),
        ),
      ),
    ),
    expectedTeamId: id,
    deploymentUrl: url,
    presentationUrl: url,
    githubUrl: githubRepositoryUrl,
    description: markdown,
  }),
]);
export type ProjectAction = typeof ProjectActionSchema.Type;

export const ProjectUpdateReceiptSchema = Schema.Struct({
  teamId: id,
  teamName: Schema.String,
  update: ProjectUpdateSchema,
  updateCount: Schema.Number,
});
export type ProjectUpdateReceipt = typeof ProjectUpdateReceiptSchema.Type;
export const ProjectDashboardSchema = Schema.Struct({
  submissionsOpen: Schema.Boolean,
  visible: Schema.Boolean,
  projects: Schema.Array(TeamProjectSchema),
  archives: Schema.Array(
    Schema.Struct({
      archivedAt: Schema.String,
      project: TeamProjectSchema,
    }),
  ),
});
export type ProjectDashboard = typeof ProjectDashboardSchema.Type;
