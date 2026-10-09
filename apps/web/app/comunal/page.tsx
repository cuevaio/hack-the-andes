import type { Metadata } from "next";

import DeckPage, {
  generateMetadata as deckMetadata,
} from "../deck/[...slug]/page";

const params = Promise.resolve({ slug: ["comunal"] });

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await deckMetadata({ params });
  return { ...metadata, alternates: { canonical: "/comunal" } };
}

export default function ComunalPage() {
  return <DeckPage params={params} />;
}
