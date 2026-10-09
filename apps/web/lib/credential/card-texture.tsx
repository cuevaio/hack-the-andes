/**
 * The card's faces, as the texture the glTF model expects.
 *
 * `card.glb` maps its two faces onto one atlas: the front samples the left
 * half, the back samples the right. Handing it a single portrait image is
 * what makes a custom card bleed across both sides or arrive cropped — the
 * same problem react-bits PR #977 exists to solve. So this draws both halves
 * into one image, each half at the card's own aspect.
 *
 * Rendered with satori, the same compositor the share image uses, so the two
 * pictures of a credential cannot drift apart in type or palette.
 *
 * A module rather than a route because two routes need it: the public
 * badge, which finds someone by their GitHub handle, and the participant's
 * own page, which knows them from their session. Duplicating five hundred
 * lines of layout is how two cards for one event start to differ.
 */

import { brandColors } from "@chofex/ui/lib/brand-theme";
import { ImageResponse } from "next/og.js";
import QRCode from "qrcode";
import {
  type Credential,
  initialsFor,
} from "@/components/credential/credential-model";
import { downloadImage, type ImageFetch } from "@/lib/badges/download-image";
import { halftoneSvg } from "@/lib/portrait/halftone";
import {
  HALFTONE_CONTRAST,
  lumaFromRgba,
  normalise,
} from "@/lib/portrait/luminance";
import {
  MOUNTAIN_ASPECT,
  mountainDataUri,
  ridgeDataUri,
  type Sponsor,
  sponsorDataUri,
  sponsorHeight,
} from "./art";
import {
  HOLDER,
  notchFonts,
  RIDGE_BACK,
  RIDGE_FRONT,
  SEAM,
  SHEET,
  WINDOW_EDGE,
} from "./printing";
import { badgeOneLinerFor } from "./profile";

/**
 * The shape of the atlas, derived from the model rather than chosen.
 *
 * Both numbers were read straight out of `card.glb`'s accessors, which
 * carry their own bounds:
 *
 * - the card mesh spans 0.716 × 1.0, so that is the aspect a face has to
 *   arrive at or the type gets stretched on its way onto the card;
 * - its `TEXCOORD_0` runs v 0.002 → 0.757, so the bottom quarter of the
 *   image is never sampled by anything.
 *
 * Sizing the image by those two puts the sampled window at exactly the
 * card's aspect, which is what stops the drawing being squeezed, and names
 * the dead strip instead of leaving it as a guessed padding value. The
 * first version used a round 1120 with 156px of bottom padding, and the
 * card shipped with the participant's name sliced in half.
 */
const FACE_WIDTH = 800;
const CARD_ASPECT = 0.716;
const SAMPLED_V = 0.7572;

/** The part of a face that reaches the card. */
const LIVE_HEIGHT = Math.round(FACE_WIDTH / CARD_ASPECT);
const FACE_HEIGHT = Math.round(LIVE_HEIGHT / SAMPLED_V);
/** The strip below it, which the model does not sample at all. */
const DEAD_HEIGHT = FACE_HEIGHT - LIVE_HEIGHT;

const PICTURE_TIMEOUT_MS = 2_500;

/**
 * The halftone's pitch, in texture pixels.
 *
 * Measured off the design file rather than chosen: its portrait window
 * is fine enough to preserve the eyes and mouth without dissolving into
 * photographic grain. Eleven — what this was — put only 45 dots across
 * the window, so highlights merged into coin-sized circles and broad facial
 * features became abstract shapes. Seven puts 71 dots across the same
 * window: the screen still reads, while the face remains recognizable.
 *
 * The ASCII grid that was considered for the same slot lands at 1.38px
 * per character and does not read at all — a dot carries one value, its
 * radius, while a character needs its shape distinguished, and a shape
 * needs several pixels to have one.
 */
const HALFTONE_CELL = 7;

const colors = brandColors.dark;

/**
 * Each mark at the width its own proportions want.
 *
 * `peru-tech-week` is a stacked lockup and nearly square; the other two are
 * wordmarks four times as wide as they are tall. One shared width would
 * leave the stacked one towering over the others.
 */
const SPONSOR_WIDTHS: ReadonlyArray<readonly [Sponsor, number]> = [
  ["peru-tech-week", 44],
  ["chofex", 82],
  ["crafter-station", 92],
];

/**
 * The printed sheet and the room inside it, stated rather than grown.
 *
 * Satori runs Yoga, whose `flexShrink` defaults to 0 where CSS defaults to
 * 1, so a child that wants more room than its parent has simply takes it
 * and overflows. The first version sized the sheet with `flex: 1` and a
 * child `width: "100%"`, and a participant whose GitHub bio was a sentence
 * pushed their own name off the right edge of the card. Every box below is
 * a number.
 */
