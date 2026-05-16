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
const japaneseRegionNames = new Intl.DisplayNames(["ja"], { type: "region" });
const quizCountryCodes = new Set(
  `
  AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ
  CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET
  FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT
  JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME
  MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG
  PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY
  SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VC VE VN VU WS YE ZA ZM ZW
  VA PS CK NU TW XK EH
  `
    .trim()
    .split(/\s+/)
    .map((code) => code.toLowerCase()),
);

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

const assetRecords = Object.entries(countries)
  .map(([alpha2, country]) => {
    const code = alpha2.toLowerCase();
    if (!flagFiles.has(code)) {
      return null;
    }

    return {
      code,
      alpha2,
      name: country.name,
      nameJa: japaneseRegionNames.of(alpha2),
      nativeName: country.native,
      continent: country.continent,
      continentName: continentNames[country.continent] || country.continent,
      capital: country.capital || "",
      flag: `assets/flags/4x3/${code}.svg`,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

const records = assetRecords.filter((country) => quizCountryCodes.has(country.code));
const missingQuizCodes = [...quizCountryCodes].filter(
  (code) => !records.some((country) => country.code === code),
);
if (missingQuizCodes.length > 0) {
  throw new Error(`Missing quiz assets or metadata for: ${missingQuizCodes.join(", ")}`);
}

for (const country of assetRecords) {
  cpSync(join(sourceFlagDir, `${country.code}.svg`), join(targetFlagDir, `${country.code}.svg`));
}

writeFileSync(join(dataDir, "countries.json"), `${JSON.stringify(records, null, 2)}\n`);
writeFileSync(
  join(dataDir, "countries-ja.json"),
  `${JSON.stringify(
    Object.fromEntries(records.map((country) => [country.code, country.nameJa])),
    null,
    2,
  )}\n`,
);

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
      japaneseNames: {
        source: "Intl.DisplayNames",
        locale: "ja",
        dataPath: "data/countries-ja.json",
      },
      countriesList: {
        package: "countries-list",
        version: countriesListVersion,
        license: "MIT",
        repository: "https://github.com/annexare/Countries",
        dataPath: "data/countries.json",
      },
      count: records.length,
      assetCount: assetRecords.length,
      quizDataset: {
        dataPath: "data/countries.json",
        count: records.length,
        rule: "193 UN member states, 2 UN observer states, and 5 common extra flags: Cook Islands, Niue, Taiwan, Kosovo, Western Sahara.",
      },
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(docsDir, "flag-assets.md"),
  `# Flag Assets\n\n` +
    `The project includes ${assetRecords.length} ISO-style country and territory flag SVGs in \`assets/flags/4x3/\`.\n\n` +
    `The app-facing quiz dataset contains ${records.length} entries in \`data/countries.json\`: 193 UN member states, 2 UN observer states, and 5 common extra flags: Cook Islands, Niue, Taiwan, Kosovo, and Western Sahara.\n\n` +
    `Metadata is generated with English names, Japanese names, native names, continents, capitals, and asset paths.\n\n` +
    `Japanese country names are also generated as a compact lookup map in \`data/countries-ja.json\`.\n\n` +
    `Sources:\n\n` +
    `- \`flag-icons@${flagIconsVersion}\`, MIT license, https://github.com/lipis/flag-icons\n` +
    `- \`countries-list@${countriesListVersion}\`, MIT license, https://github.com/annexare/Countries\n\n` +
    `Japanese display names come from the runtime ICU/CLDR data exposed through \`Intl.DisplayNames\` with locale \`ja\`.\n\n` +
    `Regenerate with:\n\n` +
    `\`\`\`sh\nnode tools/import-flag-assets.mjs\n\`\`\`\n`,
);

console.log(`Imported ${assetRecords.length} flag assets and ${records.length} quiz entries`);
