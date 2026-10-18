import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import type { Presentation } from "@/lib/judging/contract";
import { EvaluationForm } from "./evaluation-form";
import { JudgingControl } from "./judging-control";
import { RepositoryAnalysis } from "./repository-analysis";

const analysis = {
  repositoryUrl: "https://github.com/example/project",
  commitSha: "1234567890abcdef",
  analyzedAt: "2026-10-18T15:00:00Z",
  model: "Claude Sonnet",
  status: "completed",
  summary: "Implementa un tablero <script>alert(1)</script>.",
  architecture: "Next.js y PostgreSQL.",
  implementedFeatures: ["Registro de mediciones"],
  strengths: ["Validación de entradas"],
  risks: ["Falta autenticación"],
  questions: ["¿Cómo validaron el uso en clase?"],
  limitations: ["No se ejecutó la aplicación."],
} satisfies NonNullable<Presentation["repositoryAnalysis"]>;

test("analysis renders evidence, provenance and limitations without executing repository text", () => {
  const html = renderToStaticMarkup(<RepositoryAnalysis analysis={analysis} />);
  for (const expected of [
    "Next.js y PostgreSQL.",
    "Registro de mediciones",
    "Validación de entradas",
    "Falta autenticación",
    "¿Cómo validaron el uso en clase?",
    "No se ejecutó la aplicación.",
    "1234567890abcdef",
    "Claude Sonnet",
    'dateTime="2026-10-18T15:00:00Z"',
    "18/10/2026",
    "10:00:00",
    "&lt;script&gt;",
  ]) {
    expect(html).toContain(expected);
  }
  expect(html).not.toContain("<script>");
});

test("missing and unavailable reviews make their limits explicit", () => {
  expect(
    renderToStaticMarkup(<RepositoryAnalysis analysis={null} />),
  ).toContain("todavía no está disponible");
  expect(
    renderToStaticMarkup(<RepositoryAnalysis analysis={undefined} />),
  ).toContain("todavía no está disponible");
  const html = renderToStaticMarkup(
    <RepositoryAnalysis
      analysis={{
        ...analysis,
        status: "unavailable",
        summary: "El repositorio es privado.",
        architecture: "",
        implementedFeatures: [],
      }}
    />,
  );
  expect(html).toContain("No se pudo completar la revisión del código.");
  expect(html).toContain("El repositorio es privado.");
  expect(html).not.toContain("Funciones implementadas");
});

test("judges and organizers receive the same analysis in project context", () => {
  const presentation = {
    id: "00000000-0000-4000-8000-000000000001",
    project: {
      teamId: "00000000-0000-4000-8000-000000000001",
      teamName: "Cóndores",
      track: null,
      submission: null,
      updateCount: 0,
      updates: [],
    },
    members: ["Ana"],
    position: 1,
    status: "current",
    presentedAt: "2026-10-18T15:00:00Z",
    repositoryAnalysis: analysis,
  } satisfies Presentation;
  const client = new QueryClient();
  try {
    const judgeHtml = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <EvaluationForm
          presentation={presentation}
          evaluation={undefined}
          judgeId="judge"
          current
          connected
        />
      </QueryClientProvider>,
    );
    const adminHtml = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <JudgingControl
          adminId="admin"
          initialData={{
            session: {
              initializedAt: "2026-10-18T15:00:00Z",
              currentPresentationId: presentation.id,
              revision: 1,
              remainingMs: 60000,
              running: false,
              serverNow: "2026-10-18T15:00:00Z",
            },
            remainingTeams: 0,
            presentations: [presentation],
            evaluations: [],
            judges: [],
          }}
        />
      </QueryClientProvider>,
    );
    for (const html of [judgeHtml, adminHtml]) {
      expect(html).toContain("Cóndores");
      expect(html).toContain("Análisis del repositorio con Claude Code");
      expect(html).toContain("Falta autenticación");
      expect(html).toContain("No se ejecutó la aplicación.");
    }
    expect(adminHtml).toContain("Análisis de los proyectos");
  } finally {
    client.clear();
  }
});
