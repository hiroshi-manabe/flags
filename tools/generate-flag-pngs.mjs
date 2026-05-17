import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const dataPath = join(root, "data", "countries.json");
const targetDir = join(root, "assets", "flags", "4x3-png");
const width = 480;
const height = 360;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
}

if (!existsSync(dataPath)) {
  throw new Error(`Missing ${dataPath}. Run tools/import-flag-assets.mjs first.`);
}

const countries = JSON.parse(readFileSync(dataPath, "utf8"));

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

for (const country of countries) {
  const source = country.flagSvg || country.flag;
  const target = country.flagPng || `assets/flags/4x3-png/${country.code}.png`;
  run("rsvg-convert", [
    "--format=png",
    `--width=${width}`,
    `--height=${height}`,
    "--keep-aspect-ratio",
    "--output",
    target,
    source,
  ]);
}

console.log(`Generated ${countries.length} PNG flags in ${targetDir}`);
