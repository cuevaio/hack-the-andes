import type { RoleMetadata } from "@/lib/admin/roles";

export const JUDGE_ROLE = "judge";
export function metadataHasRole(metadata: RoleMetadata, role: string): boolean {
  return (
    metadata.role === role ||
    (Array.isArray(metadata.roles) && metadata.roles.includes(role))
  );
}
export function hasJudgingRole(
  publicMetadata: RoleMetadata,
  privateMetadata: RoleMetadata,
  role: "admin" | "judge",
) {
  return (
    metadataHasRole(publicMetadata, role) ||
    metadataHasRole(privateMetadata, role)
  );
}
export function withJudgeRole(metadata: RoleMetadata): string[] {
  const roles = new Set<string>();
  if (typeof metadata.role === "string") roles.add(metadata.role);
  if (Array.isArray(metadata.roles)) {
    for (const role of metadata.roles)
      if (typeof role === "string") roles.add(role);
  }
  roles.add(JUDGE_ROLE);
  return [...roles];
}
