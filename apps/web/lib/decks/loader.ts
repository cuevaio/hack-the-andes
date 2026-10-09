import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseFrontmatter } from "./frontmatter";

const DECKS_DIR = join(process.cwd(), "content", "decks");

/**
 * Typographic variant, opted into per deck from its deck.json.
 *
 * - `editorial` (default): Barlow Condensed display over IBM Plex Mono chrome,
 *   the landing's own pairing. Use it unless there's a reason not to.
 * - `plain`: IBM Plex Mono throughout, no display pair. For sober decks aimed
 *   at institutions, where the condensed display reads as marketing.
 * - `terrain`: the sponsorship skin. Inverts the page to black, drops all
 *   chroma, sets headings in the brand face and paints the slide backdrops.
 */
export type DeckStyle = "plain" | "editorial" | "terrain";

/**
 * The language of a deck, declared once in its `deck.json`.
 *
 * It does not translate anything — the slides are written in whatever language
 * they are written in. What it picks is the chrome around them (the index, the
 * pager's labels) and the `lang` attribute the page carries, which is what
 * tells a screen reader which voice to read a slide in.
 */
export const DECK_LANGS = ["es", "en"] as const;

export type DeckLang = (typeof DECK_LANGS)[number];

function parseDeckLang(value: unknown, slug: string): DeckLang {
  if (value == null) return "es";
  if (
    typeof value === "string" &&
    (DECK_LANGS as readonly string[]).includes(value)
  ) {
    return value as DeckLang;
  }
  throw new Error(
    `lang inválido "${String(value)}" en decks/${slug}/deck.json — usá uno de: ${DECK_LANGS.join(", ")}`,
  );
}

/**
 * The backdrops a slide can sit on, named rather than pathed so a slide never
 * hardcodes a file and swapping the art is one change in `deck.css`.
 *
 * All five are drawn: the terrain, which is the event's own world. Photographs
 * are deliberately not in this list. They were, briefly, and a photograph makes
 * a bad backdrop — it has no dark mass of its own for the veil to work with, so
 * the type lands on faces. Photographs enter a slide through `Photos` instead,
 * as an object beside the type rather than the ground under it.
 *
 * They are a handful of monochrome plates across the whole deck on purpose:
 * the design base draws one world, and a backdrop per slide would read as a
 * stock library rather than an identity. Only `terrain` paints them — the paper
 * styles ignore the field entirely.
 */
export const DECK_BACKDROPS = [
  "summit",
  "range",
  "peak",
  "canyon",
  "contour",
  "none",
] as const;

export type DeckBackdrop = (typeof DECK_BACKDROPS)[number];

/**
 * How hard the plate is pushed under the type, per slide.
 *
 * It is a per-slide value and not one constant because the plates are not
 * evenly bright and the slides are not evenly full: a cover with six words over
 * the dark foot of a mountain wants the drawing, and a table of seven rows over
 * the lit seam of the canyon wants it gone. The design base does the same
 * thing — the three full-bleed scrims measured off it sit at 0.37, 0.52 and
 * 0.54 — which is most of what looked at first like six unrelated opacities.
 */
export const DECK_VEILS = ["light", "mid", "heavy"] as const;

export type DeckVeil = (typeof DECK_VEILS)[number];

function parseVeil(value: unknown, slideId: string): DeckVeil {
  if (value == null) return "mid";
  if (
    typeof value === "string" &&
    (DECK_VEILS as readonly string[]).includes(value)
  ) {
    return value as DeckVeil;
  }
  throw new Error(
    `veil inválido "${String(value)}" en ${slideId}.mdx — usá uno de: ${DECK_VEILS.join(", ")}`,
  );
}

function parseBackdrop(value: unknown, slideId: string): DeckBackdrop {
  if (value == null) return "none";
  if (
    typeof value === "string" &&
    (DECK_BACKDROPS as readonly string[]).includes(value)
  ) {
    return value as DeckBackdrop;
  }
  // A typo here would silently paint nothing, which reads as a design choice.
  throw new Error(
    `backdrop inválido "${String(value)}" en ${slideId}.mdx — usá uno de: ${DECK_BACKDROPS.join(", ")}`,
  );
}

/**
 * The four templates the design base draws, named by what they do.
 *
 * - `cover`: the title slide. One centred column.
 * - `split-left` / `split-right`: the two mirrored halves. The type takes one
 *   half and the plate keeps the other, which is what the base's empty framed
 *   box on that side was standing in for — it is the drawing, uncovered.
 * - `wide`: the grid slides. The full column, which is what every slide got
 *   before templates existed, so it is the default.
 */
export const DECK_LAYOUTS = [
  "cover",
  "split-left",
  "split-right",
  "wide",
] as const;

export type DeckLayout = (typeof DECK_LAYOUTS)[number];

function parseLayout(value: unknown, slideId: string): DeckLayout {
  if (value == null) return "wide";
  if (
    typeof value === "string" &&
    (DECK_LAYOUTS as readonly string[]).includes(value)
  ) {
    return value as DeckLayout;
  }
  throw new Error(
    `layout inválido "${String(value)}" en ${slideId}.mdx — usá uno de: ${DECK_LAYOUTS.join(", ")}`,
  );
}

