import { chmod, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import metadata from "../package.json" with { type: "json" };

const cliDirectory = fileURLToPath(new URL("../", import.meta.url));
const packagesDirectory = join(cliDirectory, "dist/npm");
await rm(packagesDirectory, { recursive: true, force: true });

const { scripts, devDependencies, ...publishMetadata } = metadata;
for (const name of ["chofex-cli", "hacktheandes-cli"]) {
  const directory = join(packagesDirectory, name);
  await mkdir(join(directory, "dist"), { recursive: true });
  await copyFile(
    join(cliDirectory, "dist/index.js"),
    join(directory, "dist/index.js"),
  );
  await chmod(join(directory, "dist/index.js"), 0o755);
  await copyFile(join(cliDirectory, "README.md"), join(directory, "README.md"));
  await writeFile(
    join(directory, "package.json"),
    `${JSON.stringify({ ...publishMetadata, name }, null, 2)}\n`,
  );
}
