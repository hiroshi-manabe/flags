# Flag Assets

The project includes 250 ISO-style country and territory flag SVGs in `assets/flags/4x3/`.

Metadata is generated in `data/countries.json` with country names, native names, continents, capitals, and asset paths.

Sources:

- `flag-icons@7.5.0`, MIT license, https://github.com/lipis/flag-icons
- `countries-list@3.3.0`, MIT license, https://github.com/annexare/Countries

Regenerate with:

```sh
node tools/import-flag-assets.mjs
```
