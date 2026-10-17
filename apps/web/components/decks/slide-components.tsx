import type { CSSProperties, ReactNode } from "react";

import { availableLabel } from "@/lib/decks/chrome-copy";
import type { DeckLang } from "@/lib/decks/loader";

export { Photos } from "./photos";

/*
 * The closed vocabulary available inside a slide. Slides cannot `import`, so
 * anything not mapped in `mdx-components.ts` does not exist for them — that is
 * what keeps 40 decks looking like one system.
 *
 * Every component leans on the classes in `app/deck/deck.css`; none of them
 * carry a colour of their own.
 */

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * The props every grid in this file shares.
 *
 * The track list travels as a custom property rather than as an inline
 * `grid-template-columns`, because an inline declaration cannot be overridden
 * from a stylesheet: a four-column row of tiers stayed four columns on a
 * 412px phone, which is exactly what it looked like. Through `--deck-cols` the
 * media queries in `deck.css` get to redefine it.
 *
 * `data-cols` rides along so those queries can tell a two-column fact sheet,
 * which survives a tablet, from a four-column row, which does not.
 */
/**
 * A value slot sometimes holds a word instead of a number — `Producto` where
 * the other three tiers carry a price, `Créditos` where the other two places
 * carry an amount.
 *
 * A word is not a number and does not want a number's size. `$500` is four
 * glyphs half of which are narrow; `Créditos` is eight wide ones, and at the
 * same size it ran past the edge of its own cell on every screen under about
 * 1230px. The step down is a typographic rule, not a breakpoint, so it holds at
 * every width at once.
 */
function valueKind(value: string) {
  return /\d/.test(value) ? undefined : "word";
}

function tableProps(
  template: string,
  count: number,
  /**
   * `rows` marks a grid whose columns are a label and its value rather than
   * two cells of copy. Those keep both columns on a phone: stacking a label
   * over its value doubles the row count and reads worse than the pair.
   */
  shape?: "rows",
) {
  const props: {
    className: string;
    "data-cols": number;
    "data-shape"?: "rows";
    style: CSSProperties;
  } = {
    className: "deck-table",
    "data-cols": count,
    style: { "--deck-cols": template } as CSSProperties,
  };

  if (shape) {
    props["data-shape"] = shape;
  }

  return props;
}

/* ---------- structure and text ---------- */

export function SlideTitle({
  children,
  label,
  size = "lg",
}: {
  children: ReactNode;
  /** Kicker above the title — the section, the partner, the phase. */
  label?: string;
  size?: "lg" | "sm";
}) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="deck-label">{label}</span> : null}
      <h2 className={cx("deck-title", size === "sm" && "deck-title-sm")}>
        {children}
      </h2>
    </div>
  );
}

/*
 * The three below take their children straight from MDX, so none of them can
 * be a `<p>`.
 *
 * MDX only leaves children inline when they sit on the same line as the tag.
 * Written across lines they are flow content, and MDX wraps them in a
 * paragraph — which here is `MdxP`, another `<p>`. A `<p>` inside a `<p>` is
 * invalid: the parser closes the outer one the moment it meets the inner, so
 * the tree the server sent and the tree the client builds disagree and React
 * throws the whole slide away and re-renders it.
 *
 * A `<div>` takes either shape. The typography does not move: on one line the
 * class styles the text directly, across lines `MdxP` carries the same class
 * on the paragraph inside.
 */

export function Lead({ children }: { children: ReactNode }) {
  return <div className="deck-lead">{children}</div>;
}

export function Wordmark({ children }: { children: ReactNode }) {
  return <div className="deck-wordmark">{children}</div>;
}

/** Closing line of a close slide: the single next step, set apart. */
export function Ready({ children }: { children: ReactNode }) {
  return (
    <div className="deck-label" style={{ color: "var(--deck-status)" }}>
      {children}
    </div>
  );
}

export function Rule() {
  return <hr className="deck-rule" />;
}

/**
 * One numeral, set to fill the slide. The closing deck counts 3, 2, 1 before
 * the winners; a title caps at a reading size and a countdown is not a title.
 */
export function Count({ children }: { children: ReactNode }) {
  return <div className="deck-count">{children}</div>;
}

/* ---------- data and numbers ---------- */

