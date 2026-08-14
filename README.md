<div align="center">

# Superfunky Storefront

**A production-grade React storefront for headless WordPress and WooCommerce.**

[![MIT licence](https://img.shields.io/badge/licence-MIT-151515.svg)](https://github.com/coded-letter/superfunky-storefront/blob/main/LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](./package.json)
[![pnpm 10](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](./package.json)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)](./apps/storefront/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](./apps/storefront/tsconfig.json)
[![Netlify](https://img.shields.io/badge/deploy-Netlify-00C7B7?logo=netlify&logoColor=white)](https://www.netlify.com/)
[![CI](https://github.com/coded-letter/superfunky-storefront/actions/workflows/ci.yml/badge.svg)](https://github.com/coded-letter/superfunky-storefront/actions/workflows/ci.yml)

[Live flagship](https://superfunky.pro) ·
[Documentation](https://superfunky.pro/documentation) ·
[Shortcode library](https://superfunky.pro/shortcodes) ·
[Report an issue](https://github.com/coded-letter/superfunky-storefront/issues)

</div>

## Managed deployment fleet

Every managed headless environment runs the same storefront release with a capability-aware
backend profile. The native WordPress development backend is listed separately for setup
visibility. These badges are live HTTP status checks, not manually maintained labels.

| Environment | Profile | Status |
|---|---|---|
| [superfunky.pro](https://superfunky.pro) | Flagship Pro commerce | [![superfunky.pro](https://img.shields.io/website?url=https%3A%2F%2Fsuperfunky.pro&up_message=online&down_message=offline&label=flagship)](https://superfunky.pro) |
| [developer.superfunky.pro](https://developer.superfunky.pro) | Developer example | [![developer.superfunky.pro](https://img.shields.io/website?url=https%3A%2F%2Fdeveloper.superfunky.pro&up_message=online&down_message=offline&label=developer)](https://developer.superfunky.pro) |
| [free-blog.superfunky.pro](https://free-blog.superfunky.pro) | Free CMS/blog | [![free-blog.superfunky.pro](https://img.shields.io/website?url=https%3A%2F%2Ffree-blog.superfunky.pro&up_message=online&down_message=offline&label=free--blog)](https://free-blog.superfunky.pro) |
| [free-shop.superfunky.pro](https://free-shop.superfunky.pro) | Free commerce | [![free-shop.superfunky.pro](https://img.shields.io/website?url=https%3A%2F%2Ffree-shop.superfunky.pro&up_message=online&down_message=offline&label=free--shop)](https://free-shop.superfunky.pro) |
| [pro-shop.superfunky.pro](https://pro-shop.superfunky.pro) | Pro commerce | [![pro-shop.superfunky.pro](https://img.shields.io/website?url=https%3A%2F%2Fpro-shop.superfunky.pro&up_message=online&down_message=offline&label=pro--shop)](https://pro-shop.superfunky.pro) |
| [dev.superfunky.pro](https://dev.superfunky.pro) | Default WordPress backend | [![dev.superfunky.pro](https://img.shields.io/website?url=https%3A%2F%2Fdev.superfunky.pro&up_message=online&down_message=offline&label=backend)](https://dev.superfunky.pro) |

## Packages

The workspace is split into deliberate public package boundaries:

[![SDK](https://img.shields.io/badge/%40funky%2Fsdk-workspace-8B5CF6)](./packages/sdk)
[![CMS](https://img.shields.io/badge/%40funky%2Fcms-workspace-2563EB)](./packages/cms)
[![Commerce](https://img.shields.io/badge/%40funky%2Fcommerce-workspace-059669)](./packages/commerce)
[![UI](https://img.shields.io/badge/%40funky%2Fui-workspace-DB2777)](./packages/ui)
[![Shared](https://img.shields.io/badge/%40funky%2Fshared-workspace-475569)](./packages/shared)

Public npm-version badges will replace the workspace badges as each package is published.

## Quick start

```bash
git clone https://github.com/coded-letter/superfunky-storefront.git
cd superfunky-storefront
corepack enable
pnpm install
pnpm dev
```

The development fallback uses the public `dev.superfunky.pro` WPGraphQL backend, so the
storefront starts without requiring a local WordPress installation. To use your own backend:

```bash
cp apps/storefront/.env.example apps/storefront/.env
```

```dotenv
VITE_GRAPHQL_ENDPOINT=https://wordpress.example/graphql
VITE_SITE_URL=http://localhost:4173
```

Never commit private WordPress, commerce, payment, or deployment credentials.

## What is included

- Static route generation and complete CMS route discovery.
- React 18, Vite, TypeScript and route-level code splitting.
- Pages, posts, taxonomies, authors, navigation and SEO.
- WooCommerce catalog, cart, checkout, account and order flows.
- Community profiles, posts, media, comments and marketplace presentation.
- Capability-aware free, blog, shop and Pro backend profiles.
- Stable WordPress content styling, Layout Studio and shortcode rendering.
- Sitemaps, feeds, structured data, AI discovery files and production headers.
- Provider-neutral static output, with a Netlify deployment adapter and static failover.

## Architecture

```text
apps/storefront       Routes, feature composition and remaining domain presentation
packages/cms          Extracted CMS normalization primitives
packages/commerce     Extracted commerce normalization primitives
packages/sdk          Backend transport, environment, cache and React data hooks
packages/ui           Reusable presentation and current shared application primitives
packages/shared       Framework-independent schemas, validators and route contracts
```

Backend transport and incremental caching are private to the SDK. CMS and commerce package
roots contain the first extracted domain primitives; the storefront app still owns feature
composition while those public boundaries expand without duplicating implementations.

## Commands

```bash
pnpm dev          # start the storefront
pnpm test         # run the complete test suite
pnpm build        # create the production storefront and static route inventory
```

## WordPress compatibility

The default development backend is intended for exploration and local setup. Production
projects should supply their own WPGraphQL endpoint and capability profile. WooCommerce,
Polylang and SEO integrations are detected and gated instead of being unconditional.

The WordPress backend theme is distributed separately after its release and security
validation. The storefront remains independently forkable under the MIT licence.

## Licence

MIT. Commercial hosting, migrations, updates and support are available from
[Superfunky](https://superfunky.pro).
