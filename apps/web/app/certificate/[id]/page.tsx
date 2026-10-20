import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CertificateDetail } from "@/components/certificates/certificate-detail";
import { certificateUrl } from "@/lib/certificates/links";
import { findCertificate } from "@/lib/certificates/service";

export const dynamic = "force-dynamic";
const getCertificate = cache(findCertificate);
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const certificate = await getCertificate(id);
  if (!certificate)
    return {
      title: "Certificado no encontrado | Hack the Andes",
      robots: { index: false, follow: false },
    };
  const title = `${certificate.recipientName} · Hack the Andes 2026`;
  let description = "Certificado de participación no válido.";
  if (certificate.status === "valid")
    description =
      "Certificado de participación verificado. Hack the Andes, Lima, 17 y 18 de octubre de 2026.";
  const openGraph: NonNullable<Metadata["openGraph"]> = {
    title,
    description,
    url: certificateUrl(id),
    type: "website",
    images: [],
  };
  if (certificate.status === "valid")
    openGraph.images = [
      {
        url: `${certificateUrl(id)}/certificate.png`,
        width: 3508,
        height: 2481,
        alt: title,
      },
    ];
  return {
    title,
    description,
    alternates: { canonical: certificateUrl(id) },
    robots: { index: false, follow: false },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images:
        certificate.status === "valid"
          ? [`${certificateUrl(id)}/certificate.png`]
          : [],
    },
  };
}

export default async function CertificatePage({ params }: Props) {
  const certificate = await getCertificate((await params).id);
  if (!certificate) notFound();
  return <CertificateDetail certificate={certificate} />;
}