export function Stat({
  value,
  label,
  invert = false,
}: {
  value: string;
  label: string;
  invert?: boolean;
}) {
  return (
    <div className={cx("deck-cell", invert && "deck-cell-invert")}>
      <span className="deck-stat-value">{value}</span>
      <span className="deck-stat-label">{label}</span>
    </div>
  );
}

export function StatRow({
  items,
}: {
  items: Array<{ value: string; label: string; invert?: boolean }>;
}) {
  return (
    <div
      {...tableProps(
        `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`,
        Math.min(items.length, 4),
      )}
    >
      {items.map((item) => (
        <Stat
          invert={item.invert}
          key={item.label}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  );
}

export function DataGrid({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: number;
}) {
  return (
    <div {...tableProps(`repeat(${columns}, minmax(0, 1fr))`, columns)}>
      {children}
    </div>
  );
}

export function DataCell({
  label,
  children,
  invert = false,
}: {
  label?: string;
  children: ReactNode;
  invert?: boolean;
}) {
  return (
    <div className={cx("deck-cell", invert && "deck-cell-invert")}>
      {label ? <p className="deck-label">{label}</p> : null}
      <div className={cx("deck-copy", label && "mt-2")}>{children}</div>
    </div>
  );
}

/** Two-column fact sheet: label on the left, value on the right. */
export function MiniMatrix({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div {...tableProps("minmax(0, 1fr) minmax(0, 1.4fr)", 2, "rows")}>
      {rows.flatMap((row) => [
        <div className="deck-cell" key={`${row.label}-l`}>
          <span className="deck-label">{row.label}</span>
        </div>,
        <div className="deck-cell" key={`${row.label}-v`}>
          <span className="deck-copy">{row.value}</span>
        </div>,
      ])}
    </div>
  );
}

export function PrizePodium({
  places,
}: {
  places: Array<{ place: string; amount: string; note?: string }>;
}) {
  return (
    <div
      {...tableProps(`repeat(${places.length}, minmax(0, 1fr))`, places.length)}
    >
      {places.map((place, index) => (
        <div
          className={cx("deck-cell", index === 0 && "deck-cell-invert")}
          key={place.place}
        >
          <span className="deck-label">{place.place}</span>
          <span
            className="deck-stat-value mt-2"
            data-kind={valueKind(place.amount)}
          >
            {place.amount}
          </span>
          {place.note ? <p className="deck-copy mt-2">{place.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

/* ---------- the commercial offer ---------- */

export function SponsorTier({
  name,
  price,
  slots,
  available,
  covers,
  feature = false,
  lang = "es",
}: {
  name: string;
  price: string;
  /** Total slots at this tier. */
  slots?: string;
  /** How many are still open, when it's worth showing scarcity honestly. */
  available?: string;
  covers: string[];
  feature?: boolean;
  /** Injected by the component map, not written in a slide. */
  lang?: DeckLang;
}) {
  return (
    <div
      className={cx(
        "deck-tier deck-cell flex min-h-60 flex-col justify-between",
        feature && "deck-cell-invert",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="deck-label">{name}</span>
        {slots ? (
          <span className="deck-stat-label" style={{ marginTop: 0 }}>
            ×{slots}
            {available ? ` · ${availableLabel(available, lang)}` : ""}
          </span>
        ) : null}
      </div>
      <div>
        <p className="deck-tier-price" data-kind={valueKind(price)}>
          {price}
        </p>
        <p className="deck-copy mt-3">{covers.join(" · ")}</p>
      </div>
    </div>
  );
}

export function BenefitGrid({
  items,
  columns = 3,
}: {
  items: Array<{ title: string; detail: string }>;
  columns?: number;
}) {
  return (
    <div {...tableProps(`repeat(${columns}, minmax(0, 1fr))`, columns)}>
      {items.map((item) => (
        <div className="deck-cell" key={item.title}>
          <p className="deck-label">{item.title}</p>
          <p className="deck-copy mt-2">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Two columns in opposition — what a sponsor buys elsewhere vs. what this buys.
 * The right column is the one being argued for, so it inverts.
 */
export function ContrastGrid({
  left,
  right,
}: {
  left: { title: string; items: string[] };
  right: { title: string; items: string[] };
}) {
  return (
    <div {...tableProps("repeat(2, minmax(0, 1fr))", 2)}>
      {[left, right].map((column, index) => (
        <div
          className={cx("deck-cell", index === 1 && "deck-cell-invert")}
          key={column.title}
        >
          <p className="deck-label">{column.title}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {column.items.map((item) => (
              <li className="deck-bullet" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Ordered stages of an activation: what happens, in what order. */
export function FlowMap({
  steps,
}: {
  steps: Array<{ stage: string; detail: string }>;
}) {
  return (
    <div
      {...tableProps(`repeat(${steps.length}, minmax(0, 1fr))`, steps.length)}
    >
      {steps.map((step, index) => (
        <div className="deck-cell" key={step.stage}>
          <span className="deck-stat-value">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="deck-label mt-2">{step.stage}</p>
          <p className="deck-copy mt-2">{step.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function PersonaGrid({
  personas,
}: {
  personas: Array<{ name: string; share: string; detail: string }>;
}) {
  return (
    <div
      {...tableProps(
        `repeat(${Math.min(personas.length, 3)}, minmax(0, 1fr))`,
        Math.min(personas.length, 3),
      )}
    >
      {personas.map((persona) => (
        <div className="deck-cell" key={persona.name}>
          <span className="deck-stat-value">{persona.share}</span>
          <p className="deck-label mt-2">{persona.name}</p>
          <p className="deck-copy mt-2">{persona.detail}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- event ---------- */

export function TrackCard({
  code,
  name,
  tagline,
  children,
  owned,
}: {
  code: string;
  name: string;
  tagline?: string;
  children?: ReactNode;
  /** Partner that owns this track, when the deck is selling it. */
  owned?: string;
}) {
  return (
    <div className={cx("deck-cell", owned && "deck-cell-invert")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="deck-label">{code}</span>
        {owned ? <span className="deck-stat-label">{owned}</span> : null}
      </div>
      <p className="deck-title deck-title-sm mt-2">{name}</p>
      {tagline ? <p className="deck-stat-label">{tagline}</p> : null}
      {children ? <div className="deck-copy mt-3">{children}</div> : null}
    </div>
  );
}

export function Timeline({ children }: { children: ReactNode }) {
  return (
    <div {...tableProps("minmax(0, 0.4fr) minmax(0, 1.6fr)", 2, "rows")}>
      {children}
    </div>
  );
}

export function TimelineRow({
  time,
  children,
}: {
  time: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="deck-cell">
        <span className="deck-label">{time}</span>
      </div>
      <div className="deck-cell">
        <span className="deck-copy">{children}</span>
      </div>
    </>
  );
}

export function PhaseTimeline({
  phases,
}: {
  phases: Array<{ phase: string; when: string; detail?: string }>;
}) {
  return (
    <div
      {...tableProps(`repeat(${phases.length}, minmax(0, 1fr))`, phases.length)}
    >
      {phases.map((phase) => (
        <div className="deck-cell" key={phase.phase}>
          <p className="deck-label">{phase.when}</p>
          <p className="deck-title deck-title-sm mt-1">{phase.phase}</p>
          {phase.detail ? (
            <p className="deck-copy mt-2">{phase.detail}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ---------- qr ---------- */

/**
 * A QR code placed like a photograph: beside the type on a split slide, in the
 * strip below it on narrow ones. It reuses the `Photos` placement classes but
 * keeps its square, unfiltered, uncropped: a crop or a grey filter is what
 * stops a phone from reading it.
 */
export function Qr({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="deck-photos deck-qr" data-count="1">
      <div className="deck-photo-row">
        {/* biome-ignore lint/performance/noImgElement: static SVG, sized by CSS */}
        <img alt={alt} className="deck-qr-img" src={src} />
      </div>
      {caption ? (
        <figcaption className="deck-photo-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/* ---------- logos ---------- */

export function Logo({
  src,
  alt,
  height = 40,
}: {
  src: string;
  alt: string;
  height?: number;
}) {
  // Plain <img>: deck assets are known static files and next/image's optimizer
  // adds nothing to a logo that is already sized for the slide.
  // biome-ignore lint/performance/noImgElement: see above
  return <img alt={alt} src={src} style={{ height, width: "auto" }} />;
}

/**
 * The partner lockup: a quiet row of marks with a hairline between each.
 *
 * `LogoWall` is the other shape — a bordered grid, for a slide whose subject is
 * who backs the event. This is the footer of a cover: the marks sit in the
 * page's own rhythm and the rules between them are the only structure.
 *
 * Height is per logo because these marks are not one aspect ratio. The two
 * wordmarks run about 4:1 and the stacked one is nearly square, so a single
 * height makes one of them either tiny or enormous. Optical size is a judgement
 * the slide makes, not something a component can average.
 */
export function LogoRow({
  logos,
  height = 28,
}: {
  logos: Array<{ src: string; alt: string; height?: number }>;
  height?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-7">
      {logos.map((logo, index) => (
        <div className="flex items-center gap-5 sm:gap-7" key={logo.src}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="h-8 w-px"
              style={{ backgroundColor: "var(--deck-line-strong)" }}
            />
          ) : null}
          {/* biome-ignore lint/performance/noImgElement: static deck asset */}
          <img
            alt={logo.alt}
            src={logo.src}
            style={{ height: logo.height ?? height, width: "auto" }}
          />
        </div>
      ))}
    </div>
  );
}

export function LogoWall({
  logos,
  columns = 4,
}: {
  logos: Array<{ src: string; alt: string }>;
  columns?: number;
}) {
  return (
    <div {...tableProps(`repeat(${columns}, minmax(0, 1fr))`, columns)}>
      {logos.map((logo) => (
        <div className="deck-cell grid h-28 place-items-center" key={logo.alt}>
          <Logo alt={logo.alt} src={logo.src} />
        </div>
      ))}
    </div>
  );
}

/* ---------- lists ---------- */

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li className="deck-bullet" key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ChipGrid({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span className="deck-chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

/* ---------- markdown overrides ---------- */
/* Plain markdown in a slide still comes out in the system's voice. */

export const MdxH1 = ({ children }: { children?: ReactNode }) => (
  <h1 className="deck-title">{children}</h1>
);
export const MdxH2 = ({ children }: { children?: ReactNode }) => (
  <h2 className="deck-title deck-title-sm">{children}</h2>
);
export const MdxH3 = ({ children }: { children?: ReactNode }) => (
  <h3 className="deck-label">{children}</h3>
);
export const MdxP = ({ children }: { children?: ReactNode }) => (
  <p className="deck-lead">{children}</p>
);
export const MdxUl = ({ children }: { children?: ReactNode }) => (
  <ul className="flex flex-col gap-2">{children}</ul>
);
export const MdxOl = ({ children }: { children?: ReactNode }) => (
  <ol className="flex flex-col gap-2">{children}</ol>
);
export const MdxLi = ({ children }: { children?: ReactNode }) => (
  <li className="deck-bullet">{children}</li>
);
export const MdxStrong = ({ children }: { children?: ReactNode }) => (
  <strong>{children}</strong>
);
export const MdxA = ({
  children,
  href,
}: {
  children?: ReactNode;
  href?: string;
}) => <a href={href}>{children}</a>;
export const MdxHr = () => <Rule />;
export const MdxBlockquote = ({ children }: { children?: ReactNode }) => (
  <blockquote
    className="deck-lead"
    style={{
      borderLeft: "2px solid var(--deck-status)",
      paddingLeft: "1rem",
    }}
  >
    {children}
  </blockquote>
);
export const MdxTable = ({ children }: { children?: ReactNode }) => (
  <table className="deck-table w-full" style={{ display: "table" }}>
    {children}
  </table>
);
export const MdxThead = ({ children }: { children?: ReactNode }) => (
  <thead>{children}</thead>
);
export const MdxTbody = ({ children }: { children?: ReactNode }) => (
  <tbody>{children}</tbody>
);
export const MdxTr = ({ children }: { children?: ReactNode }) => (
  <tr>{children}</tr>
);
export const MdxTh = ({ children }: { children?: ReactNode }) => (
  <th className="deck-cell deck-label" style={{ textAlign: "left" }}>
    {children}
  </th>
);
export const MdxTd = ({ children }: { children?: ReactNode }) => (
  <td className="deck-cell deck-copy">{children}</td>
);
