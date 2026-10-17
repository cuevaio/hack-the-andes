import Link from "next/link";
import { getProjectGallery } from "@/lib/projects/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proyectos | Hack the Andes" };

export default async function ProjectsPage() {
  const gallery = await getProjectGallery();
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-10">
      <nav
        aria-label="Navegación del evento"
        className="flex flex-wrap gap-5 text-sm"
      >
        <Link className="underline" href="/">
          Inicio
        </Link>
        <Link className="underline" href="/teams">
          Equipos
        </Link>
        <Link className="underline" href="/guide">
          Guía de participantes
        </Link>
        <Link className="underline" href="/participation-terms">
          Condiciones de participación
        </Link>
      </nav>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Proyectos de Hack the Andes</h1>
        <p className="text-muted-foreground">
          Conoce lo que construyeron los equipos y cómo evolucionaron sus
          proyectos.
        </p>
      </div>
      {!gallery.visible && (
        <p className="rounded-xl border p-6">
          La galería todavía no está publicada. La organización anunciará su
          apertura.
        </p>
      )}
      {gallery.visible && gallery.projects.length === 0 && (
        <p>Aún no hay proyectos enviados.</p>
      )}
      {gallery.visible && (
        <div className="grid gap-5 sm:grid-cols-2">
          {gallery.projects.map((project) => (
            <article
              key={project.teamId}
              className="space-y-3 rounded-xl border bg-card p-6"
            >
              <h2 className="break-words text-xl font-semibold">
                <Link
                  className="underline underline-offset-4"
                  href={`/projects/${project.teamId}`}
                >
                  {project.teamName}
                </Link>
              </h2>
              <p className="text-sm text-muted-foreground">
                {project.updateCount} avances del equipo
              </p>
              <Link
                className="inline-block underline"
                href={`/projects/${project.teamId}`}
              >
                Ver proyecto y bitácora
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
