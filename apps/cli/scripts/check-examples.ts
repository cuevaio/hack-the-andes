import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const files = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
    "--",
    "README.md",
    "PROJECT.md",
    "CONTEXT.md",
    "docs",
    "skills",
    "apps/cli",
    "apps/web",
    "packages/challenges-contract",
  ],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter((file) => /\.(md|ts|tsx)$/.test(file));
const patch = process.argv.includes("--patch");
const sections: string[] = [];
// The reviewed v3 campaign pins the supported chofex alias. Do not rewrite its
// source, matching guide, or literal verification fixtures after content freeze.
const frozenSlowServiceCampaignFiles = new Set([
  "apps/web/lib/emails/slow-service-announcement.ts",
  "apps/web/components/challenges/slow-service-guide.tsx",
  "docs/announce-slow-service.md",
  "scripts/slow-service-announcement/campaign.test.ts",
  "scripts/slow-service-announcement/script.test.ts",
]);

for (const file of files) {
  const lines = (await readFile(join(root, file), "utf8")).split("\n");
  const changes: string[] = [];
  for (const [index, line] of lines.entries()) {
    const updated = line
      .replace(
        /\bchofex(?= (?:--|login\b|logout\b|register\b|confirm\b|status\b|requirements\b|whoami\b|update\b|upgrade\b|schema\b|validate\b|challenge\b|badge\b))/g,
        (command: string, offset: number) => {
          if (
            frozenSlowServiceCampaignFiles.has(file) &&
            line
              .slice(offset)
              .startsWith(`${command} challenge init --challenge make-it-fast`)
          )
            return command;
          return "andes";
        },
      )
      .replace(
        /(npm install --global |npx --yes )chofex-cli/g,
        "$1hacktheandes-cli",
      );
    if (updated === line) continue;
    changes.push(`@@\n-${line}\n+${updated}`);
    if (!patch)
      process.stderr.write(
        `${file}:${index + 1}: usa andes en los ejemplos del CLI\n`,
      );
  }
  if (changes.length > 0)
    sections.push(`*** Update File: ${file}\n${changes.join("\n")}`);
}

if (patch) {
  if (sections.length > 0)
    process.stdout.write(
      `*** Begin Patch\n${sections.join("\n")}\n*** End Patch\n`,
    );
} else if (sections.length > 0) {
  process.exitCode = 1;
}
