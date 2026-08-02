# Superfunky Storefront

Free, open-source (MIT) React + Vite + TypeScript headless storefront for the
[Superfunky](https://superfunky.pro) headless WordPress/WooCommerce platform.

This storefront talks to any WordPress site running WPGraphQL + WooGraphQL (or the
companion [`superfunky-theme`](https://github.com/coded-letter/superfunky-theme)) over
GraphQL, and to Stripe for checkout.

## Status

**This repository is currently a scaffold only.** It contains no application source
code yet. It exists so the public repository, licence, and CI conventions are in place
before real code is extracted from the private integration monorepo
(`coded-letter/superfunky-woo`), one module at a time, with review — see
[`EXTRACTION_STATUS.md`](./EXTRACTION_STATUS.md) for the current migration checklist.

## What this project is (and isn't)

- **Is**: a minimal, free, community-usable headless storefront starter — the open-source
  "acquisition" edge of the Superfunky product family.
- **Isn't**: the commercial Superfunky Pro theme, the premium plugin bundle, or any
  paid feature. Those remain closed-source in the private monorepo and are never
  extracted here.

## Licence

MIT — see [`LICENSE`](./LICENSE). Contributions are welcome once the initial code
extraction lands.

## Related repositories

- [`coded-letter/superfunky-theme`](https://github.com/coded-letter/superfunky-theme) —
  companion free WordPress theme (GPL-2.0).
- `coded-letter/superfunky-woo` (private) — the source-of-truth integration monorepo,
  including the commercial Pro theme and premium plugin bundle.
