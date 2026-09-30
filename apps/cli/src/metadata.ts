import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Schema } from "effect";

declare const CHOFEX_VERSION: string | undefined;

export const isStandaloneBuild = typeof CHOFEX_VERSION !== "undefined";

const readMetadata = () => {
  if (typeof CHOFEX_VERSION !== "undefined") {
    return { name: "chofex-cli", version: CHOFEX_VERSION };
  }

  return Schema.decodeUnknownSync(
    Schema.Struct({
      name: Schema.Literals(["chofex-cli", "hacktheandes-cli"]),
      version: Schema.String,
    }),
  )(
    JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ),
  );
};

const metadata = readMetadata();
export const cliVersion = metadata.version;
export const cliPackageName = metadata.name;
let commandPath = process.argv[1] ?? "";
if (isStandaloneBuild) {
  commandPath = process.argv0;
}
const invokedAsAndes = /^andes(?:\.cmd|\.exe)?$/.test(basename(commandPath));
export const cliCommandName = invokedAsAndes ? "andes" : "chofex";
