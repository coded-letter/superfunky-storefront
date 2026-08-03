import { BookOpen, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { PostCard, useReadArticles, useReadingList } from "@funky/ui";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { useApplicationShortcode, useEmbeddedApplicationShortcode } from "../components/applicationShortcodes";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { useBlogData } from "../state/blogData";

type ReadingListLayout = "cards" | "editorial-2col";

export function ReadingListMockupPage() {
  useEmbeddedApplicationShortcode();
  const config = useApplicationShortcode(["funkycommerce_reading_list"], { layout: "cards" });
  const blogPath = useStorefrontPath("blog", "/blog");
  const { ids, clear } = useReadingList();
  const { has: isRead, toggle: toggleRead } = useReadArticles();
  const { data: blog, isLoading, error } = useBlogData();

  // Build an index of all posts by ID for fast lookup.
  const postsById = new Map((blog?.posts || []).map((post) => [post.id, post]));

  // For each saved ID, try to find the post in the current language.
  // If the post itself isn't present but one of its translations is, use that.
  // If neither exists, the ID is considered unavailable in the current language.
  const translationMap = new Map<string, string>(); // originalId → resolvedId
  (blog?.posts || []).forEach((post) => {
    if (post.translations) {
      Object.entries(post.translations).forEach(([_lang, translationId]) => {
        // This post is the translation of another; map the other to this one.
        if (!postsById.has(translationId)) {
          // translationId points to a different language — reverse-map it
          translationMap.set(translationId, post.id);
        }
      });
    }
  });

  const savedPosts = ids.flatMap((id) => {
    const direct = postsById.get(id);
    if (direct) return [direct];
    // Try the translation map (this post was saved in a different language)
    const resolvedId = translationMap.get(id);
    if (resolvedId) {
      const translated = postsById.get(resolvedId);
      if (translated) return [translated];
    }
    // Check if any loaded post has this ID as a translation of the current language
    const byTranslation = (blog?.posts || []).find((post) =>
      post.translations && Object.values(post.translations).includes(id)
    );
    if (byTranslation) return [byTranslation];
    return [];
  });

  const layout: ReadingListLayout = config.layout === "editorial-2col" ? "editorial-2col" : "cards";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div className="grid gap-1">
          <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">Reading list</h1>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {ids.length} saved {ids.length === 1 ? "article" : "articles"} · persisted locally in this browser.
          </p>
        </div>
      </div>

      {ids.length > 0 && isLoading ? <ContentLoadingState compact label="Loading your saved articles" /> : null}
      {ids.length > 0 && error ? (
        <SavedCollectionStatus message={`Your saved articles could not be loaded: ${error.message}`} />
      ) : null}
      {!isLoading && !error && ids.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <span className="inline-grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="grid gap-1">
            <h2 className="m-0 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">Nothing saved yet</h2>
            <p className="m-0 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Use the bookmark button on any article in the blog to save it for later reading.
            </p>
          </div>
          <Link
            to={blogPath}
            className="rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
          >
            Browse the blog
          </Link>
        </div>
      ) : !isLoading && !error && savedPosts.length > 0 && layout === "editorial-2col" ? (
            // Newspaper-style dense listing: two text-first columns (no big card chrome),
            // each row split by a hairline rule — mirrors a print "in this issue" index.
            <div className="grid gap-x-10 gap-y-5 divide-y divide-zinc-200 sm:grid-cols-2 sm:gap-y-8 sm:divide-y-0 dark:divide-zinc-800">
              {savedPosts.map((post) => {
                const read = isRead(post.id);
                return (
                  <div key={post.id} className="grid gap-1.5 pt-5 first:pt-0 sm:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                        {!read ? (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500 shadow-glow"
                            aria-hidden="true"
                            title="Unread"
                          />
                        ) : null}
                        {post.categories?.[0]?.name ?? "Journal"}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRead(post.id)}
                        aria-pressed={read}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-brand-700 dark:hover:text-brand-400"
                      >
                        {read ? (
                          <>
                            <Check className="h-3 w-3" aria-hidden="true" /> Read
                          </>
                        ) : (
                          "Mark as read"
                        )}
                      </button>
                    </div>
                    <h2 className="m-0">
                      <Link
                        to={`/blog/${post.slug}`}
                        className={`font-display text-lg font-bold leading-snug no-underline transition hover:text-brand-600 ${
                          read ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {post.title}
                      </Link>
                    </h2>
                    <p className="m-0 line-clamp-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{post.excerpt}</p>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {post.author.name}
                      {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : !isLoading && !error && savedPosts.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
              {savedPosts.map((post) => (
                <PostCard key={post.id} post={post} variant="default" />
              ))}
            </div>
          ) : null}
    </div>
  );
}

function SavedCollectionStatus({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p role="status" className="m-0 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="text-sm font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
