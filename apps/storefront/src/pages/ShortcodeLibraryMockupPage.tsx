import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  List,
  BookOpen,
  CreditCard,
  Download,
  Heart,
  LogIn,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Rows3,
  ShoppingCart,
  Sparkles,
  SlidersHorizontal,
  Star,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { PaginablePostGrid, PostCard, ProductCard, ResponsiveImage, SocialPostCard, ViewSwitch, avatarColorFor, useLayoutPreferences, useSoundUX, type PostCardData, type ProductCardData, type ProductCardVariant, type SocialFeedLayout, type SocialFeedLoadMode } from "@funky/ui";
import { HeroMock } from "../components/HeroMock";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { SliderMock } from "../components/SliderMock";
import { ShortcodeLabel } from "../components/ShortcodeLabel";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CommentsSection } from "./CommentThread";
import { useBlogData } from "../state/blogData";
import { useCommerceData } from "../state/commerceData";
import { useCommunityData } from "../state/communityData";
import type { CmsBlogTerm } from "../lib/blog";

type CategoryTileItem = { id: string; title: string; count: string; image: string; slug: string };

const HERO_SLIDES = [
  {
    id: "hero-1",
    title: "New season, new silhouettes",
    subtitle: "SS26 drop — apparel, footwear, and accessories built for people who move differently.",
    label: "New season · SS26",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "hero-2",
    title: "Stories from the studio",
    subtitle: "Behind-the-scenes journal entries, style guides, and care notes from the team.",
    label: "The journal",
    image: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
  },
];

/** The five documented `[hero]` variants — one example object per layout, matching the
 * props `HeroMock` accepts, so the shortcode label and live preview always stay in sync. */
const HERO_EXAMPLES: Array<{
  id: string;
  variant: "glow" | "fullbleed" | "split" | "minimal" | "strip";
  label: string;
  description: string;
  kicker?: string;
  title: string;
  copy?: string;
  image?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}> = [
  {
    id: "hero-glow",
    variant: "glow",
    label: "Atmospheric glow (dark, centered)",
    description: "Dark, radial-glow banner with centered copy — used as the home page's own top hero.",
    kicker: "New season · SS26 drop",
    title: "Gear built for people who move differently",
    copy: "Curated apparel, footwear, and accessories mockups — ready for design review before backend mapping.",
    primaryCta: { label: "Shop the collection", href: "/shop" },
    secondaryCta: { label: "Read the journal", href: "/blog" },
  },
  {
    id: "hero-fullbleed",
    variant: "fullbleed",
    label: "Full-bleed photography (left-aligned overlay)",
    description: "Edge-to-edge background photo with a gradient overlay — copy anchored bottom-left.",
    kicker: "Members only",
    title: "The Nebula collection has landed",
    copy: "Limited-run pieces, dropping in limited sizes — shop before they're gone.",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
    primaryCta: { label: "Shop new arrivals", href: "/shop" },
    secondaryCta: { label: "View lookbook", href: "/blog" },
  },
  {
    id: "hero-split",
    variant: "split",
    label: "Split image/copy (two columns)",
    description: "Text and CTAs on one side, a supporting image on the other — even 50/50 split at desktop widths.",
    kicker: "Sustainability",
    title: "Made to last, sourced responsibly",
    copy: "Traceable materials and small-batch production, from raw fiber to finished piece.",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
    primaryCta: { label: "Our materials", href: "/blog/category/sustainability" },
    secondaryCta: { label: "Shop the range", href: "/shop" },
  },
  {
    id: "hero-minimal",
    variant: "minimal",
    label: "Minimal editorial (text-only)",
    description: "No imagery — a light, centered banner for copy-led landing sections or campaign pages.",
    kicker: "The journal",
    title: "Stories worth reading, styling worth trying",
    copy: "Guides, care notes, and behind-the-scenes features from the studio, updated weekly.",
    primaryCta: { label: "Read the journal", href: "/blog" },
    secondaryCta: { label: "Browse guides", href: "/blog/category/guides" },
  },
  {
    id: "hero-strip",
    variant: "strip",
    label: "Promo strip (compact banner)",
    description: "A slim, single-line banner for time-boxed offers — pairs well stacked above a page's main hero.",
    kicker: "Limited time",
    title: "Free shipping over $75",
    copy: "Ends Sunday — no code needed at checkout.",
    primaryCta: { label: "Shop now", href: "/shop" },
  },
];

function CategoryTile({ item, variant = "graphical" }: { item: CategoryTileItem; variant?: "editorial" | "graphical" }) {
  return (
    <Link
      to={`/shop/category/${item.slug}`}
      className={`group relative overflow-hidden text-left no-underline shadow-soft outline-none transition hover:-translate-y-1 hover:shadow-soft-lg focus-visible:ring-2 focus-visible:ring-brand-500 ${
        variant === "editorial" ? "aspect-[3/4] rounded-xl" : "aspect-[4/5] rounded-2xl"
      }`}
    >
      <ResponsiveImage
        src={item.image}
        alt=""
        sizes="(min-width: 768px) 25vw, 50vw"
        draggable={false}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/0" aria-hidden="true" />
      <div className="relative flex h-full flex-col justify-end gap-0.5 p-4">
        <h4 className="m-0 font-display text-lg font-bold text-white drop-shadow-sm">{item.title}</h4>
        <span className="text-xs font-medium text-white/85">{item.count}</span>
      </div>
    </Link>
  );
}

function TestimonialCard({ quote, author }: { quote: string; author: string }) {
  return (
    <figure className="m-0 grid h-full gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <blockquote className="m-0 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">"{quote}"</blockquote>
      <figcaption className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">— {author}</figcaption>
    </figure>
  );
}

function buildShortcode(name: string, attrs: Record<string, string | number | boolean | string[]>) {
  const entries = Object.entries(attrs).filter(([, value]) => value !== undefined && value !== "");
  return `[${name}${entries.length ? " " : ""}${entries
    .map(([key, value]) => `${key}="${Array.isArray(value) ? `[${value.join(", ")}]` : String(value)}"`)
    .join(" ")}]`;
}

function ShortcodeSnippet({
  name,
  attrs,
  caption = "Paste this shortcode into a WordPress block",
}: {
  name: string;
  attrs: Record<string, string | number | boolean | string[]>;
  caption?: string;
}) {
  return (
    <div className="grid gap-2 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-zinc-400 dark:text-zinc-500">{caption}</span>
      <code className="break-words rounded-xl bg-zinc-100 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {buildShortcode(name, attrs)}
      </code>
    </div>
  );
}

function LibrarySection({
  id,
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-36 grid gap-6 rounded-4xl border border-zinc-200/80 bg-white/80 p-6 shadow-soft backdrop-blur sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/80">
      <header className="grid gap-2 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">
          {icon}
          {eyebrow}
        </div>
        <h2 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="m-0 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </header>
      <div className="grid gap-8">{children}</div>
    </section>
  );
}

function ShortcodeContract({
  name,
  example,
  values,
}: {
  name: string;
  example: Record<string, string | number | boolean | string[]>;
  values: [string, string[]][];
}) {
  return (
    <article className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">[{name}]</h3>
        <ShortcodeLabel name={name} attrs={example} />
      </div>
      <ShortcodeSnippet name={name} attrs={example} />
      {values.map(([attribute, accepted]) => <AcceptedValues key={attribute} name={attribute} values={accepted} />)}
    </article>
  );
}

const COLUMN_COUNT_OPTIONS = [2, 3, 4] as const;
type ColumnCount = (typeof COLUMN_COUNT_OPTIONS)[number];
type ColumnLayout = "1/2+1/2" | "1/3+2/3" | "2/3+1/3" | "1/3+1/3+1/3" | "1/4×4";
type CartShortcodeLayout = "classic" | "editorial";
type CheckoutStoreMode = "physical" | "digital";
type CheckoutCouponPosition = "inline" | "top";
type CheckoutPaymentPosition = "left" | "right";
type CheckoutSummaryPosition = "sticky" | "static";
type ReadingListLayout = "cards" | "editorial-2col";
type AccountTab = "dashboard" | "orders" | "addresses" | "community";
type AuthMode = "login" | "register" | "forgot-password";
type AuthLayout = "split" | "centered" | "image-bg";
type OrderSuccessMode = "physical" | "digital";
const COLUMN_COUNT_CLASS: Record<ColumnCount, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

/** Reference/style-guide page documenting every reusable slider, carousel, grid, and
 * column shortcode the theme supports — grouped logically, with the exact shortcode
 * configuration shown above each live example. Not linked from the storefront's real
 * shopping flow; purely a design-system/CMS-editor reference. */
