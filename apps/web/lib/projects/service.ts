import { sql } from "@chofex/db/orm";
import {
  ProjectActionSchema,
  ProjectDashboardSchema,
  ProjectGallerySchema,
  ProjectStateSchema,
  ProjectUpdateReceiptSchema,
} from "@chofex/registration-contract";
import { Schema } from "effect";
import {
  confirmedParticipantId,
  eventQuery,
  parseEventInput,
} from "@/lib/event/database";

export async function getProjectState(clerkUserId: string, history = true) {
  const id = await confirmedParticipantId(clerkUserId);
  let statement = sql`select hackathon_project_summary_state(${id}::uuid) as result`;
  if (history)
    statement = sql`select hackathon_project_state(${id}::uuid) as result`;
  return Schema.decodeUnknownSync(ProjectStateSchema)(
    await eventQuery(statement),
  );
}
export async function projectAction(clerkUserId: string, input: unknown) {
  const command = parseEventInput(ProjectActionSchema, input);
  const id = await confirmedParticipantId(clerkUserId);
  const result = await eventQuery(
    sql`select hackathon_project_action(${id}::uuid,${JSON.stringify(command)}::jsonb) as result`,
  );
  if (command.action === "update")
    return Schema.decodeUnknownSync(ProjectUpdateReceiptSchema)(result);
  return Schema.decodeUnknownSync(ProjectStateSchema)(result);
}
export async function getProjectGallery() {
  return Schema.decodeUnknownSync(ProjectGallerySchema)(
    await eventQuery(sql`select hackathon_project_gallery() as result`),
  );
}
export async function getPublicProject(teamId: string) {
  const gallery = await getProjectGallery();
  return gallery.projects.find((project) => project.teamId === teamId) ?? null;
}
export async function getProjectDashboard() {
  return Schema.decodeUnknownSync(ProjectDashboardSchema)(
    await eventQuery(sql`select hackathon_project_dashboard() as result`),
  );
}
export async function setProjectGalleryVisibility(
  adminId: string,
  visible: boolean,
) {
  const command = JSON.stringify({
    action: "visibility",
    galleryVisible: visible,
  });
  return Schema.decodeUnknownSync(ProjectDashboardSchema)(
    await eventQuery(
      sql`select hackathon_project_action(null,${command}::jsonb,${adminId}) as result`,
    ),
  );
}
