# Superfunky Storefront

Free, open-source (MIT) React headless storefront for the
[Superfunky](https://superfunky.pro) headless WordPress/WooCommerce platform.

Pair this storefront with [`superfunky-theme`](https://github.com/coded-letter/superfunky-theme)
(the WordPress backend theme).

## Features

- ⚡ **Vite + React 18** — fast development and production builds
- 🛒 **Full e-commerce** — catalog, product pages, cart, checkout, account
- 💳 **Stripe Payment Element** — secure card payments via WooCommerce Store API
- 🌍 **Multilingual** — English and Polish with extensible locale system
- 🎨 **Tailwind CSS** — utility-first styling with WordPress theme.json integration
- 🌙 **Dark mode** — automatic and manual dark/light theme switching
- 👥 **Community** — user profiles, community posts, marketplace, followers
- 🔍 **SEO** — prerendering, sitemaps, RSS/Atom feeds, AI discovery files
- 📱 **PWA-ready** — service worker, offline support, push notifications
- 🔊 **Sound UX** — optional interaction sounds with per-event control
- 🍪 **Cookie consent** — GDPR-compliant consent banner

## Quick Start

```bash
# Clone the repository
git clone https://github.com/coded-letter/superfunky-storefront.git
cd superfunky-storefront

# Install dependencies
pnpm install

# Copy environment config
cp apps/storefront/.env.example apps/storefront/.env

# Edit .env to point at your WordPress/WPGraphQL endpoint
# VITE_GRAPHQL_ENDPOINT=https://your-site.com/graphql

# Start development server
pnpm dev
```

## Project Structure

```
apps/storefront/     # Main Vite application
  src/
    components/      # React components
    lib/             # API clients, utilities
    pages/           # Route pages
    state/           # Context providers, state management
  public/            # Static assets, SEO files
  scripts/           # Build scripts (prerender, SEO generation)
packages/ui/         # Shared React component library (@funky/ui)
  src/
    catalog/         # Product cards, gallery, quick view
    layout/          # Header, footer, cart, search, cookie consent
    locale/          # Language, currency, UI strings contexts
    state/           # Cart, sound, collections, brand palettes
```

## Requirements

- Node.js 18+
- pnpm 9+
- A WordPress site with [WPGraphQL](https://wpgraphql.com/) and the
  [Superfunky Theme](https://github.com/coded-letter/superfunky-theme)

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_GRAPHQL_ENDPOINT` | WordPress WPGraphQL endpoint URL |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_...`) for checkout |
| `VITE_GEOLOCATION_ENDPOINT` | Optional CDN geolocation endpoint |

## Licence

MIT — see [`LICENSE`](./LICENSE).

## Related repositories

- [`coded-letter/superfunky-theme`](https://github.com/coded-letter/superfunky-theme) —
  companion WordPress backend theme (GPL-2.0)
