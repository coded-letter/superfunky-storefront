import {
  PostCard,
  PaginablePostGrid,
  PaginableProductGrid,
  ProductCard,
  ResponsiveImage,
  SpotifyPlayerMock,
  SocialPostCard,
  SocialFeedGrid,
  normalizeLanguagePath,
  useLanguage,
  useT,
  avatarColorFor,
  useLayoutPreferences,
  type PostCardVariant,
  type PostCardData,
  type ProductCardVariant,
  type SocialFeedLayout,
} from "@funky/ui";
import { AlertTriangle, CheckCircle2, Download, LifeBuoy, Mail, MapPin, Package, Printer, Star, Truck, UserCircle2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getOrderById, type AccountOrder } from "../lib/account";
import {
  loadOrderConfirmation,
  orderConfirmationFromNavigationState,
  type CapturedOrderItem,
  type OrderConfirmation,
} from "../lib/orderConfirmation";
import { localizedOrderStatus, type OrderTranslator } from "../lib/orderPresentation";
import { formatStoreApiMoney } from "../lib/storeApiMoney";
import { orderDetailsPath, useStorefrontPath } from "../lib/storefrontPaths";
import { getOrder, type StoreApiAddress, type StoreApiOrder, type StoreApiOrderItem } from "../lib/wcStoreApi";
import { useBlogData } from "../state/blogData";
import { useStickyPostsData } from "../state/stickyPostsData";
import { useCommerceData } from "../state/commerceData";
import { useCommunityData } from "../state/communityData";
import { useNavigationData } from "../state/navigationData";
import { toggleCommunityPostLike, type CommunityPostData } from "../lib/community";
import { CommentsSection, StarRating, stringToHSL } from "../pages/CommentThread";
import { ContentLoadingState } from "./ContentLoadingState";
import { HeroMock, type HeroVariant } from "./HeroMock";
import { VideoHero } from "./VideoHero";
import { LocationsShortcode, MapShortcode } from "./LocationsShortcode";
import { SliderMock, type SliderWidth } from "./SliderMock";
import { CONTENT_SHORTCODE_NAMES } from "../lib/shortcodeRegistry.mjs";
import { withCollectionOffset } from "../lib/shortcodeCollections";
import { resolveShortcodeImage, resolveSliderContentType, resolveStaticSliderItems } from "../lib/shortcodeSlider";
import { resolveShortcodeCta } from "../lib/shortcodeCta";
import { getOrderDownloadAccess, type OrderDownloadAccess } from "../lib/downloads";
import { isRetryableHttpStatus, shouldRetryRequestError } from "../lib/requestRetry";
import { DigitalDownloadsPanel } from "./DigitalDownloadsPanel";
import { isCommunityArticlePost } from "../lib/communityProfiles";
import { requestNewsletterUnsubscribe } from "../lib/submissions";
import { resolveHeadingLevel } from "../lib/headingLevels";

export type WordPressShortcodeAttributes = Record<string, string>;
export type WordPressShortcodeRenderer = (attributes: WordPressShortcodeAttributes) => ReactNode;

const LazyChatAssistantShortcode = lazy(() =>
  import("./ChatAssistantShortcode").then((module) => ({ default: module.ChatAssistantShortcode })),
);

const PRODUCT_CARD_VARIANTS: ProductCardVariant[] = ["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"];
const POST_CARD_VARIANTS: PostCardVariant[] = ["default", "compact", "editorial", "minimal"];

function isCurrentRoute(pathname: string, targetPath: string) {
  const normalize = (value: string) => value.replace(/\/+$/, "") || "/";
  return normalize(pathname) === normalize(targetPath);
}

function HeroShortcode({ attributes }: ShortcodeProps) {
  const { homeHeroLayout } = useLayoutPreferences();
  const { pathname } = useLocation();
  const homePath = useStorefrontPath("home", "/");
  const isHomeHero = isCurrentRoute(pathname, homePath);
  const variant = isHomeHero
    ? homeHeroLayout === "classic" ? "glow" : "fullbleed"
    : oneOf<HeroVariant>(attributes.variant, ["glow", "fullbleed", "split", "minimal", "strip"], "fullbleed");
  const headingLevel = resolveHeadingLevel(
    attributes["heading-level"],
    attributes.h2 && !attributes.h1 ? "h2" : "h1",
  );
  return (
    <HeroMock
      variant={variant}
      headingLevel={headingLevel}
      kicker={attributes.pill || attributes.kicker || undefined}
      title={attributes.h1 || attributes.h2 || attributes.title || "Storefront hero"}
      description={attributes.p || attributes.description || undefined}
      image={resolveShortcodeImage(attributes.bgimg || attributes["bg-image"] || attributes.image || attributes["background-image"] || "") || undefined}
      primaryCta={resolveShortcodeCta(attributes, "primary")}
      secondaryCta={resolveShortcodeCta(attributes, "secondary")}
      fullWidth={isHomeHero ? homeHeroLayout !== "classic" : toBoolean(attributes.fullwidth)}
      height={isHomeHero && homeHeroLayout !== "classic" ? attributes.height || "75vh" : attributes.height || undefined}
    />
  );
}

function VideoHeroShortcode({ attributes }: ShortcodeProps) {
  return (
    <VideoHero
      source={attributes.src || attributes.video || ""}
      poster={resolveShortcodeImage(attributes.poster || attributes.image || "") || undefined}
      kicker={attributes.kicker || attributes.pill || undefined}
      title={attributes.title || attributes.h1 || attributes.h2 || "Video hero"}
      description={attributes.description || attributes.p || undefined}
      primaryCta={resolveShortcodeCta(attributes, "primary")}
      secondaryCta={resolveShortcodeCta(attributes, "secondary")}
      height={attributes.height || undefined}
      overlayOpacity={toInteger(attributes["overlay-opacity"] || attributes.overlay_opacity, 55, 0, 90)}
      align={oneOf<"left" | "center" | "right">(attributes.align, ["left", "center", "right"], "left")}
      autoplay={attributes.autoplay === undefined ? true : toBoolean(attributes.autoplay)}
      loop={attributes.loop === undefined ? true : toBoolean(attributes.loop)}
      muted={attributes.muted === undefined ? true : toBoolean(attributes.muted)}
      variant={oneOf(attributes.variant, ["glow", "fullbleed", "split", "minimal", "strip"], "fullbleed")}
    />
  );
}

function SpotifyRadioShortcode({ attributes }: ShortcodeProps) {
  const title = attributes.title || "Superfunky Radio";
  const contentType = oneOf(
    attributes["content-type"],
    ["track", "album", "playlist", "artist", "show", "episode"] as const,
    "playlist",
  );
  const theme = oneOf(attributes.theme, ["auto", "dark", "light"] as const, "auto");

  return (
    <ShortcodeSection title={title}>
      {attributes.description ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{attributes.description}</p> : null}
      <SpotifyPlayerMock
        uri={attributes.uri}
        contentType={contentType}
        height={toInteger(attributes.height, 400, 152, 800)}
        theme={theme}
        title={title}
      />
    </ShortcodeSection>
  );
}

function CategoriesShortcode({ attributes }: ShortcodeProps) {
  const { data: commerce, isLoading: commerceLoading, error: commerceError } = useCommerceData();
  const { data: blog, isLoading: blogLoading, error: blogError } = useBlogData();
  const type = oneOf(attributes.type, ["post", "product", "brand"], "product");
  const isLoading = type === "post" ? blogLoading : commerceLoading;
  const error = type === "post" ? blogError : commerceError;
  const include = csv(attributes.include);
  const limit = toInteger(attributes.limit, 3, 1, 24);
  const columns = toInteger(attributes.columns, 3, 2, 4);
  const layout = oneOf(attributes.layout, ["cards", "compact", "minimal", "editorial", "graphical", "pills"], "cards");
  const terms = (type === "post" ? blog?.categories : type === "brand" ? commerce?.brands : commerce?.categories) || [];
  const noun = type === "brand" ? "brands" : "categories";
  const filtered = withCollectionOffset(
    sortItems(
      terms.filter((term) => !include.length || include.includes(term.slug) || include.includes(term.id)),
      attributes.orderby === "count"
        ? (item) => item.count
        : attributes.orderby === "include"
          ? (item) => include.findIndex((value) => value === item.id || value === item.slug)
          : (item) => item.name.toLowerCase(),
      attributes.order,
    ),
    attributes.offset,
    limit,
  );

  if (isLoading) return <ContentLoadingState compact label={`Loading ${type} ${noun}`} />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!filtered.length) return <ShortcodeStatus message={`No ${type} ${noun} matched this shortcode.`} />;

  const gridClass = columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";
  return (
    <ShortcodeSection title={attributes.title}>
      <div className={layout === "compact" || layout === "pills" ? "flex flex-wrap gap-2" : `grid gap-3 ${gridClass}`}>
        {filtered.map((term) => (
          <Link
            key={term.id}
            to={term.uri}
            className={
              layout === "compact" || layout === "pills"
                ? "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 no-underline dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                : "group grid gap-1 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft no-underline transition hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-900"
            }
          >
            {layout === "graphical" && "imageUrl" in term && term.imageUrl ? (
              <ResponsiveImage src={term.imageUrl} alt="" sizes="(min-width: 768px) 25vw, 50vw" className="mb-2 aspect-[4/3] w-full rounded-xl object-cover" />
            ) : null}
            <strong className="text-zinc-900 dark:text-zinc-100">{term.name}</strong>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{term.count} {type === "post" ? "posts" : "products"}</span>
          </Link>
        ))}
      </div>
    </ShortcodeSection>
  );
}

