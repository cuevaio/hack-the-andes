import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Condiciones de entrega y presentación | Hack the Andes",
};

export default async function Page() {
  const markdown = await readFile(
    path.join(process.cwd(), "content/event/participation-terms.md"),
    "utf8",
  );
  return <LegalPage>{markdown}</LegalPage>;
}
