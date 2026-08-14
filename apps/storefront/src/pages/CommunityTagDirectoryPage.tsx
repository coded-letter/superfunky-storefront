import { Link } from "react-router-dom";
import { useLanguage } from "@funky/ui";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getCommunityArchiveData } from "../lib/community";
import { useIncrementalData } from "@funky/sdk/react";
import { ArchiveDirectory, ArchiveDirectoryStatus } from "./ArchiveDirectory";

export function CommunityTagDirectoryPage() {
  const { languageCode, languageBackendCode } = useLanguage();
  const { data, isLoading, error } = useIncrementalData(
    `community-archive-data:v1:${languageCode}`,
    () => getCommunityArchiveData(languageBackendCode),
  );

  if (isLoading) return <ContentLoadingState label="Loading community tags" />;
  if (error) {
    return <ArchiveDirectoryStatus title="Community tags unavailable" message={error.message} href="/community" linkLabel="Back to community" isError />;
  }

  const tags = data?.tags || [];
  return (
    <ArchiveDirectory
      title="Community tags"
      kicker="Explore by topic"
      description={`Browse every tag used by published ${languageCode.toUpperCase()} community posts.`}
      canonical="/community-tag"
      parent={{ label: "Community", href: "/community" }}
      count={tags.length}
    >
      {tags.length ? (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <li key={tag.slug}>
              <Link to={`/community-tag/${tag.slug}`} className="flex h-full items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-inherit no-underline shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700">
                <strong className="font-display text-lg text-zinc-900 dark:text-zinc-100">#{tag.name}</strong>
                <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                  {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ArchiveDirectoryStatus title="No community tags yet" message="No tags are assigned to published community posts." href="/community" linkLabel="Browse community posts" />
      )}
    </ArchiveDirectory>
  );
}
