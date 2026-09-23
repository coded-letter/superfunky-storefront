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
Storefront-owned discovery also generates public creator/collaborator profiles and
one archive for every non-empty community tag. Directory landing pages are generated
at `/product-brand`, `/author`, `/community-author`, and `/community-tag`.
Free shell and blog profiles retry the standard page, post, category, tag, and author
connections when a plugin breaks the generic WordPress route connections. Builds fail
instead of publishing a stable-route-only sitemap when complete route discovery remains
unavailable.

Set `VITE_SITE_URL` to the public origin during the build (for example,
`https://shop.example.com`) to add absolute canonical URLs to generated pages.
The generated `dist/static-routes.json` records every static entry for deployment
and cache-invalidation tooling.

The same route inventory powers the visitor-facing `/sitemap` directory and the
crawler-facing `/sitemap.xml`. Every public CMS route remains listed even when a
site-wide SEO plugin applies temporary `noindex` metadata; that metadata is still
rendered on the route itself. Transactional routes such as account, cart, checkout,
authentication, and order confirmation remain generated for direct navigation but
are excluded from both public sitemap surfaces. Set `VITE_SITE_URL` (or the hosting
provider's `URL`) so sitemap locations use the production storefront origin.

The storefront-generated `/sitemap.xml` is authoritative for public frontend routes.
The WordPress sitemap index is mirrored separately as `/wp-sitemap.xml`; it does not
overwrite the storefront sitemap during postbuild.

The WordPress Control Center's Build & Deploy settings can trigger the deployment
webhook after debounced public-content changes and on a configurable WP-Cron interval.

## Tailwind utilities in WordPress content

The production prebuild queries the configured `VITE_GRAPHQL_ENDPOINT` before Vite
compiles CSS. It paginates through public pages, posts, community posts, product
descriptions, media captions/descriptions, taxonomy descriptions, authors, and menus,
and includes localized announcement/footer HTML. Rendered `headlessContent` includes
the backend's expanded blocks and templates. Optional plugin fields use explicit schema
compatibility fallbacks; unavailable product GraphQL connections use the public
WooCommerce Store API.

Exact HTML class names are decoded, deduplicated, and compiled with the storefront's
real Tailwind configuration. `.tailwind/cms-content.html` is an ignored, site-specific
build artifact, scanned alongside application source. The baseline utility inventory
is additive, not an allowlist ceiling. Responsive fractions, opacity modifiers,
important/negative utilities, arbitrary transforms, shadows, and calculated radii are
supported. URLs/resource-loading values, arbitrary selectors/declarations, unsafe
characters, and invalid tokens are excluded with source-labelled diagnostics. Custom
WordPress classes remain unchanged. Never add a broad regex safelist.

Extraction is bounded to 50 MB of HTML, 100 pages per connection, 10,000 class candidates
including the baseline, 512 characters per token, and 1 MB of compiled utility CSS.
Incomplete pagination, required fields, or failed requests fail the build rather than
reusing a stale inventory. `VITE_SITE_URL` supplies the Origin for protected CMS queries.
Production builds require an explicit endpoint; `CMS_TAILWIND_OFFLINE=true` is an
explicit baseline-only demo mode, not a production recovery option.

After Vite, `scripts/audit-cms-tailwind.mjs` verifies that every compiled inventory class
survived in the initial CSS and reports its compressed size. Those hashed stylesheet
links are retained by static pages and artifact shells, so utilities do not depend on
artifact-only route CSS. Run `pnpm --filter @funky/storefront audit:cms-tailwind` to
regenerate the inventory and diagnose current CMS content without building.

Publishing a new class requires a successful storefront rebuild. Configure the
debounced public-content build webhook in Control Center, including on artifact-enabled
sites; published shared blocks/templates, menus, and public Control Center HTML also
schedule that rebuild. Regenerating a route artifact alone does not compile new utilities.
Existing compiled classes remain available until the next deployment. For local Vite
development, regenerate the inventory after CMS changes; Vite watches the generated file.

WordPress block classes such as `wp-block-*`, `has-*`, `is-layout-*`, and alignment
classes are not Tailwind utilities. They continue to use WordPress global/block styles
and the storefront compatibility CSS. The extractor does not fetch or execute CSS or
JavaScript from content.

Prerendered WordPress CSS remains in the document throughout hydration, including
while its stylesheet request is pending. Loaded static CSS or applied cached theme
styles do not wait for background data revalidation before revealing the storefront.
If runtime core block styles are needed, their readiness wait is capped at two seconds;
inline theme/compatibility CSS remains available and late stylesheets can still finish.

## Native archive pagination

Post grids, the blog index, author archives, and post taxonomy archives inherit
**Settings > Reading > Blog pages show at most** (`posts_per_page`). Product grids
and product category/tag/brand archives inherit WooCommerce's effective shop page
size, including its native rows/columns and `loop_shop_per_page` filter.
The public `funkycommerceArchiveSettings` GraphQL field supplies both values,
independently of Layout Studio preferences.

Control Center > Store & Currency > Products per page override defaults to **0**
(inherit WooCommerce). Existing saved positive overrides remain effective in both
native and headless mode; set an old override to 0 to follow WooCommerce again.
Without WooCommerce, the product fallback is 12. Updating Reading, WooCommerce
rows/columns, or the override invalidates storefront settings and schedules the
existing debounced build webhook.

The same settings are seeded during prerender and revalidated in the browser.
Both numbered pagination and infinite scrolling use these sizes. The current
client-side filtering/sorting model requires complete collections: archive loaders
walk GraphQL cursors in batches of 25 (Woo Store API pages stay at 100), rather than
mistaking one visual page for the whole archive. Broken/repeated cursors, incomplete
REST pagination, or more than 1,000 batches raise errors instead of silently hiding
later items. A native `-1` page size displays the complete collection.

A `[grid]` without `page_size` (or with `page_size="0"`) inherits the relevant native
setting. The backend transports this as `data-page-size="0"`, not a fixed 12.
An explicit positive editorial `page_size` retains its existing 1-48 range in
both native rendering and the React storefront; related-content sections,
sliders, and social feeds retain their own sizes. Homepage post grids load full
archives, not the bounded summaries intended for sliders.

Older themes without the new GraphQL field use WordPress's exposed reading setting
and 12 products per page with an explicit upgrade warning. Other settings-query
failures surface an unavailable state rather than silently substituting defaults.
Use the updated backend theme to synchronize WooCommerce settings accurately.

## Build stability

Custom CSS is critical by default. To opt in to two layers, put
`/* storefront:deferred */` on its own line **between complete top-level rules**.
Keep header, promo, hero, fonts, and layout rules above it; place only
below-the-fold rules after it. Prerender emits a separate non-render-blocking
stylesheet, activated on window load or after two seconds without waiting for React
or WordPress. Without JavaScript, a noscript stylesheet preserves the full design.
The runtime fallback applies the same split; no existing CSS is automatically deferred.

Header promotional HTML preserves classes and safe inline presentation styles in
both static and React rendering. Its `branding.promoHtml` is included in CMS
Tailwind extraction. Script/event attributes and unsafe CSS remain blocked.
CMS `application/ld+json` scripts are parsed as data, never wrapped in JavaScript
error handlers. Product category/tag/brand archives use `CollectionPage`, not
`Product` or `ProductGroup` (which describes variants of a single product).

Build-time GraphQL shares the browser's two-request concurrency limit so complete
archive loading does not saturate WordPress workers. Native display page sizes
remain independent of these transport batches. Store API requests time out after
12 seconds instead of leaving a catalog load pending indefinitely.
CMS class extraction scans two independent inventories at a time and reports
per-source timings. Route discovery limits rendered page batches to 25 and makes
at most two 20-second attempts per request, rather than five 60-second attempts.

Prerender fetches only the content seed families required by discovered routes,
one family at a time. Missing navigation, pagination settings, or required content
seeds fail the build: Netlify keeps its previous deployment rather than publishing
HTML containing loading placeholders without the data needed to activate them.
An optional AI-assistant failure is logged without discarding usable navigation.
GraphQL schema errors are not retried unchanged.

Optional SEO document mirroring shares a 30-second total network budget across
feeds, sitemaps, and AI documents. An unavailable backend is logged and existing
generated output is retained, instead of accumulating a timeout for each document.

## Public component selectors

SuperFunky-rendered components expose stable, semantic CSS hooks in the reserved
`sf-` namespace. Use component classes such as `.sf-header`, `.sf-product-card`,
`.sf-hero`, and `.sf-shortcode-categories` for custom CSS; Tailwind utilities and
WordPress classes are implementation details rather than customization contracts.
Every rendered shortcode has both `.sf-shortcode` and a normalized
`.sf-shortcode-<name>` wrapper, including its loading, empty, and error states.

Static IDs are limited to composition-guaranteed singleton landmarks such as
`#sf-header`, `#sf-footer`, and `#sf-404`. Repeatable cards, sliders, grids, modal
instances, and shortcode instances intentionally use classes only to prevent
duplicate IDs. Generated IDs used by `aria-controls`, labels, dialogs, and other
accessibility relationships are not styling hooks. Existing `funky-*` classes
remain available for backward compatibility, but new customizations should use
`sf-*`.

Layout Studio owns the storefront shell and standard CMS content geometry from the initial
render. WordPress `theme.json` `contentSize`/`wideSize`, nested `main`/`container` wrappers,
and wrapper width styles cannot resize that shell. For editors, unaligned blocks use the
normal Layout Studio content column; **Wide width** may reclaim the shell's inner width
(the theme max width minus its responsive 16/24/32px gutters); and **Full width** reaches
both document/viewport edges. A full Group or Cover keeps its background/media edge-to-edge.
Add Gutenberg `is-layout-constrained` or `has-global-padding` to that full block when its
ordinary direct children need the same safe gutters; do not add padding to the media itself.
A Full block nested directly in Full stays at 100% (no second breakout), while Wide inside
Full returns to the controlled shell-inner cap. WordPress continues to own typography,
colours, block spacing, columns, media height/aspect/object-fit, and bounded widget sizing.
Homepage application sections and product layouts are outside this CMS scope.

The generated class set is a build artifact, so publishing or changing a CMS-authored
utility requires a storefront rebuild. Keep the site's Netlify `WordPress` build hook
configured in Control Center; public-content saves already trigger that hook after the
existing one-minute debounce. Hook URLs stay in WordPress and Netlify and must not be
committed. If an internal preview site is not managed by `sites.json`, configure its
credential-free `VITE_GRAPHQL_ENDPOINT` directly in the hosting provider.

For Cloudflare Pages deployments of the open-source workspace, build from the
repository root with `pnpm build` and publish `apps/storefront/dist`. The exported
root `wrangler.jsonc` identifies that directory as the Pages application. When no
backend endpoint is configured, development uses the public
`https://dev.superfunky.pro/graphql` reference backend. Set that endpoint explicitly
to build the reference site with its CMS-authored utilities.

## CMS code and bundled behaviors

Custom HTML blocks marked with `data-wp-block-html="css"` or
`data-wp-block-html="js"` retain their editor-authored CSS and JavaScript. Editor scripts
are activated after React inserts the content, including scripts added by later route or
data updates. Inline, external HTTPS, classic, and module script attributes are preserved.
This is a trusted-publisher capability: code published through WordPress runs with the
same page privileges as bundled code.

Inline event handlers, `srcdoc`, and `javascript:`/`vbscript:` URLs are still removed.
WordPress-enqueued JavaScript is still ignored; executable editor integrations should use
the native Custom HTML JavaScript block. Interactive content can also request a bundled
behavior from `src/lib/cmsBehaviors.ts` with
`data-funky-behavior="<approved-id>"`. Approved IDs are:

- `docs-navigation` for sidebar state, active-page highlighting, the mobile menu,
  heading anchors, scroll-spy links, and the header offset;
- `homepage-location` for the accessible Superfunky location card and Google Maps link;
- `homepage-newsletter-trigger` for routing the CMS waitlist button to the bundled,
  backend-connected newsletter dialog instead of maintaining a duplicate CMS form; and
- `homepage-orbital` for finite, CSP-safe pointer tilt and orbit animation.

The single-location homepage does not load Google Maps JavaScript: a directions link is
more accessible, needs no exposed browser key, and avoids an external dependency without
an immutable integrity artifact. The typed locations shortcode remains the application
renderer for pages that genuinely need searchable multi-location maps.

The storefront also recognizes existing known DOM shapes while deployed WordPress content
is migrated. Warnings never include script bodies: executable-attribute warnings report
only blocked counts, unknown behavior warnings name only the rejected ID, and WordPress
enqueue warnings name only the ignored registered handle. Add a typed registry entry and
regression tests before publishing another bundled behavior.

## Internal links in CMS content

Storefront and CMS-authored anchors are handled centrally. Relative links, links on the
storefront origin, and public content links on the configured WordPress origin use
client-side navigation. Intent (pointer hover, keyboard focus, or touch) prefetches the
same route data the destination renders. Editors should keep normal links as ordinary
`<a href="…">` markup; dynamically inserted anchors work without a behavior ID.

Native browser behavior is retained for external origins, `mailto:`/`tel:` links,
downloads, non-`_self` targets, `rel="external"`, and same-page/hash-only anchors. Add
`data-funky-native-link` to an anchor when a same-storefront URL intentionally requires
a document navigation. WordPress admin, login, REST, GraphQL, and XML-RPC URLs are never
treated as storefront content links.

### CMS styles and Content Security Policy

React theme variables, measured navigation geometry, WordPress block markup, and editor
widgets legitimately create style attributes and runtime `<style>` elements. The generated
Netlify CSP therefore permits inline Custom HTML CSS and JavaScript, evaluated JavaScript,
HTTPS script sources and connections, WSS connections, HTTPS frames, and HTTPS/blob
workers. Inline event-handler attributes remain disabled with `script-src-attr 'none'`.

Before CMS HTML reaches `dangerouslySetInnerHTML`, its style attributes are reduced to a
finite presentation allowlist. Bounded dimensions, spacing, Gutenberg flex basis, progress
widths, colours, radius, borders, and shadows are retained. URL-bearing CSS, imports,
expressions, browser bindings/behaviors, CSS escapes/control characters, unsupported
properties, oversized dimensions, fixed/sticky/absolute positioning, insets, and z-index
are removed. Application-owned React styles and trusted theme-generated styles use their
typed paths instead of this content sanitizer.

WordPress Global Styles remain authoritative for Text, Links, Headings (including
individual H1-H6 settings), Captions, and Buttons. The native Small, Medium, Large, and
Extra Large presets retain WordPress's generated fluid values. A block-level preset or
custom value overrides the global element default. Supported native typography controls
include font family and size, style and weight, line height, letter spacing, text
alignment, decoration, indentation, transform, text columns, writing mode, and drop caps.
Default WordPress buttons inherit the current Layout Studio `--theme-radius`; explicit
block radius controls remain authoritative.

After deployment, operators can verify the response policy without credentials:

```bash
pnpm --filter @funky/storefront audit:csp -- https://storefront.example/en/
```

The audit fails if inline permission appears outside style directives. Browser QA should
also listen for `securitypolicyviolation` while loading the homepage, opening navigation
and newsletter UI, and visiting a CMS documentation page. Violations raised inside Stripe,
Spotify, or other cross-origin iframe documents belong to that framed origin and cannot be
controlled by the parent storefront CSP.

## Standalone deployments

The repository root is the pnpm workspace. For Cloudflare Pages, use `pnpm build`
and publish `apps/storefront/dist`; the included `wrangler.jsonc` identifies that
directory as the application so Cloudflare does not need to guess between packages.

Configure the public `VITE_GRAPHQL_ENDPOINT` in your hosting provider so builds can
compile CMS-authored Tailwind utilities. To build the reference site, set it to
`https://dev.superfunky.pro/graphql`. Development uses that reference when omitted.
Build-hook URLs and
provider credentials must never be committed.

The production generator also consumes the Control Center's public static-generation
configuration. It creates or removes the sitemap, custom robots file, `llms.txt`,
`llms-full.txt`, AI brand/product/ranking/FAQ/defence files, Apple merchant
association, redirects, approved security headers, GTM and reviewed head/body scripts,
and public build metadata. Deployment webhook URLs are deliberately never exposed
through GraphQL.

For Apple Pay domain verification, paste the complete downloaded
`apple-developer-merchantid-domain-association` document into the Control Center rather
than entering only the Merchant ID. The build writes those bytes unchanged. When that
setting is empty, a non-empty file at `public/.well-known/` is used as the deployment
fallback; when neither source is configured, the well-known URL returns 404 instead of
the SPA document.
