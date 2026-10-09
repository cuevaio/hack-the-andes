import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseFrontmatter } from "./frontmatter";

test("reads metadata and preserves the body for every committed deck slide", async () => {
  const root = new URL("../../content/decks/", import.meta.url).pathname;
  let slides = 0;
  for (const name of await readdir(root, { recursive: true })) {
    if (!name.endsWith(".mdx")) continue;
    const source = await readFile(join(root, name), "utf8");
    const result = parseFrontmatter(source);
    expect(typeof result.data.title).toBe("string");
    expect(source.endsWith(result.content)).toBeTrue();
    expect(result.content).not.toStartWith("---");
    slides += 1;
  }
  expect(slides).toBeGreaterThan(20);
});

test("rejects executable tags, aliases and invalid slide metadata", () => {
  for (const header of [
    "!!js/function 'function () {}'",
    "title: &title hello\ncopy: *title",
    "- title",
    "title: 1",
  ]) {
    expect(() => parseFrontmatter(`---\n${header}\n---\nbody`)).toThrow();
  }
  expect(
    parseFrontmatter('---\r\ntitle: "Perú"\r\n---\r\nbody').data.title,
  ).toBe("Perú");
});
