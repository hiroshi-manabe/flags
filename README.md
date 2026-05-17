# Flag Buddy

A small static flag memorization app for iPad-friendly practice.

Open `index.html` locally, or publish the repository with GitHub Pages.

## Assets

- `assets/flags/4x3/`: SVG flag assets.
- `data/countries.json`: the single app-facing quiz dataset with country metadata, Japanese names, and paths to the SVGs.
- `data/countries-ja.json`: compact map from lowercase quiz country code to Japanese country name.
- `data/flag-sources.json`: source package versions and license notes.

The quiz dataset contains 200 entries: 193 UN member states, 2 UN observer states, and 5 common extra flags: Cook Islands, Niue, Taiwan, Kosovo, and Western Sahara.

Regenerate the flag assets with:

```sh
node tools/import-flag-assets.mjs
node tools/generate-flag-pngs.mjs
```
