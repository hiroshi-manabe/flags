# Flag Assets

The project includes 250 ISO-style country and territory flag SVGs in `assets/flags/4x3/`.

Metadata is generated in `data/countries.json` with English names, Japanese names, native names, continents, capitals, and asset paths.

Japanese country names are also generated as a compact lookup map in `data/countries-ja.json`.

Sources:

- `flag-icons@7.5.0`, MIT license, https://github.com/lipis/flag-icons
- `countries-list@3.3.0`, MIT license, https://github.com/annexare/Countries

Japanese display names come from the runtime ICU/CLDR data exposed through `Intl.DisplayNames` with locale `ja`.

Regenerate with:

```sh
node tools/import-flag-assets.mjs
```
