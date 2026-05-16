# Flag Assets

The project includes 250 ISO-style country and territory flag SVGs in `assets/flags/4x3/`.

The app-facing quiz dataset contains 200 entries in `data/countries.json`: 193 UN member states, 2 UN observer states, and 5 common extra flags: Cook Islands, Niue, Taiwan, Kosovo, and Western Sahara.

Metadata is generated with English names, Japanese names, native names, continents, capitals, and asset paths.

Japanese country names are also generated as a compact lookup map in `data/countries-ja.json`.

Sources:

- `flag-icons@7.5.0`, MIT license, https://github.com/lipis/flag-icons
- `countries-list@3.3.0`, MIT license, https://github.com/annexare/Countries

Japanese display names come from the runtime ICU/CLDR data exposed through `Intl.DisplayNames` with locale `ja`.

Regenerate with:

```sh
node tools/import-flag-assets.mjs
```
