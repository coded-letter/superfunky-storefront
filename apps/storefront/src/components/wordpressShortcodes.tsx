import {
  PostCard,
  PaginablePostGrid,
  PaginableProductGrid,
  ProductCard,
  ResponsiveImage,
  SocialPostCard,
  SocialFeedGrid,
  avatarColorFor,
  type PostCardVariant,
  type PostCardData,
  type ProductCardVariant,
  type SocialFeedLayout,
} from "@funky/ui";
import { CheckCircle2, Download, Mail, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useBlogData } from "../state/blogData";
import { useCommerceData } from "../state/commerceData";
import { useCommunityData } from "../state/communityData";
import { CommentsSection, StarRating, stringToHSL } from "../pages/CommentThread";
import { ContentLoadingState } from "./ContentLoadingState";
import { HeroMock, type HeroVariant } from "./HeroMock";
import { LocationsShortcode } from "./LocationsShortcode";
import { SliderMock, type SliderWidth } from "./SliderMock";

export type WordPressShortcodeAttributes = Record<string, string>;
export type WordPressShortcodeRenderer = (attributes: WordPressShortcodeAttributes) => ReactNode;

const PRODUCT_CARD_VARIANTS: ProductCardVariant[] = ["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"];
const POST_CARD_VARIANTS: PostCardVariant[] = ["default", "compact", "editorial", "minimal"];

