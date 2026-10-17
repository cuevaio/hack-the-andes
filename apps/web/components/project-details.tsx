import { type TeamProject, trackNames } from "@chofex/registration-contract";
import { LegalDocument } from "@/components/legal-document";

export function ProjectTimestamp({ value }: { value: string }) {
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(new Date(value))}
    </time>
  );
}

export function ProjectDetails({ project }: { project: TeamProject }) {
  const { submission } = project;
  return (
    <div className="space-y-8">
      {project.track && (
        <p className="text-sm text-muted-foreground">
          {trackNames[project.track]}
        </p>
      )}
      {submission ? (
        <section className="space-y-5">
          <div className="flex flex-wrap gap-4">
            <a
              className="underline"
              href={submission.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir aplicación
            </a>
            <a
              className="underline"
              href={submission.presentationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver presentación
            </a>
            {submission.githubUrl && (
              <a
                className="underline"
                href={submission.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver repositorio en GitHub
              </a>
            )}
          </div>
          <LegalDocument>{submission.description}</LegalDocument>
          <p className="text-sm text-muted-foreground">
            Última edición: <ProjectTimestamp value={submission.updatedAt} />
          </p>
        </section>
      ) : (
        <p className="text-muted-foreground">
          Este equipo aún no ha enviado su proyecto.
        </p>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Bitácora del equipo</h2>
        <p className="text-sm text-muted-foreground">
          Avances, decisiones y dificultades que el equipo compartió con
          mentores y jurados.
        </p>
        {project.updates.length === 0 && (
          <p className="text-muted-foreground">
            Todavía no hay actualizaciones.
          </p>
        )}
        <ol className="space-y-4">
          {project.updates.map((update) => (
            <li key={update.id} className="space-y-4 rounded-xl border p-5">
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold">{update.authorName}</span>
                <span className="text-muted-foreground">
                  <ProjectTimestamp value={update.createdAt} />
                </span>
              </p>
              <LegalDocument>{update.body}</LegalDocument>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
