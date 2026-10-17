import { expect, test } from "bun:test";
import type { TeamProject } from "@chofex/registration-contract";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectControl } from "./project-control";
import { ProjectDetails } from "./project-details";

const project: TeamProject = {
  teamId: "00000000-0000-4000-8000-000000000001",
  teamName: "Cóndores",
  track: "transport",
  submission: {
    deploymentUrl: "https://app.example.com",
    presentationUrl: "https://slides.example.com",
    githubUrl: "https://github.com/example/project",
    description:
      "## Solución\n\n**Búsqueda accesible**\n\n<script>alert(1)</script>\n\n[Enlace inseguro](javascript:alert(1))",
    submittedAt: "2026-10-17T18:00:00Z",
    updatedAt: "2026-10-18T13:00:00Z",
  },
  updateCount: 1,
  updates: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      authorName: "Ana <equipo>",
      body: "### Decisión\n\nProbamos con **dos personas**.",
      createdAt: "2026-10-18T12:00:00Z",
    },
  ],
};

test("project pages render deliverables and attributed Markdown safely", () => {
  const html = renderToStaticMarkup(<ProjectDetails project={project} />);
  expect(html).toContain('href="https://app.example.com"');
  expect(html).toContain('href="https://slides.example.com"');
  expect(html).toContain('href="https://github.com/example/project"');
  expect(html).toContain("<h2>Solución</h2>");
  expect(html).toContain("<strong>Búsqueda accesible</strong>");
  expect(html).toContain("Ana &lt;equipo&gt;");
  expect(html).toContain("<h3>Decisión</h3>");
  expect(html).toContain("<strong>dos personas</strong>");
  expect(html).toContain('dateTime="2026-10-18T12:00:00Z"');
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('href="javascript:');
});

test("organizer review displays privately archived team submissions and logs", () => {
  const client = new QueryClient();
  try {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <ProjectControl
          initialData={{
            visible: false,
            projects: [],
            archives: [{ archivedAt: "2026-10-18T14:00:00Z", project }],
          }}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain("Equipos disueltos");
    expect(html).toContain("Cóndores");
    expect(html).toContain("<strong>dos personas</strong>");
    expect(html).toContain("Publicar galería");
    expect(html).toContain("No aparece en la galería pública.");
  } finally {
    client.clear();
  }
});

test("legacy submissions without a GitHub URL remain readable", () => {
  if (!project.submission) throw new Error("Missing submission fixture");
  const html = renderToStaticMarkup(
    <ProjectDetails
      project={{
        ...project,
        submission: { ...project.submission, githubUrl: null },
      }}
    />,
  );
  expect(html).toContain('href="https://app.example.com"');
  expect(html).not.toContain("Ver repositorio en GitHub");
});
