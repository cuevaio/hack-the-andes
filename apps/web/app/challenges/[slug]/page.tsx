import { challengeBySlug } from "@chofex/challenges-contract";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengesShell } from "@/components/challenges/challenges-shell";
import { ChallengeRankingView } from "@/components/challenges/ranking-view";
import { currentChallengeTime } from "@/lib/challenges/clock";
import { getPublicChallengeRanking } from "@/lib/challenges/public-ranking";
import { HttpError } from "@/lib/registration/http";

// Returning no build-time paths enables on-demand ISR without querying the
// production database while the deployment image is being built.
export const generateStaticParams = () => [];

// Serve the prerendered response while Next rebuilds it in the background, so
// first paint does not wait on a fresh server render or ranking query.
export const revalidate = 60;

interface ChallengeRankingPageProps {
  readonly params: Promise<{ slug: string }>;
}

export const generateMetadata = async ({
  params,
}: ChallengeRankingPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const challenge = challengeBySlug(slug);
  if (!challenge) return { title: "Challenge | Hack the Andes" };
  return {
    title: `${challenge.title} | Challenge de Hack the Andes`,
    description: challenge.summary,
  };
};

export default async function ChallengeRankingPage({
  params,
}: ChallengeRankingPageProps) {
  const { slug } = await params;
  try {
    const now = currentChallengeTime();
    const ranking = await getPublicChallengeRanking(slug);
    return (
      <ChallengesShell>
        <ChallengeRankingView now={now.toISOString()} ranking={ranking} />
      </ChallengesShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
