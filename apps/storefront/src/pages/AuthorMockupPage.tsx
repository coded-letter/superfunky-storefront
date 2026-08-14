import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PaginablePostGrid, ProfileHeader, ProfileStat, Seo, useLanguage, useLayoutPreferences } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getAuthorArchive } from "../lib/authors";
import { useIncrementalData } from "@funky/sdk/react";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { stringToHSL } from "./CommentThread";
import { NotFoundMockupPage } from "./NotFoundMockupPage";

export function AuthorMockupPage() {
  const { slug = "", language: routeLanguage } = useParams();
  const [searchParams] = useSearchParams();
  const { languageCode, languageOptions, syncLanguageCode } = useLanguage();
  const { authorProfileHeaderLayout: headerLayout } = useLayoutPreferences();
  const blogPath = useStorefrontPath("blog", "/blog");
  const queryLanguage = searchParams.get("lang");
  const explicitLanguage = languageOptions.some(({ code }) => code === routeLanguage)
    ? routeLanguage
    : languageOptions.some(({ code }) => code === queryLanguage)
      ? queryLanguage
      : null;
  const requestedLanguage = explicitLanguage || languageCode;
  const requestedBackendLanguage = languageOptions.find(({ code }) => code === requestedLanguage)?.backendCode;
  const { data: author, isLoading, error } = useIncrementalData(
    `author:${slug}:${requestedLanguage}:${requestedBackendLanguage}`,
    () => getAuthorArchive(slug, requestedBackendLanguage || requestedLanguage.toUpperCase()),
  );

  useEffect(() => {
    if (explicitLanguage) syncLanguageCode(explicitLanguage);
  }, [explicitLanguage, syncLanguageCode]);

  if (isLoading) return <ContentLoadingState label="Loading author" />;
  if (error) return <AuthorStatus title="Author unavailable" message={error.message} />;
  if (!author) return <NotFoundMockupPage />;

  const initials = author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const backLinkNode = (
    <Link
      to="/author"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 no-underline transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All authors
    </Link>
  );

  const actionsNode = author.posts.length ? (
    <a
      href="#author-articles"
      className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
    >
      Read all articles
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
  ) : null;

  return (
    <div className="grid gap-8">
      <Seo
        title={`${author.name} — Author`}
        description={author.bio || `Published ${author.languageCode.toUpperCase()} articles by ${author.name}.`}
        canonical={author.uri || undefined}
        languageCode={author.languageCode}
        image={author.avatarUrl ? { url: author.avatarUrl, alt: author.name } : undefined}
        opengraphAuthor={author.name}
        schema={{ pageType: "ProfilePage", personName: author.name }}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog", href: blogPath }, { label: "Authors", href: "/author" }, { label: author.name }]} />

      {/* Shared with `CommunityProfileMockupPage` — the six variants below are the same
          markup, only rendered through the backend-selected `authorProfileHeaderLayout`. */}
      <ProfileHeader
        layout={headerLayout}
        displayName={author.name}
        initials={initials}
        avatarColor={stringToHSL(author.name)}
        avatarUrl={author.avatarUrl}
        coverUrl={author.coverUrl}
        subtitle={`Author · ${author.languageCode.toUpperCase()}`}
        bio={author.bio}
        actions={actionsNode}
        stats={<ProfileStat value={author.posts.length} label="Articles" />}
        backLink={backLinkNode}
      />

      {!author.posts.length ? (
        <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No published posts for this author in {author.languageCode.toUpperCase()}.
        </p>
      ) : (
        <div id="author-articles" className="scroll-mt-28">
          <PaginablePostGrid
            title={`Articles by ${author.name}`}
            posts={author.posts}
            pageSize={6}
            cardVariant="default"
            gridVariant="standard"
          />
        </div>
      )}
    </div>
  );
}

function AuthorStatus({ title, message }: { title: string; message: string }) {
  const blogPath = useStorefrontPath("blog", "/blog");
  return (
    <section className="mx-auto mt-16 grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link to="/author" className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        Browse all authors
      </Link>
    </section>
  );
}
