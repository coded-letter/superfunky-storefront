import { useRef } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { normalizeLanguagePath, PaginableProductGrid, Seo, useLanguage, useLayoutPreferences, useT } from "@funky/ui";
import { Breadcrumbs, seoBreadcrumbsToItems } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { HeroMock } from "../components/HeroMock";
import { useIncrementalData } from "@funky/sdk/react";
import { useStorefrontPath } from "../lib/storefrontPaths";
import {
  getProductArchive,
  type CmsProductArchive,
  type CommerceTaxonomy,
} from "../lib/commerce";
import {
  resolveTaxonomyArchiveIdentifier,
  taxonomyEmptyMessage,
  taxonomyNotFoundMessage,
} from "../lib/taxonomyRoutes";
import { ArchiveDescriptionSection } from "./shared";
import { useCanonicalContentLanguage } from "../lib/useCanonicalContentLanguage";

export function ProductTaxonomyArchivePage({ taxonomy }: { taxonomy: CommerceTaxonomy }) {
  const t = useT();
  const { pathname } = useLocation();
  const { slug } = useParams();
  const { languageCode, languageBackendCode } = useLanguage();
  const lastResolvedArchive = useRef<CmsProductArchive | null>(null);
  const currentIdentifier = resolveTaxonomyArchiveIdentifier(pathname, slug);
  const { data: archive, isLoading, isRevalidating, error } = useIncrementalData(
    `product-${taxonomy}:${currentIdentifier.idType}:${currentIdentifier.identifier}:${languageCode}`,
    () => getProductArchive(
      taxonomy,
      currentIdentifier.identifier,
      currentIdentifier.idType,
      languageCode,
      languageBackendCode,
    ),
  );
  if (archive) lastResolvedArchive.current = archive;

  useCanonicalContentLanguage(
    archive?.languageCode || lastResolvedArchive.current?.languageCode,
    archive?.translations || lastResolvedArchive.current?.translations || [],
    pathname,
    !isLoading && !isRevalidating,
    true,
    archive?.uri || lastResolvedArchive.current?.uri,
  );

  if (isLoading) return <ContentLoadingState label="Loading product archive" />;
  if (error) return <ArchiveStatus title={t("error.archive_unavailable")} message="This collection is temporarily unavailable." />;
  if (!archive) {
    return (
      <ArchiveStatus
        title={`Product ${taxonomy} not found`}
        message={taxonomyNotFoundMessage(taxonomy)}
      />
    );
  }

  return <ProductTaxonomyArchive archive={archive} />;
}

const TAXONOMY_LABELS: Record<CommerceTaxonomy, string> = {
  category: "Category",
  tag: "Tag",
  brand: "Brand",
};

function ProductTaxonomyArchive({ archive }: { archive: CmsProductArchive }) {
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const {
    productArchiveHeroLayout: heroVariant,
    shopProductCardVariant,
    showArchiveDescriptionInHero,
  } = useLayoutPreferences();
  const isFullBleed = heroVariant === "fullbleed";
  const shopPath = useStorefrontPath("shop", "/shop");
  const taxonomyLabel = TAXONOMY_LABELS[archive.taxonomy];
  const brandDirectoryPath = normalizeLanguagePath("/product-brand", languageCode, configuredLanguageCodes);
  const localizedArchiveUri = normalizeLanguagePath(archive.uri, languageCode, configuredLanguageCodes);
  const title = archive.taxonomy === "tag" ? `#${archive.name}` : archive.name;
  const description = stripHtml(archive.descriptionHtml) ||
    `Browse products in the ${archive.name} ${archive.taxonomy}.`;
  const breadcrumbs = seoBreadcrumbsToItems(
    archive.seo.breadcrumbs,
    [
      { label: "Home", href: "/" },
      { label: "Shop", href: shopPath },
      ...(archive.taxonomy === "brand" ? [{ label: "Product brands", href: brandDirectoryPath }] : []),
      { label: title },
    ],
  );

  return (
    <div className={`grid gap-8 ${isFullBleed ? "relative" : ""}`}>
      <Seo
        title={archive.seo.title || title}
        description={archive.seo.description || archive.seo.opengraphDescription || description}
        canonical={archive.seo.canonical || archive.seo.opengraphUrl || localizedArchiveUri}
        languageCode={languageCode}
        keywords={archive.seo.keywords || undefined}
        siteName={archive.seo.siteName || undefined}
        appendSiteName={false}
        robots={archive.seo.robots}
        opengraphType="website"
        opengraphTitle={archive.seo.opengraphTitle || title}
        opengraphDescription={archive.seo.opengraphDescription || description}
        image={archive.imageUrl
          ? { url: archive.imageUrl, alt: archive.name }
          : archive.seo.opengraphImage
            ? { url: archive.seo.opengraphImage, alt: archive.name }
            : undefined}
        twitterTitle={archive.seo.twitterTitle || undefined}
        twitterDescription={archive.seo.twitterDescription || undefined}
        schema={{ pageType: archive.seo.pageType || "CollectionPage" }}
        breadcrumbs={archive.seo.breadcrumbs}
      />
      <div className={isFullBleed ? "absolute left-0 top-4 z-20 text-white [&_a]:text-white/80 [&_span]:text-white/70" : ""}>
        <Breadcrumbs items={breadcrumbs} includeStructuredData={false} />
      </div>

      <div className="grid gap-3">
        <HeroMock
          variant={heroVariant}
          headingLevel="h1"
          kicker={taxonomyLabel}
          title={title}
          description={showArchiveDescriptionInHero ? description : undefined}
          image={archive.imageUrl || undefined}
          fullWidth={isFullBleed}
          secondaryCta={archive.taxonomy === "brand"
            ? { label: "All brands", href: brandDirectoryPath }
            : { label: "All products", href: shopPath }}
        />
      </div>

      {archive.siblings.length ? (
        <nav aria-label={`Product ${archive.taxonomy} archives`} className="flex flex-wrap gap-2">
          {archive.siblings.map((term) => (
            <Link
              key={term.id}
              to={normalizeLanguagePath(term.uri, languageCode, configuredLanguageCodes)}
              className={`rounded-full px-4 py-2 text-sm font-medium no-underline transition ${
                term.id === archive.id
                  ? "bg-brand-gradient text-white shadow-glow"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {archive.taxonomy === "tag" ? "#" : ""}{term.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {archive.products.length ? (
        <PaginableProductGrid
          title={`${title} products`}
          products={archive.products}
          pageSize={6}
          cardVariant={shopProductCardVariant}
          gridVariant="standard"
        />
      ) : (
        <section className="grid gap-3 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">No products yet</h2>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {taxonomyEmptyMessage(archive.taxonomy)}
          </p>
        </section>
      )}

      {archive.descriptionHtml ? (
        <ArchiveDescriptionSection
          eyebrow={taxonomyLabel}
          title={title}
          image={archive.imageUrl || undefined}
          html={archive.descriptionHtml}
        />
      ) : null}
    </div>
  );
}

function ArchiveStatus({ title, message }: { title: string; message: string }) {
  const shopPath = useStorefrontPath("shop", "/shop");
  return (
    <section className="mx-auto grid max-w-2xl gap-4 py-20 text-center">
      <h1 className="m-0 font-display text-3xl font-bold text-zinc-950 dark:text-zinc-50">{title}</h1>
      <p className="m-0 text-zinc-600 dark:text-zinc-400">{message}</p>
      <Link to={shopPath} className="mx-auto rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white no-underline">Browse the shop</Link>
    </section>
  );
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
