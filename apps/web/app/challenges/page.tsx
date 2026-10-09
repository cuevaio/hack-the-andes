import type { Metadata } from "next";

import {
  ChallengesIndex,
  scheduledChallengeItems,
} from "@/components/challenges/challenges-index";
import { ChallengesShell } from "@/components/challenges/challenges-shell";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Challenges de clasificación | Hack the Andes",
  description:
    "Los challenges técnicos son obligatorios: envía tu postulación y compite por uno de los cupos de Hack the Andes.",
};

export default function ChallengesPage() {
  return (
    <ChallengesShell>
      <ChallengesIndex challenges={scheduledChallengeItems()} />
    </ChallengesShell>
  );
}
