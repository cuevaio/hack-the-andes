import { Schema } from "effect";

export const powerGridChallengeSlug = "power-grid";
export const powerGridChallengeVersion = "power-grid-v1";

const boundedInteger = (maximum: number) =>
  Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum })));

export const PowerReadingSchema = Schema.Struct({
  consumptionKwh: boundedInteger(2_000),
  demandKw: boundedInteger(100),
  hour: boundedInteger(23),
  solar: Schema.Boolean,
  business: Schema.Boolean,
});
export type PowerReading = typeof PowerReadingSchema.Type;

export const powerGridExample: PowerReading = {
  consumptionKwh: 100,
  demandKw: 5,
  hour: 12,
  solar: false,
  business: false,
};

export const powerGridStarterSource = `/**
 * La máquina de facturación eléctrica
 * consumptionKwh: entero 0–2000, energía importada en un periodo de medición.
 * demandKw: entero 0–100, demanda máxima registrada en ese periodo.
 * hour: entero 0–23, hora local de cierre del periodo.
 * solar: boolean, el suministro tiene generación solar.
 * business: boolean, el contrato es comercial.
 * Devuelve el importe del periodo en céntimos enteros.
 * Define una función global o usa module.exports. No uses import/export.
 */
function calculateBill(input) {
  return 0;
}
`;

export const powerGridReadme = `# La máquina de facturación eléctrica

Una cooperativa perdió el código de su facturador. Solo conserva un servicio
que recibe una lectura y devuelve el importe en céntimos enteros. Reemplázalo
con calculateBill(input). No necesitas conocimientos de tarifas eléctricas
reales: las reglas del servicio son ficticias y debes descubrirlas.

Los cinco campos son obligatorios. consumptionKwh es la energía importada en
un periodo de medición, de 0 a 2000. demandKw es la demanda máxima, de 0 a 100.
Ambos son enteros. hour es la hora local, de 0 a 23. solar indica generación
solar y business un contrato comercial. Cada lectura es independiente, sin
estado ni acumulación entre consultas. Cero es un valor válido.

Tienes 25 consultas exitosas y 3 evaluaciones oficiales. Las reglas permanecen
fijas para tu intento, pero los parámetros varían entre participantes. Puedes
usar AI. Las consultas duplicadas o fallidas no consumen presupuesto.

Usa input.json como punto de partida. Cambia una variable a la vez y prueba
los extremos, horarios e interacciones entre campos. No asumas que este
facturador aplica la fórmula del challenge de envíos. Si una variable no cambia
el resultado, prueba otros contextos antes de concluir que no influye. Separa
las reglas respaldadas por observaciones de las hipótesis pendientes y reserva
consultas para comprobar estas últimas.

andes challenge query --challenge power-grid --input input.json
andes challenge notebook --challenge power-grid
andes challenge notebook --challenge power-grid --format csv > observations.csv
andes challenge test --challenge power-grid --source bill.js
andes challenge evaluate --challenge power-grid --source bill.js

Los tests gratuitos comparan tu código con tu cuaderno. Coincidir con él no
certifica el puntaje oculto. La evaluación oficial mide coincidencias exactas
en 1000 lecturas ocultas con distintos consumos, demandas, horarios y contratos.
El puntaje y el error medio resumen muchas lecturas; por sí solos no identifican
qué regla falta ni confirman una hipótesis. El ranking conserva el mejor resultado. A igualdad de aciertos, favorece menos
consultas, menor tiempo de ejecución y luego la fecha del resultado.

Define calculateBill como función global, module.exports.calculateBill o
module.exports. Devuelve un número finito en céntimos enteros. No se permiten
imports, acceso a archivos ni llamadas de red. El source admite hasta 32768
caracteres. Este challenge no requiere review.json ni aprobación de navegador.
`;