const SHEET_INSET = 26;
const SHEET_WIDTH = FACE_WIDTH - SHEET_INSET * 2;
const SHEET_HEIGHT = LIVE_HEIGHT - SHEET_INSET * 2;
const SHEET_PADDING_X = 54;
const CONTENT_WIDTH = SHEET_WIDTH - SHEET_PADDING_X * 2;

/**
 * How tall the drawing is placed, which is what sets where its summit
 * lands.
 *
 * Square on the front, sitting on the sheet's floor: the mountain
 * occupies the lower three fifths of the art, so a square this wide puts
 * it in the lower third of the card, under the type. The back stretches
 * it so the summit rises behind the wordmark, which is where the design
 * has it — laid square there, the lockup floats above the mountain
 * instead of over it.
 */
const RIDGE_HEIGHT_FRONT = SHEET_WIDTH;
const RIDGE_HEIGHT_BACK = Math.round(SHEET_WIDTH * 1.42);

/**
 * The photo window, as a fraction of the printed sheet.
 *
 * Read off the design file's own node box rather than paced out on a
 * screenshot: the sheet is 319 × 462 there and the window takes 0.655 of
 * its width at a 0.863 aspect. The paced version had it too narrow and a
 * touch too tall.
 *
 * Snapped to whole cells, which costs a pixel or two of layout and buys
 * a screen that ends where the window does. While the pitch was five the
 * division happened to come out even; at eleven it does not, and the
 * drawing arrived six pixels narrower than the box it was placed in.
 */
const PORTRAIT_COLUMNS = Math.round((SHEET_WIDTH * 0.655) / HALFTONE_CELL);
const PORTRAIT_WIDTH = PORTRAIT_COLUMNS * HALFTONE_CELL;
const PORTRAIT_ROWS = Math.round(PORTRAIT_WIDTH / 0.863 / HALFTONE_CELL);
const PORTRAIT_HEIGHT = PORTRAIT_ROWS * HALFTONE_CELL;

/**
 * How long the pictures this fetches may be reused.
 *
 * The response itself carries no cache header: this renders one named
 * person's credential, and a module that defaulted to a public cache
 * would be one caller away from serving it to somebody else. Whoever
 * calls it decides, and today the only caller says `private, no-store`.
 */
export const revalidate = 86_400;

/**
 * The stored badge picture, screened into dots.
 *
 * This is either the reviewer-visible acceptance default or the replacement
 * the participant chose during confirmation. A card with no stored picture
 * falls through to initials rather than reaching for another profile source.
 *
 * Screened here rather than stored. What is stored is the cut-out, and
 * deriving the dots on each render means changing the grid does not
 * oblige anybody to regenerate what they already confirmed.
 *
 * Every failure answers null. A credential with initials on it is a
 * credential; one that 500s because a picture host was slow is not.
 */
