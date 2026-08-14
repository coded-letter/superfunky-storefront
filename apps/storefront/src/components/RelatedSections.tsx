import { useMemo, useState } from "react";
import { MessageSquareQuote, Star } from "lucide-react";
import { PaginablePostGrid, PaginableProductGrid, SocialFeedGrid, ViewSwitch, avatarColorFor, type SocialPostCardData } from "@funky/ui";
import { ContentLoadingState } from "./ContentLoadingState";
import { MOCK_PRODUCTS } from "../pages/shared";
import { PUBLIC_SOCIAL_POSTS, getSocialUserByHandle } from "../pages/socialShared";
import { useBlogData } from "../state/blogData";
import { useCommerceData } from "../state/commerceData";

export type RelatedSectionKind = "none" | "products" | "posts" | "community" | "testimonials";

export const RELATED_SECTION_OPTIONS: { value: RelatedSectionKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "products", label: "Products" },
  { value: "posts", label: "Posts" },
  { value: "community", label: "Community" },
  { value: "testimonials", label: "Testimonials" },
];

const TESTIMONIALS = [
  {
    quote: "Ordered twice already — the sizing guide alone saved me a return.",
    author: "Priya N.",
    product: MOCK_PRODUCTS[0]?.name ?? "Nebula Hoodie",
    rating: 5,
  },
  {
    quote: "Packaging felt premium and shipping was faster than quoted.",
    author: "Marco D.",
    product: MOCK_PRODUCTS[2]?.name ?? "Flux Sneakers",
    rating: 5,
  },
  {
    quote: "Customer support fixed an address mistake within the hour. Would shop again.",
    author: "Ines V.",
    product: MOCK_PRODUCTS[4]?.name ?? "Pulse Joggers",
    rating: 4,
  },
];

/**
 * Up to 3 "related sections" the theme's controller can append below a taxonomy
 * archive's product/post grid (or below home/shop's own pagination) — each slot picks
 * one of the shortcode-library building blocks already used site-wide, so no new
 * content model is needed. `RelatedSectionsPicker` renders the matching on-page control.
 */
export function RelatedSections({ kinds, idPrefix = "related" }: { kinds: RelatedSectionKind[]; idPrefix?: string }) {
  return (
    <>
      {kinds.map((kind, index) =>
        kind === "none" ? null : <RelatedSection key={`${idPrefix}-${index}-${kind}`} kind={kind} />,
      )}
    </>
  );
}

