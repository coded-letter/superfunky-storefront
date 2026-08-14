import { Bookmark, Truck } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ResponsiveImage, useReadingList, ViewSwitch, type PostCardData, type ProductCardData, type ProductGalleryImage } from "@funky/ui";
import { sanitizeCmsHtml } from "../lib/cmsBehaviors";

const BOOL_OPTIONS: { value: "on" | "off"; label: string }[] = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

/** Shared on/off `ViewSwitch` wrapper — used by the cart, checkout, and community
 * profile pages' own local layout-option panels for page-local content switches. */
export function BoolSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <ViewSwitch label={label} value={value ? "on" : "off"} onChange={(next) => onChange(next === "on")} options={BOOL_OPTIONS} />;
}

/**
 * Long-form taxonomy description block — rendered below the main product/post grid on
 * every archive template (product/post category & tag), rather than crammed into the
 * hero itself. Keeps the hero focused on a short tagline while this section is where a
 * long, rich-HTML category/tag description (headings, lists, links — as it would come
 * from the WP/Woo taxonomy `description` field) actually gets room to read natively.
 * The image, when present, sits as a sticky side rail on wide screens and a top banner
 * on narrow ones — "smart" placement that never competes with the grid above it.
 */
export function ArchiveDescriptionSection({
  eyebrow,
  title,
  image,
  html,
}: {
  eyebrow: string;
  title: string;
  image?: string;
  html: string;
}) {
  return (
    <section className="grid gap-6 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 lg:grid-cols-[240px,minmax(0,1fr)] lg:gap-10 lg:p-10">
      {image ? (
        <ResponsiveImage
          src={image}
          alt=""
          aria-hidden="true"
          sizes="(min-width: 1024px) 15rem, 100vw"
          className="h-40 w-full rounded-2xl object-cover shadow-soft lg:sticky lg:top-24 lg:h-56"
        />
      ) : null}
      <div className="grid gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">{eyebrow}</span>
        <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">About {title}</h2>
        {/* Ready for real CMS/GraphQL HTML (headings, lists, links, inline images) — the
         * mock data above already ships as HTML strings so this renders identically to how
         * a WP/Woo taxonomy description field would once the backend is wired up. */}
        <div
          className="grid gap-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 [&_a]:font-semibold [&_a]:text-brand-600 [&_a]:no-underline [&_a:hover]:underline dark:[&_a]:text-brand-400 [&_h3]:m-0 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100 [&_li]:my-1 [&_p]:m-0 [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(html) }}
        />
      </div>
    </section>
  );
}

export type OrderLineItem = { id: string; name: string; variant: string; quantity: number; price: string };

export type ReadingPost = { id: string; title: string; excerpt: string };

/** Order subtotal (in the store's default currency) above which shipping is free —
 * shared between the cart and checkout pages so their math and copy always agree. */
export const FREE_SHIPPING_THRESHOLD = 100;

/** Mirrors the cart drawer's currency parsing closely enough for mockup-grade shipping/tax math. */
export function parsePriceValue(label: string | undefined): number {
  if (!label) return 0;
  const numeric = label.replace(/[^0-9.,]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number.parseFloat(numeric);
  return Number.isFinite(value) ? value : 0;
}

export function currencySymbolOf(label: string | undefined): string {
  const match = label?.match(/^[^0-9]*/);
  return match?.[0]?.trim() || "€";
}

/** Uncontrolled by default (existing call sites just need a labeled placeholder input),
 * but accepts optional `value`/`onChange`/`readOnly`/`helperText` for the few forms (like
 * the account dashboard) that actually need to track edits. */
export function InputMock({
  label,
  type = "text",
  value,
  onChange,
  readOnly = false,
  helperText,
  multiline = false,
  rows = 3,
  required = false,
  error,
  placeholder,
  name,
  autoComplete,
  inputMode,
  optionalHint = false,
}: {
  label: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  helperText?: string;
  multiline?: boolean;
  rows?: number;
  /** Appends a rose asterisk next to the label — purely visual (mockup forms aren't
   * actually validated), for WooCommerce-style required/optional field cues. */
  required?: boolean;
  /** Inline validation error message (see `lib/validation.ts`) — shown in place of
   * `helperText` and switches the field's border/ring to a rose "invalid" treatment. */
  error?: string;
  /** Custom placeholder text. Falls back to the field label when omitted. */
  placeholder?: string;
  name?: string;
  autoComplete?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  /** Marks the field as optional for assistive tech without repeating a redundant
   * visible "Optional" caption underneath — fields without `required`/the asterisk
   * are already visually understood as optional, but screen reader users don't get
   * that visual cue, so we append a `sr-only` "(optional)" to the label instead. */
  optionalHint?: boolean;
}) {
  const sharedClassName = `rounded-[var(--theme-radius)] border bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-4 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 read-only:cursor-not-allowed read-only:bg-zinc-50 read-only:text-zinc-500 dark:read-only:bg-zinc-900 dark:read-only:text-zinc-400 ${
    error
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:border-rose-500/60 dark:focus:ring-rose-950"
      : "border-zinc-200 focus:border-brand-400 focus:ring-brand-100 dark:border-zinc-700 dark:focus:border-brand-500 dark:focus:ring-brand-950"
  }`;

  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
      <span>
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        {optionalHint ? <span className="sr-only"> (optional)</span> : null}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder ?? label}
          readOnly={readOnly}
          rows={rows}
          name={name}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={Boolean(error)}
          className={`${sharedClassName} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          placeholder={placeholder ?? label}
          readOnly={readOnly}
          name={name}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          aria-invalid={Boolean(error)}
          className={sharedClassName}
        />
      )}
      {error ? (
        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{helperText}</span>
      ) : null}
    </label>
  );
}

/** Site author roster — a mockup-only stand-in for WordPress's `user` entity (the
 * eventual GraphQL author field). Powers the `/blog/author/:slug` archive template and
 * the author-name link inside `PostCard`/`AuthorBio`. */
export type Author = { name: string; slug: string; role: string; bio: string };

export const AUTHORS: Author[] = [
  {
    name: "Elena Marchetti",
    slug: "elena-marchetti",
    role: "Head of Product Design",
    bio: "Elena leads product design at Superfunky, obsessing over fabric weight and stitch tolerances so nobody else has to.",
  },
  {
    name: "Marcus Webb",
    slug: "marcus-webb",
    role: "Fit & Sizing Lead",
    bio: "Marcus spends more time with a tape measure than most tailors, turning customer sizing questions into charts and guides nobody has to ask for twice.",
  },
  {
    name: "Ingrid Solberg",
    slug: "ingrid-solberg",
    role: "Sustainability Lead",
    bio: "Ingrid runs sustainability and supply-chain reporting at Superfunky, translating dye-lot paperwork and mill audits into plain language customers can actually use.",
  },
];

export function getAuthorByName(name: string): Author | undefined {
  return AUTHORS.find((author) => author.name === name);
}

export function getAuthorBySlug(slug: string): Author | undefined {
  return AUTHORS.find((author) => author.slug === slug);
}

/** Builds a `PostCardData`/`PostDetail`-shaped author reference (name + slug) from a
 * known author name, falling back to a slugified name if it's ever an author not in the
 * roster above (keeps every post author linkable regardless). */
export function authorRef(name: string): { name: string; slug: string } {
  const found = getAuthorByName(name);
  return { name, slug: found?.slug ?? slugify(name) };
}

export function SummaryRow({ label, value, isTotal = false }: { label: string; value: string; isTotal?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${isTotal ? "mt-2 border-t border-zinc-200 pt-2.5 dark:border-zinc-800" : "mb-2.5"}`}>
      <span className={isTotal ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}>{label}</span>
      <span className={isTotal ? "text-base font-bold text-zinc-900 dark:text-zinc-100" : "font-medium text-zinc-900 dark:text-zinc-100"}>
        {value}
      </span>
    </div>
  );
}

