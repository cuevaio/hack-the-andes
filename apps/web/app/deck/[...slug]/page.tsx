import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { mdxComponentsFor } from "@/components/decks/mdx-components";
import { listDecks, loadDeck } from "@/lib/decks/loader";

import { DeckPager } from "./deck-pager";

export const dynamicParams = false;

// A catch-all rather than one segment because a deck's slug can name a
// translation: `main/en` is two segments and one deck. `dynamicParams = false`
// above keeps the extra segment from widening what the route answers to —
// anything this function did not list is a 404, same as before.
export async function generateStaticParams() {
  const slugs = await listDecks();
  return slugs.map((slug) => ({ slug: slug.split("/") }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug: segments } = await params;
  const slug = segments.join("/");
  const deck = await loadDeck(slug);
  if (!deck) return {};

  return {
    title: deck.meta.title,
    description: deck.meta.description,
    // Decks are private outreach artifacts sent by link to one company.
    robots: { index: false, follow: false },
    alternates: { canonical: `/deck/${slug}` },
    ...(deck.meta.image
      ? {
          openGraph: {
            type: "website",
            url: `/deck/${slug}`,
            title: deck.meta.title,
            description: deck.meta.description,
            images: [
              {
                url: deck.meta.image,
                width: 1200,
                height: 630,
                alt: deck.meta.title,
              },
            ],
          },
          twitter: {
            card: "summary_large_image",
            title: deck.meta.title,
            description: deck.meta.description,
            images: [deck.meta.image],
          },
        }
      : {}),
    ...(deck.meta.icon || deck.meta.appleIcon
      ? {
          icons: {
            ...(deck.meta.icon ? { icon: deck.meta.icon } : {}),
            ...(deck.meta.appleIcon ? { apple: deck.meta.appleIcon } : {}),
          },
        }
      : {}),
  };
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug: segments } = await params;
  const slug = segments.join("/");
  const deck = await loadDeck(slug);
  if (!deck) notFound();

  const compiledSlides = await Promise.all(
    deck.slides.map(async (slide) => {
      // Frontmatter was already stripped by the deck loader, hence
      // parseFrontmatter: false.
      //
      // blockJS: false is required — slides pass real arrays and objects as
      // props (`items={[...]}`), and next-mdx-remote blocks expression
      // evaluation by default, which silently hands components `undefined`.
      // Safe here because deck sources are authored in this repo, never user
      // input; if that ever changes, this has to change with it.
      //
      // remark-gfm is what makes the markdown half of the vocabulary real.
      // `mdx-components.ts` maps table, thead, tbody, tr, th and td, and
      // without this plugin the parser never emits a table node — so those six
      // could not fire, and a markdown table rendered as a row of literal
      // pipes. It also brings strikethrough, task lists and autolinks, which
      // the map does not style; they fall through to the browser's defaults.
      const { content } = await compileMDX({
        source: slide.source,
        components: mdxComponentsFor(deck.lang),
        options: {
          parseFrontmatter: false,
          blockJS: false,
          mdxOptions: { remarkPlugins: [remarkGfm] },
        },
      });
      return {
        id: slide.id,
        title: slide.meta.title ?? slide.id,
        content,
        backdrop: slide.backdrop,
        veil: slide.veil,
        layout: slide.layout,
      };
    }),
  );

  return (
    <DeckPager
      deckStyle={deck.meta.style}
      lang={deck.lang}
      slides={compiledSlides}
      slug={slug}
      title={deck.meta.title}
    />
  );
}
