import {
  blackBoxChallengeSlug,
  brokenAgentChallengeSlug,
  type ChallengeRanking,
  challengeClosingNotice,
  isChallengeRankingVisibleAt,
} from "@chofex/challenges-contract";
import {
  BrandContainer,
  BrandKicker,
  BrandSectionHeader,
  brandFrameClassName,
  brandSectionClassName,
} from "@chofex/ui/components/brand";
import Link from "next/link";
import { formatChallengeScore } from "@/lib/challenges/score";
import { BrokenAgentChallengeGuide } from "./broken-agent-guide";
import { BlackBoxChallengeGuide } from "./challenge-guide";
import { RankingCountdown } from "./ranking-countdown-view";

const executionMetricText = (
  entry: ChallengeRanking["entries"][number],
): string => `${entry.runtimeMs} ms`;

const GitHubIcon = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
  </svg>
);

const LinkedInIcon = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.7-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm1.8 13.1H3.5V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.8v20.4c0 1 .8 1.8 1.8 1.8h20.4c1 0 1.8-.8 1.8-1.8V1.8c0-1-.8-1.8-1.8-1.8z" />
  </svg>
);

const RankingResults = ({
  brokenAgent,
  entries,
}: {
  readonly brokenAgent: boolean;
  readonly entries: ChallengeRanking["entries"];
}) => {
  if (entries.length === 0) {
    return (
      <div className={`p-6 ${brandFrameClassName}`}>
        <p className="text-sm text-[var(--hud-muted)]">
          Nadie ha enviado una evaluación oficial todavía. Las soluciones se
          envían por la CLI; esta página solo muestra el ranking.
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${brandFrameClassName}`}>
      <table className="min-w-full text-left text-sm">
        <thead className="landing-type-meta text-[var(--hud-muted)]">
          <tr>
            <th className="px-4 py-3">Puesto</th>
            <th className="px-4 py-3">Participante</th>
            <th className="px-4 py-3">
              {brokenAgent ? "Puntaje" : "Accuracy"}
            </th>
            <th className="px-4 py-3">{brokenAgent ? "Puntos" : "Exactas"}</th>
            {!brokenAgent && <th className="px-4 py-3">Queries</th>}
            {!brokenAgent && <th className="px-4 py-3">Runtime</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              className="border-[var(--hud-ink)]/10 border-t"
              key={entry.shareCode}
            >
              <td className="px-4 py-3 font-mono text-[var(--hud-action)]">
                #{entry.rank}
              </td>
              <td className="px-4 py-3">
                <div>{entry.displayName}</div>
                {(entry.githubUrl || entry.linkedInUrl) && (
                  <div className="landing-type-meta mt-1 flex gap-3 text-[var(--hud-muted)]">
                    {entry.githubUrl && (
                      <a
                        aria-label={`GitHub de ${entry.displayName}`}
                        className="hover:text-[var(--hud-ink)]"
                        href={entry.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={`GitHub de ${entry.displayName}`}
                      >
                        <GitHubIcon />
                      </a>
                    )}
                    {entry.linkedInUrl && (
                      <a
                        aria-label={`LinkedIn de ${entry.displayName}`}
                        className="hover:text-[var(--hud-ink)]"
                        href={entry.linkedInUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={`LinkedIn de ${entry.displayName}`}
                      >
                        <LinkedInIcon />
                      </a>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-mono">
                {formatChallengeScore(entry.accuracy)}
              </td>
              <td className="px-4 py-3 font-mono">
                {entry.exactCount}/{entry.sampleSize}
              </td>
              {!brokenAgent && (
                <td className="px-4 py-3 font-mono">{entry.queriesUsed}</td>
              )}
              {!brokenAgent && (
                <td className="px-4 py-3 font-mono">
                  {executionMetricText(entry)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export function ChallengeRankingView({
  now,
  ranking,
}: {
  readonly now: string;
  readonly ranking: ChallengeRanking;
}) {
  const { challenge, entries } = ranking;
  const brokenAgent = challenge.slug === brokenAgentChallengeSlug;
  const rankingVisible = isChallengeRankingVisibleAt(challenge, new Date(now));
  let cliHint = "andes challenge list";
  if (challenge.closed) {
    cliHint = `andes challenge ranking --challenge ${challenge.slug}`;
  } else if (challenge.playable) {
    cliHint = `andes challenge query --challenge ${challenge.slug}`;
  }
  if (brokenAgent && !challenge.closed) {
    cliHint = "andes challenge init --challenge broken-agent";
  }
  let challengeState = "En vivo";
  if (challenge.closed) {
    challengeState = "Cerrado";
  } else if (!challenge.open) {
    challengeState = `Abre ${challenge.opensAt.slice(0, 10)}`;
  }
  let rankingContent = (
    <RankingResults brokenAgent={brokenAgent} entries={entries} />
  );
  if (!rankingVisible && challenge.rankingVisibleAt) {
    rankingContent = (
      <RankingCountdown
        initialNow={now}
        visibleAt={challenge.rankingVisibleAt}
      />
    );
  }
  let challengeGuide = null;
  if (challenge.slug === blackBoxChallengeSlug && !challenge.closed) {
    challengeGuide = <BlackBoxChallengeGuide />;
  }
  if (challenge.slug === brokenAgentChallengeSlug && !challenge.closed) {
    challengeGuide = <BrokenAgentChallengeGuide />;
  }
  let rankingDescription =
    "Ranking público de solo lectura: accuracy, empates por predicciones exactas y menos queries. Las implementaciones no se publican.";
  if (brokenAgent) {
    rankingDescription =
      "Ranking público de solo lectura: puntaje de producción, menos evaluaciones oficiales y, al final, hora de envío. Aparecen todos los puntajes válidos de personas con una postulación enviada; los casos ocultos y las implementaciones no se publican.";
  }

  return (
    <section
      aria-labelledby="challenge-ranking-heading"
      className="bg-[var(--hud-paper)]"
    >
      <BrandContainer className={brandSectionClassName}>
        <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
          <Link
            className="underline-offset-4 hover:text-[var(--hud-ink)] hover:underline"
            href="/challenges"
          >
            challenges
          </Link>{" "}
          / {challenge.theme} #{challenge.code}
        </BrandKicker>
        <BrandSectionHeader
          headingLevel="h1"
          title={challenge.title}
          titleId="challenge-ranking-heading"
        >
          <p className="max-w-2xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
            {challenge.summary}
          </p>
        </BrandSectionHeader>

        <div
          className={`mb-8 grid gap-3 p-5 sm:grid-cols-2 ${brandFrameClassName}`}
        >
          <div>
            <BrandKicker className="text-[var(--hud-muted)]">
              Estado
            </BrandKicker>
            <p className="mt-2 font-mono text-sm uppercase tracking-[0.12em] text-[var(--hud-action)]">
              {challengeState}
            </p>
          </div>
          <div>
            <BrandKicker className="text-[var(--hud-muted)]">CLI</BrandKicker>
            <p className="mt-2 break-words font-mono text-sm">{cliHint}</p>
          </div>
        </div>

        {challengeGuide}

        {challenge.closed && (
          <p className={`p-5 text-base leading-relaxed ${brandFrameClassName}`}>
            {challengeClosingNotice(challenge.title)}
          </p>
        )}

        <section aria-labelledby="ranking-heading" className="mt-14">
          <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
            resultados oficiales
          </BrandKicker>
          <h2
            className="font-display text-4xl leading-none uppercase sm:text-5xl"
            id="ranking-heading"
          >
            Ranking
          </h2>
          <p className="mt-4 mb-8 max-w-2xl text-sm leading-relaxed text-[var(--hud-muted)]">
            {rankingDescription}
          </p>
          {rankingContent}
        </section>
      </BrandContainer>
    </section>
  );
}