export function OrderSummaryCard({
  title = "Order summary",
  lineItems,
  freeShippingNotice,
  rows,
  afterRows,
  total,
  ctaHref,
  ctaLabel,
  beforeCta,
  ctaDisabled = false,
  onCtaClick,
  ctaBusy = false,
  position = "sticky",
}: {
  title?: string;
  lineItems?: OrderLineItem[];
  /** Optional "X away from free shipping" banner, shown above the line items/rows and
   * linking through to the shop (or back to cart, via `actionLabel`) so shoppers can
   * act on it immediately. */
  freeShippingNotice?: { remainingLabel: string; href: string; actionLabel?: string };
  rows: { label: string; value: string }[];
  /** Optional content inserted after the standard rows but before the total. */
  afterRows?: ReactNode;
  total: string;
  ctaHref: string;
  ctaLabel: string;
  /** Optional content rendered between the totals and the CTA — e.g. required consent
   * checkboxes on checkout. Kept generic so pages that don't need it (cart, etc.) are unaffected. */
  beforeCta?: ReactNode;
  /** When true, the CTA renders as a visibly disabled, non-navigating control instead of a
   * live link — used to block "Place order" until required consent checkboxes are ticked. */
  ctaDisabled?: boolean;
  /** Optional interception handler — e.g. checkout submits a real payment before
   * navigating. Call `event.preventDefault()` inside to stop the `<Link>` navigation
   * and navigate programmatically once the async submission resolves. */
  onCtaClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Shows a "Placing order…" busy state and blocks re-clicks while a real payment
   * submission (see `onCtaClick`) is in flight. */
  ctaBusy?: boolean;
  /** `"sticky"` (default, current) follows scroll within its column on desktop.
   * `"static"` keeps it in normal document flow — useful once the summary should
   * sit inline with a checkout layout variant rather than float alongside it. */
  position?: "sticky" | "static";
}) {
  return (
    <aside
      className={`h-fit rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 ${
        position === "sticky" ? "lg:sticky lg:top-28" : ""
      }`}
    >
      <h2 className="m-0 mb-4 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {freeShippingNotice ? (
        <Link
          to={freeShippingNotice.href}
          className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs font-medium text-brand-700 no-underline transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
        >
          <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{freeShippingNotice.remainingLabel}</strong> left to free shipping — {freeShippingNotice.actionLabel ?? "shop more"}
          </span>
        </Link>
      ) : null}
      {lineItems ? (
        <div className="mb-3 grid gap-2.5 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          {lineItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">
                {item.name} × {item.quantity}
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.price}</span>
            </div>
          ))}
        </div>
      ) : null}
      {rows.map((row) => (
        <SummaryRow key={row.label} label={row.label} value={row.value} />
      ))}
      {afterRows}
      <SummaryRow label="Total" value={total} isTotal />
      {beforeCta}
      {ctaDisabled ? (
        <span
          role="button"
          aria-disabled="true"
          title="Accept the required terms above to place your order"
          className="mt-5 inline-flex w-full cursor-not-allowed justify-center rounded-full bg-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
        >
          {ctaLabel}
        </span>
      ) : (
        <Link
          to={ctaHref}
          onClick={ctaBusy ? (event) => event.preventDefault() : onCtaClick}
          aria-busy={ctaBusy}
          className={`mt-5 inline-flex w-full justify-center rounded-full bg-brand-gradient px-4 py-3 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5 ${
            ctaBusy ? "cursor-wait opacity-70" : ""
          }`}
        >
          {ctaBusy ? "Placing order…" : ctaLabel}
        </Link>
      )}
    </aside>
  );
}

