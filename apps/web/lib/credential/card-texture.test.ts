import { afterAll, beforeAll, describe, expect, test } from "bun:test";

/**
 * The module reads its fonts at import time, relative to the working
 * directory, which is what Next gives it in production and is not what
 * `bun test` gives it from the repo root. So the directory moves first
 * and the import comes after — a static import would have run at file
 * scope, before any of this.
 */
const appRoot = new URL("../../", import.meta.url).pathname;
const startedIn = process.cwd();

let halftonePortrait: typeof import("./card-texture").halftonePortrait;

beforeAll(async () => {
  process.chdir(appRoot);
  ({ halftonePortrait } = await import("@/lib/credential/card-texture"));
});

afterAll(() => {
  process.chdir(startedIn);
});

describe("halftonePortrait", () => {
  test("answers null when the badge has no stored picture", async () => {
    // No acceptance default or confirmed replacement means initials.
    expect(await halftonePortrait(null)).toBeNull();
  });

  test("rejects internal addresses before making a network request", async () => {
    // A credential with initials on it is a credential. One that 500s
    // because a picture host was slow is not.
    let requested = false;
    expect(
      await halftonePortrait("http://127.0.0.1:1/never.png", async () => {
        requested = true;
        throw new Error("Unexpected request");
      }),
    ).toBeNull();
    expect(requested).toBe(false);
  });

  test("answers null when the host returns something that is not an image", async () => {
    // A sign-in page returned as HTML with a 200 is the shape this
    // guards: without the check it reaches sharp as a buffer of markup.
    const server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response("<html>inicia sesión</html>", {
          headers: { "content-type": "text/html" },
        }),
    });

    try {
      const answer = await halftonePortrait(
        "https://img.clerk.com/x",
        (_input, init) => fetch(`http://localhost:${server.port}/x`, init),
      );

      expect(answer).toBeNull();
    } finally {
      server.stop(true);
    }
  });

  test("screens a real picture into a png of dots", async () => {
    // The whole path, end to end, because every step between the fetch
    // and the data URI is one this repo has broken before: the crop, the
    // alpha, the svg, the rasterise.
    const { default: sharp } = await import("sharp");
    const source = await sharp({
      create: {
        width: 200,
        height: 240,
        channels: 4,
        background: { r: 210, g: 210, b: 210, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(source, { headers: { "content-type": "image/png" } }),
    });

    try {
      const uri = await halftonePortrait(
        "https://img.clerk.com/p",
        (_input, init) => fetch(`http://localhost:${server.port}/p`, init),
      );

      expect(uri).toStartWith("data:image/png;base64,");

      const bytes = Buffer.from((uri ?? "").split(",")[1] ?? "", "base64");
      const meta = await sharp(bytes).metadata();

      // Sized by the window the model samples, not by the photograph —
      // and by a whole number of cells, so the screen ends where the
      // window does.
      expect(meta.width).toBe(490);
      expect(meta.height).toBe(567);
    } finally {
      server.stop(true);
    }
  });

  test("leaves a transparent background unlit", async () => {
    // The cut-out arrives with its background transparent, and alpha has
    // to win over luminance: transparent pixels read as bright, so
    // without this the erased background comes back as a full field of
    // dots and the cut-out was for nothing.
    const { default: sharp } = await import("sharp");
    const clear = await sharp({
      create: {
        width: 120,
        height: 140,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(clear, { headers: { "content-type": "image/png" } }),
    });

    try {
      const uri = await halftonePortrait(
        "https://img.clerk.com/c",
        (_input, init) => fetch(`http://localhost:${server.port}/c`, init),
      );
      const bytes = Buffer.from((uri ?? "").split(",")[1] ?? "", "base64");
      const { channels } = await sharp(bytes).stats();

      // Nothing drawn: every channel flat at zero.
      expect(channels[0]?.max).toBe(0);
    } finally {
      server.stop(true);
    }
  });
});
