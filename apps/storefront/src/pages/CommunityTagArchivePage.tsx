import { useParams } from "react-router-dom";
import { Seo, SocialFeedGrid, useLanguage } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getCommunityArchiveData } from "../lib/community";
import { useIncrementalData } from "@funky/sdk/react";
import { ArchiveDirectoryStatus } from "./ArchiveDirectory";
import { NotFoundMockupPage } from "./NotFoundMockupPage";

export function CommunityTagArchivePage() {
  const { slug = "" } = useParams();
  const { languageCode, languageBackendCode } = useLanguage();
  const { data, isLoading, error } = useIncrementalData(
    `community-archive-data:v1:${languageCode}`,
    () => getCommunityArchiveData(languageBackendCode),
  );

  if (isLoading) return <ContentLoadingState label="Loading community tag" />;
  if (error) {
    return <ArchiveDirectoryStatus title="Community tag unavailable" message={error.message} href="/community-tag" linkLabel="Browse all community tags" isError />;
  }

  const tag = data?.tags.find((entry) => entry.slug === slug);
  if (!tag) return <NotFoundMockupPage />;
  const posts = data?.posts.filter((post) => post.tagSlugs.includes(tag.slug)) || [];
  const description = `Browse ${tag.postCount} published community ${tag.postCount === 1 ? "post" : "posts"} tagged #${tag.name}.`;

  return (
    <div className="grid gap-8">
      <Seo
        title={`#${tag.name} — Community tag`}
        description={description}
        canonical={`/community-tag/${tag.slug}`}
        languageCode={languageCode}
        schema={{ pageType: "CollectionPage" }}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Community", href: "/community" },
          { label: "Community tags", href: "/community-tag" },
          { label: `#${tag.name}` },
        ]}
      />
      <header className="grid gap-3 rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-brand-50 to-white p-8 shadow-soft dark:border-zinc-800 dark:from-brand-950/30 dark:to-zinc-950 sm:p-10">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">Community tag</span>
        <h1 className="m-0 font-display text-4xl font-bold text-zinc-900 dark:text-zinc-100">#{tag.name}</h1>
        <p className="m-0 max-w-2xl text-zinc-600 dark:text-zinc-300">{description}</p>
      </header>
      <SocialFeedGrid
        title={`Tagged #${tag.name}`}
        subtitle={`${posts.length} ${posts.length === 1 ? "post" : "posts"} from ${new Set(posts.map((post) => post.author.handle)).size} public profiles`}
        posts={posts}
        pageSize={12}
        defaultLayout="grid-3"
      />
    </div>
  );
}
