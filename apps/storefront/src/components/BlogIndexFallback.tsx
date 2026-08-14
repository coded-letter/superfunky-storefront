import { PaginablePostGrid } from "@funky/ui";
import { useBlogData } from "../state/blogData";
import { ContentLoadingState } from "./ContentLoadingState";

export function BlogIndexFallback() {
  const { data, isLoading, error } = useBlogData();

  return (
    <section className="grid gap-6" data-storefront-blog-index>
      <header className="grid gap-2">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
          Journal
        </p>
        <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Latest posts
        </h1>
      </header>
      {isLoading || (!data && !error) ? <ContentLoadingState compact label="Loading posts" /> : null}
      {error ? (
        <p role="alert" className="m-0 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error.message}
        </p>
      ) : null}
      {data?.posts.length ? (
        <PaginablePostGrid
          title="All posts"
          posts={data.posts}
          pageSize={12}
          cardVariant="default"
          gridVariant="standard"
        />
      ) : null}
      {data && !data.posts.length ? (
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">No published posts are available yet.</p>
      ) : null}
    </section>
  );
}
