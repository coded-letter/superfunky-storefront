# Storefront mockup app

Run locally:

```bash
npm install
npm run dev
```

Default URL:

`http://127.0.0.1:4173`

## Static production routes

`pnpm run build` creates route-specific HTML entries for stable storefront routes.
When `VITE_GRAPHQL_ENDPOINT` is configured, the build also paginates through public
content nodes, taxonomy terms, and authors to generate entries for their CMS URLs.
If discovery is unavailable, stable routes still build and unknown URLs retain the
React Router fallback.

Set `VITE_SITE_URL` to the public origin during the build (for example,
`https://shop.example.com`) to add absolute canonical URLs to generated pages.
The generated `dist/static-routes.json` records every static entry for deployment
and cache-invalidation tooling.

The same route inventory powers the visitor-facing `/sitemap` directory and the
crawler-facing `/sitemap.xml`. Transactional routes such as account, cart, checkout,
authentication, and order confirmation remain generated for direct navigation but
are excluded from both public sitemap surfaces and disallowed in generated
`robots.txt`. Set `VITE_SITE_URL` (or the hosting provider's `URL`) so sitemap
locations use the production storefront origin.

The WordPress Control Center's Build & Deploy settings can trigger the deployment
webhook after debounced public-content changes and on a configurable WP-Cron interval.

## Managed Netlify sites

The controlled Frontend-as-a-Service fleet is declared in
[`sites.json`](/workspace/frontend/sites.json). Each entry uses this same storefront
release and supplies only its public backend connection values. From the
[`workspace/frontend`](/workspace/frontend) workspace:

```bash
pnpm sites:check
NETLIFY_AUTH_TOKEN=... pnpm sites:plan
NETLIFY_AUTH_TOKEN=... pnpm sites:apply
```

`sites:check` verifies catalog access, required GraphQL fields, and cart-token CORS
without needing Netlify credentials. `sites:plan` is read-only and reports Netlify
drift. Run `sites:apply` only after the readiness check, a local build, and a Netlify
draft deploy have passed QA. The sync is idempotent: existing sites are
looked up by ID or name, build settings and allowlisted environment variables are
reconciled, and one CMS build hook is ensured per site. Build-hook URLs remain in
Netlify and the WordPress Control Center; they are never stored in this repository.

To add a client, copy the `superfunky-pro` entry, choose a unique key and Netlify site
name, set the HTTPS GraphQL endpoint and optional custom domain, then run the plan.
Do not add backend credentials or secret Stripe keys to the manifest.

The production generator also consumes the Control Center's public static-generation
configuration. It creates or removes the sitemap, custom robots file, `llms.txt`,
`llms-full.txt`, AI brand/product/ranking/FAQ/defence files, Apple merchant
association, redirects, approved security headers, GTM and reviewed head/body scripts,
and public build metadata. Deployment webhook URLs are deliberately never exposed
through GraphQL.
