import { expect, test } from "bun:test";

const sourceFor = (name: string) =>
  Bun.file(new URL(`./${name}`, import.meta.url)).text();

test("challenge pages wear the same dark identity as the landing", async () => {
  const shell = await sourceFor("challenges-shell.tsx");

  expect(shell).toContain('"landing-dark flex flex-col"');
  expect(shell).toContain("BrandPage");
  // The bespoke light palette is gone: one ground for the whole project.
  expect(shell).not.toContain("challenges.css");
  expect(shell).not.toContain("challenges-light");
  expect(shell).toContain('<LandingSkipLinks applyHref="/#apply" />');
  expect(shell).toContain('<LandingFooter sectionHrefPrefix="/" />');
});

test("the challenge palette is the shared one, not a third", async () => {
  const palette = await Bun.file(
    new URL("../../../../packages/ui/src/styles/globals.css", import.meta.url),
  ).text();

  // These pages used to carry their own ground (#eee9df) and their own card,
  // which made three definitions of --hud-paper in one repo. They inherit the
  // dark set now, from the same file the landing and the decks read.
  expect(palette).toContain("--hud-paper: #050406");
  expect(palette).toContain(".brand-dark");
});

test("challenge views use landing tokens instead of the retired neon palette", async () => {
  const index = await sourceFor("challenges-index.tsx");
  const ranking = await sourceFor("ranking-view.tsx");
  const challengeViews = `${index}\n${ranking}`;

  expect(challengeViews).not.toContain("#d6ff00");
  expect(challengeViews).not.toContain("#07152b");
  expect(index).toContain("brandSectionClassName");
  expect(index).toContain("ContourSeal");
});

test("the live challenge page includes the brief and CLI instructions", async () => {
  const guide = await sourceFor("challenge-guide.tsx");
  const ranking = await sourceFor("ranking-view.tsx");

  expect(guide).toContain("25 queries");
  expect(guide).toContain("3 evaluaciones oficiales");
  expect(guide).toContain("calculateShipping(input)");
  expect(guide).toContain("curl -fsSL https://hacktheandes.com/install | bash");
  expect(guide).toContain("andes challenge query");
  expect(guide).toContain("andes challenge evaluate --source ./shipping.js");
  expect(guide).toContain("técnicos son obligatorios");
  expect(guide).toContain("no reserva una plaza");
  expect(guide).toContain("intentos legacy no cuentan");
  expect(ranking).toContain("BlackBoxChallengeGuide");
});

test("a closed challenge keeps its ranking without participation instructions", async () => {
  const ranking = await sourceFor("ranking-view.tsx");

  expect(ranking).toContain('challengeState = "Cerrado"');
  expect(ranking).toContain("&& !challenge.closed");
  expect(ranking).toContain("andes challenge ranking");
});

test("the public ranking does not reveal the hidden competitor count", async () => {
  const view = await sourceFor("ranking-view.tsx");
  const ranking = await Bun.file(
    new URL("../../lib/challenges/ranking.ts", import.meta.url),
  ).text();

  expect(view).not.toContain("Participantes");
  expect(view).not.toContain("competitorCount");
  expect(ranking).toContain("competitorCount: entries.length");
});

test("the Broken Agent page publishes the contract without hidden cases", async () => {
  const guide = await sourceFor("broken-agent-guide.tsx");
  const ranking = await sourceFor("ranking-view.tsx");

  expect(guide).toContain("Everything passes");
  expect(guide).toContain("7/7 tests verdes");
  expect(guide).toContain("5 evaluaciones oficiales");
  expect(guide).toContain("un solo puntaje sobre 100");
  expect(guide).toContain("menos evaluaciones");
  expect(guide).not.toContain("costo determinístico");
  expect(guide).toContain("2 de octubre");
  expect(guide).toContain("createScheduler");
  expect(guide).toContain("npm test");
  expect(guide).toContain("--challenge broken-agent");
  expect(guide).toContain("--review ./review.json");
  expect(guide).toContain("participante elige");
  expect(guide).toContain("ship o block");
  expect(guide).toContain("obligatorios para competir por un cupo");
  expect(guide).toContain("Face ID");
  expect(guide).toContain("intentos legacy quedan solo como");
  expect(guide).not.toContain("worker_crash_after_side_effect");
  expect(ranking).toContain("BrokenAgentChallengeGuide");
});
