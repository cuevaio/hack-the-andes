import { BrandContainer, BrandPage } from "@chofex/ui/components/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { EventWifi } from "@/components/event-wifi";

export const metadata: Metadata = {
  title: "Wi-Fi | Hack the Andes",
  robots: { index: false, follow: false },
};

export default function WifiPage() {
  return (
    <BrandPage className="landing-dark">
      <BrandContainer className="py-8 sm:py-16">
        <nav className="mb-10 flex flex-wrap gap-6 text-sm">
          <Link className="underline" href="/">
            Hack the Andes
          </Link>
          <Link className="underline" href="/guide">
            Guía para equipos
          </Link>
        </nav>
        <main className="mx-auto max-w-4xl space-y-8">
          <header className="space-y-3">
            <h1 className="font-display text-4xl uppercase sm:text-6xl">
              Conéctate al Wi-Fi
            </h1>
            <p className="text-muted-foreground">
              Escanea el QR o selecciona la red e ingresa la contraseña.
            </p>
          </header>
          <EventWifi />
        </main>
      </BrandContainer>
    </BrandPage>
  );
}
