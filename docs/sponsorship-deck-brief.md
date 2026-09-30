# Sponsorship deck — brief

Material consolidado para construir el deck de patrocinio dirigido a empresas de
herramientas de desarrollo (devtools). Este documento no es el deck: es el
insumo, las fuentes de verdad y las decisiones que faltan.

> **Estado (14 sep 2026):** el motor de decks ya está portado y funcionando, y
> el presupuesto ya existe. Lo que queda son decisiones de contenido.
>
> | Documento | Qué resuelve |
> | --- | --- |
> | [`deck-system.md`](./deck-system.md) | El motor: cómo se monta un deck en código. |
> | [`deck-best-practices.md`](./deck-best-practices.md) | La doctrina: qué se escribe y en qué orden. |
> | [`budget-sponsors.md`](./budget-sponsors.md) | Los números: costos, tiers, slots. |
>
> Deck general en borrador: `apps/web/content/decks/main/` → `/deck/main`.

- **Tarea Notion:** [09. Presentación de patrocinio para herramientas de desarrollo](https://app.notion.com/p/09-Presentaci-n-de-patrocinio-para-herramientas-de-desarrollo-3d8da2435b46806aa2add38b9b788996) · P1 · Comunicaciones
- **Owner:** Emmy Pardo · **Deadline:** 15 sep 2026
- **Done when:** deck con beneficios y slots listo para outreach
- **Subtareas:** [outline](https://app.notion.com/p/Esquema-de-presentaci-n-de-patrocinio-diapositivas-3d8da2435b468195ac2edae1cfd57c53) → [slides de beneficios](https://app.notion.com/p/Dise-ar-diapositivas-de-beneficios-para-patrocinadores-3d8da2435b46811f93aece6c98e8734d) → [export PDF](https://app.notion.com/p/Exportar-PDF-de-presentaci-n-de-patrocinio-3d8da2435b46816b81e1ca0de31ad2c4)

## Fuente de verdad del contenido

`apps/web/components/landing/content.ts` es el copy canónico del evento. El deck
debe leer de ahí, no inventar cifras paralelas. Capturas de la landing en
`docs/landing-preview/`.

| Dato | Valor | Dónde vive |
| --- | --- | --- |
| Marca del evento | **Hack the Andes** | `brandName` |
| Sponsor principal | Chofex · organiza Crafter Station | `sponsorsCopy` |
| Fechas | 17–18 oct 2026 | `facts`, `heroCopy`, `footerCopy` |
| Sede | Lima, Perú · presencial | `facts` |
| Duración | 30 horas | `experienceCopy` |
| Cupos | **100** | `seatCount` |
| Equipos | 1–4 personas, solos OK | `facts` |
| Premios | US$2.000 (1º) · US$500 (2º) — **$2.500 total** | `prizeAmountsUsd` |
| Premios en soles | S/ 6,700 · S/ 1,675 | `prizeAmountsPen` |
| Aplicación | vía CLI (`andes register`) o vía agent | `applyCopy`, `cliCommands` |
| Selección | lo ya construido, el criterio al explicarlo, la propuesta | `faqCopy` |
| Consejo | **5 jurados + 5 mentores**, roster sin anunciar | `judgeCount`, `mentorCount`, `peopleCopy` |
| Challenges | **3, sellados** hasta el kickoff del 17 oct | `challengeCount`, `challengesCopy`, `challengeSeats` |

> **Esta tabla se reescribió tras el rediseño de la landing (#41).** Cambiaron
> cinco hechos que el brief daba por firmes: desapareció el pool de premios de
> $300, los 2 tracks `T-01`/`T-02` pasaron a **3 challenges sellados**, el cupo
> de 100 se hizo público, el jurado pasó a 5+5, y la preselección por challenge
> técnico y golden tickets **ya no existe**. Si un borrador cita esas cifras,
> está desactualizado.

## Regla de marca (ya decidida, no reabrir)

> "Con el apoyo de Chofex. Identidad propia del evento. Chofex patrocina — no
> pinta la paleta." — `sponsorsCopy.lede`

El deck va con identidad **Hack the Andes**. Chofex aparece como sponsor, no como
dueño de la estética. Esto cierra la tarea Notion "Definir tratamiento *Sponsored
by Chofex* (sin colores Chofex)".

**Paleta: la fuente es `packages/ui/src/styles/globals.css`, y este
documento no repite los valores.** La paleta ya cambió dos veces en semanas
(`feat/palette` #39, y otra vez en el rediseño #41), y las dos veces una copia
escrita a mano quedó atrás sin que nadie se diera cuenta — primero en este
brief, después en el CSS del deck. Los tokens se leen por rol
(`--hud-paper`, `--hud-ink`, `--hud-action`, `--hud-status`, `--hud-accent`,
`--hud-muted`), nunca por hex.

Lo que sí es estable y conviene tener escrito: **la página es clara**, con el
papel de fondo y la tinta reservada para tipografía; el accent es un tinte y no
sostiene texto. Tipografía: Barlow Condensed (display), Barlow (cuerpo), IBM
Plex Mono (chrome HUD) — ver `components/landing/fonts.ts`.

El deck consume esos mismos tokens del design system y activa `.brand-light`
para sus estilos claros, así que un cambio de paleta llega a landing, producto
y decks en el mismo commit.

## Estado actual de los slots

⚠️ **La grilla de sponsors ya no existe.** El rediseño (#41) eliminó
`sponsorSlots` y `sponsors.tsx`. Hoy la landing muestra **una sola marca**:

```ts
// apps/web/components/landing/content.ts
export const sponsorsCopy = {
  kicker: "sponsor principal",
  title: "Chofex",
  lede: "Hack the Andes se realiza con el respaldo de Chofex y la producción de Crafter Station.",
  logoSrc: "/sponsors/chofex.png",
  // …
};
```

El tier sheet abre **9 slots nombrados** (ver `budget-sponsors.md` §5), así que
la sección multi-sponsor **hay que construirla de nuevo**. No es actualizar un
array. Y es bloqueante para cobrar un Toolkit, porque ese tier promete
exactamente "logo en la grilla".

> ⚠️ **Cambio de modelo, 17 sep 2026.** Lo que sigue describe la etapa en que se
> vendía obligatoriedad de uso y se pedía efectivo. **Las dos cosas se cayeron.**
> Ninguna herramienta es obligatoria y no se pide cash. Basic aporta créditos
> para los 100 en el monto que el sponsor elija; Pro suma créditos para 1º, 2º y
> 3º; Premium suma merch sobre Basic. Pro y Premium son extensiones distintas.
> La fuente vigente son `deck-best-practices.md` §1 y §9 y
> `budget-sponsors.md` §5; las preguntas resueltas #4 y #5 de más abajo quedaron
> sin efecto.

## Qué se le pide a un sponsor devtool

Del roadmap (#10 "Contactar patrocinadores, pedir créditos y beneficios"): el ask
principal son **créditos de producto para los participantes**, más beneficios de
marca. La plataforma ya contempla que el participante reclame créditos en el
evento — ver las tareas de Plataforma "claim credits" y `#24`.

## Contrapartidas disponibles (inventario, falta tierizar)

Lo que el evento ya puede ofrecer, según lo construido y lo planificado:

- Logo en la landing (⚠️ la grilla está por reconstruirse — ver arriba)
- Post de anuncio por sponsor confirmado (roadmap: "Plantilla de publicaciones por
  cada patrocinador" + "Publicar publicación por patrocinador confirmado")
- Plantilla de imagen de anuncio de sponsor (roadmap #15)
- Presencia en banners físicos de sede (roadmap #15, #16)
- Badges digitales de participantes — piezas que circulan en redes post-evento
  (`expeditionSignals` V-04; generación ya implementada, ver README)
- Acceso al talento: ~100 asistentes seleccionados, presenciales
- Menciones en kickoff y premiación (roadmap #32, #34)

## Preguntas abiertas

Quedan **tres**, y las tres son de ejecución, no de estrategia: el modelo
comercial ya está decidido (§4 de las resueltas). El presupuesto resolvió tres
preguntas, el rediseño de la landing (#41) resolvió dos más por su cuenta, y la
decisión de vender obligatoriedad en vez de challenges cerró la última.

### Siguen abiertas

1. **Definir las 3 capas obligatorias antes de vender la primera.** Cerrar un
   Stack o un Core cierra esa capa para todo el evento. Vender por orden de
   llegada sin decidir qué capas se abren es cómo se termina con dos proveedores
   de inferencia y una exclusividad imposible de cumplir.
2. **Escribir la obligatoriedad en los requisitos de entrega.** Reglamento,
   mención en kickoff y verificación del jurado. Sin eso "obligatorio" no
   existe. **Vale $4.500 del sheet** — los tres slots obligatorios.
3. **Reconstruir la sección de sponsors de la landing.** El rediseño la dejó en
   una sola marca. El tier Toolkit promete "logo en la grilla" y la grilla no
   existe. Bloquea cobrar Toolkit, no escribir el deck.

### Resueltas

4. ~~**Qué le vendemos a un partner.**~~ → **no challenges, sino
   obligatoriedad de uso.** La herramienta del partner entra en los requisitos
   de entrega; el 100% de las soluciones la integra. Los 3 challenges siguen
   siendo producto de participante, sellados y sin marca. Reglas en
   `deck-best-practices.md` §9.
5. ~~**Tiers y precio.**~~ → `budget-sponsors.md` §5. Stack Partner $2.500 ×1 ·
   Core Partner $1.000 ×2 · Toolkit $500 ×6 · In-kind ∞. Derivados de un
   total a financiar de **$10.750**. El ask a devtools es créditos **más**
   obligatoriedad; el cash es lo que cierra el presupuesto.
4. ~~**Cuántos slots.**~~ → **9 nombrados** (1+2+6) más in-kind sin límite.
5. ~~**Idioma del deck.**~~ → **ambos**. `main` en ES y `en` en EN, como el
   sistema del que se portó. Hoy solo existe `main`.
6. ~~**Fechas.**~~ → **17–18 oct 2026**, ya consistente en toda `content.ts`
   (incluido el reveal de los briefs, "se revela en Lima · 17 oct"). Si el
   roadmap de Notion sigue diciendo 10–11, es el roadmap el que está atrasado.
7. ~~**Cupo.**~~ → **100**, ahora `seatCount` y publicado en la landing en
   varios lugares. El presupuesto ($82,50 de operación por hacker) queda firme.

## Aguas abajo

Si el deck no sale, se traba toda la cadena de sponsors:

```
#09 deck (15 sep) → #10 outreach (18 sep) → seguimiento hasta confirmación escrita
   → #22 logos en landing (1 oct) → posts por sponsor confirmado
```

## Verificación

Después de tocar `content.ts` o `sponsors.tsx`:

```sh
bun test            # incluye apps/web/components/landing/content.test.ts
bun run lint
bun run check-types
```

Después de tocar un deck (`apps/web/content/decks/**`):

```sh
cd apps/web && bun run build   # los decks se prerenderizan en build
```

Un error en un slide **rompe el build**, no se degrada en runtime. Eso es
deliberado: un deck roto no debe poder mandarse.
