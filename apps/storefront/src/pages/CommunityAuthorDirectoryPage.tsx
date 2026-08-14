import { Link } from "react-router-dom";
import { ResponsiveImage, avatarColorFor, useLanguage } from "@funky/ui";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getCommunityArchiveData } from "../lib/community";
import { useIncrementalData } from "@funky/sdk/react";
import { ArchiveDirectory, ArchiveDirectoryStatus } from "./ArchiveDirectory";

export function CommunityAuthorDirectoryPage() {
  const { languageCode, languageBackendCode } = useLanguage();
  const { data, isLoading, error } = useIncrementalData(
    `community-archive-data:v1:${languageCode}`,
    () => getCommunityArchiveData(languageBackendCode),
  );

  if (isLoading) return <ContentLoadingState label="Loading community authors" />;
  if (error) {
    return <ArchiveDirectoryStatus title="Community authors unavailable" message={error.message} href="/community" linkLabel="Back to community" isError />;
  }

  const authors = data?.authors || [];
  return (
    <ArchiveDirectory
      title="Community authors"
      kicker="Creators and collaborators"
      description="Discover public Superfunky creators and collaborators who publish community content."
      canonical="/community-author"
      parent={{ label: "Community", href: "/community" }}
      count={authors.length}
    >
      {authors.length ? (
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((author) => (
            <li key={author.databaseId}>
              <Link to={`/community/${author.handle}`} className="grid h-full grid-cols-[auto_1fr] items-center gap-4 rounded-3xl border border-zinc-200 bg-white p-5 text-inherit no-underline shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700">
                {author.avatarUrl ? (
                  <ResponsiveImage src={author.avatarUrl} alt="" sizes="4rem" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: avatarColorFor(author.displayName) }}>
                    {initials(author.displayName)}
                  </span>
                )}
                <span className="grid min-w-0 gap-1">
                  <strong className="truncate font-display text-lg text-zinc-900 dark:text-zinc-100">{author.displayName}</strong>
                  <span className="text-xs font-semibold capitalize text-brand-600 dark:text-brand-400">{author.role}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">@{author.handle}</span>
                  {author.bio ? <span className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{author.bio}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ArchiveDirectoryStatus title="No community authors yet" message="No public creators or collaborators are currently available." href="/community" linkLabel="Browse community posts" />
      )}
    </ArchiveDirectory>
  );
}

function initials(value: string): string {
  return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
