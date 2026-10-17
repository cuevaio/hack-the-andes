import type { Credits } from "@chofex/registration-contract";
import { HttpError } from "@/lib/registration/http";

const catalog: Credits = {
  credits: [
    {
      sponsor: "Grok",
      benefit: "Beneficio del evento mediante enlace de referido",
      code: null,
      url: "https://grok.com/plans/referral?sku=sku_iFHd43ge7daR&interval=MONTHLY&code=VZ96-BKAH-HBPD-VSMX#subscribe",
      instructions: [],
    },
    {
      sponsor: "n8n",
      benefit: "Un mes de n8n Cloud Pro. 100 licencias para el evento.",
      code: "2026-HACKATHON-COMUNITARIO-LIMA-CACA2353",
      url: "https://n8n.notion.site/voucher-code",
      instructions: [
        "Sigue la guía para canjear el cupón. Los cupones caducan una semana después del evento.",
      ],
    },
    {
      sponsor: "Zavu",
      benefit: "Cupón del evento",
      code: "HACKTHEANDES26",
      url: null,
      instructions: [
        "Disponible el domingo 18 de octubre. Consulta al equipo de Zavu para canjearlo.",
      ],
    },
    {
      sponsor: "Exa",
      benefit: "US$50 en créditos de Search API. Hasta 300 canjes.",
      code: "EXA50HACKTHEANDES",
      url: "https://exa.ai",
      instructions: ["Canjea el código en Exa."],
    },
    {
      sponsor: "Apify",
      benefit: "Beneficio del evento",
      code: null,
      url: "https://apify.notion.site/Hack-the-Andes-x-Apify-3f1f39950a22805eaca5e2c404e8a72e",
      instructions: [
        "Consulta las condiciones y los pasos de canje en la guía.",
      ],
    },
    {
      sponsor: "AtomicMemory",
      benefit: "5 meses de AtomicMemory Pro, valorados en US$95.",
      code: null,
      url: "https://lp.atomicstrata.ai/andes",
      instructions: [
        "Obtén tu código de participante en la página del evento.",
        "Crea tu cuenta en https://memory.atomicstrata.ai/signup?plan=pro",
      ],
    },
    {
      sponsor: "Qatom",
      benefit: "Beneficio del evento",
      code: null,
      url: "https://www.qatom.ai/hack-the-andes",
      instructions: [
        "Consulta el beneficio y los pasos de canje en la página del evento.",
      ],
    },
    {
      sponsor: "IALABS",
      benefit: "Acceso a Maritime",
      code: null,
      url: "https://maritime.sh",
      instructions: [
        "Consulta con IALABS las condiciones del beneficio del evento.",
      ],
    },
    {
      sponsor: "Lovable",
      benefit: "Pro Plan 1 mensual con 100 créditos. Hasta 120 canjes.",
      code: "COMM-ANDES-K7QZ",
      url: "https://lovable.dev",
      instructions: [
        "Crea una cuenta o ve a Settings → Plans & Credits.",
        "Selecciona Pro Plan 1 de 100 créditos con facturación mensual e introduce el código al pagar.",
        "Si ya tienes una cuenta de pago, crea un nuevo workspace.",
        "Válido hasta el 20 de octubre de 2026 a las 17:00, hora de Lima.",
      ],
    },
    {
      sponsor: "Tavily",
      benefit: "8,000 créditos gratis",
      code: "ANDESHACK",
      url: "https://app.tavily.com/redeem/ANDESHACK",
      instructions: [
        "Válido del 17 al 19 de octubre de 2026. Disponibilidad limitada.",
      ],
    },
  ],
};

export function creditsForCheckin(checkedIn: boolean): Credits {
  if (!checkedIn)
    throw new HttpError(
      403,
      "CHECKIN_REQUIRED",
      "Los créditos se habilitan después del check-in. Ejecuta andes checkin y confirma tu llegada con un organizador.",
    );
  return catalog;
}