export const halftonePortrait = async (
  url: string | null,
  fetchImpl: ImageFetch = fetch,
): Promise<string | null> => {
  if (!url) {
    return null;
  }

  try {
    const source = Buffer.from(
      await downloadImage(url, (input, init) =>
        fetchImpl(input, {
          ...init,
          next: { revalidate },
          signal: AbortSignal.timeout(PICTURE_TIMEOUT_MS),
        }),
      ),
    );
    const { default: sharp } = await import("sharp");
    /*
      `top`, not centred. A portrait puts the face in the upper half of
      the frame, so a centre crop of a standing photograph takes the head
      off — and the crop has to happen before the luminance read, because
      the grid is the window's shape and not the photograph's.
    */
    const { data, info } = await sharp(source)
      .resize(PORTRAIT_COLUMNS, PORTRAIT_ROWS, {
        fit: "cover",
        position: "top",
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8ClampedArray(data);
    const grid = lumaFromRgba(pixels, info.width, info.height);
    const values = normalise(grid.values, HALFTONE_CONTRAST);

    /*
      Alpha wins over luminance.

      The cut-out arrives with its background transparent, and a
      transparent pixel reads as bright. Without this the erased
      background comes back as a full field of dots and the cut-out was
      for nothing.
    */
    for (let i = 0; i < values.length; i += 1) {
      if ((pixels[i * info.channels + 3] ?? 255) < 128) {
        values[i] = 0;
      }
    }

    const svg = halftoneSvg(
      { width: info.width, height: info.height, values },
      { cell: HALFTONE_CELL, ink: colors.ink },
    );
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
};

/**
 * The card's own URL, as a QR.
 *
 * Drawn bone-on-sheet rather than the conventional black-on-white: the
 * sheet-colored quiet zone keeps the mountain artwork out of the code
 * without introducing a bright rectangle on the card.
 */
const qrDataUri = async (url: string): Promise<string | null> => {
  try {
    const png = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: { dark: colors.ink, light: SHEET },
    });
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
};

export const renderCardTexture = async (
  credential: Credential,
): Promise<Response> => {
  const [portrait, ridgeFront, ridgeBack, mountain, qr, sponsors] =
    await Promise.all([
      halftonePortrait(credential.pictureUrl),
      ridgeDataUri({ width: SHEET_WIDTH, opacity: RIDGE_FRONT }),
      ridgeDataUri({ width: SHEET_WIDTH, opacity: RIDGE_BACK }),
      mountainDataUri(96),
      qrDataUri(credential.linkUrl),
      Promise.all(
        SPONSOR_WIDTHS.map(async ([sponsor, width]) => ({
          sponsor,
          width,
          height: await sponsorHeight(sponsor, width),
          src: await sponsorDataUri(sponsor, width),
        })),
      ),
    ]);

  const oneLiner = badgeOneLinerFor(credential.oneLiner);

  let portraitNode = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: PORTRAIT_WIDTH,
        height: PORTRAIT_HEIGHT,
        color: colors.muted,
        fontSize: 150,
      }}
    >
      {initialsFor(credential.name)}
    </div>
  );
  if (portrait) {
    portraitNode = (
      // biome-ignore lint/performance/noImgElement: next/image cannot run inside satori
      <img
        alt=""
        height={PORTRAIT_HEIGHT}
        src={portrait}
        // `contain`: the bust is already trimmed to its own extents, and
        // filling a square with it would take the top of the head off.
        style={{ objectFit: "contain" }}
        width={PORTRAIT_WIDTH}
      />
    );
  }

  /** Shared by both halves: the shell, and the printed sheet inside it. */
  /**
   * One printed face inside its shell.
   *
   * `ridge` is a parameter rather than a constant because the two faces
   * want the drawing at different strengths: on the front it is a trace
   * under the type, on the back it is the subject.
   */
  const face = (
    ridge: string,
    ridgeHeight: number,
    children: React.ReactNode,
  ) => (
    <div
      style={{
        display: "flex",
        width: FACE_WIDTH,
        height: FACE_HEIGHT,
        background: HOLDER,
        // The shell's own wall, plus the strip the model never samples.
        padding: `26px 26px ${DEAD_HEIGHT + 26}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: SHEET_WIDTH,
          height: SHEET_HEIGHT,
          borderRadius: 14,
          border: `2px solid ${SEAM}`,
          background: SHEET,
          color: colors.ink,
          fontFamily: "Stack Sans Notch",
          fontWeight: 500,
          padding: `38px ${SHEET_PADDING_X}px 44px`,
        }}
      >
        {/*
          The ridge is placed, not set as a background.

          `backgroundImage` put it on the front and silently dropped it on
          the back — same helper, same URI, one face drawn and the other
          bare. An absolutely positioned image is the mechanism the
          portrait already uses on this card and it draws on both.

          Square, at the sheet's own width, standing on the sheet's floor.
          Two earlier sizings each broke one half of that: one scaled it to
          the *face* width, which is wider than the sheet, so the summit sat
          off-centre and the right slope was cut at the card's edge — the
          half a mountain that got reported; the other filled by height and
          climbed the ridge up behind the portrait. The drawing's own
          mountain occupies the lower three fifths of a square, so a square
          this wide lands it in the lower third of the card.
        */}
        {/* biome-ignore lint/performance/noImgElement: next/image cannot run inside satori */}
        <img
          alt=""
          height={ridgeHeight}
          src={ridge}
          style={{ position: "absolute", left: 0, bottom: 0 }}
          width={SHEET_WIDTH}
        />
        {/*
          The column lives here, in a div of its own, and the faces below
          hand this function an array rather than a fragment. Satori does
          not flatten a fragment the way React does: the front's four
          blocks arrived as one opaque child, lost the column they were
          supposed to stack in, and laid themselves out left to right until
          the participant's name was off the edge of the card.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: CONTENT_WIDTH,
            height: SHEET_HEIGHT - 82,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      {/* Front: the left half of the atlas. */}
      {face(ridgeFront, RIDGE_HEIGHT_FRONT, [
        <div
          key="placement"
          style={{
            display: "flex",
            // Flush with the photo window's right edge, not the sheet's
            // margin. Measured on the design: its stamp ends within six
            // pixels of the window's rule, which is close enough that
            // the two are meant to line up.
            width: PORTRAIT_WIDTH,
            justifyContent: "flex-end",
            fontSize: 22,
            letterSpacing: 1,
          }}
        >
          {credential.placement}
        </div>,
        // The photo window is a line and nothing else. Sampling the design
        // across its edge finds one pale pixel and then the card's own tone
        // again, so the panel this used to fill was never there.
        <div
          key="portrait"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: PORTRAIT_WIDTH,
            height: PORTRAIT_HEIGHT,
            marginTop: 26,
            border: `1px solid ${WINDOW_EDGE}`,
            // The portrait is a transparent cut-out. Give its window the
            // printed sheet's own tone so the ridge behind the card cannot
            // show through the erased background and climb into the photo.
            background: SHEET,
          }}
        >
          {portraitNode}
        </div>,
        <div
          key="identity"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: CONTENT_WIDTH,
          }}
        >
          {/*
            Sized from the design by cap height, not by eye: its name
            stands 52px against a window 495 wide, and Notch's capitals
            are 0.74 of the em, so 71. The tracking the condensed face
            needed to fill the measure is gone — a grotesque at this size
            already fills it.

            The width is what lets a long name wrap instead of running
            off the card. Yoga defaults `flexShrink` to 0, so without a
            measure of its own this line grows past the sheet rather than
            breaking, and the participants whose names do that are the
            ones least able to shrug it off.

            `justifyContent` and not `textAlign` alone: a div here is a
            flex container, so the text is a flex item and `textAlign`
            governs the lines inside it, not the box. With the width set
            and only `textAlign`, the name rendered hard against the left
            edge — centred to the eye that wrote it, and measurably not.
          */}
          <div
            style={{
              width: CONTENT_WIDTH,
              justifyContent: "center",
              fontSize: 71,
              fontWeight: 700,
              lineHeight: 1.05,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {credential.name}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 27,
              fontWeight: 700,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {oneLiner}
          </div>
        </div>,
        qr ? (
          // biome-ignore lint/performance/noImgElement: next/image cannot run inside satori
          <img
            alt=""
            height={115}
            key="qr"
            src={qr}
            style={{ marginTop: 30 }}
            width={115}
          />
        ) : (
          <div
            key="qr"
            style={{
              display: "flex",
              color: colors.action,
              fontSize: 26,
              letterSpacing: 3,
            }}
          >
            {credential.organization ?? ""}
          </div>
        ),
        <div
          key="website"
          style={{
            display: "flex",
            marginTop: 18,
            color: colors.muted,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          HACKTHEANDES.COM
        </div>,
      ])}

      {/*
        Back: the right half.

        The wordmark runs across it, not up its edge. An earlier version
        rotated the whole lockup ninety degrees, which is a thing real
        badges do and is not what this design does — and rotating it
        took the sponsor marks with it, stacking three wordmarks down
        the card where the design sets them in a row.

        No date either. The front carries the event; repeating "17-18
        OCT 2026" on the back is the kind of filler that arrives when a
        face looks empty.
      */}
      {face(
        ridgeBack,
        RIDGE_HEIGHT_BACK,
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: CONTENT_WIDTH,
            height: SHEET_HEIGHT - 82,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: next/image cannot run inside satori */}
            <img
              alt=""
              height={Math.round(46 / MOUNTAIN_ASPECT)}
              src={mountain}
              width={46}
            />
            <div
              style={{
                fontFamily: "Stack Sans Notch",
                fontWeight: 700,
                fontSize: 62,
                letterSpacing: -0.5,
              }}
            >
              HACK THE ANDES
            </div>
          </div>

          {/*
            The marks in a row, divided. Each keeps its own width because
            one is a stacked lockup and the others are wordmarks four
            times as wide as they are tall.
          */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 26,
            }}
          >
            {sponsors.map(({ sponsor, width, height, src }, index) => (
              <div
                key={sponsor}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginLeft: index === 0 ? 0 : 20,
                  paddingLeft: index === 0 ? 0 : 20,
                  borderLeft: index === 0 ? "none" : `1px solid ${WINDOW_EDGE}`,
                }}
              >
                {/* biome-ignore lint/performance/noImgElement: next/image cannot run inside satori */}
                <img
                  alt=""
                  height={height}
                  src={src}
                  style={{ opacity: 0.86 }}
                  width={width}
                />
              </div>
            ))}
          </div>
        </div>,
      )}
    </div>,
    {
      width: FACE_WIDTH * 2,
      height: FACE_HEIGHT,
      fonts: notchFonts,
    },
  );
};
