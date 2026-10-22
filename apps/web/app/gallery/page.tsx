import { BrandPage, BrandWordmarkLink } from "@chofex/ui/components/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { galleryPhotos } from "@/components/gallery/photos";
import { brandName } from "@/components/landing/content";

const title = "Galería | Hack the Andes";
const description =
  "Fotos de Hack the Andes: 30 horas construyendo en Lima. Explora la galería y descarga tus favoritas.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/gallery" },
  openGraph: { title, description, url: "/gallery" },
  twitter: { title, description },
};

export default function GalleryPage() {
  return (
    <BrandPage className="relative h-svh overflow-hidden">
      <h1 className="sr-only">Galería de Hack the Andes</h1>
      <main className="absolute inset-0">
        <PhotoGallery />
      </main>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-background via-background/70 to-transparent px-4 pt-4 pb-10 sm:px-8">
        <BrandWordmarkLink className="pointer-events-auto" href="/">
          {brandName}
        </BrandWordmarkLink>
        <Link className="pointer-events-auto text-sm hover:underline" href="/">
          Inicio
        </Link>
      </header>
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-background via-background/70 to-transparent px-4 pt-10 pb-4 sm:px-8">
        <p className="font-mono text-xs tracking-widest uppercase">
          Galería · Lima · 17–18 oct 2026
        </p>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {galleryPhotos.length} fotos · arrastra para explorar
        </p>
      </footer>
    </BrandPage>
  );
}
