import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectDetails } from "@/components/project-details";
import { getPublicProject } from "@/lib/projects/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proyecto | Hack the Andes" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getPublicProject(id);
  if (!project) notFound();
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
      <Link className="underline" href="/projects">
        Volver a proyectos
      </Link>
      <h1 className="break-words text-3xl font-semibold">{project.teamName}</h1>
      <ProjectDetails project={project} />
    </main>
  );
}