export type DeckMeta = {
  title: string;
  description: string;
  image?: string;
  icon?: string;
  appleIcon?: string;
  style?: DeckStyle;
  lang?: DeckLang;
} & Record<string, unknown>;

export type SlideMeta = {
  title: string;
  backdrop?: DeckBackdrop;
  veil?: DeckVeil;
  layout?: DeckLayout;
} & Record<string, unknown>;

export type SlideSource = {
  meta: SlideMeta;
  source: string;
  number: number;
  id: string;
  backdrop: DeckBackdrop;
  veil: DeckVeil;
  layout: DeckLayout;
};

export type LoadedDeck = {
  meta: DeckMeta;
  slug: string;
  lang: DeckLang;
  slides: SlideSource[];
};

const SLIDE_FILE_RE = /^(\d{2,})-.+\.mdx$/;

function parseSlideFilename(
  name: string,
): { number: number; id: string } | null {
  const match = SLIDE_FILE_RE.exec(name);
  const digits = match?.[1];
  if (!digits) return null;
  return {
    number: Number.parseInt(digits, 10),
    id: name.replace(/\.mdx$/, ""),
  };
}

/** A missing directory is an empty deck list, not a crash. */
async function readDirEntries(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** A folder only counts as a deck when it has a readable deck.json. */
async function isDeckDir(dir: string): Promise<boolean> {
  try {
    await readFile(join(dir, "deck.json"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Every deck's slug, which is its path under `content/decks` — so a slug can
 * carry a slash.
 *
 * A translation is not a deck of its own sitting next to the one it
 * translates: it lives inside it, under its language code. `main/en` is the
 * English `main`, and the URL says exactly what the filesystem does. The flat
 * layout this replaced could not say that — `en` and `partners-en` were
 * siblings of `main`, so nothing tied a deck to its translation but a naming
 * habit, and `en` read as a deck named "en".
 *
 * Only one level deep, and only under a name that is a language we know: a
 * deck holds translations, and a translation holds nothing.
 */
export async function listDecks(): Promise<string[]> {
  const entries = await readDirEntries(DECKS_DIR);
  const slugs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const deckDir = join(DECKS_DIR, entry.name);
    if (!(await isDeckDir(deckDir))) continue;
    slugs.push(entry.name);

    for (const nested of await readDirEntries(deckDir)) {
      if (!nested.isDirectory()) continue;
      if (!(DECK_LANGS as readonly string[]).includes(nested.name)) continue;
      if (!(await isDeckDir(join(deckDir, nested.name)))) continue;
      slugs.push(`${entry.name}/${nested.name}`);
    }
  }

  return slugs.sort();
}

/**
 * Load one deck by its slug, which is its path under `content/decks` and may
 * name a translation: `main`, `main/en`.
 */
export async function loadDeck(slug: string): Promise<LoadedDeck | null> {
  const deckDir = join(DECKS_DIR, slug);

  let rawMeta: string;
  try {
    rawMeta = await readFile(join(deckDir, "deck.json"), "utf-8");
  } catch {
    return null;
  }

  let meta: DeckMeta;
  try {
    meta = JSON.parse(rawMeta) as DeckMeta;
  } catch (error) {
    // Name the deck: a bare JSON.parse error doesn't say which file broke.
    throw new Error(`deck.json inválido en content/decks/${slug}`, {
      cause: error,
    });
  }

  const lang = parseDeckLang(meta.lang, slug);

  // A translation is addressed by the folder it sits in, and its deck.json
  // declares a language too. They can drift in exactly one direction, and it
  // is silent: copy `en/` to `pt/`, forget to touch the field, and the
  // Portuguese URL serves an English deck with English chrome. Nothing
  // downstream can catch that — the chrome would be consistent with the
  // metadata, and both would be wrong. So the two have to agree here.
  const nestedLang = slug.split("/")[1];
  if (nestedLang && nestedLang !== lang) {
    throw new Error(
      `content/decks/${slug} está bajo "${nestedLang}" pero su deck.json declara lang "${lang}" — tienen que coincidir`,
    );
  }

  const entries = await readdir(deckDir, { withFileTypes: true });
  const slides: SlideSource[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".mdx")) continue;
    const parsed = parseSlideFilename(entry.name);
    if (!parsed) continue;

    const raw = await readFile(join(deckDir, entry.name), "utf-8");
    const { data, content } = parseFrontmatter(raw);

    slides.push({
      meta: data as SlideMeta,
      source: content,
      number: parsed.number,
      id: parsed.id,
      backdrop: parseBackdrop((data as SlideMeta).backdrop, parsed.id),
      veil: parseVeil((data as SlideMeta).veil, parsed.id),
      layout: parseLayout((data as SlideMeta).layout, parsed.id),
    });
  }

  // Order by the filename number, not lexicographically: renaming a file
  // reorders the deck, and dropping the numeric prefix disables a slide.
  slides.sort((a, b) => a.number - b.number);

  return { meta, slug, lang, slides };
}
