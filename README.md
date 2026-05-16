# Flag Buddy

A small static flag memorization app for iPad-friendly practice.

Open `index.html` locally, or publish the repository with GitHub Pages.

## Assets

- `assets/flags/4x3/`: SVG flag assets.
- `data/countries.json`: country metadata, Japanese names, and paths to the SVGs.
- `data/countries-ja.json`: compact map from lowercase country code to Japanese country name.
- `data/flag-sources.json`: source package versions and license notes.

Regenerate the flag assets with:

```sh
node tools/import-flag-assets.mjs
```
