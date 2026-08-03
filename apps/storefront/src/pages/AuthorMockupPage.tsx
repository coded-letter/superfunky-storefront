import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, User } from "lucide-react";
import { PaginablePostGrid, ResponsiveImage, Seo, useLanguage } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getAuthorArchive } from "../lib/authors";
import { useIncrementalData } from "../lib/incrementalData";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { stringToHSL } from "./CommentThread";
import { NotFoundMockupPage } from "./NotFoundMockupPage";

export function AuthorMockupPage() {
  const { slug = "", language: routeLanguage } = useParams();
  const [searchParams] = useSearchParams();
  const { languageCode, languageOptions, syncLanguageCode } = useLanguage();
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

  return (
    <div className="grid gap-8">
      <Seo
        title={`${author.name} — Author`}
        description={author.bio || `Published ${author.languageCode.toUpperCase()} articles by ${author.name}.`}
        canonical={author.uri || undefined}
        languageCode={author.languageCode}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog", href: blogPath }, { label: author.name }]} />

      <header className="grid gap-6 rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-brand-50 to-white p-8 shadow-soft dark:border-zinc-800 dark:from-brand-950/30 dark:to-zinc-950 sm:p-10">
        <Link
          to={blogPath}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 no-underline transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All posts
        </Link>

        <div className="flex flex-wrap items-center gap-5 sm:flex-nowrap">
          {author.avatarUrl ? (
            <ResponsiveImage src={author.avatarUrl} alt="" priority sizes="5rem" className="h-20 w-20 shrink-0 rounded-full object-cover shadow-glow" />
          ) : (
            <span
              className="inline-grid h-20 w-20 shrink-0 place-items-center rounded-full text-2xl font-semibold text-white shadow-glow"
              style={{ backgroundColor: stringToHSL(author.name) }}
              aria-hidden="true"
            >
              {initials}
            </span>
          )}
          <div className="grid gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              Author · {author.languageCode.toUpperCase()}
            </span>
            <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-4xl">{author.name}</h1>
            {author.bio ? <p className="m-0 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">{author.bio}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {author.posts.length} {author.languageCode.toUpperCase()} article{author.posts.length === 1 ? "" : "s"} published
          </span>
          {author.posts.length ? (
            <a
              href="#author-articles"
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
            >
              Read all articles
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </header>

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
  return (
    <section className="mx-auto grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link to={blogPath} className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        Back to blog
      </Link>
    </section>
  );
}