function RelatedSection({ kind }: { kind: Exclude<RelatedSectionKind, "none"> }) {
  const { data: blog, isLoading: isBlogLoading, error: blogError } = useBlogData();
  const { data: commerce, isLoading: isCommerceLoading, error: commerceError } = useCommerceData();

  if (kind === "products") {
    if (isCommerceLoading) return <ContentLoadingState compact label="Loading related products" />;
    if (commerceError) return <RelatedContentStatus message={commerceError.message} isError />;
    if (!commerce?.products.length) return <RelatedContentStatus message="No published products are available." />;
    return (
      <PaginableProductGrid
        title="You might also like"
        subtitle="Products from the shared store catalog."
        products={commerce.products}
        pageSize={4}
        cardVariant="default"
        gridVariant="standard"
      />
    );
  }

  if (kind === "posts") {
    if (isBlogLoading) return <ContentLoadingState compact label="Loading related posts" />;
    if (blogError) return <RelatedContentStatus message={blogError.message} isError />;
    if (!blog?.posts.length) return <RelatedContentStatus message="No published posts are available for this language." />;
    return (
      <PaginablePostGrid
        title="Related reading"
        subtitle="The latest posts from the shared site journal."
        posts={blog.posts}
        pageSize={3}
        cardVariant="default"
        gridVariant="standard"
      />
    );
  }

  if (kind === "community") {
    return <CommunityRelatedSection />;
  }

  function RelatedContentStatus({ message, isError = false }: { message: string; isError?: boolean }) {
    return (
      <section className="sf-related-status rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className={`m-0 ${isError ? "text-rose-600 dark:text-rose-400" : "text-zinc-500 dark:text-zinc-400"}`}>{message}</p>
      </section>
    );
  }

  // kind === "testimonials"
  return (
    <section className="sf-related-testimonials grid gap-5">
      <div className="grid gap-1 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">What customers say</h2>
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">The `[testimonials]` shortcode — a rotating trust-builder slot.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {TESTIMONIALS.map((item) => {
          const initials = item.author
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <figure
              key={item.author}
              className="m-0 grid gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={`h-3.5 w-3.5 ${index < item.rating ? "fill-amber-400 text-amber-400" : "fill-none text-zinc-300 dark:text-zinc-700"}`}
                    />
                  ))}
                </div>
                <MessageSquareQuote className="h-5 w-5 text-brand-500" aria-hidden="true" />
              </div>
              <blockquote className="m-0 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">&ldquo;{item.quote}&rdquo;</blockquote>
              <figcaption className="mt-1 flex items-center gap-3">
                <span
                  className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: avatarColorFor(item.author) }}
                  aria-hidden="true"
                >
                  {initials}
                </span>
                <span className="grid">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.author}</span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">Verified buyer · {item.product}</span>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/** Maps a handful of the public feed's most recent uploads to `SocialPostCardData` —
 * mirrors the exact same conversion `HomeMockupPage`/`CommunityFeedMockupPage` use for
 * their own `[community-feed]` shortcode previews. */
function CommunityRelatedSection() {
  const posts = useMemo<SocialPostCardData[]>(
    () =>
      PUBLIC_SOCIAL_POSTS.slice(0, 8).map((post) => {
        const author = getSocialUserByHandle(post.authorHandle);
        return {
          id: post.id,
          image: post.image,
          aspect: post.aspect,
          title: post.title,
          description: post.description,
          media: post.media,
          caption: post.caption,
          tags: post.tags,
          likes: post.likes,
          comments: post.comments,
          createdAt: post.createdAt,
          author: {
            handle: post.authorHandle,
            displayName: author?.displayName ?? post.authorHandle,
            avatarUrl: author?.avatarUrl,
          },
        };
      }),
    [],
  );

  return (
    <section className="grid gap-5">
      <div className="grid gap-1 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">From the community</h2>
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">The `[community-feed]` shortcode, previewed here in a compact slot.</p>
      </div>
      <SocialFeedGrid posts={posts} pageSize={4} defaultLayout="grid-4" />
    </section>
  );
}

/**
 * Control panel offering up to 3 related-section slots, each a `ViewSwitch` between
 * `RELATED_SECTION_OPTIONS`. `onChange` receives the full 3-item array so the parent
 * page can hand it straight to `<RelatedSections kinds={...} />`.
 */
export function useRelatedSectionSlots(defaults: RelatedSectionKind[] = ["products", "none", "none"]) {
  const [slots, setSlots] = useState<RelatedSectionKind[]>(() => {
    const next = [...defaults];
    while (next.length < 3) next.push("none");
    return next.slice(0, 3);
  });

  const setSlot = (index: number, value: RelatedSectionKind) => {
    setSlots((current) => current.map((existing, i) => (i === index ? value : existing)));
  };

  return { slots, setSlot };
}

export function RelatedSectionsPicker({
  slots,
  onChangeSlot,
}: {
  slots: RelatedSectionKind[];
  onChangeSlot: (index: number, value: RelatedSectionKind) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
      <h3 className="m-0 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Related sections (up to 3)</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {slots.map((value, index) => (
          <ViewSwitch
            key={index}
            label={`Section ${index + 1}`}
            value={value}
            onChange={(next) => onChangeSlot(index, next)}
            options={RELATED_SECTION_OPTIONS}
          />
        ))}
      </div>
    </div>
  );
}
