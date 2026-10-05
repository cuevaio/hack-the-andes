import { BrandKicker, brandFrameClassName } from "@chofex/ui/components/brand";
import { ShellCommand } from "@/components/shell-command";

const workflow = [
  {
    title: "Prepara tu solución",
    command: "andes challenge init --challenge power-grid",
    body: "Crea power-grid/ con bill.js, input.json y el contrato. Luego entra a esa carpeta.",
  },
  {
    title: "Consulta el facturador",
    command: "andes challenge query --challenge power-grid --input input.json",
    body: "Cambia una variable a la vez. Cada consulta exitosa consume una de tus 25 solicitudes. Las repetidas y fallidas no consumen presupuesto.",
  },
  {
    title: "Estudia el cuaderno",
    command: "andes challenge notebook --challenge power-grid",
    body: "Compara consumos, demandas, horarios, generación solar y contratos. Prueba límites e interacciones; no asumas las reglas del challenge de envíos.",
  },
  {
    title: "Prueba tu función",
    command: "andes challenge test --challenge power-grid --source ./bill.js",
    body: "Define calculateBill(input) y devuelve céntimos enteros. Estos tests comparan tu código con el cuaderno y son gratuitos.",
  },
  {
    title: "Envía una evaluación oficial",
    command:
      "andes challenge evaluate --challenge power-grid --source ./bill.js",
    body: "Cada evaluación consume uno de tus 3 intentos y mide coincidencias exactas en 1,000 lecturas ocultas. El ranking conserva tu mejor resultado.",
  },
];

export function PowerGridChallengeGuide() {
  return (
    <div className="mt-14 space-y-10">
      <section aria-labelledby="power-grid-brief">
        <BrandKicker>Challenge 04 / Power Grid</BrandKicker>
        <h2
          id="power-grid-brief"
          className="mt-3 font-display text-4xl uppercase"
        >
          El reto
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed">
          Una cooperativa perdió el código de su facturador eléctrico. Solo
          conserva una máquina que recibe cinco campos y devuelve un importe.
          Descubre sus reglas y reemplázala con{" "}
          <code>calculateBill(input)</code>.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Las tarifas son ficticias. No necesitas conocimientos de electricidad.
          Cada lectura es independiente y las reglas permanecen fijas para tu
          intento, con parámetros personalizados por participante. Puedes usar
          AI.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt>
              <code>consumptionKwh</code>
            </dt>
            <dd>
              Energía importada durante un periodo de medición. Entero de 0 a
              2,000.
            </dd>
          </div>
          <div>
            <dt>
              <code>demandKw</code>
            </dt>
            <dd>Demanda máxima del periodo. Entero de 0 a 100.</dd>
          </div>
          <div>
            <dt>
              <code>hour</code>
            </dt>
            <dd>Hora local de cierre del periodo. Entero de 0 a 23.</dd>
          </div>
          <div>
            <dt>
              <code>solar</code> y <code>business</code>
            </dt>
            <dd>
              Booleanos que indican generación solar y contrato comercial.
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
      <section aria-labelledby="power-grid-workflow">
        <h2
          id="power-grid-workflow"
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
