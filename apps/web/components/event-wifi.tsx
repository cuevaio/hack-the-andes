import Image from "next/image";

export function EventWifi() {
  return (
    <div className="grid min-w-0 items-center gap-8 md:grid-cols-2 md:gap-12">
      <dl className="min-w-0 space-y-8">
        <div>
          <dt className="mb-3 font-mono text-sm uppercase tracking-widest text-neutral-300">
            Red Wi-Fi
          </dt>
          <dd className="break-all font-mono text-2xl font-semibold sm:text-4xl">
            TP-Link_DADE_5G
          </dd>
        </div>
        <div>
          <dt className="mb-3 font-mono text-sm uppercase tracking-widest text-neutral-300">
            Contraseña
          </dt>
          <dd className="font-mono text-3xl font-semibold sm:text-5xl">
            02234847
          </dd>
        </div>
      </dl>
      <figure className="mx-auto w-full max-w-sm">
        <Image
          src="/wifi/qr.png"
          alt="QR para conectarte a la red Wi-Fi TP-Link_DADE_5G"
          width={444}
          height={444}
          unoptimized
          className="h-auto w-full rounded-xl bg-white"
        />
        <figcaption className="mt-3 text-center text-sm text-neutral-300">
          Escanea con la cámara para conectarte.
        </figcaption>
      </figure>
    </div>
  );
}