export function ShortcodeLibraryMockupPage() {
  const { playAction } = useSoundUX();
  const { themeMaxWidthPx } = useLayoutPreferences();
  const [gridColumns, setGridColumns] = useState<ColumnCount>(4);
  const [categoryLayout, setCategoryLayout] = useState<"minimal" | "editorial" | "graphical">("graphical");
  const [archiveCollectionLayout, setArchiveCollectionLayout] = useState<"pills" | "compact">("pills");
  const [postCardVariant, setPostCardVariant] = useState<"default" | "compact" | "editorial" | "minimal">("default");
  const [productCardVariant, setProductCardVariant] = useState<ProductCardVariant>("default");
  const [columnLayout, setColumnLayout] = useState<ColumnLayout>("1/3+2/3");
  const [reviewsVariant, setReviewsVariant] = useState<"full" | "compact">("full");
  const [commentsVariant, setCommentsVariant] = useState<"full" | "compact">("full");
  const [memberLayout, setMemberLayout] = useState<"grid" | "list">("grid");
  const [socialPostLayout, setSocialPostLayout] = useState<SocialFeedLayout>("grid-3");
  const [communityFeedLoadMode, setCommunityFeedLoadMode] = useState<SocialFeedLoadMode>("manual");
  const [communityFeedPageSize, setCommunityFeedPageSize] = useState<"6" | "12" | "24">("12");
  const [communityFeedFilters, setCommunityFeedFilters] = useState<"show" | "hide">("show");
  const [communityHeroLayout, setCommunityHeroLayout] = useState<"gradient" | "split" | "image-bg">("gradient");
  const [cartLayout, setCartLayout] = useState<CartShortcodeLayout>("classic");
  const [cartSummaryPosition, setCartSummaryPosition] = useState<CheckoutSummaryPosition>("sticky");
  const [checkoutStoreMode, setCheckoutStoreMode] = useState<CheckoutStoreMode>("physical");
  const [checkoutCouponPosition, setCheckoutCouponPosition] = useState<CheckoutCouponPosition>("inline");
  const [checkoutPaymentPosition, setCheckoutPaymentPosition] = useState<CheckoutPaymentPosition>("left");
  const [checkoutSummaryPosition, setCheckoutSummaryPosition] = useState<CheckoutSummaryPosition>("sticky");
  const [checkoutOptionalFields, setCheckoutOptionalFields] = useState<"show" | "hide">("show");
  const [checkoutOrderNotes, setCheckoutOrderNotes] = useState<"show" | "hide">("show");
  const [checkoutTerms, setCheckoutTerms] = useState<"show" | "hide">("show");
  const [checkoutPrivacy, setCheckoutPrivacy] = useState<"show" | "hide">("show");
  const [checkoutGuestCheckout, setCheckoutGuestCheckout] = useState<"allow" | "require-account">("allow");
  const [wishlistCardVariant, setWishlistCardVariant] = useState<ProductCardVariant>("default");
  const [readingListLayout, setReadingListLayout] = useState<ReadingListLayout>("cards");
  const [accountTab, setAccountTab] = useState<AccountTab>("dashboard");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLayout, setAuthLayout] = useState<AuthLayout>("split");
  const [orderSuccessMode, setOrderSuccessMode] = useState<OrderSuccessMode>("physical");
  const { data: blog, isLoading: isBlogLoading, error: blogError } = useBlogData();
  const { data: commerce, isLoading: isCommerceLoading, error: commerceError } = useCommerceData();
  const { data: community, isLoading: isCommunityLoading, error: communityError } = useCommunityData();
  const livePosts = blog?.posts || [];
  const liveProducts = commerce?.products || [];
  const liveCategories = commerce?.categories || [];

  const featuredProduct = liveProducts[0];
  const featuredPost = livePosts[0];
  const featuredMembers = (community?.members || []).filter((user) => user.isPublic).slice(0, 4);
  const marketplaceEntries = community?.marketplaceItems || [];
  const featuredMarketplaceEntry = marketplaceEntries[0];
  const featuredSocialPost = community?.posts[0];
  const communityArticles = community && blog
    ? blog.posts.filter((post) =>
        community.members.some((member) => member.role === "collaborator" && member.handle === post.author?.slug),
      )
    : [];
  const featuredReviews = commerce?.reviews || [];
  const averageRating = featuredReviews.length
    ? featuredReviews.reduce((sum, review) => sum + review.rating, 0) / featuredReviews.length
    : 0;
  const categoryTiles: CategoryTileItem[] = liveCategories.slice(0, 8).map((category) => ({
    id: category.id,
    title: category.name,
    count: `${category.count} products`,
    image: category.imageUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
    slug: category.slug,
  }));

  return (
    <div className="grid gap-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shortcode library" }]} />

      <section className="grid gap-3 rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Design system</span>
        <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100">Shortcode library</h1>
        <p className="m-0 max-w-2xl text-zinc-500 dark:text-zinc-400">
          Every reusable slider, carousel, grid, and column block the theme supports — organized by type, with the
          shortcode configuration and paste-ready block text shown directly above each example. These pages are
          intentionally blank-canvas shells: WordPress owns the surrounding layout, while Layout Studio stays focused on
          visual tuning. Attribute names (
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">slides</code>,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">layout</code>,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">navigation</code>,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">bgimgs</code>,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">pill</code>,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">h1</code>,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">p</code>) mirror what a future
          live WordPress shortcode resolver accepts as real backend input.
        </p>
      </section>

      <nav aria-label="Shortcode domains" className="grid gap-3 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Home", href: "#home-heroes", detail: "Heroes and campaign sliders" },
          { label: "Shop", href: "#shop-carousels", detail: "Products, categories, reviews" },
          { label: "Blog", href: "#blog-columns", detail: "Posts, taxonomies, comments" },
          { label: "Community", href: "#community-hero", detail: "Hero, feed, members, marketplace" },
          { label: "Customer", href: "#customer-cart", detail: "Cart, checkout, saved content, account" },
        ].map((domain) => (
          <a key={domain.label} href={domain.href} className="grid gap-1 rounded-2xl border border-zinc-200 p-4 no-underline transition hover:border-brand-400 hover:bg-brand-50 dark:border-zinc-800 dark:hover:border-brand-600 dark:hover:bg-brand-950/30">
            <strong className="text-sm text-zinc-900 dark:text-zinc-100">{domain.label}</strong>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{domain.detail}</span>
          </a>
        ))}
      </nav>

      <LibrarySection
        id="home-backend-shortcodes"
        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Home · Backend execution contracts"
        title="Paste-ready Home shortcodes"
        description="These are the validated WordPress shortcodes executed by the shared React resolver. Repeat a shortcode as many times as needed; editor order is preserved exactly on the storefront."
      >
        <div className="grid gap-8">
          <ShortcodeContract
            name="hero"
            example={{ variant: "fullbleed", kicker: "New season", title: "Gear built for people who move differently", description: "Curated apparel, footwear, and accessories.", image: "https://example.com/hero.jpg", primary_cta_label: "Shop the collection", primary_cta_href: "/shop", secondary_cta_label: "Read the journal", secondary_cta_href: "/blog", fullwidth: true, height: "75vh" }}
            values={[
              ["variant", ["glow", "fullbleed", "split", "minimal", "strip"]],
              ["kicker / title / description / image", ["text or URL"]],
              ["primary_cta_label / primary_cta_href", ["text", "internal path or URL"]],
              ["secondary_cta_label / secondary_cta_href", ["text", "internal path or URL"]],
              ["fullwidth", ["true", "false"]],
              ["height", ["CSS length, e.g. 75vh or 640px"]],
            ]}
          />
          <ShortcodeContract
            name="categories"
            example={{ type: "product", layout: "cards", columns: 3, limit: 3, include: "", orderby: "name", order: "asc", title: "" }}
            values={[
              ["type", ["product", "post"]],
              ["layout", ["cards", "compact", "minimal", "editorial", "graphical", "pills"]],
              ["columns", ["2", "3", "4"]],
              ["limit", ["1–24"]],
              ["include", ["comma-separated IDs or slugs"]],
              ["orderby", ["name", "count", "include"]],
              ["order", ["asc", "desc"]],
              ["title", ["text"]],
            ]}
          />
          <ShortcodeContract
            name="slider"
            example={{ type: "product", layout: "2/3", card_variant: "default", slides: 3, limit: 6, navigation: "both", autoplay: 5000, loop: true, category: "", tag: "", author: "", date_from: "", date_to: "", min_rating: 0, orderby: "date", order: "desc", title: "This season's picks", subtitle: "" }}
            values={[
              ["type", ["campaign", "product", "post"]],
              ["layout", ["3/3", "2/3", "1/3"]],
              ["card_variant (product)", ["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"]],
              ["card_variant (post)", ["default", "compact", "editorial", "minimal"]],
              ["slides / limit", ["1–12", "1–48"]],
              ["navigation", ["dots", "arrows", "both", "none"]],
              ["autoplay / loop", ["0–60000 milliseconds", "true", "false"]],
              ["include / category / tag / author", ["comma-separated IDs/slugs", "single slug"]],
              ["date_from / date_to (post)", ["YYYY-MM-DD"]],
              ["min_rating (product)", ["0–5"]],
              ["orderby / order", ["date", "title", "rating", "include", "asc", "desc"]],
              ["title / subtitle", ["text"]],
              ["campaign: kicker / description / image", ["text or URL"]],
              ["campaign: titles / descriptions / images / kickers", ["pipe-separated slide values"]],
              ["campaign: fullwidth / height", ["true", "false", "CSS length"]],
            ]}
          />
          <ShortcodeContract
            name="reviews"
            example={{ layout: "grid-4", limit: 12, product: "", min_rating: 0, max_rating: 5, date_from: "", date_to: "", title: "Product reviews" }}
            values={[
              ["layout", ["grid-4", "grid-3", "grid-5", "masonry", "compact"]],
              ["variant", ["cards", "full", "compact"]],
              ["limit", ["1–48"]],
              ["product", ["product slug or blank for all"]],
              ["min_rating / max_rating", ["0–5"]],
              ["date_from / date_to", ["YYYY-MM-DD"]],
              ["title", ["text"]],
            ]}
          />
          <ShortcodeContract
            name="comments"
            example={{ layout: "cards", limit: 12, post: "", min_rating: 0, max_rating: 5, date_from: "", date_to: "", title: "Recent comments" }}
            values={[
              ["layout", ["cards", "compact"]],
              ["variant", ["cards", "full", "compact"]],
              ["limit", ["1–48"]],
              ["post", ["post slug or blank for all"]],
              ["min_rating / max_rating", ["0–5 where comment ratings exist"]],
              ["date_from / date_to", ["YYYY-MM-DD"]],
              ["title", ["text"]],
            ]}
          />
          <ShortcodeContract
            name="community-feed"
            example={{ layout: "grid-4", load_mode: "manual", page_size: 8, show_filters: true, tags: "", author: "", date_from: "", date_to: "", min_rating: 0, min_likes: 0, title: "From the community feed" }}
            values={[
              ["layout", ["masonry", "grid-3", "grid-4", "list", "compact"]],
              ["load_mode", ["manual", "infinite"]],
              ["page_size", ["1–48"]],
              ["show_filters", ["true", "false"]],
              ["tags / author", ["comma-separated tag slugs", "author handle"]],
              ["date_from / date_to", ["YYYY-MM-DD"]],
              ["min_rating", ["0–5"]],
              ["min_likes", ["0–1000000 (community only)"]],
              ["title", ["text"]],
            ]}
          />
          <ShortcodeContract
            name="testimonials"
            example={{ layout: "grid-3", limit: 3, min_rating: 4, date_from: "", date_to: "", title: "What customers say" }}
            values={[
              ["layout", ["grid-3", "carousel", "compact"]],
              ["limit", ["1–12"]],
              ["min_rating", ["0–5"]],
              ["date_from / date_to", ["YYYY-MM-DD"]],
              ["title", ["text"]],
            ]}
          />
          <ShortcodeContract
            name="related-sections"
            example={{ items: "testimonials,none,none", product_limit: 4, post_limit: 3, community_limit: 4 }}
            values={[
              ["items", ["up to three comma-separated: products", "posts", "community", "testimonials", "none"]],
              ["product_limit / post_limit / community_limit", ["1–12"]],
            ]}
          />
        </div>
      </LibrarySection>

      <LibrarySection
        id="special-page-backend-shortcodes"
        icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Shop · Blog · Community backend execution"
        title="Remaining special-page shortcodes"
        description="Validated live-data contracts used to compose the Shop, Blog, and Community Pages from the block editor. Date, rating, and community-only likes filters use the same semantics as the Home contracts."
      >
        <div className="grid gap-8">
          <ShortcodeContract
            name="grid"
            example={{ type: "product", layout: "standard", columns: 4, card_variant: "default", page_size: 12, paginated: true, include: "", category: "", tag: "", author: "", date_from: "", date_to: "", min_rating: 0, orderby: "date", order: "desc", title: "All products", subtitle: "" }}
            values={[
              ["type", ["product", "post", "community-article"]],
              ["layout", ["standard", "compact", "editorial", "masonry"]],
              ["columns / page_size", ["1–6", "1–48"]],
              ["card_variant", ["all seven product variants", "all four post variants"]],
              ["paginated", ["true", "false"]],
              ["include / category / tag / author", ["IDs or slugs"]],
              ["date_from / date_to", ["YYYY-MM-DD for posts"]],
              ["min_rating", ["0–5 for products"]],
              ["orderby / order", ["date", "title", "rating", "include", "asc", "desc"]],
              ["title / subtitle", ["text"]],
            ]}
          />
          <ShortcodeContract
            name="carousel"
            example={{ type: "product", card_variant: "editorial", columns: 4, limit: 12, autoplay: 3200, loop: true, min_rating: 0, title: "Product carousel" }}
            values={[
              ["type", ["product", "post"]],
              ["columns / limit", ["1–6", "1–48"]],
              ["card_variant", ["product or post variants"]],
              ["include / category / tag / author", ["IDs or slugs"]],
              ["date_from / date_to", ["YYYY-MM-DD for posts"]],
              ["min_rating", ["0–5 for products"]],
              ["autoplay / loop", ["0–60000 milliseconds", "true", "false"]],
              ["title / subtitle", ["text"]],
            ]}
          />
          <ShortcodeContract name="tags" example={{ layout: "pills", limit: 24, include: "", orderby: "name", order: "asc", title: "Tags" }} values={[
            ["layout", ["pills", "cards", "compact"]],
            ["limit", ["1–100"]],
            ["include", ["comma-separated IDs or slugs"]],
            ["orderby / order", ["name", "count", "include", "asc", "desc"]],
            ["title", ["text"]],
          ]} />
          <ShortcodeContract name="authors" example={{ layout: "cards", limit: 12, include: "", show_bio: true, min_posts: 0, orderby: "name", order: "asc", title: "Authors" }} values={[
            ["layout", ["cards", "compact"]],
            ["limit", ["1–100"]],
            ["include", ["comma-separated IDs or slugs"]],
            ["show_bio", ["true", "false"]],
            ["min_posts", ["0–1000000"]],
            ["orderby / order", ["name", "post-count", "include", "asc", "desc"]],
          ]} />
          <ShortcodeContract name="community-hero" example={{ layout: "gradient", kicker: "Community", title: "See how the community styles it", description: "Real posts from public members.", image: "", show_upload: true }} values={[
            ["layout", ["gradient", "split", "image-bg"]],
            ["kicker / title / description / image", ["text or URL"]],
            ["show_upload", ["true", "false"]],
          ]} />
          <ShortcodeContract name="community-marketplace" example={{ layout: "grid", card_variant: "default", columns: 4, limit: 12, min_rating: 0, title: "Shop the community" }} values={[
            ["layout", ["grid", "compact", "carousel"]],
            ["card_variant", ["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"]],
            ["columns / limit", ["1–6", "1–48"]],
            ["min_rating", ["0–5"]],
          ]} />
          <ShortcodeContract name="community-tag-picks" example={{ layout: "grid-3", tags: "", tag_limit: 3, post_limit: 3, min_likes: 0, date_from: "", date_to: "", title: "Hand-picked by tag" }} values={[
            ["layout", ["grid-3", "grid-4", "compact"]],
            ["tags", ["comma-separated tag slugs"]],
            ["tag_limit / post_limit", ["1–12"]],
            ["min_likes", ["0–1000000 (community only)"]],
            ["date_from / date_to", ["YYYY-MM-DD"]],
          ]} />
          <ShortcodeContract name="community-members" example={{ layout: "grid", columns: 6, limit: 12, include: "", role: "all", show_bio: false, title: "Members to follow" }} values={[
            ["layout", ["grid", "compact", "list"]],
            ["columns / limit", ["1–6", "1–100"]],
            ["include", ["comma-separated member handles"]],
            ["role", ["all", "member", "creator", "collaborator"]],
            ["show_bio", ["true", "false"]],
          ]} />
        </div>
      </LibrarySection>

      <LibrarySection
        id="home-heroes"
        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Home · Hero sections"
        title="Heroes"
        description="Five documented top-of-page banner layouts — pick the atmosphere (dark/light, image/text-only) that best fits the page, then feed it a kicker, heading, copy, and up to two CTAs."
      >
        <div className="grid gap-8">
          {HERO_EXAMPLES.map((hero) => (
            <div key={hero.id} className="grid gap-3">
              <ShortcodeLabel
                name="hero"
                attrs={{
                  variant: hero.variant,
                  ...(hero.kicker ? { pill: hero.kicker } : {}),
                  h1: hero.title,
                  ...(hero.copy ? { p: hero.copy } : {}),
                  ...(hero.image ? { bgimg: hero.image } : {}),
                  ...(hero.primaryCta ? { cta1: `${hero.primaryCta.label}|${hero.primaryCta.href}` } : {}),
                  ...(hero.secondaryCta ? { cta2: `${hero.secondaryCta.label}|${hero.secondaryCta.href}` } : {}),
                }}
              />
              <p className="m-0 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{hero.label}</p>
              <p className="m-0 -mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{hero.description}</p>
              <HeroMock
                variant={hero.variant}
                kicker={hero.kicker}
                title={hero.title}
                description={hero.copy}
                image={hero.image}
                primaryCta={hero.primaryCta}
                secondaryCta={hero.secondaryCta}
              />
            </div>
          ))}
          <div className="grid gap-3">
            <ShortcodeLabel
              name="hero"
              attrs={{
                variant: "fullbleed",
                fullwidth: true,
                height: "70vh",
                pill: "Limited drop",
                h1: "Break out of the column entirely",
                p: "Pass fullwidth=\"true\" to ignore the theme's usual max-w-7xl column and stretch edge-to-edge, and height to lock in an exact viewport-relative size — built for a single standalone cinematic hero, not a hero nested in a grid/card.",
                bgimg: "hero-fullwidth-demo",
              }}
            />
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Full browser width + custom height (opt-in)
            </p>
            <p className="m-0 -mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              New <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">fullwidth</code> and{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">height</code> attributes, only
              meant for a hero used as its own top-of-page section (like the home page's hero) — not one nested
              inside a card or multi-column layout, where breaking out to 100vw would overlap sibling content.
            </p>
            <HeroMock
              variant="fullbleed"
              fullWidth
              height="70vh"
              kicker="Limited drop"
              title="Break out of the column entirely"
              description="Pass fullwidth to ignore the theme's usual max-w-7xl column and stretch edge-to-edge, and height to lock in an exact viewport-relative size."
              image="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1920&q=80"
              primaryCta={{ label: "Shop the drop", href: "/shop" }}
              secondaryCta={{ label: "View lookbook", href: "/blog" }}
            />
          </div>
        </div>
      </LibrarySection>

      <LibrarySection
        id="home-sliders"
        icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Home · Campaign and content"
        title="Sliders"
        description="Paginated, dot/arrow-navigable rails — advance one page at a time, loop at the ends, and support autoplay."
      >
        <div className="grid gap-3">
          <ShortcodeLabel
            name="slider"
            attrs={{
              type: "cinematic",
              slides: 1,
              layout: "3/3",
              navigation: "dots",
              autoplay: 6000,
              loop: true,
              bgimgs: HERO_SLIDES.map((slide) => slide.id),
              h1: HERO_SLIDES.map((slide) => slide.title),
              p: HERO_SLIDES.map((slide) => slide.subtitle),
              pill: HERO_SLIDES.map((slide) => slide.label),
            }}
          />
          <SliderMock
            title="Cinematic full-screen slider (3/3)"
            subtitle="Background imagery with overlay copy for hero-style landing blocks. Dots only — no arrow buttons."
            width="full"
            items={HERO_SLIDES}
            pageSize={1}
            gridClassName="grid-cols-1"
            autoplayMs={6000}
            navigation="dots"
            getImageUrls={(item) => [item.image]}
            renderItem={(item, _index, meta) => (
              <article key={item.id} className="group relative flex h-full min-h-[20rem] items-end overflow-hidden rounded-2xl text-left shadow-soft sm:min-h-[24rem]">
                <ResponsiveImage
                  src={item.image}
                  alt=""
                  priority={meta.isPriority}
                  sizes="100vw"
                  draggable={false}
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/0" aria-hidden="true" />
                <div className="relative grid gap-2 p-6 sm:p-10">
                  <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-white backdrop-blur">
                    {item.label}
                  </span>
                  <h3 className="m-0 max-w-xl font-display text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">{item.title}</h3>
                  <p className="m-0 max-w-lg text-sm text-white/80 sm:text-base">{item.subtitle}</p>
                </div>
              </article>
            )}
          />
        </div>

        <div className="grid gap-3">
          <ShortcodeLabel
            name="slider"
            attrs={{
              type: "cinematic",
              slides: 1,
              layout: "3/3",
              navigation: "dots",
              autoplay: 6000,
              loop: true,
              fullwidth: true,
              height: "80vh",
              bgimgs: HERO_SLIDES.map((slide) => slide.id),
              h1: HERO_SLIDES.map((slide) => slide.title),
              p: HERO_SLIDES.map((slide) => slide.subtitle),
              pill: HERO_SLIDES.map((slide) => slide.label),
            }}
          />
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Full browser width + custom height (opt-in)
          </p>
          <p className="m-0 -mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Same cinematic slider, with <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">fullwidth</code> and{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">height</code> attributes added — breaks out to
            100vw and locks in a viewport-relative height, for a single standalone cinematic hero slider (like this one), not one
            nested in a card or multi-column grid.
          </p>
          <SliderMock
            title="Cinematic full-screen slider — full browser width"
            subtitle="Same rail, opted into edge-to-edge width and an 80vh custom height via fullBleed/height props."
            width="full"
            items={HERO_SLIDES}
            pageSize={1}
            gridClassName="grid-cols-1"
            autoplayMs={6000}
            navigation="dots"
            fullBleed
            height="80vh"
            getImageUrls={(item) => [item.image]}
            renderItem={(item, _index, meta) => (
              <article
                key={item.id}
                className={`group relative flex items-end overflow-hidden text-left shadow-soft ${
                  meta.hasCustomHeight ? "h-full" : "h-full min-h-[20rem] rounded-2xl sm:min-h-[24rem]"
                }`}
              >
                <ResponsiveImage
                  src={item.image}
                  alt=""
                  priority={meta.isPriority}
                  sizes="100vw"
                  draggable={false}
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/0" aria-hidden="true" />
                <div className="relative mx-auto grid w-full gap-2 px-6 py-10 sm:px-12" style={{ maxWidth: `${themeMaxWidthPx}px` }}>
                  <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-white backdrop-blur">
                    {item.label}
                  </span>
                  <h3 className="m-0 max-w-xl font-display text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">{item.title}</h3>
                  <p className="m-0 max-w-lg text-sm text-white/80 sm:text-base">{item.subtitle}</p>
                </div>
              </article>
            )}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="grid gap-3 lg:col-span-2">
            <ShortcodeLabel
              name="slider"
              attrs={{ type: "product-rail", slides: 3, layout: "2/3", navigation: "both", autoplay: 5000, loop: true }}
            />
            <SliderMock
              title="Product card slider (2/3)"
              subtitle="Scrollable product-card shortcode, 3 items per view. Both arrows and dots enabled."
              width="two-thirds"
              items={liveProducts.slice(0, 6)}
              pageSize={3}
              gridClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
              autoplayMs={5000}
              navigation="both"
              getImageUrls={(product) => [product.imageUrl, ...(product.gallery ?? [])]}
              renderItem={(product, index, meta) => (
                <ProductCard key={`${product.id}-${index}`} product={product} variant="default" imageLoading={meta.isPriority ? "eager" : "lazy"} />
              )}
            />
          </div>

          <div className="grid gap-3">
            <ShortcodeLabel name="slider" attrs={{ type: "editorial-rail", slides: 1, layout: "1/3", navigation: "arrows", autoplay: 0, loop: true }} />
            <SliderMock
              title="Editorial rail (1/3)"
              subtitle="Narrow column slot — arrows only, no dots, manual advance."
              width="one-third"
              items={livePosts.slice(0, 3)}
              pageSize={1}
              gridClassName="grid-cols-1"
              navigation="arrows"
              renderItem={(post) => <PostCard key={post.id} post={post} variant="minimal" />}
            />
          </div>
        </div>
      </LibrarySection>

      <LibrarySection
        id="shop-carousels"
        icon={<MonitorSmartphone className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Shop · Carousels"
        title="Carousels & scrollable rails"
        description="Continuous auto-advancing carousels and pure drag/swipe scroll rails with no visible pagination chrome."
      >
        <div className="grid gap-3">
          <ShortcodeLabel name="carousel" attrs={{ type: "testimonial", slides: 3, layout: "3/3", navigation: "none", autoplay: 3200, loop: true }} />
          <SliderMock
            title="Testimonial carousel"
            subtitle="Continuous auto-advancing loop, no visible navigation chrome at all — pure ambient motion."
            width="full"
            items={featuredReviews}
            pageSize={3}
            gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            autoplayMs={3200}
            navigation="none"
            renderItem={(item) => <TestimonialCard key={item.id} quote={item.content} author={item.author} />}
          />
        </div>

        <div className="grid gap-3">
          <ShortcodeLabel name="carousel" attrs={{ type: "scrollable", slides: 5, layout: "full", navigation: "none", autoplay: 0, loop: false }} />
          <SliderMock
            title="Scrollable product rail"
            subtitle="Drag/swipe-only — no autoplay, no dots, no arrows. Pure momentum scrolling for dense browse rows."
            width="full"
            items={liveProducts.slice(0, 10)}
            pageSize={5}
            gridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            navigation="none"
            renderItem={(product, index, meta) => (
              <ProductCard key={`scroll-${product.id}-${index}`} product={product} variant="minimal" imageLoading={meta.isPriority ? "eager" : "lazy"} />
            )}
          />
        </div>
      </LibrarySection>

      <LibrarySection
        id="shop-grids"
        icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Shop · Product and category grids"
        title="Grids"
        description="Static, non-paginated tile grids — image-with-text-overlay category tiles and standard product grids at 2/3/4 columns."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Category view"
              value={categoryLayout}
              onChange={setCategoryLayout}
              options={[
                { value: "minimal", label: "Minimal" },
                { value: "editorial", label: "Editorial" },
                { value: "graphical", label: "Graphical" },
              ]}
            />
            <div role="group" aria-label="Grid columns" className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
              {COLUMN_COUNT_OPTIONS.map((columns) => (
                <button
                  key={columns}
                  type="button"
                  onClick={() => setGridColumns(columns)}
                  aria-pressed={gridColumns === columns}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    gridColumns === columns
                      ? "bg-brand-gradient text-white shadow-glow"
                      : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {columns} col
                </button>
              ))}
            </div>
            <ShortcodeLabel name="categories" attrs={{ type: "product", layout: categoryLayout, columns: gridColumns, items: categoryTiles.map((category) => category.slug) }} />
          </div>
          <AcceptedValues name="layout" values={["minimal", "editorial", "graphical"]} />
          <AcceptedValues name="columns" values={["2", "3", "4"]} />
          {isCommerceLoading ? <ContentLoadingState compact label="Loading WooCommerce categories" /> : commerceError ? (
            <BlogShortcodeStatus message={commerceError.message} isError />
          ) : categoryLayout === "minimal" ? (
            <div className={`grid gap-3 ${COLUMN_COUNT_CLASS[gridColumns]}`}>
              {categoryTiles.slice(0, gridColumns).map((item) => (
                <Link key={item.id} to={`/shop/category/${item.slug}`} className="grid justify-items-center gap-2 rounded-2xl border border-zinc-200 p-4 text-center no-underline dark:border-zinc-800">
                  <ResponsiveImage src={item.image} alt="" sizes="4rem" className="h-16 w-16 rounded-full object-cover" />
                  <strong className="text-sm text-zinc-900 dark:text-zinc-100">{item.title}</strong>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.count}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={`grid gap-5 ${COLUMN_COUNT_CLASS[gridColumns]}`}>
              {categoryTiles.slice(0, gridColumns).map((item) => (
                <CategoryTile key={item.id} item={item} variant={categoryLayout} />
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <ShortcodeLabel name="grid" attrs={{ type: "product", columns: 3, items: liveProducts.slice(0, 6).map((product) => product.id) }} />
          {isCommerceLoading ? <ContentLoadingState compact label="Loading WooCommerce products" /> : commerceError ? (
            <BlogShortcodeStatus message={commerceError.message} isError />
          ) : <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {liveProducts.slice(0, 6).map((product) => (
              <div key={product.id} onMouseEnter={() => playAction("hover")}>
                <ProductCard product={product} variant="default" imageLoading="lazy" />
              </div>
            ))}
          </div>}
        </div>

        <div className="grid gap-3">
          <ShortcodeLabel name="grid" attrs={{ type: "post", columns: 3, items: livePosts.length }} />
          {isBlogLoading ? (
            <ContentLoadingState compact label="Loading WordPress posts" />
          ) : blogError ? (
            <BlogShortcodeStatus message={blogError.message} isError />
          ) : livePosts.length ? (
            <PaginablePostGrid
              title="WordPress post grid"
              subtitle="The shared blog shortcode feed, rendered in three columns."
              posts={livePosts}
              pageSize={6}
              cardVariant="default"
              gridVariant="standard"
            />
          ) : (
            <BlogShortcodeStatus message="No published posts are available for this language." />
          )}
        </div>

      </LibrarySection>

      <LibrarySection
        id="blog-columns"
        icon={<Rows3 className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Blog · Columns and taxonomies"
        title="Columns"
        description="Static content composition blocks for landing pages — split the row into fixed fractional columns, no slider behavior."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Columns layout"
              value={columnLayout}
              onChange={setColumnLayout}
              options={[
                { value: "1/2+1/2", label: "1/2 + 1/2" },
                { value: "1/3+2/3", label: "1/3 + 2/3" },
                { value: "2/3+1/3", label: "2/3 + 1/3" },
                { value: "1/3+1/3+1/3", label: "Thirds" },
                { value: "1/4×4", label: "Quarters" },
              ]}
            />
            <ShortcodeLabel name="columns" attrs={{ layout: columnLayout, type: "post", gap: 5, items: livePosts.slice(0, 4).map((post) => post.id) }} />
          </div>
          <AcceptedValues name="layout" values={["1/2+1/2", "1/3+2/3", "2/3+1/3", "1/3+1/3+1/3", "1/4×4"]} />
          <ColumnLayoutPreview layout={columnLayout} posts={livePosts.slice(0, 4)} />
        </div>

        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Archive collection view"
              value={archiveCollectionLayout}
              onChange={setArchiveCollectionLayout}
              options={[
                { value: "pills", label: "Pills" },
                { value: "compact", label: "Compact" },
              ]}
            />
            <ShortcodeLabel name="categories" attrs={{ type: "post", layout: archiveCollectionLayout, items: (blog?.categories || []).map((term) => term.slug) }} />
            <ShortcodeLabel name="tags" attrs={{ type: "post", layout: archiveCollectionLayout, items: (blog?.tags || []).map((term) => term.slug) }} />
            <ShortcodeLabel name="authors" attrs={{ layout: archiveCollectionLayout, items: (blog?.authors || []).map((author) => author.slug) }} />
          </div>
          <AcceptedValues name="layout" values={["pills", "compact"]} />
          <div className={archiveCollectionLayout === "compact" ? "grid gap-4 lg:grid-cols-3" : "grid gap-5"}>
            <TaxonomyColumn title="WordPress categories" terms={(blog?.categories || []).slice(0, 10)} />
            <TaxonomyColumn title="WordPress tags" terms={(blog?.tags || []).slice(0, 10)} tags />
            <div className="grid content-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/60">
              <h3 className="m-0 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">WordPress authors</h3>
              {(blog?.authors || []).slice(0, 8).map((author) => (
                <Link key={author.id} to={author.uri || `/author/${author.slug}`} className="flex items-center justify-between gap-3 text-sm font-semibold text-zinc-700 no-underline dark:text-zinc-300">
                  <span>{author.name}</span><span className="text-xs font-normal text-zinc-400">{author.postCount} posts</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </LibrarySection>

      <LibrarySection
        id="shop-product-cards"
        icon={<Store className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Shop · Product cards"
        title="Product card variants"
        description="Every accepted `card_variant` for product grids, sliders, carousels, related products, and marketplace listings."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Product card variant"
              value={productCardVariant}
              onChange={setProductCardVariant}
              options={[
                { value: "default", label: "Default" },
                { value: "minimal", label: "Minimal" },
                { value: "editorial", label: "Editorial" },
                { value: "gallery", label: "Gallery" },
                { value: "simple", label: "Simple" },
                { value: "variation", label: "Variation" },
                { value: "expandable", label: "Expandable" },
              ]}
            />
            <ShortcodeLabel name="product-card" attrs={{ product: featuredProduct?.id ?? "unavailable", variant: productCardVariant }} />
          </div>
          <AcceptedValues name="variant" values={["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"]} />
          {featuredProduct ? (
            <div className="grid max-w-sm"><ProductCard product={featuredProduct} variant={productCardVariant} /></div>
          ) : <BlogShortcodeStatus message="No WooCommerce product is available." />}
        </div>
      </LibrarySection>

      <LibrarySection
        id="blog-posts"
        icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Blog · Post cards"
        title="Posts"
        description="A single blog/journal post card, rendered across every card style the theme supports — pick a variant to preview it, then drop the shortcode into a `[grid]`/`[slider]` of posts."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Card variant"
              value={postCardVariant}
              onChange={setPostCardVariant}
              options={[
                { value: "default", label: "Default" },
                { value: "compact", label: "Compact" },
                { value: "editorial", label: "Editorial" },
                { value: "minimal", label: "Minimal" },
              ]}
            />
            <ShortcodeLabel name="post-card" attrs={{ post: featuredPost?.slug ?? "unavailable", variant: postCardVariant }} />
          </div>
          <div className="grid max-w-sm gap-5">
            {featuredPost ? <PostCard post={featuredPost} variant={postCardVariant} /> : <BlogShortcodeStatus message="No WordPress post available." />}
          </div>
          <AcceptedValues name="variant" values={["default", "compact", "editorial", "minimal"]} />
        </div>
      </LibrarySection>

      <LibrarySection
        id="shop-reviews"
        icon={<Star className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Shop · Reviews"
        title="Reviews"
        description="Product reviews are standard WordPress comments with an extra rating meta field — `[reviews]` renders the same thread component as `[comments]`, just with a rating histogram and average passed in. `full` is the threaded discussion with a submission form; `compact` is a read-only teaser (summary + first few reviews, no form) for embedding in a sidebar or dashboard widget."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Variant"
              value={reviewsVariant}
              onChange={setReviewsVariant}
              options={[
                { value: "full", label: "Full thread" },
                { value: "compact", label: "Compact teaser" },
              ]}
            />
            <ShortcodeLabel name="reviews" attrs={{ product: featuredProduct?.slug ?? "latest", variant: reviewsVariant }} />
          </div>
          <AcceptedValues name="variant" values={["full", "compact"]} />
          {isCommerceLoading ? <ContentLoadingState compact label="Loading WooCommerce reviews" /> : commerceError ? (
            <BlogShortcodeStatus message={commerceError.message} isError />
          ) : featuredProduct && featuredReviews.length ? (
            <CommentsSection
              anchorId="shortcode-reviews"
              heading="Reviews"
              initialReviews={featuredReviews}
              averageRating={averageRating}
              totalCountOverride={featuredReviews.length}
              formTitle="Leave a review"
              variant={reviewsVariant}
            />
          ) : <BlogShortcodeStatus message="No approved WooCommerce reviews are available." />}
        </div>
      </LibrarySection>

      <LibrarySection
        id="blog-comments"
        icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Blog · Comments"
        title="Comments"
        description="The same threaded-discussion component as `[reviews]`, minus the rating histogram/average — used on blog posts and community-post detail pages. `full` shows nested replies and the submission form; `compact` shows a read-only teaser."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Variant"
              value={commentsVariant}
              onChange={setCommentsVariant}
              options={[
                { value: "full", label: "Full thread" },
                { value: "compact", label: "Compact teaser" },
              ]}
            />
            <ShortcodeLabel name="comments" attrs={{ post: featuredPost?.slug ?? "unavailable", variant: commentsVariant }} />
          </div>
          <AcceptedValues name="variant" values={["full", "compact"]} />
          {featuredPost ? (
            <CommentsSection
              anchorId="shortcode-comments"
              heading="Comments"
              initialReviews={blog?.comments || []}
              formTitle="Join the discussion"
              variant={commentsVariant}
              showRatingField={false}
            />
          ) : null}
        </div>
      </LibrarySection>

      <LibrarySection
        id="community-hero"
        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Community · Hero"
        title="Community hero"
        description="The Community landing banner has three image treatments: a brand gradient, a split image panel, and a full image background."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Layout"
              value={communityHeroLayout}
              onChange={setCommunityHeroLayout}
              options={[
                { value: "gradient", label: "Gradient" },
                { value: "split", label: "Image split" },
                { value: "image-bg", label: "Image background" },
              ]}
            />
            <ShortcodeLabel name="hero" attrs={{ type: "community", layout: communityHeroLayout }} />
          </div>
          <AcceptedValues name="layout" values={["gradient", "split", "image-bg"]} />
          <div
            className={
              communityHeroLayout === "split"
                ? "grid min-h-64 overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-2"
                : communityHeroLayout === "image-bg"
                  ? "relative grid min-h-64 content-end overflow-hidden rounded-3xl bg-[url('https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center p-8 text-white"
                  : "grid min-h-64 content-center rounded-3xl bg-gradient-to-br from-brand-100 to-white p-8 dark:from-brand-950 dark:to-zinc-950"
            }
          >
            <div className={communityHeroLayout === "split" ? "grid content-center gap-3 p-8" : "relative z-10 grid gap-3"}>
              <span className="text-xs font-semibold uppercase tracking-wide">Community</span>
              <h3 className="m-0 font-display text-3xl font-bold">See how the community styles it</h3>
              <p className="m-0 max-w-xl text-sm opacity-80">Real posts, reviews, and marketplace finds from public member profiles.</p>
            </div>
            {communityHeroLayout === "split" ? (
              <ResponsiveImage src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=80" alt="" sizes="(min-width: 1024px) 50vw, 100vw" className="h-full min-h-64 w-full object-cover" />
            ) : null}
            {communityHeroLayout === "image-bg" ? <span className="absolute inset-0 bg-black/55" aria-hidden="true" /> : null}
          </div>
        </div>
      </LibrarySection>

      <LibrarySection
        id="community-feed"
        icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Community · Feed"
        title="Community feed"
        description="The complete feed and each `[social-post]` card accept the same five responsive layouts."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Layout"
              value={socialPostLayout}
              onChange={setSocialPostLayout}
              options={[
                { value: "masonry", label: "Masonry" },
                { value: "grid-3", label: "Grid (3)" },
                { value: "grid-4", label: "Grid (4)" },
                { value: "list", label: "List" },
                { value: "compact", label: "Compact" },
              ]}
            />
            <ViewSwitch label="Loading" value={communityFeedLoadMode} onChange={setCommunityFeedLoadMode} options={[{ value: "manual", label: "Load more" }, { value: "infinite", label: "Infinite" }]} />
            <ViewSwitch label="Page size" value={communityFeedPageSize} onChange={setCommunityFeedPageSize} options={[{ value: "6", label: "6" }, { value: "12", label: "12" }, { value: "24", label: "24" }]} />
            <ViewSwitch label="Tag filters" value={communityFeedFilters} onChange={setCommunityFeedFilters} options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide" }]} />
            <ShortcodeLabel name="community-feed" attrs={{ layout: socialPostLayout, load_mode: communityFeedLoadMode, page_size: Number(communityFeedPageSize), show_filters: communityFeedFilters === "show" }} />
          </div>
          <AcceptedValues name="layout" values={["masonry", "grid-3", "grid-4", "list", "compact"]} />
          <AcceptedValues name="load_mode" values={["manual", "infinite"]} />
          <AcceptedValues name="page_size" values={["1–48"]} />
          <AcceptedValues name="show_filters" values={["true", "false"]} />
          <div
            className={
              socialPostLayout === "masonry"
                ? "columns-2 gap-4 lg:columns-3"
                : socialPostLayout === "list"
                  ? "mx-auto grid w-full max-w-2xl gap-4"
                  : socialPostLayout === "compact"
                    ? "grid grid-cols-3 gap-2 sm:grid-cols-4"
                    : socialPostLayout === "grid-4"
                      ? "grid grid-cols-2 gap-4 lg:grid-cols-4"
                      : "grid grid-cols-2 gap-4 lg:grid-cols-3"
            }
          >
            {(community?.posts || []).slice(0, 8).map((post) => (
              <div key={`${socialPostLayout}-${post.id}`} className={socialPostLayout === "masonry" ? "mb-4 break-inside-avoid" : ""}>
                <SocialPostCard post={post} layout={socialPostLayout} />
              </div>
            ))}
          </div>
        </div>
      </LibrarySection>

      <LibrarySection
        id="community-profiles"
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Community · Profiles"
        title="Community profiles"
        description={
          'A directory tile for a community member — links out to their public profile/feed. `grid` shows compact avatar-first tiles (good for a "members to follow" strip); `list` shows a denser single-column row with bio and stats (good for a full member directory page).'
        }
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Layout"
              value={memberLayout}
              onChange={setMemberLayout}
              options={[
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
              ]}
            />
            <ShortcodeLabel name="community-members" attrs={{ layout: memberLayout, items: featuredMembers.length }} />
          </div>
          <AcceptedValues name="layout" values={["grid", "list"]} />
          {isCommunityLoading ? <ContentLoadingState compact label="Loading community members" /> : communityError ? (
            <BlogShortcodeStatus message={communityError.message} isError />
          ) : memberLayout === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {featuredMembers.map((member) => (
                <Link
                  key={member.handle}
                  to={`/community/${member.handle}`}
                  className="grid justify-items-center gap-2 rounded-2xl border border-zinc-200/80 p-4 text-center no-underline transition hover:-translate-y-0.5 hover:shadow-soft dark:border-zinc-800"
                >
                  <MemberAvatar name={member.displayName} avatarUrl={member.avatarUrl} size="h-12 w-12" />
                  <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{member.displayName}</span>
                  <span className="text-[0.68rem] capitalize text-zinc-400 dark:text-zinc-500">{member.role}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid gap-2 divide-y divide-zinc-200/80 dark:divide-zinc-800">
              {featuredMembers.map((member) => (
                <Link
                  key={member.handle}
                  to={`/community/${member.handle}`}
                  className="flex items-center gap-3 py-3 no-underline transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <MemberAvatar name={member.displayName} avatarUrl={member.avatarUrl} size="h-10 w-10" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{member.displayName}</span>
                    <span className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{member.bio}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-xs capitalize text-zinc-400 dark:text-zinc-500">{member.role}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </LibrarySection>

      <LibrarySection
        id="community-marketplace"
        icon={<Store className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Community · Marketplace"
        title="Marketplace"
        description="Products listed by community creator members under their own profile — the exact same `ProductCard` used everywhere else in the shop, with a vendor byline appended so shoppers can tell it's a member listing and click through to the seller's profile. `[marketplace-product]` renders one listing; `[marketplace-grid]` flattens every creator's listings into one browsable grid, same column control as `[grid]` above."
      >
        <div className="grid gap-3">
          <ShortcodeLabel
            name="marketplace-product"
            attrs={{ product: featuredMarketplaceEntry?.product.id ?? "unavailable", vendor: featuredMarketplaceEntry?.vendor.handle ?? "unavailable" }}
          />
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Single listing, with vendor byline</p>
          {featuredMarketplaceEntry ? (
            <div className="grid max-w-sm gap-2">
              <ProductCard product={featuredMarketplaceEntry.product} variant="default" />
              <Link
                to={`/community/${featuredMarketplaceEntry.vendor.handle}?tab=shop`}
                className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-zinc-500 no-underline transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
              >
                by @{featuredMarketplaceEntry.vendor.handle}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div role="group" aria-label="Grid columns" className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
              {COLUMN_COUNT_OPTIONS.map((columns) => (
                <button
                  key={columns}
                  type="button"
                  aria-pressed={gridColumns === columns}
                  onClick={() => setGridColumns(columns)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    gridColumns === columns
                      ? "bg-brand-gradient text-white shadow-glow"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {columns}
                </button>
              ))}
            </div>
            <ShortcodeLabel name="marketplace-grid" attrs={{ columns: gridColumns, items: marketplaceEntries.length }} />
          </div>
          <AcceptedValues name="columns" values={["2", "3", "4"]} />
          <p className="m-0 -mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Every creator's listings, flattened into one grid
          </p>
          <div className={`grid gap-5 ${COLUMN_COUNT_CLASS[gridColumns]}`}>
            {marketplaceEntries.slice(0, gridColumns * 2).map(({ product, vendor }) => (
              <div key={product.id} className="grid gap-2">
                <ProductCard product={product} variant="default" />
                <Link
                  to={`/community/${vendor.handle}?tab=shop`}
                  className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-zinc-500 no-underline transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
                >
                  by @{vendor.handle}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </LibrarySection>

      <LibrarySection
        id="community-posts"
        icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Community · Posts"
        title="Community posts"
        description="The two customer-authored content types from the community's 'edge social' features: a shared photo update (`[social-post]`, the same card the community feed/profile/post-detail pages use, in every feed layout) and a creator-written article (`[creator-article]`, the same `[post-card]` from Group 5 above, just sourced from a member's profile instead of the staff blog — its link routes to `/community/:handle/articles/:slug` instead of `/blog/:slug`)."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Feed layout"
              value={socialPostLayout}
              onChange={setSocialPostLayout}
              options={[
                { value: "masonry", label: "Masonry" },
                { value: "grid-3", label: "Grid (3)" },
                { value: "grid-4", label: "Grid (4)" },
                { value: "list", label: "List" },
                { value: "compact", label: "Compact" },
              ]}
            />
            <ShortcodeLabel name="social-post" attrs={{ post: featuredSocialPost?.id ?? "unavailable", layout: socialPostLayout }} />
          </div>
          <AcceptedValues name="layout" values={["masonry", "grid-3", "grid-4", "list", "compact"]} />
          {isCommunityLoading ? <ContentLoadingState compact label="Loading community posts" /> : communityError ? (
            <BlogShortcodeStatus message={communityError.message} isError />
          ) : featuredSocialPost ? (
            <div className="grid max-w-sm gap-5">
              <SocialPostCard post={featuredSocialPost} layout={socialPostLayout} />
            </div>
          ) : <BlogShortcodeStatus message="No published community posts are available." />}
        </div>

        <div className="grid gap-3">
          <ShortcodeLabel name="creator-article" attrs={{ source: "community-post", variant: postCardVariant }} />
          <p className="m-0 -mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Same `[post-card]` renderer as Group 5, sourced from a creator's own profile
          </p>
          {communityArticles.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {communityArticles.slice(0, 6).map((post) => <PostCard key={post.id} post={post} variant={postCardVariant} />)}
            </div>
          ) : (
            <BlogShortcodeStatus message="No matching creator articles are published. This view derives live WordPress posts whose authors match collaborator profiles and never substitutes local fixtures." />
          )}
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-backend-shortcodes"
        icon={<MonitorSmartphone className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer backend execution"
        title="Dedicated customer-page shortcodes"
        description="These are the validated live component contracts used on Cart, Checkout, Wishlist, Reading List, Account, Auth, Order Success, and Unsubscribe Pages. The dedicated storefront routes are now intentionally empty shortcode shells: author the page layout in WordPress, place the matching component shortcode where you want the live module to mount, and wrap it with any Gutenberg blocks before or after it."
      >
        <div className="grid gap-8">
          <ShortcodeContract
            name="funkycommerce_cart"
            example={{ layout: "classic", summary_position: "sticky" }}
            values={[
              ["layout", ["classic", "editorial"]],
              ["summary_position", ["sticky", "static"]],
            ]}
          />
          <ShortcodeContract
            name="funkycommerce_checkout"
            example={{
              mode: "physical",
              coupon_position: "inline",
              payment_position: "left",
              summary_position: "sticky",
              hide_optional_billing_fields: false,
              hide_optional_shipping_fields: false,
              show_order_notes: true,
              show_terms: true,
              show_privacy: true,
              allow_guest_checkout: true,
            }}
            values={[
              ["mode", ["physical", "digital"]],
              ["coupon_position", ["inline", "top"]],
              ["payment_position", ["left", "right"]],
              ["summary_position", ["sticky", "static"]],
              ["hide_optional_billing_fields / hide_optional_shipping_fields", ["true", "false"]],
              ["show_order_notes / show_terms / show_privacy", ["true", "false"]],
              ["allow_guest_checkout", ["true", "false"]],
            ]}
          />
          <ShortcodeContract
            name="funkycommerce_wishlist"
            example={{ card_variant: "default" }}
            values={[["card_variant", ["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"]]]}
          />
          <ShortcodeContract
            name="funkycommerce_reading_list"
            example={{ layout: "cards" }}
            values={[["layout", ["cards", "editorial-2col"]]]}
          />
          <ShortcodeContract
            name="funkycommerce_account"
            example={{ default_tab: "dashboard", tabs: "dashboard,orders,addresses,community" }}
            values={[
              ["default_tab", ["dashboard", "orders", "addresses", "community"]],
              ["tabs", ["comma-separated dashboard,orders,addresses,community"]],
            ]}
          />
          <ShortcodeContract
            name="funkycommerce_auth"
            example={{ mode: "login", layout: "split" }}
            values={[
              ["mode", ["login", "register", "forgot-password"]],
              ["layout", ["split", "centered", "image-bg"]],
            ]}
          />
          <ShortcodeContract
            name="order-success"
            example={{ mode: "physical", show_native_link: true, show_support_link: true }}
            values={[
              ["mode", ["physical", "digital"]],
              ["show_native_link / show_support_link", ["true", "false"]],
            ]}
          />
          <ShortcodeContract
            name="unsubscribe-form"
            example={{ title: "We’re sorry to see you go.", description: "Confirm your email address and tell us why you’re unsubscribing." }}
            values={[
              ["title", ["text"]],
              ["description", ["text"]],
            ]}
          />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-cart"
        icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Cart"
        title="Cart"
        description="Place `[funkycommerce_cart]` inside the WordPress Cart page wherever the live cart module should appear. The module preserves the classic line-item view and the editorial product-tile view, including optional sticky summary behavior in the classic layout."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch label="Layout" value={cartLayout} onChange={setCartLayout} options={[{ value: "classic", label: "Classic rows" }, { value: "editorial", label: "Editorial" }]} />
            <ViewSwitch label="Summary" value={cartSummaryPosition} onChange={setCartSummaryPosition} options={[{ value: "sticky", label: "Sticky" }, { value: "static", label: "Static" }]} />
            <ShortcodeLabel name="funkycommerce_cart" attrs={{ layout: cartLayout, summary_position: cartSummaryPosition }} />
          </div>
          <ShortcodeSnippet name="funkycommerce_cart" attrs={{ layout: cartLayout, summary_position: cartSummaryPosition }} />
          <AcceptedValues name="layout" values={["classic", "editorial"]} />
          <AcceptedValues name="summary_position" values={["sticky", "static"]} />
          <CartShortcodePreview layout={cartLayout} summaryPosition={cartSummaryPosition} products={liveProducts.slice(0, 3)} />
          <FullPageLink href="/cart" label="Open the shortcode-driven cart page" />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-checkout"
        icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Checkout"
        title="Checkout"
        description="Place `[funkycommerce_checkout]` in the WordPress Checkout page to mount the live checkout exactly where your Gutenberg layout needs it. Checkout exposes every positional and visibility control from the original component, including physical/digital store mode and whether the live Woo checkout remains open to guests."
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch label="Store mode" value={checkoutStoreMode} onChange={setCheckoutStoreMode} options={[{ value: "physical", label: "Physical" }, { value: "digital", label: "Digital only" }]} />
            <ViewSwitch label="Coupon" value={checkoutCouponPosition} onChange={setCheckoutCouponPosition} options={[{ value: "inline", label: "Inline" }, { value: "top", label: "At top" }]} />
            <ViewSwitch label="Payments" value={checkoutPaymentPosition} onChange={setCheckoutPaymentPosition} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
            <ViewSwitch label="Summary" value={checkoutSummaryPosition} onChange={setCheckoutSummaryPosition} options={[{ value: "sticky", label: "Sticky" }, { value: "static", label: "Static" }]} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch label="Guests" value={checkoutGuestCheckout} onChange={setCheckoutGuestCheckout} options={[{ value: "allow", label: "Allowed" }, { value: "require-account", label: "Account required" }]} />
            <ViewSwitch label="Optional fields" value={checkoutOptionalFields} onChange={setCheckoutOptionalFields} options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide" }]} />
            <ViewSwitch label="Order notes" value={checkoutOrderNotes} onChange={setCheckoutOrderNotes} options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide" }]} />
            <ViewSwitch label="Terms" value={checkoutTerms} onChange={setCheckoutTerms} options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide" }]} />
            <ViewSwitch label="Privacy" value={checkoutPrivacy} onChange={setCheckoutPrivacy} options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide" }]} />
          </div>
          <ShortcodeLabel name="funkycommerce_checkout" attrs={{
            mode: checkoutStoreMode,
            coupon_position: checkoutCouponPosition,
            payment_position: checkoutPaymentPosition,
            summary_position: checkoutSummaryPosition,
            hide_optional_billing_fields: checkoutOptionalFields === "hide",
            hide_optional_shipping_fields: checkoutOptionalFields === "hide",
            show_order_notes: checkoutOrderNotes === "show",
            show_terms: checkoutTerms === "show",
            show_privacy: checkoutPrivacy === "show",
            allow_guest_checkout: checkoutGuestCheckout === "allow",
          }} />
          <ShortcodeSnippet
            name="funkycommerce_checkout"
            attrs={{
              mode: checkoutStoreMode,
              coupon_position: checkoutCouponPosition,
              payment_position: checkoutPaymentPosition,
              summary_position: checkoutSummaryPosition,
              hide_optional_billing_fields: checkoutOptionalFields === "hide",
              hide_optional_shipping_fields: checkoutOptionalFields === "hide",
              show_order_notes: checkoutOrderNotes === "show",
              show_terms: checkoutTerms === "show",
              show_privacy: checkoutPrivacy === "show",
              allow_guest_checkout: checkoutGuestCheckout === "allow",
            }}
          />
          <AcceptedValues name="mode" values={["physical", "digital"]} />
          <AcceptedValues name="coupon_position" values={["inline", "top"]} />
          <AcceptedValues name="payment_position" values={["left", "right"]} />
          <AcceptedValues name="summary_position" values={["sticky", "static"]} />
          <AcceptedValues name="allow_guest_checkout" values={["true", "false"]} />
          <AcceptedValues name="visibility controls" values={["true", "false"]} />
          <CheckoutShortcodePreview
            storeMode={checkoutStoreMode}
            couponPosition={checkoutCouponPosition}
            paymentPosition={checkoutPaymentPosition}
            summaryPosition={checkoutSummaryPosition}
            showOptionalFields={checkoutOptionalFields === "show"}
            showOrderNotes={checkoutOrderNotes === "show"}
            showTerms={checkoutTerms === "show"}
            showPrivacy={checkoutPrivacy === "show"}
          />
          <FullPageLink href="/checkout" label="Open the shortcode-driven checkout page" />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-wishlist"
        icon={<Heart className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Wishlist"
        title="Wishlist"
        description="Place `[funkycommerce_wishlist]` inside the WordPress Wishlist page and surround it with any editorial blocks you need. The live wishlist accepts every authoritative ProductCard variant used by the original saved-products page."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch label="Card style" value={wishlistCardVariant} onChange={setWishlistCardVariant} options={[
              { value: "default", label: "Default" }, { value: "minimal", label: "Minimal" }, { value: "editorial", label: "Editorial" },
              { value: "gallery", label: "Mini gallery" }, { value: "variation", label: "Swatches" }, { value: "simple", label: "Simple" },
              { value: "expandable", label: "Expandable" },
            ]} />
            <ShortcodeLabel name="funkycommerce_wishlist" attrs={{ card_variant: wishlistCardVariant }} />
          </div>
          <ShortcodeSnippet name="funkycommerce_wishlist" attrs={{ card_variant: wishlistCardVariant }} />
          <AcceptedValues name="card_variant" values={["default", "minimal", "editorial", "gallery", "variation", "simple", "expandable"]} />
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
            {liveProducts.slice(0, 3).map((product) => <ProductCard key={`wishlist-${product.id}`} product={product} variant={wishlistCardVariant} />)}
          </div>
          <FullPageLink href="/wishlist" label="Open the shortcode-driven wishlist page" />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-reading-list"
        icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Reading list"
        title="Reading list"
        description="Place `[funkycommerce_reading_list]` inside the WordPress Reading List page to mount the saved-article module in your chosen editorial layout. It mirrors the original card grid and dense two-column newspaper view."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch label="Layout" value={readingListLayout} onChange={setReadingListLayout} options={[{ value: "cards", label: "Post cards" }, { value: "editorial-2col", label: "Editorial (2 columns)" }]} />
            <ShortcodeLabel name="funkycommerce_reading_list" attrs={{ layout: readingListLayout }} />
          </div>
          <ShortcodeSnippet name="funkycommerce_reading_list" attrs={{ layout: readingListLayout }} />
          <AcceptedValues name="layout" values={["cards", "editorial-2col"]} />
          <ReadingListShortcodePreview layout={readingListLayout} posts={livePosts.slice(0, 4)} />
          <FullPageLink href="/reading-list" label="Open the shortcode-driven reading list page" />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-account"
        icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Account"
        title="Account"
        description="Place `[funkycommerce_account]` inside the WordPress Account page and let Gutenberg control the surrounding layout. The live account module can open directly on any of the four existing hash-addressable panels."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch label="Panel" value={accountTab} onChange={setAccountTab} options={[
              { value: "dashboard", label: "Dashboard" }, { value: "orders", label: "Orders" },
              { value: "addresses", label: "Addresses" }, { value: "community", label: "Community" },
            ]} />
            <ShortcodeLabel name="funkycommerce_account" attrs={{ default_tab: accountTab, tabs: "dashboard,orders,addresses,community" }} />
          </div>
          <ShortcodeSnippet name="funkycommerce_account" attrs={{ default_tab: accountTab, tabs: "dashboard,orders,addresses,community" }} />
          <AcceptedValues name="default_tab" values={["dashboard", "orders", "addresses", "community"]} />
          <AcceptedValues name="tabs" values={["comma-separated dashboard, orders, addresses, community"]} />
          <AccountShortcodePreview tab={accountTab} />
          <FullPageLink href={`/account#${accountTab}`} label={`Open the shortcode-driven ${accountTab} account panel`} />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-auth"
        icon={<LogIn className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Authentication"
        title="Authentication"
        description="Place `[funkycommerce_auth]` inside the WordPress Auth page, or reuse it on landing pages wherever login, registration, or recovery should appear. Auth combines three form modes with all three shells from the original authentication page."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch label="Mode" value={authMode} onChange={setAuthMode} options={[
              { value: "login", label: "Login" }, { value: "register", label: "Register" }, { value: "forgot-password", label: "Forgot password" },
            ]} />
            <ViewSwitch label="Layout" value={authLayout} onChange={setAuthLayout} options={[
              { value: "split", label: "Split screen" }, { value: "centered", label: "Centered card" }, { value: "image-bg", label: "Image background" },
            ]} />
            <ShortcodeLabel name="funkycommerce_auth" attrs={{ mode: authMode, layout: authLayout }} />
          </div>
          <ShortcodeSnippet name="funkycommerce_auth" attrs={{ mode: authMode, layout: authLayout }} />
          <AcceptedValues name="mode" values={["login", "register", "forgot-password"]} />
          <AcceptedValues name="layout" values={["split", "centered", "image-bg"]} />
          <AuthShortcodePreview mode={authMode} layout={authLayout} />
          <FullPageLink href={authMode === "login" ? "/auth" : authMode === "register" ? "/auth/register" : "/auth/forgot-password"} label={`Open the shortcode-driven ${authMode} page`} />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-order-success"
        icon={<Download className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Order success"
        title="Order success"
        description="Use the confirmation screen as an inline shortcode for physical or digital orders while keeping the dedicated routes available for live checkout redirects."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ViewSwitch
              label="Mode"
              value={orderSuccessMode}
              onChange={setOrderSuccessMode}
              options={[{ value: "physical", label: "Physical" }, { value: "digital", label: "Digital" }]}
            />
            <ShortcodeLabel name="order-success" attrs={{ mode: orderSuccessMode, show_native_link: true, show_support_link: true }} />
          </div>
          <ShortcodeSnippet name="order-success" attrs={{ mode: orderSuccessMode, show_native_link: true, show_support_link: true }} />
          <AcceptedValues name="mode" values={["physical", "digital"]} />
          <AcceptedValues name="show_native_link" values={["true", "false"]} />
          <AcceptedValues name="show_support_link" values={["true", "false"]} />
          <OrderSuccessShortcodePreview mode={orderSuccessMode} />
          <FullPageLink href={orderSuccessMode === "digital" ? "/order-success/digital" : "/order-success"} label="Open the dedicated order success page" />
        </div>
      </LibrarySection>

      <LibrarySection
        id="customer-unsubscribe"
        icon={<Mail className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Customer · Unsubscribe"
        title="Unsubscribe form"
        description="A reusable opt-out form block for newsletters and lifecycle emails, matching the dedicated unsubscribe route."
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ShortcodeLabel
              name="unsubscribe-form"
              attrs={{
                title: "We’re sorry to see you go.",
                description: "Confirm your email address and tell us why you’re unsubscribing.",
              }}
            />
          </div>
          <ShortcodeSnippet
            name="unsubscribe-form"
            attrs={{
              title: "We’re sorry to see you go.",
              description: "Confirm your email address and tell us why you’re unsubscribing.",
            }}
          />
          <AcceptedValues name="title" values={["Any short heading"]} />
          <AcceptedValues name="description" values={["Any supporting copy"]} />
          <UnsubscribeShortcodePreview />
          <FullPageLink href="/unsubscribe" label="Open the dedicated unsubscribe page" />
        </div>
      </LibrarySection>
    </div>
  );
}

function CartShortcodePreview({
  layout,
  summaryPosition,
  products,
}: {
  layout: CartShortcodeLayout;
  summaryPosition: CheckoutSummaryPosition;
  products: ProductCardData[];
}) {
  if (!products.length) return <BlogShortcodeStatus message="No live WooCommerce products are available for the cart preview." />;
  if (layout === "editorial") {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.map((product) => <ProductCard key={`cart-editorial-${product.id}`} product={product} variant="editorial" />)}
        <div className="grid min-h-64 content-end gap-2 rounded-3xl bg-brand-gradient p-6 text-white">
          <ShoppingCart className="h-7 w-7" aria-hidden="true" />
          <strong className="font-display text-xl">Ready to check out?</strong>
          <span className="text-sm text-white/80">{products.length} preview items</span>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="grid gap-3">
        {products.map((product) => (
          <div key={`cart-row-${product.id}`} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            {product.imageUrl ? (
              <ResponsiveImage src={product.imageUrl} alt="" sizes="4.5rem" className="aspect-square w-[72px] rounded-xl object-cover" />
            ) : (
              <span className="aspect-square w-[72px] rounded-xl bg-zinc-100 dark:bg-zinc-800" aria-hidden="true" />
            )}
            <div className="flex items-center justify-between gap-3">
              <div><strong className="block text-sm text-zinc-900 dark:text-zinc-100">{product.name}</strong><span className="text-xs text-zinc-500">Quantity 1</span></div>
              <strong className="text-sm text-zinc-900 dark:text-zinc-100">{product.priceLabel}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className={`${summaryPosition === "sticky" ? "lg:sticky lg:top-28" : ""} h-fit rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900`}>
        <strong className="font-display text-lg text-zinc-900 dark:text-zinc-100">Order summary</strong>
        <div className="mt-4 flex justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-700"><span>Total</span><strong>{products[0]?.priceLabel}</strong></div>
      </div>
    </div>
  );
}

function CheckoutShortcodePreview({
  storeMode,
  couponPosition,
  paymentPosition,
  summaryPosition,
  showOptionalFields,
  showOrderNotes,
  showTerms,
  showPrivacy,
}: {
  storeMode: CheckoutStoreMode;
  couponPosition: CheckoutCouponPosition;
  paymentPosition: CheckoutPaymentPosition;
  summaryPosition: CheckoutSummaryPosition;
  showOptionalFields: boolean;
  showOrderNotes: boolean;
  showTerms: boolean;
  showPrivacy: boolean;
}) {
  const coupon = <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700">Coupon code</div>;
  const payments = <div className="grid gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"><strong className="text-sm">Payment methods</strong><span className="rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-800">Card · BLIK · Crypto · COD · Cheque</span></div>;
  const summary = <div className={`${summaryPosition === "sticky" ? "lg:sticky lg:top-28" : ""} h-fit rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900`}><strong className="text-sm">Order summary</strong><p className="mb-0 text-xs text-zinc-500">Subtotal · Tax · Total</p></div>;
  return (
    <div className="grid gap-4 rounded-3xl border border-zinc-200 p-5 dark:border-zinc-800">
      {couponPosition === "top" ? coupon : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3">
          <strong className="font-display text-lg text-zinc-900 dark:text-zinc-100">Billing details</strong>
          <div className="grid grid-cols-2 gap-2">
            {["First name", "Last name", "Email", "Phone"].map((field) => <span key={field} className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">{field}</span>)}
            {showOptionalFields ? <span className="col-span-2 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">Company name · optional</span> : null}
          </div>
          {storeMode === "physical" ? <div className="rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">Shipping address and delivery method</div> : null}
          {couponPosition === "inline" ? coupon : null}
          {paymentPosition === "left" ? payments : null}
          {showOrderNotes ? <div className="rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">Order notes</div> : null}
          {showTerms ? <span className="text-xs text-zinc-500">☐ I agree to the terms</span> : null}
          {showPrivacy ? <span className="text-xs text-zinc-500">☐ I accept the privacy policy</span> : null}
        </div>
        <div className="grid content-start gap-3">{summary}{paymentPosition === "right" ? payments : null}</div>
      </div>
    </div>
  );
}

function ReadingListShortcodePreview({ layout, posts }: { layout: ReadingListLayout; posts: PostCardData[] }) {
  if (!posts.length) return <BlogShortcodeStatus message="No live WordPress posts are available for the reading-list preview." />;
  if (layout === "cards") return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{posts.map((post) => <PostCard key={`reading-${post.id}`} post={post} variant="default" />)}</div>;
  return (
    <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
      {posts.map((post) => (
        <article key={`reading-editorial-${post.id}`} className="grid gap-1.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{post.categories?.[0]?.name || "Journal"}</span>
          <strong className="font-display text-lg text-zinc-900 dark:text-zinc-100">{post.title}</strong>
          <p className="m-0 line-clamp-2 text-sm text-zinc-500">{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}

function AccountShortcodePreview({ tab }: { tab: AccountTab }) {
  const content: Record<AccountTab, { title: string; items: string[] }> = {
    dashboard: { title: "Profile dashboard", items: ["Verified account", "Profile details", "Push notifications"] },
    orders: { title: "Order history", items: ["Order FC-10482 · Delivered", "Order FC-10417 · Shipped", "Invoice downloads"] },
    addresses: { title: "Saved addresses", items: ["Billing address", "Shipping address", "Add address"] },
    community: { title: "Creator community", items: ["Published posts", "Marketplace listings", "Creator articles"] },
  };
  return (
    <div className="grid gap-4 rounded-3xl border border-zinc-200 p-5 dark:border-zinc-800 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="grid content-start gap-1">{(["dashboard", "orders", "addresses", "community"] as AccountTab[]).map((item) => <span key={item} className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize ${item === tab ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "text-zinc-500"}`}>{item}</span>)}</div>
      <div className="grid content-start gap-3 rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-900"><strong className="font-display text-xl text-zinc-900 dark:text-zinc-100">{content[tab].title}</strong>{content[tab].items.map((item) => <span key={item} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">{item}</span>)}</div>
    </div>
  );
}

function AuthShortcodePreview({ mode, layout }: { mode: AuthMode; layout: AuthLayout }) {
  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Forgotten password";
  const form = (
    <div className="grid w-full max-w-sm gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
      <strong className="font-display text-xl">{title}</strong>
      <span className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">Email address</span>
      {mode !== "forgot-password" ? <span className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">Password</span> : null}
      {mode === "register" ? <span className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">Confirm password</span> : null}
      <span className="rounded-full bg-brand-gradient px-4 py-2 text-center text-sm font-semibold text-white">{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}</span>
    </div>
  );
  if (layout === "centered") return <div className="grid min-h-80 place-items-center rounded-3xl bg-zinc-50 p-6 dark:bg-zinc-950">{form}</div>;
  if (layout === "image-bg") return <div className="grid min-h-80 place-items-center rounded-3xl bg-[linear-gradient(rgba(9,9,11,.55),rgba(9,9,11,.75)),url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center p-6">{form}</div>;
  return <div className="grid min-h-80 overflow-hidden rounded-3xl bg-zinc-50 dark:bg-zinc-950 lg:grid-cols-2"><div className="grid place-items-center p-6">{form}</div><div className="hidden content-center justify-items-center gap-2 bg-zinc-900 p-8 text-white lg:grid"><Sparkles className="h-8 w-8" /><strong className="font-display text-2xl">FunkyCommerce</strong></div></div>;
}

function OrderSuccessShortcodePreview({ mode }: { mode: OrderSuccessMode }) {
  return (
    <div className="grid gap-4 rounded-3xl border border-zinc-200 p-5 dark:border-zinc-800">
      <strong className="font-display text-xl text-zinc-900 dark:text-zinc-100">
        {mode === "digital" ? "Digital order confirmation" : "Physical order confirmation"}
      </strong>
      <div className="grid gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {mode === "digital" ? "Downloads + order links" : "Shipping recap + order links"}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Native order link and support CTA remain optional through shortcode attributes.
        </span>
      </div>
    </div>
  );
}

function UnsubscribeShortcodePreview() {
  return (
    <div className="grid gap-3 rounded-3xl border border-zinc-200 p-5 dark:border-zinc-800">
      <strong className="font-display text-xl text-zinc-900 dark:text-zinc-100">Unsubscribe form</strong>
      <span className="rounded-2xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">Email address</span>
      <span className="rounded-2xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">Reason (optional)</span>
      <span className="inline-flex w-fit rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">Unsubscribe</span>
    </div>
  );
}

function FullPageLink({ href, label }: { href: string; label: string }) {
  return <Link to={href} className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400">{label} →</Link>;
}

function TaxonomyColumn({ title, terms, tags = false }: { title: string; terms: CmsBlogTerm[]; tags?: boolean }) {
  return (
    <div className="grid content-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/60">
      <h3 className="m-0 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {terms.map((term) => (
          <Link
            key={term.id}
            to={term.uri}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 no-underline transition hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {tags ? "#" : ""}
            {term.name} ({term.count})
          </Link>
        ))}
      </div>
    </div>
  );
}

function BlogShortcodeStatus({ message, isError = false }: { message: string; isError?: boolean }) {
  return (
    <p className={`m-0 rounded-2xl border border-dashed px-5 py-4 text-sm ${
      isError
        ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400"
        : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
    }`}>
      {message}
    </p>
  );
}

function AcceptedValues({ name, values }: { name: string; values: string[] }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <strong className="mr-1 text-zinc-700 dark:text-zinc-200">Accepted {name}:</strong>
      {values.map((value) => <code key={value} className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{value}</code>)}
    </p>
  );
}

function ColumnLayoutPreview({ layout, posts }: { layout: ColumnLayout; posts: PostCardData[] }) {
  if (!posts.length) return <BlogShortcodeStatus message="No WordPress posts are available." />;
  if (layout === "1/3+2/3" || layout === "2/3+1/3") {
    const firstWide = layout === "2/3+1/3";
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className={firstWide ? "lg:col-span-2" : ""}><PostCard post={posts[0]} variant={firstWide ? "editorial" : "compact"} /></div>
        <div className={firstWide ? "" : "grid gap-5 sm:grid-cols-2 lg:col-span-2"}>
          {posts.slice(1, firstWide ? 2 : 3).map((post) => <PostCard key={post.id} post={post} variant="compact" />)}
        </div>
      </div>
    );
  }
  const className = layout === "1/2+1/2"
    ? "grid gap-5 sm:grid-cols-2"
    : layout === "1/3+1/3+1/3"
      ? "grid gap-5 sm:grid-cols-3"
      : "grid grid-cols-2 gap-5 lg:grid-cols-4";
  const count = layout === "1/2+1/2" ? 2 : layout === "1/3+1/3+1/3" ? 3 : 4;
  return (
    <div className={className}>
      {posts.slice(0, count).map((post) => <PostCard key={post.id} post={post} variant="compact" />)}
    </div>
  );
}

function MemberAvatar({ name, avatarUrl, size }: { name: string; avatarUrl?: string; size: string }) {
  if (avatarUrl) {
    return <ResponsiveImage src={avatarUrl} alt="" sizes="5rem" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-full text-sm font-bold text-white`}
      style={{ backgroundColor: avatarColorFor(name) }}
      aria-hidden="true"
    >
      {name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </span>
  );
}
