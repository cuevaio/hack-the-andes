import { BrandKicker, brandFrameClassName } from "@chofex/ui/components/brand";
import { ShellCommand } from "@/components/shell-command";

const workflow = [
  {
    title: "Prepara tu solución",
    command: "andes challenge init --challenge mountain-lodge",
    body: "Crea mountain-lodge/ con stay.js, input.json y el contrato. Luego entra a esa carpeta.",
  },
  {
    title: "Consulta el sistema de reservas",
    command:
      "andes challenge query --challenge mountain-lodge --input input.json",
    body: "Cambia una variable a la vez. Cada consulta exitosa consume una de tus 25 solicitudes. Las repetidas y fallidas no consumen presupuesto.",
  },
  {
    title: "Estudia el cuaderno",
    command: "andes challenge notebook --challenge mountain-lodge",
    body: "Compara duraciones, huéspedes, horarios, equipo propio y expediciones. Prueba límites e interacciones; no asumas las reglas del challenge de envíos.",
  },
  {
    title: "Prueba tu función",
    command:
      "andes challenge test --challenge mountain-lodge --source ./stay.js",
    body: "Define quoteStay(input) y devuelve céntimos enteros. Estos tests comparan tu código con el cuaderno y son gratuitos.",
  },
  {
    title: "Envía una evaluación oficial",
    command:
      "andes challenge evaluate --challenge mountain-lodge --source ./stay.js",
    body: "Cada evaluación consume uno de tus 3 intentos y mide coincidencias exactas en 1,000 cotizaciones ocultas. El ranking conserva tu mejor resultado.",
  },
];

export function MountainLodgeChallengeGuide() {
  return (
    <div className="mt-14 space-y-10">
      <section aria-labelledby="mountain-lodge-brief">
        <BrandKicker>Challenge 05 / Refugio de montaña</BrandKicker>
        <h2
          id="mountain-lodge-brief"
          className="mt-3 font-display text-4xl uppercase"
        >
          El reto
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed">
          Un refugio perdió el código de su sistema de reservas. Solo conserva
          una máquina que recibe cinco campos y devuelve un importe. Descubre
          sus reglas y reemplázala con <code>quoteStay(input)</code>.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Las tarifas son ficticias. No necesitas conocimientos de turismo. Cada
          cotización es independiente y las reglas permanecen fijas para tu
          intento, con parámetros personalizados por participante. Puedes usar
          AI.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt>
              <code>durationHours</code>
            </dt>
            <dd>Duración de la estancia en horas. Entero de 0 a 2,000.</dd>
          </div>
          <div>
            <dt>
              <code>guests</code>
            </dt>
            <dd>Cantidad de huéspedes. Entero de 0 a 100.</dd>
          </div>
          <div>
            <dt>
              <code>arrivalHour</code>
            </dt>
            <dd>Hora local de llegada. Entero de 0 a 23.</dd>
          </div>
          <div>
            <dt>
              <code>equipment</code> y <code>expedition</code>
            </dt>
            <dd>
              Booleanos que indican equipo propio y reserva de una expedición.
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm">
          Los cinco campos son obligatorios. Devuelve el importe en céntimos
          enteros, sin imports ni acceso a archivos o red. El source admite
          hasta 32,768 caracteres.
        </p>
        <p className="mt-4 text-sm">
          Gana el porcentaje de coincidencias exactas. Los empates favorecen
          menos consultas, menor tiempo de ejecución y luego la fecha del
          resultado. Los tests del cuaderno no certifican el puntaje oculto.
        </p>
      </section>
      <section aria-labelledby="mountain-lodge-workflow">
        <h2
          id="mountain-lodge-workflow"
          className="font-display text-4xl uppercase"
        >
          Cómo participar
        </h2>
        <p className="mt-4">
          Instala la CLI e inicia sesión con <code>andes login</code> antes de
          consultar o evaluar.
        </p>
        <ol className="mt-6 grid gap-4">
          {workflow.map((item) => (
            <li key={item.title} className={`p-6 ${brandFrameClassName}`}>
              <h3 className="font-semibold">{item.title}</h3>
              <pre className="brand-code mt-3 overflow-x-auto border p-4 text-sm">
                <ShellCommand command={item.command} />
              </pre>
              <p className="mt-3 text-sm leading-relaxed text-[var(--hud-muted)]">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
