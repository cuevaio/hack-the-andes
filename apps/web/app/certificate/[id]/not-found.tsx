import Link from "next/link";

export default function CertificateNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-lg space-y-5">
        <h1 className="text-3xl">Certificado no encontrado</h1>
        <p className="leading-relaxed text-white/60">
          No encontramos un certificado con este ID. Revisa el enlace o escanea
          el QR del certificado original.
        </p>
        <Link
          href="/"
          className="inline-block text-sm underline underline-offset-4"
        >
          Hack the Andes
        </Link>
      </div>
    </main>
  );
}