function HeroShortcode({ attributes }: ShortcodeProps) {
  const variant = oneOf<HeroVariant>(attributes.variant, ["glow", "fullbleed", "split", "minimal", "strip"], "fullbleed");
  return (
    <HeroMock
      variant={variant}
      headingLevel="h1"
      kicker={attributes.kicker || undefined}
      title={attributes.title || "Storefront hero"}
      description={attributes.description || undefined}
      image={attributes.image || undefined}
      primaryCta={cta(attributes["primary-cta-label"], attributes["primary-cta-href"])}
      secondaryCta={cta(attributes["secondary-cta-label"], attributes["secondary-cta-href"])}
      fullWidth={toBoolean(attributes.fullwidth)}
      height={attributes.height || undefined}
    />
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
  const filtered = sortItems(
    terms.filter((term) => !include.length || include.includes(term.slug) || include.includes(term.id)),
    attributes.orderby === "count"
      ? (item) => item.count
      : attributes.orderby === "include"
        ? (item) => include.findIndex((value) => value === item.id || value === item.slug)
        : (item) => item.name.toLowerCase(),
    attributes.order,
  ).slice(0, limit);

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
  const type = oneOf(attributes.type, ["campaign", "product", "post"], "product");
  const width = sliderWidth(attributes.layout);
  const pageSize = toInteger(attributes.slides, type === "campaign" ? 1 : 3, 1, 12);
  const limit = toInteger(attributes.limit, 6, 1, 48);
  const navigation = oneOf(attributes.navigation, ["dots", "arrows", "both", "none"], "both");
  const autoplay = toInteger(attributes.autoplay, 5000, 0, 60000);
  const loop = attributes.loop !== "false";
  const title = attributes.title || (type === "post" ? "Latest stories" : type === "product" ? "This season's picks" : "");
  const subtitle = attributes.subtitle || "";

  if (type === "campaign") {
    const titles = pipe(attributes.titles);
    const descriptions = pipe(attributes.descriptions);
    const images = pipe(attributes.images);
    const kickers = pipe(attributes.kickers);
    const campaignItems = (titles.length ? titles : [attributes.title || "New season, new silhouettes"]).map((slideTitle, index) => ({
      id: `editor-campaign-${index}`,
      title: slideTitle,
      subtitle: descriptions[index] || attributes.description || attributes.subtitle || "",
      label: kickers[index] || attributes.kicker || "",
      image: images[index] || attributes.image || "",
    })).slice(0, limit);
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
        fullBleed={toBoolean(attributes.fullwidth)}
        height={attributes.height || undefined}
        showHeader={Boolean(title || subtitle)}
        loop={loop}
        getImageUrls={(slide) => [slide.image]}
        renderItem={(slide, _index, meta) => (
          <article key={slide.id} className="group relative flex h-full min-h-[22rem] items-end overflow-hidden rounded-2xl bg-zinc-900 text-left shadow-soft">
            {slide.image ? <ResponsiveImage src={slide.image} alt="" priority={meta.isPriority} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/0" aria-hidden="true" />
            <div className="relative grid gap-2 p-6 text-white sm:p-10">
              {slide.label ? <span className="text-xs font-semibold uppercase tracking-[0.24em]">{slide.label}</span> : null}
              <h2 className="m-0 font-display text-3xl font-bold">{slide.title}</h2>
              {slide.subtitle ? <p className="m-0 max-w-xl text-white/80">{slide.subtitle}</p> : null}
            </div>
          </article>
        )}
      />
    );
  }

  const isLoading = type === "post" ? blogLoading : commerceLoading;
  const error = type === "post" ? blogError : commerceError;
  if (isLoading) return <ContentLoadingState compact label={`Loading ${type} slider`} />;
  if (error) return <ShortcodeStatus message={error.message} isError />;

  if (type === "post") {
    const posts = filterPosts(blog?.posts || [], attributes).slice(0, limit);
    if (!posts.length) return <ShortcodeStatus message="No WordPress posts matched this shortcode." />;
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
        getImageUrls={(post) => [post.imageUrl]}
        renderItem={(post, _index, meta) => <PostCard key={post.id} post={post} variant={variant} imageLoading={meta.isPriority ? "eager" : "lazy"} />}
      />
    );
  }

  const include = csv(attributes.include);
  const minimumRating = toNumber(attributes["min-rating"], 0, 0, 5);
  const products = sortItems(
    (commerce?.products || []).filter((product) =>
      (!include.length || include.includes(product.id)) &&
      (product.rating || 0) >= minimumRating &&
      (!attributes.category || product.category?.toLowerCase() === attributes.category.toLowerCase()) &&
      (!attributes.brand || product.brand?.toLowerCase() === attributes.brand.toLowerCase()),
    ),
    attributes.orderby === "title" ? (product) => product.name.toLowerCase() : (product) => product.rating || 0,
    attributes.order,
  ).slice(0, limit);
  if (!products.length) return <ShortcodeStatus message="No WooCommerce products matched this shortcode." />;
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
  const { data: community } = useCommunityData();
  const type = oneOf(attributes.type, ["product", "post", "community-article"], "product");
  const pageSize = toInteger(attributes["page-size"], 12, 1, 48);
  const columns = toInteger(attributes.columns, 3, 1, 6);
  const title = attributes.title || (type === "product" ? "All products" : type === "community-article" ? "Community blog" : "All posts");
  const subtitle = attributes.subtitle || "";

  if (type === "product") {
    if (commerceLoading) return <ContentLoadingState compact label="Loading product grid" />;
    if (commerceError) return <ShortcodeStatus message={commerceError.message} isError />;
    const include = csv(attributes.include);
    const products = sortItems(
      (commerce?.products || []).filter((product) =>
        (!include.length || include.includes(product.id)) &&
        (!attributes.category || product.category?.toLowerCase() === attributes.category.toLowerCase()) &&
        (!attributes.brand || product.brand?.toLowerCase() === attributes.brand.toLowerCase()) &&
        (product.rating || 0) >= toNumber(attributes["min-rating"], 0, 0, 5),
      ),
      attributes.orderby === "title" ? (product) => product.name.toLowerCase() : (product) => product.rating || 0,
      attributes.order,
    );
    if (!products.length) return <ShortcodeStatus message="No products matched this grid." />;
    return (
      <PaginableProductGrid
        title={title}
        subtitle={subtitle}
        products={products}
        pageSize={pageSize}
        cardVariant={oneOf<ProductCardVariant>(attributes["card-variant"], PRODUCT_CARD_VARIANTS, "default")}
        gridVariant={columns <= 2 ? "compact" : "standard"}
      />
    );
  }

  if (blogLoading) return <ContentLoadingState compact label="Loading post grid" />;
  if (blogError) return <ShortcodeStatus message={blogError.message} isError />;
  const sourcePosts = type === "community-article"
    ? (blog?.posts || []).filter((post) => community?.members.some((member) => member.role === "collaborator" && member.handle === post.author.slug))
    : blog?.posts || [];
  const posts = filterPosts(sourcePosts, attributes);
  if (!posts.length) return <ShortcodeStatus message="No posts matched this grid." />;
  return (
    <PaginablePostGrid
      title={title}
      subtitle={subtitle}
      posts={posts}
      pageSize={pageSize}
      cardVariant={oneOf<PostCardVariant>(attributes["card-variant"], POST_CARD_VARIANTS, "default")}
      gridVariant={columns <= 2 ? "compact" : "standard"}
    />
  );
}

function TagsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useBlogData();
  const include = csv(attributes.include);
  const tags = sortItems(
    (data?.tags || []).filter((tag) => !include.length || include.includes(tag.id) || include.includes(tag.slug)),
    attributes.orderby === "count" ? (tag) => tag.count : attributes.orderby === "include" ? (tag) => include.indexOf(tag.slug) : (tag) => tag.name.toLowerCase(),
    attributes.order,
  ).slice(0, toInteger(attributes.limit, 24, 1, 100));
  if (isLoading) return <ContentLoadingState compact label="Loading WordPress tags" />;
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

function AuthorsShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useBlogData();
  const include = csv(attributes.include);
  const authors = sortItems(
    (data?.authors || []).filter((author) =>
      author.postCount >= toInteger(attributes["min-posts"], 0, 0, 1000000) &&
      (!include.length || include.includes(author.id) || include.includes(author.slug)),
    ),
    attributes.orderby === "post-count" ? (author) => author.postCount : attributes.orderby === "include" ? (author) => include.indexOf(author.slug) : (author) => author.name.toLowerCase(),
    attributes.order,
  ).slice(0, toInteger(attributes.limit, 12, 1, 100));
  if (isLoading) return <ContentLoadingState compact label="Loading WordPress authors" />;
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
  const reviews = filterRatedDated(data?.reviews || [], attributes)
    .filter((review) => !attributes.product || review.productUri.includes(`/${attributes.product}/`))
    .slice(0, toInteger(attributes.limit, 12, 1, 48));
  const layout = oneOf(attributes.layout, ["grid-4", "grid-3", "grid-5", "masonry", "compact"], "grid-4");

  if (isLoading) return <ContentLoadingState compact label="Loading WooCommerce reviews" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!reviews.length) return <ShortcodeStatus message="No approved product reviews matched this shortcode." />;

  if (attributes.variant === "full" || attributes.variant === "compact") {
    const averageRating = reviews.reduce((total, review) => total + (review.rating || 0), 0) / reviews.length;
    return (
      <CommentsSection
        anchorId="shortcode-reviews"
        heading={attributes.title || "Product reviews"}
        initialReviews={reviews}
        averageRating={averageRating}
        totalCountOverride={reviews.length}
        formTitle="Leave a review"
        variant={attributes.variant}
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
  const comments = filterRatedDated(data?.comments || [], attributes)
    .filter((comment) => !attributes.post || comment.postUri.includes(`/${attributes.post}/`))
    .slice(0, toInteger(attributes.limit, 12, 1, 48));
  const compact = attributes.layout === "compact";

  if (isLoading) return <ContentLoadingState compact label="Loading WordPress comments" />;
  if (error) return <ShortcodeStatus message={error.message} isError />;
  if (!comments.length) return <ShortcodeStatus message="No approved comments matched this shortcode." />;

  if (attributes.variant === "full" || attributes.variant === "compact") {
    return (
      <CommentsSection
        anchorId="shortcode-comments"
        heading={attributes.title || "Recent comments"}
        initialReviews={comments}
        formTitle="Join the discussion"
        variant={attributes.variant}
        showRatingField={false}
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
  const selectedTags = csv(attributes.tags);
  const posts = (data?.posts || []).filter((post) =>
    inDateRange(post.createdAt, attributes["date-from"], attributes["date-to"]) &&
    post.likes >= toInteger(attributes["min-likes"], 0, 0, 1000000) &&
    (post.ratingAverage || 0) >= toNumber(attributes["min-rating"], 0, 0, 5) &&
    (!attributes.author || post.author.handle === attributes.author) &&
    (!selectedTags.length || selectedTags.every((tag) => post.tags.includes(tag))),
  );
  const layout = oneOf<SocialFeedLayout>(attributes.layout, ["masonry", "grid-3", "grid-4", "list", "compact"], "masonry");
  const loadMode = attributes["load-mode"] === "infinite" ? "infinite" : "manual";
  const pageSize = toInteger(attributes["page-size"], 12, 1, 48);
  const showFilters = attributes["show-filters"] !== "false";
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
    />
  );
}

function CommunityHeroShortcode({ attributes }: ShortcodeProps) {
  const layout = oneOf(attributes.layout, ["gradient", "split", "image-bg"], "gradient");
  const image = attributes.image || "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80";
  const content = (
    <div className="relative z-10 grid gap-4 p-8 sm:p-10">
      <span className="text-xs font-semibold uppercase tracking-wide">{attributes.kicker || "Community"}</span>
      <h1 className="m-0 font-display text-3xl font-bold sm:text-4xl">{attributes.title || "See how the community styles it"}</h1>
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
  const items = (data?.marketplaceItems || [])
    .filter(({ product }) => (product.rating || 0) >= toNumber(attributes["min-rating"], 0, 0, 5))
    .slice(0, toInteger(attributes.limit, 12, 1, 48));
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
      <div className="grid gap-8">{picks.map(([tag, posts]) => <section key={tag} className="grid gap-3"><h3 className="m-0 text-sm uppercase text-zinc-500">#{tag}</h3><div className={layout === "grid-4" ? "grid grid-cols-2 gap-4 lg:grid-cols-4" : layout === "compact" ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-4 sm:grid-cols-3"}>{posts.sort((a, b) => b.likes - a.likes).slice(0, postLimit).map((post) => <SocialPostCard key={post.id} post={post} layout={layout} />)}</div></section>)}</div>
    </ShortcodeSection>
  );
}

function CommunityMembersShortcode({ attributes }: ShortcodeProps) {
  const { data, isLoading, error } = useCommunityData();
  const include = csv(attributes.include);
  const members = (data?.members || []).filter((member) =>
    member.isPublic &&
    (attributes.role === "all" || !attributes.role || member.role === attributes.role) &&
    (!include.length || include.includes(member.handle)),
  ).slice(0, toInteger(attributes.limit, 12, 1, 100));
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
  const reviews = filterRatedDated(data?.reviews || [], attributes).slice(0, toInteger(attributes.limit, 3, 1, 12));
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

function ShortcodeSection({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="grid gap-5">{title ? <h2 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2> : null}{children}</section>;
}

function ShortcodeStatus({ message, isError = false }: { message: string; isError?: boolean }) {
  return <p role={isError ? "alert" : "status"} className={`m-0 rounded-2xl border border-dashed p-4 text-sm ${isError ? "border-rose-300 text-rose-600" : "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"}`}>{message}</p>;
}

function cta(label?: string, href?: string) {
  return label && href ? { label, href } : undefined;
}

function csv(value?: string): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) || [];
}

function pipe(value?: string): string[] {
  return value?.split("|").map((item) => item.trim()).filter(Boolean) || [];
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

function OrderSuccessShortcode({ attributes }: ShortcodeProps) {
  const mode = oneOf(attributes.mode, ["physical", "digital"], "physical");
  const showNativeLink = toBoolean(attributes["show-native-link"] ?? "true");
  const showSupportLink = toBoolean(attributes["show-support-link"] ?? "true");

  return (
    <ShortcodeSection title={mode === "digital" ? "Order confirmation · digital" : "Order confirmation"}>
      <div className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-2 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            {mode === "digital" ? <Download className="h-7 w-7" aria-hidden="true" /> : <CheckCircle2 className="h-7 w-7" aria-hidden="true" />}
          </div>
          <strong className="font-display text-2xl text-zinc-900 dark:text-zinc-100">Order successful</strong>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "digital"
              ? "Use this shortcode when you want the digital order success content inline on a WordPress page."
              : "Use this shortcode when you want the physical order success content inline on a WordPress page."}
          </p>
        </div>
        <div className="grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-950/40">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">#{mode === "digital" ? "FC-2026-1043" : "FC-2026-1042"}</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {mode === "digital" ? "Downloads, receipt, and order links" : "Shipping/payment recap, receipt, and order links"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {showNativeLink ? <span className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Native order link</span> : null}
          {showSupportLink ? <span className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Support link</span> : null}
        </div>
      </div>
    </ShortcodeSection>
  );
}

function UnsubscribeFormShortcode({ attributes }: ShortcodeProps) {
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
        <div className="grid gap-3">
          <span className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">Email address</span>
          <span className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">Reason (optional)</span>
          <span className="inline-flex w-fit items-center rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">Unsubscribe</span>
        </div>
      </div>
    </ShortcodeSection>
  );
}

export const WORDPRESS_SHORTCODE_RENDERERS: Record<string, WordPressShortcodeRenderer> = {
  hero: (attributes) => <HeroShortcode attributes={attributes} />,
  categories: (attributes) => <CategoriesShortcode attributes={attributes} />,
  slider: (attributes) => <SliderShortcode attributes={attributes} />,
  carousel: (attributes) => <CarouselShortcode attributes={attributes} />,
  grid: (attributes) => <GridShortcode attributes={attributes} />,
  tags: (attributes) => <TagsShortcode attributes={attributes} />,
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
  funkycommerce_locations: (attributes) => <LocationsShortcode attributes={attributes} />,
  gml_map: (attributes) => <LocationsShortcode attributes={attributes} />,
  sorted_locations: (attributes) => <LocationsShortcode attributes={{ ...attributes, layout: attributes.layout || "list" }} />,
};
