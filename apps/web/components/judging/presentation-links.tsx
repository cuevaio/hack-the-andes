import type { Presentation } from "@/lib/judging/contract";

export function PresentationLinks({
  presentation,
  label,
}: {
  presentation: Presentation;
  label: string;
}) {
  const { project } = presentation;
  const repositoryUrl = project.submission?.githubUrl;
  return (
    <article className="space-y-3 rounded-xl border p-5">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <h3 className="text-lg font-semibold">{project.teamName}</h3>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {project.submission && (
          <>
            <a
              className="underline"
              href={project.submission.presentationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver presentación
            </a>
            <a
              className="underline"
              href={project.submission.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir aplicación
            </a>
          </>
        )}
        {repositoryUrl && (
          <a
            className="underline"
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir repositorio
          </a>
        )}
      </div>
      {!project.submission && (
        <p className="text-sm text-muted-foreground">
          Sin presentación ni aplicación enviadas.
        </p>
      )}
      {!repositoryUrl && (
        <p className="text-sm text-muted-foreground">
          Repositorio no disponible.
        </p>
      )}
    </article>
  );
}
