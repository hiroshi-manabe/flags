import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = new URL("..", import.meta.url).pathname;
const workDir = join(tmpdir(), "flag-buddy-assets");
const flagIconsVersion = "7.5.0";
const countriesListVersion = "3.3.0";

const continentNames = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function extract(tarball, target) {
  mkdirSync(target, { recursive: true });
  run("tar", ["-xzf", tarball, "-C", target, "--strip-components=1"], workDir);
}

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

run("npm", ["pack", `flag-icons@${flagIconsVersion}`, `countries-list@${countriesListVersion}`], workDir);

extract(join(workDir, `flag-icons-${flagIconsVersion}.tgz`), join(workDir, "flag-icons"));
extract(join(workDir, `countries-list-${countriesListVersion}.tgz`), join(workDir, "countries-list"));

const sourceFlagDir = join(workDir, "flag-icons", "flags", "4x3");
const targetFlagDir = join(root, "assets", "flags", "4x3");
const dataDir = join(root, "data");
const docsDir = join(root, "docs");

rmSync(targetFlagDir, { recursive: true, force: true });
mkdirSync(targetFlagDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });
mkdirSync(docsDir, { recursive: true });

const countries = JSON.parse(
  readFileSync(join(workDir, "countries-list", "countries.min.json"), "utf8"),
);
const flagFiles = new Set(
  readdirSync(sourceFlagDir)
    .filter((file) => file.endsWith(".svg"))
    .map((file) => basename(file, ".svg")),
);

const records = Object.entries(countries)
  .map(([alpha2, country]) => {
    const code = alpha2.toLowerCase();
    if (!flagFiles.has(code)) {
      return null;
    }

    return {
      code,
      alpha2,
      name: country.name,
      nativeName: country.native,
      continent: country.continent,
      continentName: continentNames[country.continent] || country.continent,
      capital: country.capital || "",
      flag: `assets/flags/4x3/${code}.svg`,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

for (const country of records) {
  cpSync(join(sourceFlagDir, `${country.code}.svg`), join(targetFlagDir, `${country.code}.svg`));
}

writeFileSync(join(dataDir, "countries.json"), `${JSON.stringify(records, null, 2)}\n`);

writeFileSync(
  join(dataDir, "flag-sources.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      flagIcons: {
        package: "flag-icons",
        version: flagIconsVersion,
        license: "MIT",
        repository: "https://github.com/lipis/flag-icons",
        assetPath: "assets/flags/4x3",
      },
      countriesList: {
        package: "countries-list",
        version: countriesListVersion,
        license: "MIT",
        repository: "https://github.com/annexare/Countries",
        dataPath: "data/countries.json",
      },
      count: records.length,
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(docsDir, "flag-assets.md"),
  `# Flag Assets\n\n` +
    `The project includes ${records.length} ISO-style country and territory flag SVGs in \`assets/flags/4x3/\`.\n\n` +
    `Metadata is generated in \`data/countries.json\` with country names, native names, continents, capitals, and asset paths.\n\n` +
    `Sources:\n\n` +
    `- \`flag-icons@${flagIconsVersion}\`, MIT license, https://github.com/lipis/flag-icons\n` +
    `- \`countries-list@${countriesListVersion}\`, MIT license, https://github.com/annexare/Countries\n\n` +
    `Regenerate with:\n\n` +
    `\`\`\`sh\nnode tools/import-flag-assets.mjs\n\`\`\`\n`,
);

console.log(`Imported ${records.length} flags into ${targetFlagDir}`);