function SliderShortcode({ attributes }: ShortcodeProps) {
  const { data: commerce, isLoading: commerceLoading, error: commerceError } = useCommerceData();
  const { data: blog, isLoading: blogLoading, error: blogError } = useBlogData();
  const { homeHeroLayout, themeMaxWidthPx } = useLayoutPreferences();
  const { pathname } = useLocation();
  const homePath = useStorefrontPath("home", "/");
  const isHomeCampaign = isCurrentRoute(pathname, homePath);
  const type = resolveSliderContentType(attributes.type);
  const campaignLike = type === "campaign";
  const width = sliderWidth(attributes.layout);
  const pageSize = toInteger(attributes.slides, campaignLike ? 1 : 3, 1, 12);
  const limit = toInteger(attributes.limit, 6, 1, 48);
  const navigation = oneOf(attributes.navigation, ["dots", "arrows", "both", "none"], "both");
  const autoplay = toInteger(attributes.autoplay, 5000, 0, 60000);
  const loop = attributes.loop !== "false";
  const fullBleed = toBoolean(attributes.fullwidth);
  const title = attributes.title || (type === "post" ? "Latest stories" : type === "product" ? "This season's picks" : "");
  const subtitle = attributes.subtitle || "";
  const sectionHeadingLevel = resolveHeadingLevel(attributes["section-heading-level"], "h3");
  const slideHeadingLevel = resolveHeadingLevel(attributes["heading-level"], "h2");
  const firstSlideHeadingLevel = resolveHeadingLevel(attributes["first-heading-level"], slideHeadingLevel);

  if (type === "campaign") {
    const primaryCtaConfig = resolveShortcodeCta(attributes, "primary");
    const secondaryCtaConfig = resolveShortcodeCta(attributes, "secondary");
    const campaignItems = withCollectionOffset(
      resolveStaticSliderItems(attributes).map((slide, index) => ({
        id: `editor-campaign-${index}`,
        title: slide.title,
        subtitle: slide.description,
        label: slide.kicker,
        image: slide.image,
      })),
      attributes.offset,
      limit,
    );
    if (isHomeCampaign && homeHeroLayout !== "cinematic-slider") {
      const [hero] = campaignItems;
      if (!hero) return <ShortcodeStatus message="No campaign slides were configured." />;
      return (
        <HeroMock
          variant={homeHeroLayout === "classic" ? "glow" : "fullbleed"}
          headingLevel={firstSlideHeadingLevel}
          kicker={hero.label}
          title={hero.title}
          description={hero.subtitle}
          image={hero.image}
          primaryCta={primaryCtaConfig}
          secondaryCta={secondaryCtaConfig}
          fullWidth={homeHeroLayout === "cinematic"}
          height={homeHeroLayout === "cinematic" ? attributes.height || "75vh" : attributes.height || undefined}
        />
      );
    }
    return (
      <SliderMock
        title={title}
        subtitle={subtitle}
        width={width}
        items={campaignItems}
        pageSize={1}
        gridClassName="grid-cols-1"
        autoplayMs={autoplay || undefined}
        navigation={navigation}
        fullBleed={isHomeCampaign ? true : fullBleed}
        height={attributes.height || undefined}
        showHeader={Boolean(title || subtitle)}
        headingLevel={sectionHeadingLevel}
        loop={loop}
        getImageUrls={(slide) => [slide.image]}
        renderItem={(slide, index, meta) => {
          const SlideHeading = index === 0 ? firstSlideHeadingLevel : slideHeadingLevel;
          return (
          <article
            key={slide.id}
            className={`group relative flex h-full min-h-[22rem] overflow-hidden bg-zinc-900 text-left shadow-soft ${
              fullBleed ? "items-center rounded-none" : "items-end rounded-2xl"
            }`}
          >
            {slide.image ? <ResponsiveImage src={slide.image} alt="" priority={meta.isPriority} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/0" aria-hidden="true" />
            <div
              className={`relative grid w-full gap-2 text-white ${fullBleed ? "mx-auto px-6 py-10 sm:px-12" : "p-6 sm:p-10"}`}
              style={fullBleed ? { maxWidth: `${themeMaxWidthPx}px` } : undefined}
            >
              {slide.label ? <span className="text-xs font-semibold uppercase tracking-[0.24em]">{slide.label}</span> : null}
              <SlideHeading className="m-0 font-display text-3xl font-bold">{slide.title}</SlideHeading>
              {slide.subtitle ? <p className="m-0 max-w-xl text-white/80">{slide.subtitle}</p> : null}
              {primaryCtaConfig || secondaryCtaConfig ? (
                <div className="flex flex-wrap gap-3 pt-2">
                  {primaryCtaConfig ? (
                    <Link
                      to={primaryCtaConfig.href}
                      target={primaryCtaConfig.target}
                      rel={primaryCtaConfig.rel}
                      className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 no-underline transition hover:-translate-y-0.5"
                    >
                      {primaryCtaConfig.label}
                    </Link>
                  ) : null}
                  {secondaryCtaConfig ? (
                    <Link
                      to={secondaryCtaConfig.href}
                      target={secondaryCtaConfig.target}
                      rel={secondaryCtaConfig.rel}
                      className="rounded-full border border-white/50 px-5 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-white/10"
                    >
                      {secondaryCtaConfig.label}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
          );
        }}
      />
    );
  }

  const isLoading = type === "post" ? blogLoading : commerceLoading;
  const error = type === "post" ? blogError : commerceError;
  if (isLoading) return <ContentLoadingState compact label={`Loading ${type} slider`} />;
  if (error) return <ShortcodeStatus message={error.message} isError />;

  if (type === "post") {
    const posts = withCollectionOffset(filterPosts(blog?.posts || [], attributes), attributes.offset, limit);
    if (!posts.length) return <ShortcodeStatus message="No journal posts matched this shortcode." />;
    const variant = oneOf<PostCardVariant>(attributes["card-variant"], POST_CARD_VARIANTS, "default");
    return (
      <SliderMock
        title={title}
        subtitle={subtitle}
        width={width}
        items={posts}
        pageSize={pageSize}
        gridClassName={sliderGrid(pageSize)}
        autoplayMs={autoplay || undefined}
        navigation={navigation}
        loop={loop}
        headingLevel={sectionHeadingLevel}
        getImageUrls={(post) => [post.imageUrl]}
        renderItem={(post, _index, meta) => <PostCard key={post.id} post={post} variant={variant} imageLoading={meta.isPriority ? "eager" : "lazy"} />}
      />
    );
  }

  const products = withCollectionOffset(filterProducts(commerce?.products || [], attributes), attributes.offset, limit);
  if (!products.length) return <ShortcodeStatus message="No store products matched this shortcode." />;
  const variant = oneOf<ProductCardVariant>(attributes["card-variant"], PRODUCT_CARD_VARIANTS, "default");
  return (
    <SliderMock
      title={title}
      subtitle={subtitle}
      width={width}
      items={products}
      pageSize={pageSize}
      gridClassName={sliderGrid(pageSize)}
      autoplayMs={autoplay || undefined}
      navigation={navigation}
      loop={loop}
      headingLevel={sectionHeadingLevel}
      getImageUrls={(product) => [product.imageUrl, ...(product.gallery || [])]}
      renderItem={(product, _index, meta) => <ProductCard key={product.id} product={product} variant={variant} imageLoading={meta.isPriority ? "eager" : "lazy"} />}
    />
  );
}

function CarouselShortcode({ attributes }: ShortcodeProps) {
  return (
    <SliderShortcode
      attributes={{
        ...attributes,
        layout: "3/3",
        slides: attributes.columns || "4",
        navigation: "none",
        autoplay: attributes.autoplay || "3200",
      }}
    />
  );
}

function GridShortcode({ attributes }: ShortcodeProps) {
  const { data: commerce, isLoading: commerceLoading, error: commerceError } = useCommerceData();
  const { data: blog, isLoading: blogLoading, error: blogError } = useBlogData();
  const { data: community, isLoading: communityLoading, error: communityError } = useCommunityData();
  const type = oneOf(attributes.type, ["product", "post", "community-article"], "product");
  const pageSize = toInteger(attributes["page-size"], 12, 1, 48);
  const columns = toInteger(attributes.columns, 3, 1, 6);
  const title = attributes.title || (type === "product" ? "All products" : type === "community-article" ? "Community blog" : "All posts");
  const subtitle = attributes.subtitle || "";

  if (type === "product") {
    if (commerceLoading) return <ContentLoadingState compact label="Loading product grid" />;
    if (commerceError) return <ShortcodeStatus message={commerceError.message} isError />;
    const products = withCollectionOffset(filterProducts(commerce?.products || [], attributes), attributes.offset);
    if (!products.length) return <ShortcodeStatus message="No products matched this grid." />;
    return (
      <PaginableProductGrid
        title={title}
        subtitle={subtitle}
        products={products}
        pageSize={pageSize}
        cardVariant={oneOf<ProductCardVariant>(attributes["card-variant"], PRODUCT_CARD_VARIANTS, "default")}
        gridVariant={columns <= 2 ? "compact" : "standard"}
        showFilters={attributes["show-filters"] !== "false"}
      />
    );
  }

  if (blogLoading || (type === "community-article" && communityLoading)) {
    return <ContentLoadingState compact label="Loading post grid" />;
  }
  if (blogError || (type === "community-article" && communityError)) {
    return <ShortcodeStatus message={(blogError || communityError)?.message || "Community articles are unavailable."} isError />;
  }
  const sourcePosts = type === "community-article"
    ? (blog?.posts || []).filter((post) => isCommunityArticlePost(post, community?.members || []))
    : blog?.posts || [];
  const posts = withCollectionOffset(filterPosts(sourcePosts, attributes), attributes.offset);
  if (!posts.length) return <ShortcodeStatus message="No posts matched this grid." />;
  return (
    <PaginablePostGrid
      title={title}
      subtitle={subtitle}
      posts={posts}
      pageSize={pageSize}
      cardVariant={oneOf<PostCardVariant>(attributes["card-variant"], POST_CARD_VARIANTS, "default")}
      gridVariant={columns <= 2 ? "compact" : "standard"}
      showFilters={attributes["show-filters"] !== "false"}
    />
  );
}

/** `[sticky-posts]` (and its neutral `[sticky_posts]` alias) — published, sticky,
 * language-scoped posts from the dedicated `useStickyPostsData` query (see
 * `lib/stickyPosts.ts`), never the general blog listing. Reuses the shared `PostCard`
 * for every layout so pinned posts look consistent with the rest of the post grids. */
function StickyPostsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useStickyPostsData();
  const layout = oneOf(attributes.layout, ["grid", "carousel", "compact-list"], "grid");
  const columns = toInteger(attributes.columns, 3, 1, 4);
  const cardVariant = oneOf<PostCardVariant>(attributes["card-variant"], POST_CARD_VARIANTS, "default");
  const posts = withCollectionOffset(data?.posts || [], attributes.offset, toInteger(attributes.limit, 6, 1, 24));

  if (isLoading) return <ContentLoadingState compact label="Loading pinned posts" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!posts.length) return <ShortcodeStatus message="No published sticky posts matched this shortcode." />;

  if (layout === "carousel") {
    return (
      <SliderMock
        title={attributes.title || "Pinned posts"}
        subtitle={attributes.subtitle || ""}
        width="full"
        items={posts}
        pageSize={Math.min(columns, posts.length)}
        gridClassName={sliderGrid(columns)}
        autoplayMs={toInteger(attributes.autoplay, 4000, 0, 60000) || undefined}
        loop={attributes.loop !== "false"}
        getImageUrls={(post) => [post.imageUrl]}
        renderItem={(post) => <PostCard key={post.id} post={post} variant={cardVariant} />}
      />
    );
  }

  const gridClass = layout === "compact-list"
    ? "grid gap-3"
    : columns === 1
      ? "grid gap-4"
      : columns === 2
        ? "grid gap-4 sm:grid-cols-2"
        : columns === 4
          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <ShortcodeSection title={attributes.title || "Pinned posts"} subtitle={attributes.subtitle}>
      <div className={gridClass}>
        {posts.map((post) => <PostCard key={post.id} post={post} variant={layout === "compact-list" ? "compact" : cardVariant} />)}
      </div>
    </ShortcodeSection>
  );
}

function TagsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useBlogData();
  const include = csv(attributes.include);
  const tags = withCollectionOffset(
    sortItems(
      (data?.tags || []).filter((tag) => !include.length || include.includes(tag.id) || include.includes(tag.slug)),
      attributes.orderby === "count" ? (tag) => tag.count : attributes.orderby === "include" ? (tag) => include.indexOf(tag.slug) : (tag) => tag.name.toLowerCase(),
      attributes.order,
    ),
    attributes.offset,
    toInteger(attributes.limit, 24, 1, 100),
  );
  if (isLoading) return <ContentLoadingState compact label="Loading journal tags" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!tags.length) return <ShortcodeStatus message="No tags matched this shortcode." />;
  return (
    <ShortcodeSection title={attributes.title || "Tags"}>
      <div className={attributes.layout === "cards" ? "grid gap-3 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
        {tags.map((tag) => <Link key={tag.id} to={tag.uri} className="rounded-full border border-dashed border-zinc-300 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 no-underline dark:border-zinc-700 dark:text-zinc-400">#{tag.name} ({tag.count})</Link>)}
      </div>
    </ShortcodeSection>
  );
}

function ProductTagsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useCommerceData();
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const include = csv(attributes.include);
  const tags = withCollectionOffset(
    sortItems(
      (data?.tags || []).filter((tag) => !include.length || include.includes(tag.id) || include.includes(tag.slug)),
      attributes.orderby === "count" ? (tag) => tag.count : attributes.orderby === "include" ? (tag) => include.indexOf(tag.slug) : (tag) => tag.name.toLowerCase(),
      attributes.order,
    ),
    attributes.offset,
    toInteger(attributes.limit, 24, 1, 100),
  );
  if (isLoading) return <ContentLoadingState compact label="Loading product tags" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!tags.length) return <ShortcodeStatus message="No product tags matched this shortcode." />;
  return (
    <ShortcodeSection title={attributes.title || "Product tags"}>
      <div className={attributes.layout === "cards" ? "grid gap-3 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
        {tags.map((tag) => <Link key={tag.id} to={normalizeLanguagePath(tag.uri, languageCode, configuredLanguageCodes)} className="rounded-full border border-dashed border-zinc-300 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 no-underline dark:border-zinc-700 dark:text-zinc-400">#{tag.name} ({tag.count})</Link>)}
      </div>
    </ShortcodeSection>
  );
}

function AuthorsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useBlogData();
  const include = csv(attributes.include);
  const authors = withCollectionOffset(
    sortItems(
      (data?.authors || []).filter((author) =>
        author.postCount >= toInteger(attributes["min-posts"], 0, 0, 1000000) &&
        (!include.length || include.includes(author.id) || include.includes(author.slug)),
      ),
      attributes.orderby === "post-count" ? (author) => author.postCount : attributes.orderby === "include" ? (author) => include.indexOf(author.slug) : (author) => author.name.toLowerCase(),
      attributes.order,
    ),
    attributes.offset,
    toInteger(attributes.limit, 12, 1, 100),
  );
  if (isLoading) return <ContentLoadingState compact label="Loading journal authors" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!authors.length) return <ShortcodeStatus message="No authors matched this shortcode." />;
  return (
    <ShortcodeSection title={attributes.title || "Authors"}>
      <div className={attributes.layout === "compact" ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        {authors.map((author) => (
          <article key={author.id} className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center gap-3">
              {author.avatarUrl ? <ResponsiveImage src={author.avatarUrl} alt="" sizes="2.75rem" className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">{initials(author.name)}</span>}
              <div><h3 className="m-0 font-display font-bold">{author.name}</h3><span className="text-xs text-zinc-500">{author.postCount} posts</span></div>
            </div>
            {attributes["show-bio"] !== "false" && author.bio ? <p className="m-0 line-clamp-3 text-sm text-zinc-500">{author.bio}</p> : null}
            <Link to={author.uri || `/author/${author.slug}`} className="text-sm font-semibold text-brand-600 no-underline">Read all →</Link>
          </article>
        ))}
      </div>
    </ShortcodeSection>
  );
}

function ReviewsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useCommerceData();
  const { discussionLayout } = useLayoutPreferences();
  const reviews = withCollectionOffset(
    filterRatedDated(data?.reviews || [], attributes)
      .filter((review) => !attributes.product || review.productUri.includes(`/${attributes.product}/`)),
    attributes.offset,
    toInteger(attributes.limit, 12, 1, 48),
  );
  const layout = oneOf(attributes.layout, ["grid-4", "grid-3", "grid-5", "masonry", "compact"], "grid-4");

  if (isLoading) return <ContentLoadingState compact label="Loading product reviews" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!reviews.length) return <ShortcodeStatus message="No approved product reviews matched this shortcode." />;

  if (attributes.variant === "full" || attributes.variant === "compact") {
    const averageRating = reviews.reduce((total, review) => total + (review.rating || 0), 0) / reviews.length;
    return (
      <CommentsSection
        anchorId="shortcode-reviews"
        contentKey={`shortcode-reviews:${attributes.product || "all"}`}
        heading={attributes.title || "Product reviews"}
        initialReviews={reviews}
        averageRating={averageRating}
        totalCountOverride={reviews.length}
        formTitle="Leave a review"
        variant={attributes.variant}
        discussionLayout={discussionLayout}
      />
    );
  }

  const gridClass = layout === "masonry" ? "columns-1 gap-4 sm:columns-2 lg:columns-3" : layout === "grid-3" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : layout === "grid-5" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-5" : layout === "compact" ? "grid gap-2" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";
  return (
    <ShortcodeSection title={attributes.title || "Product reviews"}>
      <div className={gridClass}>
        {reviews.map((review) => (
          <figure key={review.id} className={`m-0 grid gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 ${layout === "masonry" ? "mb-4 inline-grid w-full break-inside-avoid" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: stringToHSL(review.author) }}>{initials(review.author)}</span>
              <div><figcaption className="font-semibold text-zinc-900 dark:text-zinc-100">{review.author}</figcaption>{review.rating ? <StarRating rating={review.rating} /> : null}</div>
            </div>
            <blockquote className="m-0 text-sm text-zinc-600 dark:text-zinc-300">"{review.content}"</blockquote>
            <Link to={review.productUri} className="text-xs font-semibold text-brand-600 no-underline dark:text-brand-400">{review.productTitle}</Link>
          </figure>
        ))}
      </div>
    </ShortcodeSection>
  );
}

function CommentsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useBlogData();
  const { discussionLayout } = useLayoutPreferences();
  const comments = withCollectionOffset(
    filterRatedDated(data?.comments || [], attributes)
      .filter((comment) => !attributes.post || comment.postUri.includes(`/${attributes.post}/`)),
    attributes.offset,
    toInteger(attributes.limit, 12, 1, 48),
  );
  const compact = attributes.layout === "compact";

  if (isLoading) return <ContentLoadingState compact label="Loading comments" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!comments.length) return <ShortcodeStatus message="No approved comments matched this shortcode." />;

  if (attributes.variant === "full" || attributes.variant === "compact") {
    return (
      <CommentsSection
        anchorId="shortcode-comments"
        contentKey={`shortcode-comments:${attributes.post || "all"}`}
        heading={attributes.title || "Recent comments"}
        initialReviews={comments}
        formTitle="Join the discussion"
        variant={attributes.variant}
        showRatingField={false}
        discussionLayout={discussionLayout}
      />
    );
  }

  return (
    <ShortcodeSection title={attributes.title || "Recent comments"}>
      <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
        {comments.map((comment) => (
          <Link key={comment.id} to={`${comment.postUri}#opinions`} className="grid gap-1.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 no-underline dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex justify-between gap-2 text-xs"><strong className="text-zinc-700 dark:text-zinc-200">{comment.author}</strong><time dateTime={comment.date}>{new Date(comment.date).toLocaleDateString()}</time></div>
            {comment.rating ? <StarRating rating={comment.rating} /> : null}
            <p className="m-0 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{comment.content}</p>
            <span className="truncate text-xs font-medium text-brand-600 dark:text-brand-400">on "{comment.postTitle}"</span>
          </Link>
        ))}
      </div>
    </ShortcodeSection>
  );
}

function CommunityFeedShortcode({ attributes }: ShortcodeProps) {
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useCommunityData();
  const { languageCode } = useLanguage();
  const {
    communityFeedLayout,
    communityFeedLoadMode,
    communityFeedPageSize,
    communityFeedFilters,
  } = useLayoutPreferences();
  const selectedTags = csv(attributes.tags);
  const posts = withCollectionOffset(
    (data?.posts || []).filter((post) =>
      (!post.languageCode || post.languageCode === languageCode.toLowerCase()) &&
      inDateRange(post.createdAt, attributes["date-from"], attributes["date-to"]) &&
      post.likes >= toInteger(attributes["min-likes"], 0, 0, 1000000) &&
      (post.ratingAverage || 0) >= toNumber(attributes["min-rating"], 0, 0, 5) &&
      (!attributes.author || post.author.handle === attributes.author) &&
      (!selectedTags.length || selectedTags.every((tag) => post.tags.includes(tag))),
    ),
    attributes.offset,
  );
  const layout = oneOf<SocialFeedLayout>(attributes.layout, ["masonry", "grid-3", "grid-4", "list", "compact"], communityFeedLayout);
  const loadMode = oneOf(attributes["load-mode"], ["manual", "infinite"], communityFeedLoadMode);
  const pageSize = toInteger(attributes["page-size"], Number(communityFeedPageSize), 1, 48);
  const showFilters = attributes["show-filters"] === undefined
    ? communityFeedFilters === "show"
    : toBoolean(attributes["show-filters"]);
  const deepLinkTag = searchParams.get("tag");

  if (isLoading) return <ContentLoadingState compact label="Loading community feed" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!posts.length) return <ShortcodeStatus message="No community posts matched this shortcode." />;

  return (
    <SocialFeedGrid
      title={attributes.title || "All posts"}
      subtitle={`${posts.length} posts from ${new Set(posts.map((post) => post.author.handle)).size} public profiles`}
      posts={posts}
      pageSize={pageSize}
      availableTags={showFilters ? Array.from(new Set(posts.flatMap((post) => post.tags))).sort() : []}
      initialSelectedTags={deepLinkTag ? [deepLinkTag] : selectedTags.length ? selectedTags : undefined}
      defaultLayout={layout}
      defaultLoadMode={loadMode}
      onToggleLike={(post) => toggleCommunityPostLike(Number(post.id))}
    />
  );
}

function CommunityHeroShortcode({ attributes }: ShortcodeProps) {
  const layout = oneOf(attributes.layout, ["gradient", "split", "image-bg"], "gradient");
  const image = attributes.image || "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80";
  const Heading = resolveHeadingLevel(attributes["heading-level"], "h1");
  const content = (
    <div className="relative z-10 grid gap-4 p-8 sm:p-10">
      <span className="text-xs font-semibold uppercase tracking-wide">{attributes.kicker || "Community"}</span>
      <Heading className="m-0 font-display text-3xl font-bold sm:text-4xl">{attributes.title || "See how the community styles it"}</Heading>
      {attributes.description ? <p className="m-0 max-w-2xl opacity-80">{attributes.description}</p> : null}
      {attributes["show-upload"] !== "false" ? <Link to="/auth" className="w-fit rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline">Share a post</Link> : null}
    </div>
  );
  if (layout === "split") return <section className="grid overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-2">{content}<ResponsiveImage src={image} alt="" sizes="(min-width: 1024px) 50vw, 100vw" className="h-full min-h-64 w-full object-cover" /></section>;
  if (layout === "image-bg") return <section className="relative overflow-hidden rounded-3xl text-white"><ResponsiveImage src={image} alt="" sizes="100vw" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-0 bg-black/55" aria-hidden="true" />{content}</section>;
  return <section className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-brand-50 to-white dark:border-zinc-800 dark:from-brand-950/30 dark:to-zinc-950">{content}</section>;
}

function CommunityMarketplaceShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useCommunityData();
  const items = withCollectionOffset(
    (data?.marketplaceItems || [])
      .filter(({ product }) => (product.rating || 0) >= toNumber(attributes["min-rating"], 0, 0, 5)),
    attributes.offset,
    toInteger(attributes.limit, 12, 1, 48),
  );
  if (isLoading) return <ContentLoadingState compact label="Loading community marketplace" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!items.length) return <ShortcodeStatus message="No community marketplace products matched this shortcode." />;
  const variant = oneOf<ProductCardVariant>(attributes["card-variant"], PRODUCT_CARD_VARIANTS, "default");
  return (
    <ShortcodeSection title={attributes.title || "Shop the community"}>
      <div className={attributes.layout === "compact" ? "grid gap-4 sm:grid-cols-2" : "grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"}>
        {items.map(({ product, vendor }) => <div key={product.id} className="grid gap-2"><ProductCard product={product} variant={variant} /><Link to={`/community/${vendor.handle}?tab=shop`} className="text-xs font-semibold text-zinc-500 no-underline">by @{vendor.handle}</Link></div>)}
      </div>
    </ShortcodeSection>
  );
}

function CommunityTagPicksShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useCommunityData();
  const requestedTags = csv(attributes.tags);
  const eligible = (data?.posts || []).filter((post) =>
    post.likes >= toInteger(attributes["min-likes"], 0, 0, 1000000) &&
    inDateRange(post.createdAt, attributes["date-from"], attributes["date-to"]),
  );
  const byTag = new Map<string, typeof eligible>();
  eligible.forEach((post) => post.tags.forEach((tag) => {
    if (requestedTags.length && !requestedTags.includes(tag)) return;
    byTag.set(tag, [...(byTag.get(tag) || []), post]);
  }));
  const picks = Array.from(byTag.entries())
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, toInteger(attributes["tag-limit"], 3, 1, 12));
  if (isLoading) return <ContentLoadingState compact label="Loading community tag picks" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!picks.length) return <ShortcodeStatus message="No community tag picks matched this shortcode." />;
  const postLimit = toInteger(attributes["post-limit"], 3, 1, 12);
  const layout = attributes.layout === "grid-4" ? "grid-4" : attributes.layout === "compact" ? "compact" : "grid-3";
  return (
    <ShortcodeSection title={attributes.title || "Hand-picked by tag"}>
      <div className="grid gap-8">{picks.map(([tag, posts]) => <section key={tag} className="grid gap-3"><h3 className="m-0 text-sm uppercase text-zinc-500"><Link to={communityTagPath(posts[0], tag)} className="text-inherit no-underline hover:text-brand-600 dark:hover:text-brand-400">#{tag}</Link></h3><div className={layout === "grid-4" ? "grid grid-cols-2 gap-4 lg:grid-cols-4" : layout === "compact" ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-4 sm:grid-cols-3"}>{withCollectionOffset(posts.sort((a, b) => b.likes - a.likes), attributes.offset, postLimit).map((post) => <SocialPostCard key={post.id} post={post} layout={layout} />)}</div></section>)}</div>
    </ShortcodeSection>
  );
}

function CommunityMembersShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useCommunityData();
  const include = csv(attributes.include);
  const normalizeRole = (type: string) => {
    const normalized = type.trim().toLowerCase().replace(/\s+/g, "-");
    return normalized === "administrator" ? "admin" : normalized;
  };
  const roles = csv(attributes.role).map(normalizeRole).filter((type) => type !== "all");
  const memberAliasRoles = csv(attributes.members).map(normalizeRole).filter((type) => type !== "all");
  const permissionRoles = csv(attributes.permission).map(normalizeRole).filter((type) => type !== "all");
  const requestedRoles = roles.length ? roles : memberAliasRoles.length ? memberAliasRoles : permissionRoles;
  const members = withCollectionOffset(
    (data?.members || []).filter((member) =>
      member.isPublic &&
      member.memberTypes.length > 0 &&
      (!requestedRoles.length || requestedRoles.some((type) => member.memberTypes.includes(type))) &&
      (!include.length || include.includes(member.handle)),
    ),
    attributes.offset,
    toInteger(attributes.limit, 12, 1, 100),
  );
  if (isLoading) return <ContentLoadingState compact label="Loading community members" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!members.length) return <ShortcodeStatus message="No community members matched this shortcode." />;
  return (
    <ShortcodeSection title={attributes.title || "Members to follow"}>
      <div className={attributes.layout === "list" ? "grid gap-3" : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"}>
        {members.map((member) => <Link key={member.handle} to={`/community/${member.handle}`} className="grid justify-items-center gap-2 rounded-2xl border border-zinc-200 p-4 text-center no-underline dark:border-zinc-800">{member.avatarUrl ? <ResponsiveImage src={member.avatarUrl} alt="" sizes="3rem" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: avatarColorFor(member.displayName) }}>{initials(member.displayName)}</span>}<strong className="text-xs text-zinc-900 dark:text-zinc-100">{member.displayName}</strong><span className="text-[0.68rem] capitalize text-zinc-400">{member.role}</span>{attributes["show-bio"] === "true" && member.bio ? <p className="m-0 line-clamp-2 text-xs text-zinc-500">{member.bio}</p> : null}</Link>)}
      </div>
    </ShortcodeSection>
  );
}

function TestimonialsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useCommerceData();
  const reviews = withCollectionOffset(
    filterRatedDated(data?.reviews || [], attributes),
    attributes.offset,
    toInteger(attributes.limit, 3, 1, 12),
  );
  if (isLoading) return <ContentLoadingState compact label="Loading testimonials" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!reviews.length) return <ShortcodeStatus message="No reviews matched this testimonial shortcode." />;

  if (attributes.layout === "carousel") {
    return (
      <SliderMock
        title={attributes.title || "What customers say"}
        subtitle=""
        width="full"
        items={reviews}
        pageSize={Math.min(3, reviews.length)}
        gridClassName="grid-cols-1 sm:grid-cols-3"
        autoplayMs={3200}
        navigation="none"
        renderItem={(review) => <TestimonialCard key={review.id} review={review} />}
      />
    );
  }

  return (
    <ShortcodeSection title={attributes.title || "What customers say"}>
      <div className={attributes.layout === "compact" ? "grid gap-2" : "grid gap-4 sm:grid-cols-3"}>
        {reviews.map((review) => <TestimonialCard key={review.id} review={review} />)}
      </div>
    </ShortcodeSection>
  );
}

function TestimonialCard({ review }: { review: NonNullable<ReturnType<typeof useCommerceData>["data"]>["reviews"][number] }) {
  return (
    <figure className="m-0 grid gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex gap-0.5" aria-label={`${review.rating || 0} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < (review.rating || 0) ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`} />)}
      </div>
      <blockquote className="m-0 text-sm text-zinc-600 dark:text-zinc-300">"{review.content}"</blockquote>
      <figcaption className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{review.author} · {review.productTitle}</figcaption>
    </figure>
  );
}

