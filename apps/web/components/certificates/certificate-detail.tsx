import type { ParticipationCertificate } from "@chofex/registration-contract";
import Image from "next/image";
import Link from "next/link";
import {
  certificateIssuer,
  certificateTitle,
  certificateUrl,
  linkedinCertificateUrl,
  linkedinShareUrl,
} from "@/lib/certificates/links";
import { CopyField } from "./copy-field";

export function CertificateDetail({
  certificate,
}: {
  certificate: ParticipationCertificate;
}) {
  const valid = certificate.status === "valid";
  const date = new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(certificate.issuedAt));
  const month = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(certificate.issuedAt));
  const path = `/certificate/${certificate.id}`;
  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 flex items-center justify-between gap-5">
          <Link href="/">
            <Image
              src="/brand/hack-the-andes-light.svg"
              alt="Hack the Andes"
              width={210}
              height={28}
              className="h-auto"
            />
          </Link>
          <Link
            href="/certificate"
            className="text-sm text-white/55 hover:text-white"
          >
            Obtener mi certificado
          </Link>
        </header>
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-sm text-white/60">
              {valid ? "✓ Certificado verificado" : "Certificado no válido"}
            </p>
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
              {certificate.recipientName}
            </h1>
            <p className="mt-3 text-sm text-white/55">
              Participación en Hack the Andes · Lima, 17 y 18 de octubre de 2026
            </p>
          </div>
          {valid && (
            <a
              href={`${path}/certificate.pdf`}
              className="w-fit whitespace-nowrap rounded-full bg-white px-6 py-3 text-sm text-black"
            >
              Descargar PDF
            </a>
          )}
        </div>
        {valid ? (
          <Image
            src={`${path}/certificate.png`}
            alt={`Certificado de participación de ${certificate.recipientName}, ID ${certificate.id}`}
            width={3508}
            height={2481}
            unoptimized
            className="h-auto w-full rounded-sm ring-1 ring-white/10"
          />
        ) : (
          <p role="status" className="py-16 text-white/65">
            Este certificado fue revocado o ya no tiene un check-in válido. No
            acredita participación.
          </p>
        )}
        <div className="mt-10 grid gap-12 pb-8 md:grid-cols-2 md:gap-20">
          <section className="space-y-5">
            <h2 className="text-lg">Datos del certificado</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-white/50">Identificador</dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {certificate.id}
                </dd>
              </div>
              <div>
                <dt className="text-white/50">Emisor</dt>
                <dd className="mt-1">{certificateIssuer}</dd>
              </div>
              <div>
                <dt className="text-white/50">Fecha de emisión</dt>
                <dd className="mt-1">{date}</dd>
              </div>
            </dl>
            <p className="max-w-md text-sm leading-relaxed text-white/50">
              {valid
                ? "Emitido a partir del check-in presencial registrado por la organización. El QR y este enlace permiten comprobar su validez."
                : "No utilices este certificado como acreditación vigente."}
            </p>
            {valid && (
              <a
                href={`${path}/certificate.png?download=1`}
                className="inline-block text-sm underline underline-offset-4"
              >
                Descargar imagen
              </a>
            )}
          </section>
          {valid && (
            <section>
              <h2 className="text-lg">En tu LinkedIn</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Abre «Licencias y certificaciones» y copia estos datos. Este
                certificado no caduca.
              </p>
              <dl className="mt-4">
                <CopyField label="Nombre" value={certificateTitle} />
                <CopyField
                  label="Organización emisora"
                  value={certificateIssuer}
                />
                <CopyField label="Fecha de emisión" value={month} />
                <CopyField label="ID de la credencial" value={certificate.id} />
                <CopyField
                  label="URL de la credencial"
                  value={certificateUrl(certificate.id)}
                />
              </dl>
              <div className="mt-6 flex flex-wrap gap-5 text-sm">
                <a
                  href={linkedinCertificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white px-5 py-3 text-black"
                >
                  Añadir a LinkedIn
                </a>
                <a
                  href={linkedinShareUrl(certificate.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 text-white/70 underline underline-offset-4"
                >
                  Compartir
                </a>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
