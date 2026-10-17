import type { DeckLang } from "@/lib/decks/loader";
import {
  BenefitGrid,
  BulletList,
  ChipGrid,
  ContrastGrid,
  Count,
  DataCell,
  DataGrid,
  FlowMap,
  Lead,
  Logo,
  LogoRow,
  LogoWall,
  MdxA,
  MdxBlockquote,
  MdxH1,
  MdxH2,
  MdxH3,
  MdxHr,
  MdxLi,
  MdxOl,
  MdxP,
  MdxStrong,
  MdxTable,
  MdxTbody,
  MdxTd,
  MdxTh,
  MdxThead,
  MdxTr,
  MdxUl,
  MiniMatrix,
  PersonaGrid,
  PhaseTimeline,
  Photos,
  PrizePodium,
  Qr,
  Ready,
  Rule,
  SlideTitle,
  SponsorTier,
  Stat,
  StatRow,
  Timeline,
  TimelineRow,
  TrackCard,
  Wordmark,
} from "./slide-components";
import { Video } from "./video";

/**
 * The closed vocabulary injected into every slide. A slide cannot `import`, so
 * this map is the whole surface area available to deck authors — which is what
 * keeps the chrome unbreakable and stops one slide from pulling in a library.
 *
 * Adding a component here is a deliberate widening of the system; prefer
 * composing what already exists.
 *
 * It is built per deck rather than exported as a constant because one entry —
 * `SponsorTier`, which writes "6 disponibles" or "6 open" — needs to know the
 * deck's language. The map is the injection point the system already has, so
 * the language rides in through it rather than through a context a Server
 * Component cannot read.
 */
export function mdxComponentsFor(lang: DeckLang) {
  return {
    // structure and text
    SlideTitle,
    Lead,
    Wordmark,
    Ready,
    Rule,
    // data and numbers
    Stat,
    StatRow,
    Count,
    DataGrid,
    DataCell,
    MiniMatrix,
    PrizePodium,
    // the commercial offer
    SponsorTier: (props: Omit<Parameters<typeof SponsorTier>[0], "lang">) =>
      SponsorTier({ ...props, lang }),
    BenefitGrid,
    ContrastGrid,
    FlowMap,
    PersonaGrid,
    // event
    TrackCard,
    Timeline,
    TimelineRow,
    PhaseTimeline,
    // photographs and video
    Photos,
    Video,
    Qr,
    // logos
    Logo,
    LogoRow,
    LogoWall,
    // lists
    BulletList,
    ChipGrid,
    // markdown base
    h1: MdxH1,
    h2: MdxH2,
    h3: MdxH3,
    p: MdxP,
    ul: MdxUl,
    ol: MdxOl,
    li: MdxLi,
    strong: MdxStrong,
    a: MdxA,
    hr: MdxHr,
    blockquote: MdxBlockquote,
    table: MdxTable,
    thead: MdxThead,
    tbody: MdxTbody,
    tr: MdxTr,
    th: MdxTh,
    td: MdxTd,
  };
}
