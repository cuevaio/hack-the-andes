import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tu certificado | Hack the Andes",
  robots: { index: false, follow: false },
};

export default function CertificateGuidePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-xl space-y-8">
        <Link href="/">
          <Image
            src="/brand/hack-the-andes-light.svg"
            alt="Hack the Andes"
            width={260}
            height={34}
            className="h-auto"
          />
        </Link>
        <h1 className="text-4xl font-medium tracking-tight">Tu certificado</h1>
        <p className="leading-relaxed text-white/60">
          Ejecuta este comando en el CLI con la cuenta que usaste para
          participar.
        </p>
        <pre className="rounded-xl bg-white/5 px-6 py-5 text-lg text-white">
          <code>andes certificate</code>
        </pre>
        <p className="leading-relaxed text-white/60">
          Si tu check-in presencial está registrado, recibirás el enlace de tu
          certificado. Desde allí puedes descargarlo, verificarlo y añadirlo a
          LinkedIn.
        </p>
        <p className="text-sm text-white/50">
          Si el comando no aparece, ejecuta{" "}
          <code className="text-white/80">andes update</code>.
        </p>
        <Link href="/" className="block text-sm text-white/50 hover:text-white">
          Volver a Hack the Andes
        </Link>
      </div>
    </main>
  );
}
