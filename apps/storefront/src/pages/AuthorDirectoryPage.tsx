import { Link } from "react-router-dom";
import { ResponsiveImage, avatarColorFor, useLanguage, useT } from "@funky/ui";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getBlogAuthorDirectory } from "../lib/blog";
import { useIncrementalData } from "@funky/sdk/react";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { ArchiveDirectory, ArchiveDirectoryStatus } from "./ArchiveDirectory";

export function AuthorDirectoryPage() {
  const t = useT();
  const { languageCode, languageBackendCode } = useLanguage();
  const blogPath = useStorefrontPath("blog", "/blog");
  const { data: authors, isLoading, error } = useIncrementalData(
    `blog-author-directory:v1:${languageCode}`,
    () => getBlogAuthorDirectory(languageBackendCode),
  );

  if (isLoading) return <ContentLoadingState label={t("loading.authors")} />;
  if (error) {
    return <ArchiveDirectoryStatus title={t("error.authors_unavailable")} message={error.message} href={blogPath} linkLabel={t("archive.back_to_blog")} isError />;
  }

  const entries = authors || [];
  return (
    <ArchiveDirectory
      title={t("archive.authors_title")}
      kicker={t("archive.authors_kicker")}
      description={t("archive.authors_description", { language: languageCode.toUpperCase() })}
      canonical="/author"
      parent={{ label: t("nav.blog"), href: blogPath }}
      count={entries.length}
    >
      {entries.length ? (
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((author) => (
            <li key={author.id}>
              <Link to={author.uri || `/author/${author.slug}`} className="grid h-full grid-cols-[auto_1fr] items-center gap-4 rounded-3xl border border-zinc-200 bg-white p-5 text-inherit no-underline shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700">
                {author.avatarUrl ? (
                  <ResponsiveImage src={author.avatarUrl} alt="" sizes="4rem" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: avatarColorFor(author.name) }}>
                    {initials(author.name)}
                  </span>
                )}
                <span className="grid min-w-0 gap-1">
                  <strong className="truncate font-display text-lg text-zinc-900 dark:text-zinc-100">{author.name}</strong>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{t("archive.author_article_count", { count: author.postCount })}</span>
                  {author.bio ? <span className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{author.bio}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ArchiveDirectoryStatus title={t("archive.no_authors")} message={t("archive.no_authors_message", { language: languageCode.toUpperCase() })} href={blogPath} linkLabel={t("archive.browse_stories")} />
      )}
    </ArchiveDirectory>
  );
}

function initials(value: string): string {
  return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