function RelatedSectionsShortcode({ attributes }: ShortcodeProps) {
  return (
    <div className="grid gap-8">
      {csv(attributes.items).slice(0, 3).map((item, index) => {
        if (item === "products") return <SliderShortcode key={`${item}-${index}`} attributes={{ type: "product", layout: "3/3", slides: "4", limit: attributes["product-limit"] || "4", title: "You might also like" }} />;
        if (item === "posts") return <SliderShortcode key={`${item}-${index}`} attributes={{ type: "post", layout: "3/3", slides: "3", limit: attributes["post-limit"] || "3", title: "Related reading" }} />;
        if (item === "community") return <CommunityFeedShortcode key={`${item}-${index}`} attributes={{ layout: "grid-4", "page-size": attributes["community-limit"] || "4", title: "From the community" }} />;
        if (item === "testimonials") return <TestimonialsShortcode key={`${item}-${index}`} attributes={{ layout: "grid-3", limit: "3", "min-rating": "4" }} />;
        return null;
      })}
    </div>
  );
}

type ShortcodeProps = { attributes: WordPressShortcodeAttributes };
type RatedDated = { rating?: number; date: string };

function ShortcodeSection({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="grid gap-5">
      {title ? (
        <div className="grid gap-1">
          <h2 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {subtitle ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function ShortcodeStatus({ message, isError = false }: { message: string; isError?: boolean }) {
  return <p role={isError ? "alert" : "status"} className={`m-0 rounded-2xl border border-dashed p-4 text-sm ${isError ? "border-rose-300 text-rose-600" : "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"}`}>{message}</p>;
}

function csv(value?: string): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) || [];
}

function toBoolean(value?: string): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").toLowerCase());
}

function toInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function toNumber(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseFloat(value || "");
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function oneOf<T extends string>(value: string | undefined, accepted: readonly T[], fallback: T): T {
  return accepted.includes(value as T) ? value as T : fallback;
}

function inDateRange(date: string, from?: string, to?: string): boolean {
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return !from && !to;
  return (!from || timestamp >= Date.parse(`${from}T00:00:00`)) && (!to || timestamp <= Date.parse(`${to}T23:59:59`));
}

function filterRatedDated<T extends RatedDated>(items: T[], attributes: WordPressShortcodeAttributes): T[] {
  const minimum = toNumber(attributes["min-rating"], 0, 0, 5);
  const maximum = toNumber(attributes["max-rating"], 5, 0, 5);
  return items.filter((item) => (item.rating || 0) >= minimum && (item.rating || 0) <= maximum && inDateRange(item.date, attributes["date-from"], attributes["date-to"]));
}

function filterPosts(posts: PostCardData[], attributes: WordPressShortcodeAttributes) {
  const include = csv(attributes.include);
  return sortItems(
    posts.filter((post) =>
      (!include.length || include.includes(post.id) || include.includes(post.slug)) &&
      inDateRange(post.date, attributes["date-from"], attributes["date-to"]) &&
      (!attributes.category || post.categories?.some((term) => term.slug === attributes.category)) &&
      (!attributes.tag || post.tags?.some((term) => term.slug === attributes.tag)) &&
      (!attributes.author || post.author.slug === attributes.author),
    ),
    attributes.orderby === "title" ? (post) => post.title.toLowerCase() : (post) => Date.parse(post.date),
    attributes.order,
  );
}

function filterProducts(
  products: NonNullable<ReturnType<typeof useCommerceData>["data"]>["products"],
  attributes: WordPressShortcodeAttributes,
) {
  const include = csv(attributes.include);
  const category = attributes.category?.toLocaleLowerCase();
  const tag = attributes.tag?.toLocaleLowerCase();
  const brand = attributes.brand?.toLocaleLowerCase();
  const filtered = products.filter((product) =>
    (!include.length || include.includes(product.id) || include.includes(product.slug)) &&
    (!category || product.categorySlugs?.some((slug) => slug.toLocaleLowerCase() === category) || product.category?.toLocaleLowerCase() === category) &&
    (!tag || product.tagSlugs?.some((slug) => slug.toLocaleLowerCase() === tag)) &&
    (!brand || product.brandSlugs?.some((slug) => slug.toLocaleLowerCase() === brand) || product.brand?.toLocaleLowerCase() === brand) &&
    (product.rating || 0) >= toNumber(attributes["min-rating"], 0, 0, 5),
  );
  const orderBy = attributes.orderby || "date";
  if (orderBy === "date") return attributes.order === "asc" ? [...filtered].reverse() : filtered;
  if (orderBy === "include") {
    return sortItems(filtered, (product) => {
      const idIndex = include.indexOf(product.id);
      const slugIndex = include.indexOf(product.slug);
      const index = idIndex >= 0 ? idIndex : slugIndex;
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    }, attributes.order || "asc");
  }
  return sortItems(
    filtered,
    orderBy === "title"
      ? (product) => product.name.toLocaleLowerCase()
      : orderBy === "price"
        ? (product) => product.priceAmount || 0
        : (product) => product.rating || 0,
    attributes.order,
  );
}

function sortItems<T>(items: T[], selector: (item: T) => string | number, order = "desc"): T[] {
  const direction = order === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = selector(left);
    const rightValue = selector(right);
    return leftValue < rightValue ? -direction : leftValue > rightValue ? direction : 0;
  });
}

function sliderWidth(layout?: string): SliderWidth {
  if (layout === "2/3") return "two-thirds";
  if (layout === "1/3") return "one-third";
  return "full";
}

function sliderGrid(pageSize: number): string {
  if (pageSize <= 1) return "grid-cols-1";
  if (pageSize === 2) return "grid-cols-1 sm:grid-cols-2";
  if (pageSize === 3) return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
}

function initials(value: string): string {
  return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function communityTagPath(post: CommunityPostData | undefined, tag: string): string {
  const tagIndex = post?.tags.indexOf(tag) ?? -1;
  const slug = tagIndex >= 0 ? post?.tagSlugs?.[tagIndex] : undefined;
  const fallbackSlug = tag.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return `/community-tag/${encodeURIComponent(slug || fallbackSlug)}`;
}

export function OrderSuccessShortcode({ attributes }: ShortcodeProps) {
  const location = useLocation();
  const t = useT();
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const shopPath = useStorefrontPath("shop", "/shop");
  const accountPath = useStorefrontPath("account", "/account");
  const { data: navigationData } = useNavigationData();
  const mode = oneOf(attributes.mode, ["physical", "digital"], "physical");
  const showNativeLink = toBoolean(attributes["show-native-link"] ?? "true");
  const showSupportLink = toBoolean(attributes["show-support-link"] ?? "true");
  const [confirmation] = useState<OrderConfirmation | null>(
    () => orderConfirmationFromNavigationState(location.state) || loadOrderConfirmation(),
  );
  const [liveOrder, setLiveOrder] = useState<StoreApiOrder | null>(null);
  const [accountOrder, setAccountOrder] = useState<AccountOrder | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(confirmation));
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [downloadAccess, setDownloadAccess] = useState<OrderDownloadAccess | null>(null);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadsError, setDownloadsError] = useState<string | null>(null);
  const deepLink = new URLSearchParams(location.search);
  const deepLinkOrderId = Number(deepLink.get("order_id") || 0);
  const deepLinkOrderKey = deepLink.get("key") || "";
  const deepLinkEmail = deepLink.get("email") || "";
  const deepLinkAccessToken = deepLink.get("access_token") || "";
  const refreshIntervalMs = 10_000;

  useEffect(() => {
    if (!confirmation) return;
    let cancelled = false;
    setIsLoading(true);
    setRefreshError(null);

    let refreshTimer = 0;
    const scheduleRefresh = () => {
      refreshTimer = window.setTimeout(refreshOrder, refreshIntervalMs);
    };
    async function refreshOrder() {
      try {
        const result = await getOrder(
          confirmation.order.order_id,
          confirmation.order.order_key || "",
          confirmation.billingEmail,
        );
        if (cancelled) return;
        if (result.ok) {
          setLiveOrder(result.data);
          setRefreshError(null);
          setIsLoading(false);
          if (["pending", "processing", "on-hold"].includes(result.data.status.replace(/^wc-/, ""))) {
            scheduleRefresh();
          }
          return;
        }

        try {
          const authenticatedOrder = await getOrderById(confirmation.order.order_id);
          if (cancelled) return;
          if (authenticatedOrder) {
            setAccountOrder(authenticatedOrder);
            setRefreshError(null);
            if (["pending", "processing", "on-hold"].includes(authenticatedOrder.status.replace(/^wc-/, ""))) {
              scheduleRefresh();
            }
          } else {
            setRefreshError(result.error);
            if (isRetryableHttpStatus(result.status)) {
              scheduleRefresh();
            }
          }
        } catch (error) {
          if (!cancelled) {
            setRefreshError(error instanceof Error ? error.message : result.error);
            if (isRetryableHttpStatus(result.status)) {
              scheduleRefresh();
            }
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      } catch (error) {
        if (cancelled) return;
        setRefreshError(error instanceof Error ? error.message : t("order_success.refresh_error"));
        setIsLoading(false);
        scheduleRefresh();
      }
    }
    void refreshOrder();

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
    };
  }, [confirmation, t]);

  useEffect(() => {
    const orderId = confirmation?.order.order_id || deepLinkOrderId;
    const orderKey = confirmation?.order.order_key || deepLinkOrderKey;
    const billingEmail = confirmation?.billingEmail || deepLinkEmail;
    if (!orderId || (!confirmation && !deepLinkAccessToken && (!orderKey || !billingEmail))) return;

    let cancelled = false;
    let refreshTimer = 0;
    let initialRequest = true;
    setDownloadsLoading(true);
    setDownloadsError(null);
    const refreshDownloads = async () => {
      try {
        const result = await getOrderDownloadAccess({
          orderId,
          orderKey,
          billingEmail,
          accessToken: deepLinkAccessToken,
        });
        if (cancelled) return;
        setDownloadAccess(result);
        setDownloadsError(null);
        if (!result.downloadPermitted) {
          refreshTimer = window.setTimeout(refreshDownloads, refreshIntervalMs);
        }
      } catch (error) {
        if (!cancelled) {
          setDownloadsError(error instanceof Error ? error.message : "Your download links could not be loaded.");
          if (shouldRetryRequestError(error)) {
            refreshTimer = window.setTimeout(refreshDownloads, refreshIntervalMs);
          }
        }
      } finally {
        if (!cancelled && initialRequest) {
          initialRequest = false;
          setDownloadsLoading(false);
        }
      }
    };
    void refreshDownloads();

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
    };
  }, [confirmation, deepLinkAccessToken, deepLinkOrderId, deepLinkOrderKey, deepLinkEmail]);

  if (!confirmation) {
    if (
      mode === "digital"
      && deepLinkOrderId
      && (deepLinkAccessToken || (deepLinkOrderKey && deepLinkEmail))
    ) {
      return (
        <ShortcodeSection title={t("order_success.section_digital")}>
          <div className="storefront-order-receipt grid gap-5 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8" data-order-receipt>
            <div className="grid gap-2 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Download className="h-7 w-7" aria-hidden="true" />
              </div>
              <strong className="font-display text-2xl text-zinc-900 dark:text-zinc-100">Your order downloads</strong>
              <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
                Secure download access for order #{deepLinkOrderId}.
              </p>
            </div>
            <DigitalDownloadsPanel
              downloads={downloadAccess?.downloads || []}
              isLoading={downloadsLoading}
              error={downloadsError}
              emptyMessage={downloadAccess?.hasDownloadableItems && !downloadAccess.downloadPermitted
                ? "Download links will appear automatically after payment is confirmed and the order is completed."
                : undefined}
            />
            <p className="m-0 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Guest access to this secure order page remains available for 7 days after order completion.
            </p>
            <div className="storefront-order-receipt__actions flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => window.print()} title={t("order_success.cta.pdf_hint")} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                {t("order_success.cta.pdf")}
              </button>
              <Link to={shopPath} className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 no-underline dark:border-zinc-700 dark:text-zinc-200">
                {t("order_success.cta.shopping")}
              </Link>
              <Link to={`${accountPath}#downloads`} className="rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white no-underline shadow-glow">
                Account downloads
              </Link>
            </div>
          </div>
        </ShortcodeSection>
      );
    }
    return (
      <ShortcodeSection title={t("order_success.section")}>
        <div className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-6 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
          <strong className="font-display text-xl text-zinc-900 dark:text-zinc-100">{t("order_success.empty.heading")}</strong>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {t("order_success.empty.message")}
          </p>
          <Link to={shopPath} className="mx-auto rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow">
            {t("order_success.cta.shopping")}
          </Link>
        </div>
      </ShortcodeSection>
    );
  }

  const resolvedMode = confirmation.mode || mode;
  const checkoutOrder = confirmation.order;
  const orderNumber = checkoutOrder.order_number || accountOrder?.number || String(checkoutOrder.order_id);
  const status = liveOrder?.status || accountOrder?.status || checkoutOrder.status;
  const billingAddress = liveOrder?.billing_address || checkoutOrder.billing_address;
  const shippingAddress = liveOrder?.shipping_address || checkoutOrder.shipping_address || billingAddress;
  const customerName = [billingAddress?.first_name, billingAddress?.last_name].filter(Boolean).join(" ") || t("order_success.customer_fallback");
  const displayItems = resolveOrderItems(liveOrder, accountOrder, confirmation.items);
  const summary = resolveOrderSummary(liveOrder, accountOrder, confirmation, t);
  const supportUrl = navigationData?.storefrontConfig.checkout?.supportUrl || `${accountPath}#orders`;
  const paymentLabel = t(paymentMethodTranslationKey(checkoutOrder.payment_method));
  const orderCurrency = liveOrder?.totals.currency_code || accountOrder?.currency || confirmation.currency || "";
  const statusLabel = localizedOrderStatus(status, accountOrder?.statusText, t);
  const privateOrderPath = orderDetailsPath(checkoutOrder.order_id, languageCode, configuredLanguageCodes);

  return (
    <ShortcodeSection title={t(resolvedMode === "digital" ? "order_success.section_digital" : "order_success.section")}>
      <div className="storefront-order-receipt grid gap-5 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8" data-order-receipt>
        <div className="grid gap-2 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            {resolvedMode === "digital" ? <Download className="h-7 w-7" aria-hidden="true" /> : <CheckCircle2 className="h-7 w-7" aria-hidden="true" />}
          </div>
          <strong className="font-display text-2xl text-zinc-900 dark:text-zinc-100">{t("order_success.heading")}</strong>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {t(resolvedMode === "digital" ? "order_success.thank_you_digital" : "order_success.thank_you", {
              name: customerName,
              number: orderNumber,
            })}
          </p>
        </div>

        {isLoading ? <ContentLoadingState compact label={t("order_success.refreshing")} /> : null}
        {refreshError ? (
          <p role="status" className="m-0 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("order_success.refresh_error")}
          </p>
        ) : null}
        {confirmation.accountLoginError ? (
          <p role="status" className="m-0 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("order_success.account_login_error", { error: confirmation.accountLoginError })}
          </p>
        ) : null}

        {resolvedMode === "digital" ? (
          <div className="grid gap-2">
            <DigitalDownloadsPanel
              downloads={downloadAccess?.downloads.length ? downloadAccess.downloads : accountOrder?.downloads || []}
              isLoading={downloadsLoading}
              error={downloadsError}
              emptyMessage={(downloadAccess?.hasDownloadableItems || accountOrder?.hasDownloadableItems)
                && !(downloadAccess?.downloadPermitted || accountOrder?.downloadPermitted)
                ? "Download links will appear automatically after payment is confirmed and the order is completed."
                : undefined}
            />
            <p className="m-0 text-center text-xs text-zinc-500 dark:text-zinc-400">
              This secure order page is retained in this browser for 7 days.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("order_success.order_label", { number: orderNumber })}</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {statusLabel}
            </span>
          </div>
          <div className="grid gap-3">
            {displayItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-start gap-2 text-zinc-600 dark:text-zinc-300">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                  <span>
                    {item.name}
                    {item.variant ? <span className="block text-xs text-zinc-400">{item.variant}</span> : null}
                    <span className="block text-xs text-zinc-400">{t("order_success.quantity", { quantity: item.quantity })}</span>
                  </span>
                </span>
                <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-100">{item.total}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            {summary.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-zinc-500 dark:text-zinc-400">
                <span>{row.label}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
              <span>{t("order_success.row.total")}</span>
              <span className="text-base">{summary.total}</span>
            </div>
          </div>
        </div>

        <div className={`grid gap-3 ${resolvedMode === "physical" ? "sm:grid-cols-2" : ""}`}>
          {resolvedMode === "physical" && shippingAddress ? (
            <OrderDataCard icon={<MapPin className="h-4 w-4" aria-hidden="true" />} label={t("order_success.shipping_to")}>
              {formatAddress(shippingAddress)}
            </OrderDataCard>
          ) : null}
          <OrderDataCard
            icon={<Truck className="h-4 w-4" aria-hidden="true" />}
            label={t(resolvedMode === "digital" ? "order_success.details.order" : "order_success.details.delivery_payment")}
          >
            {confirmation.shippingMethod ? <>{confirmation.shippingMethod}<br /></> : null}
            {paymentLabel}
            {orderCurrency ? <><br />{t("order_success.currency")}: {orderCurrency}</> : null}
            {confirmation.billingEmail ? <><br />{t("order_success.receipt")}: {confirmation.billingEmail}</> : null}
          </OrderDataCard>
        </div>

        <div className="storefront-order-receipt__actions flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.print()} title={t("order_success.cta.pdf_hint")} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            {t("order_success.cta.pdf")}
          </button>
          <Link to={shopPath} className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 no-underline dark:border-zinc-700 dark:text-zinc-200">
            {t("order_success.cta.shopping")}
          </Link>
          <Link to={`${accountPath}#${resolvedMode === "digital" ? "downloads" : "orders"}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white no-underline shadow-glow">
            <UserCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {resolvedMode === "digital" ? "Account downloads" : t("order_success.cta.orders")}
          </Link>
          {showNativeLink ? (
            <Link to={privateOrderPath} className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 no-underline dark:border-zinc-700 dark:text-zinc-200">
              {t("order_success.cta.private")}
            </Link>
          ) : null}
          {showSupportLink ? (
            <a href={supportUrl} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 no-underline dark:border-zinc-700 dark:text-zinc-200">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
              {t("order_success.cta.help")}
            </a>
          ) : null}
        </div>
      </div>
    </ShortcodeSection>
  );
}

type DisplayOrderItem = CapturedOrderItem;

function resolveOrderItems(
  liveOrder: StoreApiOrder | null,
  accountOrder: AccountOrder | null,
  capturedItems: CapturedOrderItem[],
): DisplayOrderItem[] {
  if (liveOrder?.items.length) {
    return liveOrder.items.map((item) => ({
      id: String(item.id),
      name: item.name,
      variant: formatOrderItemVariation(item),
      quantity: item.quantity,
      total: formatStoreApiMoney(item.totals.line_total, item.totals),
    }));
  }
  if (accountOrder?.items.length) {
    return accountOrder.items.map((item, index) => ({
      id: `${accountOrder.databaseId}-${index}`,
      name: item.name,
      variant: item.variation,
      quantity: item.quantity,
      total: item.total,
    }));
  }
  return capturedItems;
}

function resolveOrderSummary(
  liveOrder: StoreApiOrder | null,
  accountOrder: AccountOrder | null,
  confirmation: OrderConfirmation,
  t: OrderTranslator,
): { rows: Array<{ label: string; value: string }>; total: string } {
  if (liveOrder) {
    const totals = liveOrder.totals;
    const rows = [
      { label: t("order_success.row.subtotal"), value: formatStoreApiMoney(totals.subtotal, totals) },
      ...(isPositiveStoreApiAmount(totals.total_discount)
        ? [{
            label: liveOrder.coupons.length
              ? t("order_success.row.discount_with_codes", { codes: liveOrder.coupons.map(({ code }) => code).join(", ") })
              : t("order_success.row.discount"),
            value: `-${formatStoreApiMoney(totals.total_discount, totals)}`,
          }]
        : []),
      ...(totals.total_shipping !== null
        ? [{
            label: t("order_success.row.shipping"),
            value: isPositiveStoreApiAmount(totals.total_shipping)
              ? formatStoreApiMoney(totals.total_shipping, totals)
              : t("order_success.row.free"),
          }]
        : []),
      ...(isPositiveStoreApiAmount(totals.total_tax)
        ? [{ label: t("order_success.row.tax"), value: formatStoreApiMoney(totals.total_tax, totals) }]
        : []),
    ];
    return { rows, total: formatStoreApiMoney(totals.total_price, totals) };
  }

  const rows = [
    { label: t("order_success.row.subtotal"), value: confirmation.totals.subtotal },
    ...(confirmation.totals.discount ? [{
      label: confirmation.coupons.length
        ? t("order_success.row.discount_with_codes", { codes: confirmation.coupons.join(", ") })
        : t("order_success.row.discount"),
      value: confirmation.totals.discount,
    }] : []),
    ...(confirmation.totals.shipping ? [{
      label: t("order_success.row.shipping"),
      value: confirmation.mode === "digital" ? t("order_success.row.digital_delivery") : confirmation.totals.shipping,
    }] : []),
    ...(confirmation.totals.tax ? [{ label: t("order_success.row.tax"), value: confirmation.totals.tax }] : []),
  ];
  return { rows, total: accountOrder?.total || confirmation.totals.total };
}

function formatOrderItemVariation(item: StoreApiOrderItem): string {
  const values = item.variation?.map(({ attribute, value }) => `${attribute}: ${value}`).filter(Boolean)
    || item.item_data?.map(({ key, value }) => `${key}: ${value}`).filter(Boolean)
    || [];
  return values.join(" · ");
}

function isPositiveStoreApiAmount(value: string | null | undefined): boolean {
  return Number(value || "0") > 0;
}

function paymentMethodTranslationKey(method?: string): string {
  if (method === "cod") return "order_success.payment.cod";
  if (method === "cheque") return "order_success.payment.cheque";
  if (method === "bacs") return "order_success.payment.bacs";
  if (method === "funkycommerce_crypto") return "order_success.payment.crypto";
  if (method === "stripe_blik") return "order_success.payment.blik";
  return "order_success.payment.card";
}

function formatAddress(address: StoreApiAddress): ReactNode {
  const locality = [address.postcode, address.city].filter(Boolean).join(" ");
  return (
    <>
      {[address.first_name, address.last_name].filter(Boolean).join(" ")}
      {address.address_1 ? <><br />{address.address_1}</> : null}
      {address.address_2 ? <><br />{address.address_2}</> : null}
      {locality ? <><br />{locality}</> : null}
      {address.state || address.country ? <><br />{[address.state, address.country].filter(Boolean).join(", ")}</> : null}
    </>
  );
}

function OrderDataCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <p className="m-0 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {icon}
        {label}
      </p>
      <p className="m-0 text-zinc-700 dark:text-zinc-300">{children}</p>
    </div>
  );
}

function UnsubscribeFormShortcode({ attributes }: ShortcodeProps) {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(() => {
    const confirmation = searchParams.get("newsletter_unsubscribe");
    if (confirmation === "confirmed") return "Your newsletter data has been permanently deleted.";
    if (confirmation === "invalid") return "That confirmation link is invalid or has expired.";
    return "";
  });
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      setStatus(await requestNewsletterUnsubscribe(email.trim()));
      setEmail("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The unsubscribe request could not be sent.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <ShortcodeSection title={attributes.title || "Unsubscribe"}>
      <div className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Unsubscribe
          </div>
          <strong className="font-display text-2xl text-zinc-900 dark:text-zinc-100">{attributes.title || "We’re sorry to see you go."}</strong>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {attributes.description || "Confirm your email address and tell us why you’re unsubscribing."}
          </p>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email address
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100" />
          </label>
          <button type="submit" disabled={submitting} className="inline-flex w-fit items-center rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
            {submitting ? "Sending…" : "Email confirmation link"}
          </button>
          {status ? <p role="status" aria-live="polite" className="m-0 text-sm text-zinc-600 dark:text-zinc-300">{status}</p> : null}
        </form>
      </div>
    </ShortcodeSection>
  );
}

export const WORDPRESS_SHORTCODE_RENDERERS: Record<string, WordPressShortcodeRenderer> = {
  hero: (attributes) => <HeroShortcode attributes={attributes} />,
  "video-hero": (attributes) => <VideoHeroShortcode attributes={attributes} />,
  "spotify-radio": (attributes) => <SpotifyRadioShortcode attributes={attributes} />,
  chat_assistant: () => (
    <Suspense fallback={<ContentLoadingState compact label="Loading AI Assistant" />}>
      <LazyChatAssistantShortcode />
    </Suspense>
  ),
  categories: (attributes) => <CategoriesShortcode attributes={attributes} />,
  slider: (attributes) => <SliderShortcode attributes={attributes} />,
  carousel: (attributes) => <CarouselShortcode attributes={attributes} />,
  grid: (attributes) => <GridShortcode attributes={attributes} />,
  "sticky-posts": (attributes) => <StickyPostsShortcode attributes={attributes} />,
  sticky_posts: (attributes) => <StickyPostsShortcode attributes={attributes} />,
  tags: (attributes) => <TagsShortcode attributes={attributes} />,
  "product-tags": (attributes) => <ProductTagsShortcode attributes={attributes} />,
  authors: (attributes) => <AuthorsShortcode attributes={attributes} />,
  reviews: (attributes) => <ReviewsShortcode attributes={attributes} />,
  comments: (attributes) => <CommentsShortcode attributes={attributes} />,
  "community-feed": (attributes) => <CommunityFeedShortcode attributes={attributes} />,
  "community-hero": (attributes) => <CommunityHeroShortcode attributes={attributes} />,
  "community-marketplace": (attributes) => <CommunityMarketplaceShortcode attributes={attributes} />,
  "community-tag-picks": (attributes) => <CommunityTagPicksShortcode attributes={attributes} />,
  "community-members": (attributes) => <CommunityMembersShortcode attributes={attributes} />,
  testimonials: (attributes) => <TestimonialsShortcode attributes={attributes} />,
  "related-sections": (attributes) => <RelatedSectionsShortcode attributes={attributes} />,
  "order-success": (attributes) => <OrderSuccessShortcode attributes={attributes} />,
  "unsubscribe-form": (attributes) => <UnsubscribeFormShortcode attributes={attributes} />,
  funkycommerce_map: (attributes) => <MapShortcode attributes={attributes} />,
  funkycommerce_locations: () => <LocationsShortcode />,
  gml_map: (attributes) => <MapShortcode attributes={attributes} />,
  sorted_locations: () => <LocationsShortcode />,
};

for (const name of CONTENT_SHORTCODE_NAMES) {
  if (!WORDPRESS_SHORTCODE_RENDERERS[name]) {
    throw new Error(`Missing content shortcode renderer: ${name}`);
  }
}