export function BookmarkButton({ postId, className = "" }: { postId: string; className?: string }) {
  const { has, toggle } = useReadingList();
  const isSaved = has(postId);
  return (
    <button
      type="button"
      onClick={() => toggle(postId)}
      aria-pressed={isSaved}
      aria-label={isSaved ? "Remove from reading list" : "Save to reading list"}
      title={isSaved ? "Remove from reading list" : "Save to reading list"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        isSaved
          ? "bg-brand-gradient text-white shadow-soft"
          : "border border-zinc-200 text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
      } ${className}`}
    >
      <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}

export const primaryActionButtonClass =
  "rounded-control bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5";

export const MOCK_READING_POSTS: ReadingPost[] = [
  {
    id: "r-1",
    title: "How to choose your next performance outfit",
    excerpt: "A practical guide to materials, fit, and layering for everyday comfort.",
  },
  {
    id: "r-2",
    title: "Shipping policy explained",
    excerpt: "Everything about delivery windows, tracking, and international orders.",
  },
  {
    id: "r-3",
    title: "Care instructions for long-lasting products",
    excerpt: "Simple washing and maintenance practices to keep products in top condition.",
  },
];

export const MOCK_PRODUCTS: ProductCardData[] = [
  {
    id: "p-001",
    name: "Nebula Hoodie",
    subtitle: "Heavyweight cotton blend",
    category: "Apparel",
    imageUrl: "https://images.unsplash.com/photo-1622519407650-3df9883f76a5?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€79.00",
    compareAtPriceLabel: "€95.00",
    rating: 4.8,
    reviewCount: 124,
    badge: "Bestseller",
    gallery: ["", ""],
  },
  {
    id: "p-002",
    name: "Orbit Crossbody Bag",
    subtitle: "Waterproof recycled shell",
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€49.00",
    rating: 4.6,
    reviewCount: 89,
    isNew: true,
  },
  {
    id: "p-003",
    name: "Flux Sneakers",
    subtitle: "Breathable mesh upper",
    category: "Footwear",
    imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€119.00",
    compareAtPriceLabel: "€139.00",
    rating: 4.9,
    reviewCount: 218,
  },
  {
    id: "p-004",
    name: "Pulse Joggers",
    subtitle: "Tapered fit with stretch",
    category: "Apparel",
    imageUrl: "https://images.unsplash.com/photo-1560343776-97e7d202ff0e?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€59.00",
    rating: 4.4,
    reviewCount: 67,
  },
  {
    id: "p-005",
    name: "Mono Cap",
    subtitle: "Six-panel unisex fit",
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€24.00",
    rating: 4.3,
    reviewCount: 42,
  },
  {
    id: "p-006",
    name: "Shift Tee",
    subtitle: "Organic cotton jersey",
    category: "Apparel",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€29.00",
    compareAtPriceLabel: "€35.00",
    rating: 4.7,
    reviewCount: 153,
  },
  {
    // WooCommerce "external/affiliate" product — the card links out to a partner
    // store instead of adding to this site's own cart.
    id: "p-007",
    name: "Terra Trail Poles (via TrailGear)",
    subtitle: "Sold by our outdoor partner",
    category: "Partner",
    imageUrl: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€64.00",
    rating: 4.5,
    reviewCount: 31,
    productType: "external",
    externalUrl: "https://example.com/trailgear/terra-trail-poles",
  },
  {
    // WooCommerce "variable" product — price is a range across variations, and the
    // card lists the pickable attributes (colour/size) instead of a single SKU.
    id: "p-008",
    name: "Aurora Windbreaker",
    subtitle: "Packable, water-resistant shell",
    category: "Apparel",
    imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
    priceLabel: "€89.00",
    priceRangeLabel: "€89.00 – €99.00",
    rating: 4.7,
    reviewCount: 76,
    isNew: true,
    productType: "variable",
    gallery: ["", ""],
    variationOptions: [
      {
        label: "Color",
        values: [
          { label: "Midnight", swatchColor: "midnightblue", imageIndex: 0 },
          { label: "Fog", swatchColor: "gainsboro", imageIndex: 1 },
          { label: "Brand pink", swatchColor: "#ff6bd6", imageIndex: 2 },
        ],
      },
      {
        label: "Size",
        values: [{ label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" }],
      },
    ],
  },
];

// --- Product template mock data ------------------------------------------------
// Mirrors the shape of data the legacy Gatsby prototype's `templates/product.js`
// expects (variations, attribute options, categories/tags) so the product template
// can be built out incrementally without reshaping the mock data each time.

export type ProductVariationOption = {
  label: string;
  values: string[];
  /** CSS colors keyed by value — when present (e.g. for a "Color" attribute), the
   * variation selector renders a colour swatch circle instead of a text pill. Mirrors
   * WooCommerce's colour attribute term convention and supports hex or named colors. */
  swatches?: Record<string, string>;
};

export type ProductVariationCombo = {
  id: string;
  databaseId?: number;
  options: Record<string, string>;
  priceLabel: string;
  priceAmount?: number;
  compareAtPriceLabel?: string;
  compareAtPriceAmount?: number;
  imageId?: string;
  imageUrl?: string;
  sku: string;
  inStock: boolean;
  stockQuantity: number | null;
};

export type ProductReview = {
  id: string;
  /** Numeric WordPress comment ID used by the createReview mutation for threaded replies. */
  databaseId?: number;
  author: string;
  /** Present only on top-level reviews — WooCommerce only accepts a star rating on the
   * original review comment, not on replies further down the thread (mirroring what
   * `wp_list_comments` actually renders: replies are plain comments, no rating field). */
  rating?: number;
  /** ISO date string — matches the format WP/WooCommerce's GraphQL comment nodes use. */
  date: string;
  content: string;
  /** id of the comment this one replies to — omitted/null for a top-level review. Lets
   * the UI rebuild WordPress's native, arbitrarily-deep threaded-comment tree. */
  parentId?: string | null;
  /** Numeric parent ID used when GraphQL Relay IDs are unavailable or inconsistent. */
  parentDatabaseId?: number | null;
  /** Local submissions remain visible while they await moderation or a server refresh. */
  isPending?: boolean;
};

export type ProductDetail = {
  slug: string;
  card: ProductCardData;
  gallery: ProductGalleryImage[];
  description: string;
  learnMore: string;
  sku: string;
  variationOptions: ProductVariationOption[];
  variationCombos: ProductVariationCombo[];
  /** Sample of published reviews, plus a histogram to illustrate the full 124-review
   * spread from `card.reviewCount` without needing to mock every single one. */
  reviews: ProductReview[];
  ratingHistogram: Record<1 | 2 | 3 | 4 | 5, number>;
};

export const MOCK_PRODUCT_DETAILS: Record<string, ProductDetail> = {
  "nebula-hoodie": {
    slug: "nebula-hoodie",
    card: MOCK_PRODUCTS[0],
    sku: "NEB-HD",
    gallery: [
      { id: "front", label: "Front", accentClass: "from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900" },
      { id: "back", label: "Back", accentClass: "from-brand-100 to-brand-200 dark:from-brand-950 dark:to-zinc-900" },
      { id: "detail", label: "Fabric detail", accentClass: "from-amber-100 to-amber-200 dark:from-amber-950 dark:to-zinc-900" },
      { id: "worn", label: "Worn, front angle", accentClass: "from-fuchsia-100 to-fuchsia-200 dark:from-fuchsia-950 dark:to-zinc-900" },
    ],
    description:
      "A heavyweight cotton-blend hoodie with a brushed interior, dropped shoulders, and a relaxed fit built for everyday layering.",
    learnMore:
      "Cut from a 380gsm cotton-blend fleece, the Nebula Hoodie is garment-dyed for a lived-in feel from the first wear. A ribbed hem and cuffs lock in warmth, while the kangaroo pocket is reinforced at the seams for daily use. Machine washable, pre-shrunk.",
    variationOptions: [
      { label: "Color", values: ["Black", "Navy", "Olive"], swatches: { Black: "#18181b", Navy: "#1e3a5f", Olive: "#565f3c" } },
      { label: "Size", values: ["S", "M", "L", "XL"] },
    ],
    variationCombos: buildHoodieVariationCombos(),
    ratingHistogram: { 5: 105, 4: 13, 3: 4, 2: 1, 1: 1 },
    reviews: [
      {
        id: "rev-1",
        author: "Priya Nandakumar",
        rating: 5,
        date: "2026-06-02",
        content: "Runs true to size and the fleece is genuinely heavyweight — no pilling after a month of regular wear. The Navy colourway looks even better in person.",
      },
      {
        id: "rev-2",
        author: "Marco Belletti",
        rating: 5,
        date: "2026-05-18",
        content: "Best hoodie I've bought in years. Kangaroo pocket seams are reinforced like the description says — mine's survived a very overstuffed gym bag.",
      },
      {
        // Store reply, one level deep — demonstrates a merchant responding directly
        // under a review, the way WooCommerce/WordPress comment threading works.
        id: "rev-1-reply-1",
        author: "Superfunky Support",
        date: "2026-06-03",
        content: "Thanks so much, Priya! Really glad the Navy shade lived up to the photos — happy wearing. 💙",
        parentId: "rev-1",
      },
      {
        // Reviewer replying back to the store reply — two levels deep.
        id: "rev-1-reply-1-reply-1",
        author: "Priya Nandakumar",
        date: "2026-06-04",
        content: "Will do — already ordered the Olive one too!",
        parentId: "rev-1-reply-1",
      },
      {
        id: "rev-3",
        author: "Freja Lindqvist",
        rating: 4,
        date: "2026-04-27",
        content: "Great quality and the Olive shade is lovely, just wish it came in more sizes — mine sold out fast.",
      },
      {
        // Another shopper chiming in under someone else's review — three levels deep,
        // illustrating that replies can keep nesting further and further.
        id: "rev-3-reply-1",
        author: "Owen Marsh",
        date: "2026-04-28",
        content: "Same here, M sold out within a day of restock. Worth setting a back-in-stock alert.",
        parentId: "rev-3",
      },
      {
        id: "rev-3-reply-1-reply-1",
        author: "Freja Lindqvist",
        date: "2026-04-29",
        content: "Good call, just signed up for the alert on the product page.",
        parentId: "rev-3-reply-1",
      },
      {
        id: "rev-4",
        author: "Tomasz Wiśniewski",
        rating: 5,
        date: "2026-03-11",
        content: "Garment-dyed finish looks great after washing, doesn't fade. Sizing chart was accurate for me.",
      },
    ],
  },
};

function buildHoodieVariationCombos(): ProductVariationCombo[] {
  const sizeSurcharge: Record<string, number> = { S: 0, M: 0, L: 0, XL: 4 };
  // Olive is a limited run and only available in the smaller sizes — mirrors the
  // legacy template's disabled-option behaviour for combinations without stock.
  const outOfStock = new Set(["Olive-L", "Olive-XL"]);

  const combos: ProductVariationCombo[] = [];
  for (const color of ["Black", "Navy", "Olive"]) {
    for (const size of ["S", "M", "L", "XL"]) {
      const key = `${color}-${size}`;
      const inStock = !outOfStock.has(key);
      combos.push({
        id: key,
        options: { Color: color, Size: size },
        priceLabel: `€${(79 + sizeSurcharge[size]).toFixed(2)}`,
        compareAtPriceLabel: color === "Black" ? "€95.00" : undefined,
        sku: `NEB-HD-${color.slice(0, 3).toUpperCase()}-${size}`,
        inStock,
        stockQuantity: inStock ? 12 : 0,
      });
    }
  }
  return combos;
}

/** A single block of a blog post's body — a small structured content model standing in
 * for the legacy prototype's raw WP `content` HTML string, so the post template can
 * render, type-check, and slugify headings without runtime HTML parsing. */
export type PostContentBlock =
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "list"; items: string[] };

export type PostDetail = {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date string — matches the format WP's GraphQL post nodes use. */
  date: string;
  wordCount: number;
  readingTimeMinutes: number;
  author: { name: string; slug: string; bio: string };
  categories: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  content: PostContentBlock[];
  /** Post comments reuse the exact same threaded-comment type as product reviews —
   * WordPress backs both with the same underlying `comment` entity. */
  reviews: ProductReview[];
  ratingHistogram?: Record<1 | 2 | 3 | 4 | 5, number>;
};

/** Mirrors the legacy `toc.js`/`anchors-content.js` slug algorithm: strip accents,
 * fold the Polish "ł", collapse whitespace to dashes, drop punctuation/emoji, and
 * lower-case — so heading anchors stay stable and URL-safe. */
export function slugifyHeading(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .replace(/\s+/g, "-")
    .replace(/[`~!@#$%^&*()_|+=?;:'",.<>{}[\]\\/]/gi, "")
    .toLowerCase();
}

/** General-purpose slug helper (same algorithm as `slugifyHeading`, just named for
 * non-heading use — e.g. turning a product's `category` label into a route slug for
 * the `/shop/category/:slug` archive template). */
export const slugify = slugifyHeading;

/** Site-wide product category/tag lists — mirrors `BLOG_CATEGORIES`/`BLOG_TAGS` below but
 * for the shop taxonomy. Slugs power the `/shop/category/:slug` and `/shop/tag/:slug`
 * archive templates; `PRODUCT_TAG_MAP` is a mockup-only stand-in for a real per-product
 * tags field (which `ProductCardData` doesn't model yet). */
export const PRODUCT_CATEGORIES = [
  {
    name: "Apparel",
    slug: "apparel",
    description: "Everyday layers, from tees to outerwear.",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>Our apparel line is built around one idea: clothes that move with you, not against you. Every piece starts as a sketch informed by how people actually get dressed — layering for a commute, shedding a jacket mid-workout, or throwing on a hoodie over anything at all.</p><h3>Fabric &amp; fit</h3><p>We favour mid-weight cotton blends and brushed technical knits that soften with every wash instead of pilling. Cuts run true to size across the collection, with an athletic taper through the body and a slightly roomier sleeve for full range of motion.</p><ul><li>Pre-shrunk, garment-dyed cotton on core tees and hoodies</li><li>Water-resistant technical shells for outerwear</li><li>Reinforced seams at every stress point</li></ul><p>New drops land at the start of each season — <a href=\"/blog/category/style\">read our styling notes</a> for pairing ideas straight from the design team.</p>",
  },
  {
    name: "Footwear",
    slug: "footwear",
    description: "Sneakers and trail-ready shoes.",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>From city sneakers to trail-ready trainers, our footwear collection is designed and tested by people who actually rack up the miles in it. Each silhouette goes through multiple prototype rounds before it ever reaches the shop.</p><h3>What sets it apart</h3><p>Every pair ships with a removable, moisture-wicking insole and a lightweight EVA midsole tuned for all-day comfort rather than pure cushioning bulk. Outsoles use a high-abrasion rubber compound rated for both pavement and light trail use.</p><ul><li>Breathable knit or full-grain leather uppers</li><li>Reinforced heel counter for lateral stability</li><li>True-to-size fit — check our size guide before ordering half sizes</li></ul>",
  },
  {
    name: "Accessories",
    slug: "accessories",
    description: "Bags, caps, and finishing touches.",
    image: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>The small stuff that finishes an outfit — bags, caps, belts, and the everyday-carry pieces people end up wearing more than anything else in their closet. We keep this category tight and considered rather than chasing every trend.</p><p>Hardware is solid brass or matte-finished stainless steel throughout, and every bag in the range is built around a single, well-tested pattern rather than one-off designs, so replacement straps and parts stay available for years after a style first ships.</p>",
  },
  {
    name: "Partner",
    slug: "partner",
    description: "Curated picks fulfilled by trusted partner stores.",
    image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>Partner listings are curated picks from independent stores we trust, fulfilled directly by them rather than from our own warehouse. Shipping times and return policies follow each partner's own terms — look for the notice on the product page before checkout.</p><p>We vet every partner on quality, response time, and return handling before listing their catalog here, and we re-review that relationship every season.</p>",
  },
];

export const PRODUCT_TAGS = [
  {
    name: "Layering",
    slug: "layering",
    description: "Mix-and-match pieces built to stack for shoulder-season weather.",
    longDescriptionHtml:
      "<p>Shoulder-season dressing is its own puzzle — too warm for a heavy coat, too cold for a single layer. This tag groups every piece we've designed to stack cleanly: slim base layers, mid-weight overshirts, and packable shells that compress down when the temperature swings back up.</p><p>Look for the <strong>layer-weight</strong> badge on the product page — it tells you roughly where each piece sits in a three-layer system (base, mid, shell) so you're not guessing at fit when combining sizes.</p>",
  },
  {
    name: "New season",
    slug: "new-season",
    description: "The latest arrivals just landed in the shop.",
    longDescriptionHtml:
      "<p>Everything here shipped in the current drop. We restock core styles year-round, but this tag is reserved strictly for first-run pieces from the newest collection — once a piece has been live for a full season it rolls off this tag automatically.</p>",
  },
  {
    name: "Unisex",
    slug: "unisex",
    description: "Fits and cuts designed to work for every body.",
    longDescriptionHtml:
      "<p>Every piece tagged unisex is graded on a single size chart rather than split gendered blocks, with a fit that's intentionally roomy through the shoulder and adjustable at the waist or cuff where it matters. If you usually size between two numbers, we recommend sizing down for a closer fit.</p>",
  },
];

export const PRODUCT_TAG_MAP: Record<string, string[]> = {
  layering: ["p-001", "p-004", "p-008"],
  "new-season": ["p-002", "p-005", "p-008"],
  unisex: ["p-002", "p-005", "p-006"],
};

/** Site-wide category/tag clouds — mirrors the legacy prototype's `cat-pills.js` /
 * `tag-pills.js` (which list every WP category/tag, not just the current post's own).
 * Now wired to real `/blog/category/:slug` and `/blog/tag/:slug` archive templates. */
export const BLOG_CATEGORIES = [
  {
    name: "Behind the Scenes",
    slug: "behind-the-scenes",
    description: "Process, craft, and stories from the studio.",
    image: "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>A running look inside how things actually get made here — sample rounds, fabric sourcing trips, photoshoots that didn't go to plan, and the small decisions that never make it into a product description. If you're curious how a collection goes from sketch to shelf, this is the category for you.</p><h3>What you'll find</h3><ul><li>Studio visits and maker interviews</li><li>Sample-to-production breakdowns</li><li>Photoshoot behind-the-scenes</li></ul>",
  },
  {
    name: "Guides",
    slug: "guides",
    description: "Practical how-tos for getting more from your gear.",
    image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>Practical, no-fluff how-tos — sizing advice, care instructions, layering systems, and troubleshooting for the gear you already own. Every guide is written and fact-checked by the same team that designs the product, not outsourced content.</p><p>Have a question a guide hasn't answered yet? <a href=\"/blog\">Browse the full journal</a> or reach out through support — recurring questions become new guides.</p>",
  },
  {
    name: "Sustainability",
    slug: "sustainability",
    description: "Materials, sourcing, and our environmental commitments.",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>We publish our sourcing decisions here in plain language, including the tradeoffs — no greenwashing, no vague claims we can't back up with a supplier audit. Expect updates on fabric certifications, factory relationships, and the commitments we're still working toward.</p><h3>Current commitments</h3><ul><li>100% of core cotton lines certified organic or recycled by next season</li><li>Annual third-party factory audits, summarized publicly</li><li>Take-back program for end-of-life garments</li></ul>",
  },
  {
    name: "Style",
    slug: "style",
    description: "Outfit inspiration and seasonal styling ideas.",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=80",
    longDescriptionHtml:
      "<p>Outfit breakdowns, seasonal capsule ideas, and styling notes straight from the team that designs each collection — built around pieces you can actually shop, not aspirational looks assembled from ten different brands.</p>",
  },
];

export const BLOG_TAGS = [
  {
    name: "Hoodies",
    slug: "hoodies",
    description: "Cozy layers built for cooler days and lazy weekends.",
    longDescriptionHtml:
      "<p>Everything we've ever written about hoodies — fabric weight comparisons, fit notes across our different hoodie cuts, and care tips to keep the brushed interior soft wash after wash.</p>",
  },
  {
    name: "Materials",
    slug: "materials",
    description: "A closer look at the fabrics and finishes we use.",
    longDescriptionHtml:
      "<p>Deep dives into the fabrics behind each collection — where the fibers come from, how they're finished, and why we chose them over the (usually cheaper) alternative.</p>",
  },
  {
    name: "Care Guide",
    slug: "care-guide",
    description: "Tips for washing, storing, and extending the life of your gear.",
    longDescriptionHtml:
      "<p>Wash temperatures, drying advice, and storage tips organized by fabric type — cotton, wool, technical shells, and leather each get their own rundown so your gear lasts seasons longer than the care label alone would suggest.</p>",
  },
  {
    name: "New Arrivals",
    slug: "new-arrivals",
    description: "Fresh drops worth knowing about this season.",
    longDescriptionHtml: "<p>Announcement posts for everything new — design notes, restock timing, and first-look photography for each drop.</p>",
  },
  {
    name: "Sizing",
    slug: "sizing",
    description: "Fit notes and measurement tips for finding your size.",
    longDescriptionHtml:
      "<p>Fit notes broken down by category, plus a walkthrough of how to take your own measurements if you're ordering without trying anything on first. When in doubt, size up on outerwear and true-to-size on everything else.</p>",
  },
];

/** Post summaries for the archive/listing shortcodes (`PostCard` + `PaginablePostGrid`) —
 * lighter than `MOCK_POST_DETAILS` (no body content/reviews) since a grid card only ever
 * needs title/excerpt/author/date/word-count/taxonomy metadata. */
export const MOCK_POST_SUMMARIES: PostCardData[] = [
  {
    id: "post-001",
    slug: "behind-the-design-of-the-nebula-collection",
    title: "Behind the design of the Nebula collection",
    excerpt: "A look at the materials, process, and inspiration behind our most-loved seasonal drop.",
    imageUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
    date: "2026-05-14",
    lastEditedDate: "2026-05-20",
    author: authorRef("Elena Marchetti"),
    wordCount: 640,
    readingTimeMinutes: 4,
    categories: [{ name: "Behind the Scenes", slug: "behind-the-scenes" }],
    tags: [{ name: "Hoodies", slug: "hoodies" }, { name: "Materials", slug: "materials" }],
  },
  {
    id: "r-1",
    slug: "how-to-choose-your-next-performance-outfit",
    title: "How to choose your next performance outfit",
    excerpt: "A practical guide to materials, fit, and layering for everyday comfort.",
    imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80",
    date: "2026-05-08",
    author: authorRef("Marcus Webb"),
    wordCount: 820,
    readingTimeMinutes: 5,
    categories: [{ name: "Guides", slug: "guides" }],
    tags: [{ name: "Sizing", slug: "sizing" }, { name: "New Arrivals", slug: "new-arrivals" }],
  },
  {
    id: "r-2",
    slug: "shipping-policy-explained",
    title: "Shipping policy explained",
    excerpt: "Everything about delivery windows, tracking, and international orders.",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    date: "2026-04-30",
    author: authorRef("Ingrid Solberg"),
    wordCount: 410,
    readingTimeMinutes: 3,
    categories: [{ name: "Guides", slug: "guides" }],
    tags: [{ name: "Care Guide", slug: "care-guide" }],
  },
  {
    id: "r-3",
    slug: "care-instructions-for-long-lasting-products",
    title: "Care instructions for long-lasting products",
    excerpt: "Simple washing and maintenance practices to keep products in top condition.",
    imageUrl: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=80",
    date: "2026-04-22",
    lastEditedDate: "2026-04-29",
    author: authorRef("Elena Marchetti"),
    wordCount: 560,
    readingTimeMinutes: 4,
    categories: [{ name: "Sustainability", slug: "sustainability" }],
    tags: [{ name: "Care Guide", slug: "care-guide" }, { name: "Materials", slug: "materials" }],
  },
  {
    id: "post-005",
    slug: "the-fabric-glossary-every-shopper-should-know",
    title: "The fabric glossary every shopper should know",
    excerpt: "GSM, loop-back, ripstop — decoding the material jargon printed on every care label.",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    date: "2026-04-15",
    author: authorRef("Marcus Webb"),
    wordCount: 710,
    readingTimeMinutes: 5,
    categories: [{ name: "Guides", slug: "guides" }, { name: "Style", slug: "style" }],
    tags: [{ name: "Materials", slug: "materials" }],
  },
  {
    id: "post-006",
    slug: "why-we-switched-to-garment-dyeing",
    title: "Why we switched to garment-dyeing",
    excerpt: "The slower, pickier dye process behind the Nebula collection's lived-in colour depth.",
    imageUrl: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80",
    date: "2026-04-02",
    author: authorRef("Ingrid Solberg"),
    wordCount: 530,
    readingTimeMinutes: 4,
    categories: [{ name: "Behind the Scenes", slug: "behind-the-scenes" }, { name: "Sustainability", slug: "sustainability" }],
    tags: [{ name: "Materials", slug: "materials" }],
  },
  {
    id: "post-007",
    slug: "building-a-capsule-wardrobe-that-actually-works",
    title: "Building a capsule wardrobe that actually works",
    excerpt: "Fewer pieces, more outfits — a practical framework for a season-proof rotation.",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
    date: "2026-03-26",
    lastEditedDate: "2026-04-01",
    author: authorRef("Marcus Webb"),
    wordCount: 940,
    readingTimeMinutes: 6,
    categories: [{ name: "Style", slug: "style" }],
    tags: [{ name: "New Arrivals", slug: "new-arrivals" }, { name: "Sizing", slug: "sizing" }],
  },
  {
    id: "post-008",
    slug: "our-2026-sustainability-progress-report",
    title: "Our 2026 sustainability progress report",
    excerpt: "Recycled fibres, water use, and supply-chain transparency — a mid-year check-in.",
    imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    date: "2026-03-18",
    author: authorRef("Ingrid Solberg"),
    wordCount: 880,
    readingTimeMinutes: 6,
    categories: [{ name: "Sustainability", slug: "sustainability" }],
    tags: [{ name: "Materials", slug: "materials" }, { name: "Care Guide", slug: "care-guide" }],
  },
  {
    id: "post-009",
    slug: "sizing-guide-finding-your-perfect-fit",
    title: "Sizing guide: finding your perfect fit",
    excerpt: "How our size charts are built, and what to do when you're between two sizes.",
    imageUrl: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80",
    date: "2026-03-05",
    author: authorRef("Elena Marchetti"),
    wordCount: 480,
    readingTimeMinutes: 3,
    categories: [{ name: "Guides", slug: "guides" }],
    tags: [{ name: "Sizing", slug: "sizing" }],
  },
  {
    id: "post-010",
    slug: "new-arrivals-the-spring-drop-preview",
    title: "New arrivals: the spring drop preview",
    excerpt: "A first look at the silhouettes, colourways, and fabrics landing next month.",
    imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
    date: "2026-02-24",
    author: authorRef("Marcus Webb"),
    wordCount: 390,
    readingTimeMinutes: 3,
    categories: [{ name: "Behind the Scenes", slug: "behind-the-scenes" }],
    tags: [{ name: "New Arrivals", slug: "new-arrivals" }],
  },
];

export const MOCK_POST_DETAILS: Record<string, PostDetail> = {
  "behind-the-design-of-the-nebula-collection": {
    slug: "behind-the-design-of-the-nebula-collection",
    title: "Behind the design of the Nebula collection",
    excerpt: "A look at the materials, process, and inspiration behind our most-loved seasonal drop.",
    date: "2026-05-14",
    wordCount: 640,
    readingTimeMinutes: 4,
    author: {
      name: AUTHORS[0].name,
      slug: AUTHORS[0].slug,
      bio: AUTHORS[0].bio,
    },
    categories: [
      { name: "Behind the Scenes", slug: "behind-the-scenes" },
      { name: "Guides", slug: "guides" },
    ],
    tags: [
      { name: "Hoodies", slug: "hoodies" },
      { name: "Materials", slug: "materials" },
    ],
    content: [
      {
        type: "paragraph",
        text: "Every Nebula-collection piece starts on the cutting-room floor with a single question: what does \"heavyweight\" actually feel like to the person wearing it every day, not just under a showroom light?",
      },
      { type: "heading", level: 2, text: "Choosing the fleece" },
      {
        type: "paragraph",
        text: "We tested eleven different cotton-blend fleece weights before settling on the 380gsm brushed-back loop that ships in the Nebula Hoodie today. Anything lighter felt like a t-shirt with delusions of grandeur; anything heavier stopped draping properly across the shoulders.",
      },
      {
        type: "quote",
        text: "If a hoodie doesn't survive a hundred washes without pilling, it's not ready for the collection.",
        cite: "Elena Marchetti, Head of Product Design",
      },
      { type: "heading", level: 2, text: "Garment-dyeing over piece-dyeing" },
      {
        type: "paragraph",
        text: "Garment-dyeing — where the finished, sewn hoodie goes into the dye bath rather than the raw fabric before cutting — is slower and pickier, but it's the only way to get that slightly irregular, lived-in colour depth across seams and pockets.",
      },
      {
        type: "list",
        items: [
          "Softer hand-feel after the first wash",
          "Colour that fades evenly instead of patchily",
          "A visibly different finish at the felled seams — that's not a flaw, it's the process",
        ],
      },
      { type: "heading", level: 3, text: "Reinforcing the pocket" },
      {
        type: "paragraph",
        text: "The kangaroo pocket takes more abuse than almost any other part of a hoodie — phones, keys, overstuffed gym bags. We double-stitch the pocket bag itself, not just the visible topstitch, which is the detail most reviewers have picked up on.",
      },
      { type: "heading", level: 2, text: "What's next for the collection" },
      {
        type: "paragraph",
        text: "The next drop extends the same fleece and dye process into a quarter-zip and a lighter, unlined version for warmer climates — both currently in wear-testing with our team.",
      },
    ],
    ratingHistogram: { 5: 2, 4: 1, 3: 0, 2: 0, 1: 0 },
    reviews: [
      {
        id: "post-rev-1",
        author: "Sana Okafor",
        rating: 5,
        date: "2026-05-16",
        content: "Loved reading the process behind the garment-dyeing — explains why my Navy one looks a little different at the seams, makes total sense now.",
      },
      {
        // Author replying to a comment on their own post — one level deep.
        id: "post-rev-1-reply-1",
        author: "Elena Marchetti",
        date: "2026-05-16",
        content: "Exactly — that seam variation is a feature of the process, not a defect. Glad it landed well!",
        parentId: "post-rev-1",
      },
      {
        id: "post-rev-2",
        author: "Marcus Webb",
        rating: 4,
        date: "2026-05-15",
        content: "Would love a deep dive on the quarter-zip you mentioned — any timeline on that?",
      },
      {
        id: "post-rev-2-reply-1",
        author: "Elena Marchetti",
        date: "2026-05-15",
        content: "Aiming for late this year, still fine-tuning the zip-tape weight. I'll write it up once it's locked.",
        parentId: "post-rev-2",
      },
      {
        // Two levels deep — the original commenter replying back to the author's reply.
        id: "post-rev-2-reply-1-reply-1",
        author: "Marcus Webb",
        date: "2026-05-15",
        content: "Can't wait — following for updates!",
        parentId: "post-rev-2-reply-1",
      },
      {
        id: "post-rev-3",
        author: "Ingrid Solberg",
        rating: 5,
        date: "2026-05-14",
        content: "The double-stitched pocket detail is such a small thing but it's exactly the kind of durability write-up I want before buying.",
      },
    ],
  },
};
