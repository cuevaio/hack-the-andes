import { describe, expect, test } from "bun:test";

const read = async (name: string): Promise<string> =>
  await Bun.file(new URL(`./${name}`, import.meta.url)).text();

describe("page-sweep", () => {
  test("honours a request for reduced motion", async () => {
    // A curtain wiping across the whole viewport is exactly the motion
    // that setting exists for.
    const sweep = await read("page-sweep.tsx");

    expect(sweep).toContain("prefers-reduced-motion");
  });

  test("reports done on every path out", async () => {
    /*
      The page is underneath. Any path that skips the callback — no
      canvas, no 2D context, reduced motion — leaves every control on the
      page behind an opaque overlay for the rest of the session.
    */
    const sweep = await read("page-sweep.tsx");
    const calls = sweep.match(/setDone\(true\)/g) ?? [];

    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  test("clears the canvas rather than painting one background", async () => {
    /*
      The whole effect is that the page shows through where the curtain
      has gone. A single fill behind the characters would hide the thing
      it is supposed to be revealing, and the sweep would end on a cut
      from a full screen of noise to the page.
    */
    const sweep = await read("page-sweep.tsx");

    expect(sweep).toContain("clearRect");
  });

  test("never takes a pointer event", async () => {
    // It covers every control on the page for a second and a half. A tap
    // that lands on it is a tap the person has to repeat.
    const sweep = await read("page-sweep.tsx");
    const css = await Bun.file(
      new URL("../credential/credential.css", import.meta.url),
    ).text();
    const rule = css.slice(css.indexOf(".page-sweep {"));

    expect(rule).toContain("pointer-events: none");
    expect(sweep).toContain('aria-hidden="true"');
    expect(sweep).toContain("tabIndex={-1}");
  });

  test("cancels its frame loop on unmount", async () => {
    // Navigating away mid-sweep otherwise leaves a loop drawing into a
    // detached canvas for as long as the tab lives.
    const sweep = await read("page-sweep.tsx");

    expect(sweep).toContain("cancelAnimationFrame");
  });

  test("covers the viewport, not the card", async () => {
    // Fixed, not absolute: the page can scroll under a sweep that
    // started before anybody could scroll.
    const css = await Bun.file(
      new URL("../credential/credential.css", import.meta.url),
    ).text();
    const rule = css.slice(css.indexOf(".page-sweep {"));

    expect(rule).toContain("position: fixed");
  });
});

describe("portrait-picker", () => {
  test("shows the cut-out before anything is stored", async () => {
    // Segmentation fails honestly on a busy background, and somebody has
    // to see that and say no. A picker that uploaded first would put a
    // half-erased room on a badge.
    const picker = await read("portrait-picker.tsx");

    expect(picker).toContain("Así quedará en tu carnet");
    expect(picker).toContain("Confirmar");
    expect(picker).toContain("Elegir otra");
  });

  test("confirms the source, not only the upload", async () => {
    // The defect this exists for shipped and was found by reading the
    // service rather than by using the picker: storing an upload writes
    // the badge profile, the card reads `pictureUrl`, and only a
    // confirmation turns one into the other. Without the PATCH the
    // picker told somebody their photograph was saved, reloaded, and
    // changed nothing on their badge.
    const picker = await read("portrait-picker.tsx");
    const verbs = [...picker.matchAll(/method: "(POST|PUT|PATCH)"/g)].map(
      (m) => m[1],
    );

    expect(verbs).toEqual(["POST", "PUT", "PATCH"]);
    expect(picker).toContain("pictureSource");
  });

  test("says what to do when attendance is not confirmed yet", async () => {
    // Changing a picture is only possible after `andes confirm`, which
    // is where the source is first set. "No pudimos guardar la foto" for
    // that case sends somebody looking for a bug instead of a command.
    const picker = await read("portrait-picker.tsx");

    expect(picker).toContain("ATTENDANCE_NOT_CONFIRMED");
    expect(picker).toContain("andes confirm");
  });

  test("writes through the endpoint, never the columns", async () => {
    // `pictureSource` is also an acceptance-details field. Two paths
    // writing it is how one silently reverts the other.
    const picker = await read("portrait-picker.tsx");

    expect(picker).not.toContain("@chofex/db");
    expect(picker).toContain("/api/v1/profile-picture");
  });

  test("says what went wrong when the cut-out fails", async () => {
    const picker = await read("portrait-picker.tsx");

    expect(picker).toContain("CutoutError");
    expect(picker).toContain("fondo liso");
  });

  test("frees the preview it replaces", async () => {
    // Object URLs are not collected. Trying five photographs would pin
    // five bitmaps in memory for the life of the tab.
    const picker = await read("portrait-picker.tsx");

    expect(picker).toContain("revokeObjectURL");
  });

  test("puts one line of text on every button", async () => {
    // The repository's own rule: subtitles and status go beside a
    // button, never inside it.
    const picker = await read("portrait-picker.tsx");
    const labels = [
      ...picker.matchAll(
        />\s*\n?\s*([A-ZÁÉÍÓÚÑ][^<>{]*?)\s*\n?\s*<\/(?:button|label)>/g,
      ),
    ];

    expect(labels.length).toBeGreaterThan(0);
    for (const [, label] of labels) {
      expect(`${label?.trim()} -> ${!label?.includes("\n")}`).toContain("true");
    }
  });
});

describe("credential-stage", () => {
  test("says a proposal is a proposal", async () => {
    // CONTEXT.md forbids using an available image before its owner picks
    // a source. Drawing their GitHub photo unasked is defensible only
    // while the page says that is what it is doing.
    const stage = await read("credential-stage.tsx");

    expect(stage).toContain("foto de GitHub");
    expect(stage).toContain("confirmed");
  });

  test("mounts the scene under the sweep, not after it", async () => {
    /*
      WebGL should compile its shaders while somebody is watching
      characters dissolve, rather than in the silence afterwards. The
      sweep is a sibling of the stage on the page — not a gate in front
      of it — so the scene starts mounting immediately and the curtain
      spends its second and a half hiding the compile.
    */
    const page = await Bun.file(
      new URL("../../app/badge/page.tsx", import.meta.url),
    ).text();

    expect(page).toContain("<PageSweep />");
    expect(page.indexOf("<PageSweep />")).toBeLessThan(
      page.indexOf("<CredentialStage"),
    );
  });
});
