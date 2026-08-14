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

The production build runs `scripts/generate-cms-tailwind-content.mjs --contract-only`
before Vite. It writes the reviewed, finite CMS utility contract without querying
WordPress, so publishing content never changes the application CSS or requires a
storefront rebuild. Run `pnpm --filter @funky/storefront audit:cms-tailwind` separately
to validate current CMS content and report unsupported tokens.

Editors may use utilities and responsive/state variants present in that stable contract.
Permitted arbitrary values are compiled into bounded route CSS when WordPress regenerates
the artifact: numeric dimensions, border radii, opacity, aspect ratios, integer
stacking/order, and hex colors. Arbitrary selectors, URLs, transforms, shadows, CSS
declarations, unsupported variants, malformed brackets, excessive output, and non-ASCII
tokens are rejected. Extend both the JavaScript validator and PHP compiler with tests
when an editor needs a new finite form; never add a broad regex safelist.

WordPress block classes such as `wp-block-*`, `has-*`, `is-layout-*`, and alignment
classes are not Tailwind utilities. They continue to use WordPress global/block styles
and the storefront compatibility CSS. The extractor does not fetch or execute CSS or
JavaScript from content.

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

Publishing content with utilities from the stable contract does not require a CSS rebuild.
Extending the contract itself remains an application-code change and requires a new
storefront build. Configure the credential-free `VITE_GRAPHQL_ENDPOINT` in the deployment
environment when the public reference backend is not appropriate.

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
