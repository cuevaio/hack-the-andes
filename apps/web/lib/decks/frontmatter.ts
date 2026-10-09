import { parseDocument } from "yaml";

export const parseFrontmatter = (source: string) => {
  const match =
    /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match)
    throw new Error(
      "La diapositiva necesita metadatos YAML delimitados por ---",
    );
  const document = parseDocument(match[1] ?? "");
  if (document.errors.length || document.warnings.length) {
    throw new Error("Los metadatos de la diapositiva no son YAML válido");
  }
  const data: unknown = document.toJS({ maxAliasCount: 0 });
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !("title" in data) ||
    typeof data.title !== "string"
  ) {
    throw new Error("Los metadatos de la diapositiva necesitan un título");
  }
  return { data, content: source.slice(match[0].length) };
};
