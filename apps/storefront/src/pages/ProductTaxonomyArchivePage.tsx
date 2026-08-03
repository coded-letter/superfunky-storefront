import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PaginableProductGrid, Seo, ViewSwitch } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { HeroMock, type HeroVariant } from "../components/HeroMock";
import { useIncrementalData } from "../lib/incrementalData";
import { useStorefrontPath } from "../lib/storefrontPaths";
import {
  getProductArchive,
  type CmsProductArchive,
  type CommerceTaxonomy,
  type CommerceTaxonomyIdentifierType,
} from "../lib/commerce";
import { ARCHIVE_HERO_OPTIONS, ArchiveDescriptionSection } from "./shared";

const TAXONOMY_URI_PREFIX: Record<CommerceTaxonomy, string> = {
  category: "/product-category/",
  tag: "/product-tag/",
  brand: "/brand/",
};

export function ProductTaxonomyArchivePage({ taxonomy }: { taxonomy: CommerceTaxonomy }) {
  const { pathname } = useLocation();
  const { slug = "" } = useParams();
  const isCanonicalUri = pathname.startsWith(TAXONOMY_URI_PREFIX[taxonomy]);
  const identifier = isCanonicalUri ? withTrailingSlash(pathname) : slug;
  const idType: CommerceTaxonomyIdentifierType = isCanonicalUri ? "URI" : "SLUG";
  const { data: archive, isLoading, error } = useIncrementalData(
    `product-${taxonomy}:${idType}:${identifier}`,
    () => getProductArchive(taxonomy, identifier, idType),
  );

  if (isLoading) return <ContentLoadingState label="Loading product archive" />;
  if (error) return <ArchiveStatus title="Archive unavailable" message={error.message} />;
  if (!archive) {
    return (
      <ArchiveStatus
        title={`Product ${taxonomy} not found`}
        message={`WooCommerce has no published ${taxonomy} matching “${identifier}”.`}
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
  const [heroVariant, setHeroVariant] = useState<HeroVariant>(archive.taxonomy === "category" ? "split" : "minimal");
  const shopPath = useStorefrontPath("shop", "/shop");
  const taxonomyLabel = TAXONOMY_LABELS[archive.taxonomy];
  const title = archive.taxonomy === "tag" ? `#${archive.name}` : archive.name;
  const description = stripHtml(archive.descriptionHtml) ||
    `Browse products in the ${archive.name} ${archive.taxonomy}.`;

  return (
    <div className="grid gap-8">
      <Seo
        title={archive.seo.title || title}
        description={archive.seo.description || archive.seo.opengraphDescription || description}
        canonical={archive.seo.canonical || archive.seo.opengraphUrl || archive.uri}
        languageCode="pl"
        keywords={archive.seo.keywords || undefined}
        siteName={archive.seo.siteName || undefined}
        appendSiteName={false}
        robots={archive.seo.robots}
        opengraphType="website"
        opengraphTitle={archive.seo.opengraphTitle || title}
        opengraphDescription={archive.seo.opengraphDescription || description}
        opengraphImage={archive.seo.opengraphImage || archive.imageUrl || undefined}
        twitterTitle={archive.seo.twitterTitle || undefined}
        twitterDescription={archive.seo.twitterDescription || undefined}
        schema={{ pageType: archive.seo.pageType || "CollectionPage" }}
        breadcrumbs={archive.seo.breadcrumbs}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop", href: shopPath }, { label: title }]} includeStructuredData={false} />

      <div className="grid gap-3">
        <ViewSwitch label="Hero layout" value={heroVariant} onChange={setHeroVariant} options={ARCHIVE_HERO_OPTIONS} />
        <HeroMock
          variant={heroVariant}
          headingLevel="h1"
          kicker={taxonomyLabel}
          title={title}
          description={description}
          image={archive.imageUrl || undefined}
          secondaryCta={{ label: "All products", href: shopPath }}
        />
      </div>

      {archive.siblings.length ? (
        <nav aria-label={`Product ${archive.taxonomy} archives`} className="flex flex-wrap gap-2">
          {archive.siblings.map((term) => (
            <Link
              key={term.id}
              to={term.uri}
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
          cardVariant="default"
          gridVariant="standard"
        />
      ) : (
        <section className="grid gap-3 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">No products yet</h2>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            WooCommerce currently has no published products assigned to this {archive.taxonomy}.
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

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
